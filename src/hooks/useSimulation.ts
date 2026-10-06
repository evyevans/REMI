/* ═══════════════════════════════════════════════════════════
   useSimulation — Durable simulation hook backed by simulationStore.

   All state lives in Zustand (simulationStore) and persists in
   Supabase (simulation_jobs table). No localStorage. Polling reads
   from Supabase via the backend, NOT from MiroFish directly.

   Navigation away does NOT kill the simulation — returning resumes
   from persisted state.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSimulationStore, type SimulationJob } from '../stores/simulationStore';
import { getOrCreateSessionId } from '../lib/auth-utils';
import { DEMO_MODE, MOCK_SIM_ESTIMATE, MOCK_SIM_REPORT, buildMockSimJob } from '../demo/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────
export interface SimulationTier {
  agents: number;
  rounds: number;
  description: string;
  estimated_minutes: number;
  estimated_cost_usd: number;
}

export interface SimulationReport {
  executive_summary: string;
  scenarios: Array<{ name: string; probability: number; description: string }>;
  key_dynamics: string[];
  persona_group_analysis: Record<string, { sentiment: string; narrative: string }>;
  actionable_insights: Record<string, string[]>;
  risk_factors: string[];
}

export interface CostEstimate {
  tier: string;
  agents: number;
  rounds: number;
  estimated_cost_usd: number;
  estimated_minutes: number;
  description: string;
  token_breakdown: {
    system_prompts: number;
    agent_interactions: number;
    report_synthesis: number;
    total: number;
  };
}

const TERMINAL_STATUSES = ['completed', 'failed'];
const POLL_INTERVAL_MS = 3_000;

// ── Hook ──────────────────────────────────────────────────────
export function useSimulation() {
  const activeJob = useSimulationStore((s) => s.activeJob);
  const setActiveJob = useSimulationStore((s) => s.setActiveJob);
  const updateProgress = useSimulationStore((s) => s.updateProgress);
  const clearActiveJob = useSimulationStore((s) => s.clearActiveJob);
  const hydrate = useSimulationStore((s) => s.hydrate);
  const deactivateJob = useSimulationStore((s) => s.deactivateJob);

  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Local UI state — doesn't survive navigation but triggers re-renders
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);

  // ── Hydrate on mount ──
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ── Start/stop polling based on activeJob ──
  useEffect(() => {
    if (!activeJob) {
      stopPolling();
      return;
    }
    if (TERMINAL_STATUSES.includes(activeJob.status)) {
      stopPolling();
      if (activeJob.status === 'completed' && activeJob.result_json) {
        setReport(activeJob.result_json as SimulationReport);
      }
      return;
    }
    // Non-terminal: start polling if not already
    if (!pollerRef.current) {
      startPolling(activeJob.id);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id, activeJob?.status]);

  function stopPolling() {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  }

  function startPolling(simId: string) {
    stopPolling();
    const sessionId = getOrCreateSessionId();

    pollerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/simulations/${simId}`, {
          headers: { 'x-session-id': sessionId },
        });
        if (!res.ok) return;

        const job = (await res.json()) as SimulationJob;

        updateProgress({
          status: job.status,
          progress_pct: job.progress_pct,
          current_round: job.current_round,
          total_rounds: job.total_rounds,
          sentiment: job.sentiment,
          completed_at: job.completed_at,
          error_message: job.error_message,
          result_json: job.result_json,
        });

        if (TERMINAL_STATUSES.includes(job.status)) {
          stopPolling();
          if (job.status === 'completed' && job.result_json) {
            setReport(job.result_json as SimulationReport);
          }
          if (job.status === 'failed') {
            setLocalError(job.error_message || 'Simulation failed');
          }
        }
      } catch {
        // Network error — keep polling, don't crash
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Get Cost Estimate ──
  const fetchEstimate = useCallback(async (tier: string) => {
    if (DEMO_MODE) {
      const est: CostEstimate = { ...MOCK_SIM_ESTIMATE, tier };
      setEstimate(est);
      return est;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/simulations/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setEstimate(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // ── Start Simulation ──
  const startSimulation = useCallback(async (
    tier: string,
    eventDescription: string,
    marketContext: Record<string, unknown> = {},
    listingData?: Record<string, unknown>,
  ) => {
    setLocalError(null);
    setReport(null);

    if (DEMO_MODE) {
      const job = buildMockSimJob(tier, eventDescription);
      setActiveJob(job);
      setReport(MOCK_SIM_REPORT as SimulationReport);
      return job;
    }

    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`${API_BASE}/api/v1/simulations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          tier,
          event_description: eventDescription,
          market_context: marketContext,
          listing_data: listingData,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.detail?.message || err.message || 'Failed to start simulation');
      }

      const data = await res.json();

      // Set the new job in global store immediately
      const job: SimulationJob = {
        id: data.id,
        status: data.status || 'queued',
        depth_tier: tier,
        scenario_text: eventDescription,
        progress_pct: 0,
        current_round: 0,
        total_rounds: data.max_rounds || 0,
        sentiment: { bullish: 0, bearish: 0, neutral: 0 },
        result_json: null,
        error_message: null,
        created_at: new Date().toISOString(),
        completed_at: null,
        active_run: true,
      };

      setActiveJob(job);
      // Polling will start automatically via the useEffect above
      return job;
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to start simulation');
      return null;
    }
  }, [setActiveJob]);

  // ── Chat with Agent ──
  const chatWithAgent = useCallback(async (simId: string, agentName: string, message: string) => {
    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`${API_BASE}/api/v1/simulations/${simId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ agent_name: agentName, message }),
      });
      if (!res.ok) throw new Error('Agent chat failed');
      return await res.json();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    }
  }, []);

  // ── Fetch Report (for completed jobs without inline result_json) ──
  const fetchReport = useCallback(async (simId: string) => {
    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`${API_BASE}/api/v1/simulations/${simId}/report`, {
        headers: { 'x-session-id': sessionId },
      });
      if (!res.ok) return null;
      const data = await res.json();
      setReport(data as SimulationReport);
      return data;
    } catch {
      return null;
    }
  }, []);

  // ── Reset ──
  const reset = useCallback(() => {
    stopPolling();
    clearActiveJob();
    setReport(null);
    setLocalError(null);
    setEstimate(null);
  }, [clearActiveJob]);

  // Derive convenience values from store
  const simulation = activeJob
    ? {
        id: activeJob.id,
        status: activeJob.status,
        tier: activeJob.depth_tier,
        current_round: activeJob.current_round,
        max_rounds: activeJob.total_rounds,
        agent_count: 0, // Not stored in job row — tier config has this
        sentiment: activeJob.sentiment,
        created_at: activeJob.created_at,
        started_at: null as string | null,
        completed_at: activeJob.completed_at,
        error: activeJob.error_message,
      }
    : null;

  const loading = activeJob !== null && !TERMINAL_STATUSES.includes(activeJob.status);

  return {
    simulation,
    report: report ?? (activeJob?.result_json as SimulationReport | null),
    estimate,
    loading,
    error: localError ?? activeJob?.error_message ?? null,
    fetchEstimate,
    startSimulation,
    chatWithAgent,
    fetchReport,
    reset,
    // Durable APIs
    activeJob,
    deactivateJob,
  };
}
