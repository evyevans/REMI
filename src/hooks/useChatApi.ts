/**
 * useChatApi — Hook for calling the Oracle Chat API
 *
 * PHASE 4 REWRITE: Reads from Zustand store at call time,
 * eliminating stale closure race conditions.
 *
 * Key architectural change: `sendMessage` no longer closes over
 * `currentMarket` — it reads `useMarketStore.getState()` synchronously
 * at invocation time, guaranteeing the latest geographic context.
 */

import { useCallback, useState } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { useJobStore, type AnalysisType } from '../stores/jobStore';
import type { GeographicCascade } from '../stores/marketStore';
import { buildChatPayload } from '../services/chatService';
import type { ChatResponse } from '../types';
import { DEMO_MODE, getMockChatResponse, demoDelay } from '../demo/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Smart fallback for when backend is offline ──────────── */

function generateFallbackResponse(query: string, cascade: GeographicCascade): ChatResponse {
  const locationName = cascade.neighborhood?.name 
    ? `${cascade.neighborhood.name}, ${cascade.city?.name}` 
    : cascade.city?.name 
      ? `${cascade.city.name}, ${cascade.state?.abbr}`
      : cascade.state?.name || 'your selected region';

  return {
    text: `**Connection Issue**

I wasn't able to reach the backend services for **${locationName}** just now.

Please check that your backend server is running on port 8000, then try again.`,
    actions: [
      { type: 'ask_followup', label: 'Retry Request', data: { prompt: query } }
    ],
    source: 'System',
  };
}

/* ═══ MAIN HOOK ══════════════════════════════════════════ */

interface UseChatApiOptions {
  sessionId?: string;
}

interface UseChatApiReturn {
  sendMessage: (content: string, analysisType?: string) => Promise<ChatResponse>;
  isLoading: boolean;
  error: string | null;
  apiAvailable: boolean;
}

export function useChatApi(options: UseChatApiOptions = {}): UseChatApiReturn {
  const { sessionId = 'default' } = options;
  // NOTE: We DO NOT read currentMarket here. We read it at call time inside sendMessage.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  const sendMessage = useCallback(async (content: string, analysisType?: string): Promise<ChatResponse> => {
    // ── Demo mode: return a canned, keyword-routed Austin answer ──
    if (DEMO_MODE) {
      setIsLoading(true);
      setError(null);
      await demoDelay(1200);
      setIsLoading(false);
      setApiAvailable(true);
      return getMockChatResponse(content);
    }
    // ══════════════════════════════════════════════════════
    // PHASE 4 FIX: Read from Zustand at CALL TIME
    // This eliminates the stale closure race condition.
    // getState() is synchronous and always returns the latest value,
    // regardless of React's render cycle.
    // ══════════════════════════════════════════════════════
    const storeState = useMarketStore.getState();
    const market = storeState.getCurrentMarket();
    const cascade = storeState.cascade;
    const isHydrated = storeState.isHydrated;

    // Preflight gate: block requests if store isn't ready
    if (!isHydrated) {
      console.warn('[useChatApi] Store not hydrated yet. Blocking request.');
      return {
        text: '⏳ Please wait — loading your saved location preferences...',
        actions: [],
        confidence: 0,
        source: 'System',
      };
    }

    if (!market) {
      console.warn('[useChatApi] No market selected. Blocking request.');
      return {
        text: '📍 **Please select a location first.**\n\nUse the location selector at the top of the page to choose a State → City → Neighborhood before requesting market intelligence.',
        actions: [],
        confidence: 0,
        source: 'System',
      };
    }

    setIsLoading(true);
    setError(null);

    // 120 second timeout — allows the multi-agent backend enough time to scrape sequentially and LLM synthesize
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const payload = buildChatPayload(content, sessionId, market, analysisType);

      const res = await fetch(`${API_BASE}/api/oracle/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();

      // Bridge oracle.py response shape → ChatResponse shape
      const rawButtons: Array<{ label: string; url?: string; action?: string }> =
        data.buttons || [];

      const mappedActions = rawButtons.map((btn) => ({
        type: btn.action === 'browse_properties' ? 'view_on_map'
            : btn.action === 'search_similar'    ? 'view_on_map'
            : btn.action === 'reset'             ? 'ask_followup'
            : btn.action === 'market_insights'   ? 'run_comps'
            : btn.url                            ? 'view_on_map'
            : 'ask_followup',
        label: btn.label,
        data: btn.url ? { url: btn.url } : undefined,
      }));

      const chatResponse: ChatResponse = {
        text: data.text || data.output || data.message || 'No response from Oracle.',
        actions: data.suggestedActions || data.actions || mappedActions,
        propertyIds: data.propertyIds,
        regionIds: data.regionIds,
        mapHighlights: data.mapHighlights,
        confidence: data.confidence ?? 0.9,
        source: data.source || 'Team Leader',
        jobId: data.job_id,
        analysisType: analysisType || 'comprehensive',
      };

      // ══════════════════════════════════════════════════════
      // Map ↔ Chat Communion (Step 2.1)
      // Register job in jobStore after successful API response
      // ══════════════════════════════════════════════════════
      if (data.job_id) {
        useJobStore.getState().registerJob({
          jobId: data.job_id,
          marketSlug: market.id,
          analysisType: (analysisType as AnalysisType) || 'comprehensive',
          status: 'scanning',
          propertiesFound: 0,
          propertiesExpected: data.expected_count || null,
          startedAt: new Date().toISOString(),
          completedAt: null,
          error: null,
          failure_reason: null,
        });

        // ══════════════════════════════════════════════════════
        // Frontend Polling/Wait Timeout (70 second safety net)
        // ══════════════════════════════════════════════════════
        setTimeout(() => {
          const job = useJobStore.getState().jobs[data.job_id];
          if (job && !['complete', 'failed', 'partial_success'].includes(job.status)) {
             useJobStore.getState().failJob(
               data.job_id, 
               "This market is taking longer than expected. Try narrowing your search area or adding price/bedroom filters."
             );
          }
        }, 70_000);
      }

      setApiAvailable(true);
      return chatResponse;

    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = (err as Error).name === 'AbortError';
      console.warn(`[useChatApi] ${isTimeout ? 'Timeout' : 'API error'}, using fallback:`, err);
      setApiAvailable(false);

      // Graceful fallback: smart mock that mimics real API shape
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
      return generateFallbackResponse(content, cascade);

    } finally {
      setIsLoading(false);
    }
  }, [sessionId]); // ← NO market in dependency array. Read at call time.

  return { sendMessage, isLoading, error, apiAvailable };
}
