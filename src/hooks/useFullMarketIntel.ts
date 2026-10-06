/**
 * useFullMarketIntel — data fetching hook for full_market_intel table.
 *
 * Fetches records from GET /api/full-market-intel scoped to the current
 * market. Returns records, loading state, error state, and a runAgents
 * function that triggers the manual AI analysis pipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMarket } from '../stores/marketStore';
import { DEMO_MODE, MOCK_FULL_MARKET_INTEL } from '../demo/mockData';

// ── Types ─────────────────────────────────────────────────────

export type AgentButtonState = 'idle' | 'running' | 'complete' | 'partial' | 'error';

export type FullMarketIntelRecord = {
  id: string;
  property_address: string;
  city: string;
  state_province: string;
  market_slug: string;
  market_context: string;
  country: string;

  property_price: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listing_url: string | null;

  // Tier 1 — AI generated
  market_position: string | null;
  investment_score: number | null;

  // Manual classification
  priority_level: string | null;
  opportunity_type: string | null;

  // Tier 2 — AI generated
  comparable_analysis: string | null;
  buyer_profile_match: string | null;
  seller_opportunity_analysis: string | null;
  market_insights: string | null;
  client_action_items: string | null;

  // Tier 3 — Executive synthesis
  ai_notes: string | null;

  // Metadata
  analysis_date: string | null;
  status: string;
  notes: string | null;
  is_test_record: boolean;
  agents_status: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type FmiFilters = {
  status?: string;
  priority_level?: string;
  opportunity_type?: string;
  min_investment_score?: number;
};

// ── Agent status helpers ────────────────────────────────────────

const AGENT_KEYS = [
  'market_position',
  'investment_score',
  'comparable_analysis',
  'buyer_profile_match',
  'seller_opportunity_analysis',
  'market_insights',
  'client_action_items',
  'ai_notes',
] as const;

export function deriveButtonState(agents_status: Record<string, string> | null | undefined): AgentButtonState {
  if (!agents_status || Object.keys(agents_status).length === 0) return 'idle';

  const meta = agents_status['_status'];
  if (meta === 'complete') return 'complete';
  if (meta === 'error') return 'error';

  const values = AGENT_KEYS.map(k => agents_status[k]);
  const hasRunning = values.some(v => v === 'running');
  if (hasRunning) return 'running';

  const completed = values.filter(v => v === 'complete').length;
  const total = AGENT_KEYS.length;
  if (completed === total) return 'complete';
  if (completed > 0) return 'partial';

  return 'idle';
}

// ── API base URL ────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// ── Hook ────────────────────────────────────────────────────────

export function useFullMarketIntel(filters: FmiFilters = {}) {
  if (DEMO_MODE) {
    return {
      records: MOCK_FULL_MARKET_INTEL,
      loading: false,
      error: null as string | null,
      runningIds: new Set<string>(),
      runningAgents: new Set<string>(),
      refetch: async () => {},
      runAgents: async (_recordId: string) => {},
      runAgent: async (_recordId: string, _agentName: string) => {},
    };
  }
  const { currentMarket } = useMarket();

  const [records, setRecords] = useState<FullMarketIntelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track per-record running state for the Run Analysis button
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch records ─────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    if (!currentMarket?.id || !currentMarket?.city) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    setError(null);

    try {
      const marketSlug = currentMarket.id;
      const marketContext = currentMarket.city
        + (currentMarket.state_province ? `, ${currentMarket.state_province}` : '');

      const params = new URLSearchParams({
        market_context: marketContext,
        market_slug: marketSlug,
        limit: '200',
        offset: '0',
      });

      if (filters.status) params.set('status', filters.status);
      if (filters.priority_level) params.set('priority_level', filters.priority_level);
      if (filters.opportunity_type) params.set('opportunity_type', filters.opportunity_type);
      if (filters.min_investment_score != null) {
        params.set('min_investment_score', String(filters.min_investment_score));
      }

      const res = await fetch(`${API_BASE}/api/full-market-intel?${params}`, {
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setRecords(data.records ?? []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message ?? 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [
    currentMarket?.id,
    currentMarket?.city,
    currentMarket?.state_province,
    filters.status,
    filters.priority_level,
    filters.opportunity_type,
    filters.min_investment_score,
  ]);

  useEffect(() => {
    fetchRecords();
    return () => abortRef.current?.abort();
  }, [fetchRecords]);

  // ── Track per-agent running state ────────────────────────────

  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());

  // ── Run all agents for a record ─────────────────────────────────

  const runAgents = useCallback(async (recordId: string): Promise<void> => {
    setRunningIds(prev => new Set(prev).add(recordId));

    // Optimistically mark agent statuses as running in local state
    setRecords(prev =>
      prev.map(r =>
        r.id === recordId
          ? { ...r, agents_status: { ...r.agents_status, _status: 'running' } }
          : r
      )
    );

    try {
      const res = await fetch(
        `${API_BASE}/api/full-market-intel/run-agents?record_id=${encodeURIComponent(recordId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      // Re-fetch to get latest AI-generated fields
      await fetchRecords();
    } catch (err: any) {
      // Mark as error in local state
      setRecords(prev =>
        prev.map(r =>
          r.id === recordId
            ? { ...r, agents_status: { ...r.agents_status, _status: 'error' } }
            : r
        )
      );
    } finally {
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  }, [fetchRecords]);

  // ── Run a specific agent for a record ───────────────────────────

  const runAgent = useCallback(
    async (recordId: string, agentName: string): Promise<void> => {
      const key = `${recordId}:${agentName}`;
      setRunningAgents(prev => new Set(prev).add(key));

      try {
        const res = await fetch(
          `${API_BASE}/api/full-market-intel/run-agents?record_id=${encodeURIComponent(recordId)}&agents=${encodeURIComponent(agentName)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }

        // Re-fetch to get latest AI-generated fields
        await fetchRecords();
      } catch (err: any) {
        // Log error but don't crash
        console.error(`Agent ${agentName} failed:`, err.message);
      } finally {
        setRunningAgents(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [fetchRecords]
  );

  return {
    records,
    loading,
    error,
    runningIds,
    runningAgents,
    refetch: fetchRecords,
    runAgents,
    runAgent,
  };
}
