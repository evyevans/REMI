/**
 * simulationStore — Global Zustand store for durable simulation jobs.
 *
 * Lives outside any page component. Survives navigation between tabs.
 * The Header reads from this store to show the global "Simulation running" indicator.
 * Persistence is Supabase (simulation_jobs table), NOT localStorage.
 */
import { create } from 'zustand';
import { getOrCreateSessionId } from '../lib/auth-utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type SimJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SimulationJob {
  id: string;
  status: SimJobStatus;
  depth_tier: string;
  scenario_text: string;
  progress_pct: number;
  current_round: number;
  total_rounds: number;
  sentiment: { bullish: number; bearish: number; neutral: number };
  result_json: unknown | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  active_run: boolean;
}

interface SimulationState {
  activeJob: SimulationJob | null;
  setActiveJob: (job: SimulationJob | null) => void;
  updateProgress: (update: Partial<SimulationJob>) => void;
  clearActiveJob: () => void;

  /** Hydrate active job from Supabase on app load. */
  hydrate: () => Promise<void>;

  /** Deactivate old job via API before starting a new one. */
  deactivateJob: (simId: string) => Promise<void>;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  activeJob: null,

  setActiveJob: (job) => set({ activeJob: job }),

  updateProgress: (update) =>
    set((state) => {
      if (!state.activeJob) return state;
      return { activeJob: { ...state.activeJob, ...update } };
    }),

  clearActiveJob: () => set({ activeJob: null }),

  hydrate: async () => {
    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch(`${API_BASE}/api/v1/simulations/active`, {
        headers: { 'x-session-id': sessionId },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.simulation) {
        set({ activeJob: data.simulation as SimulationJob });
      }
    } catch {
      // Silently fail — hydration is best-effort
    }
  },

  deactivateJob: async (simId: string) => {
    try {
      const sessionId = getOrCreateSessionId();
      await fetch(`${API_BASE}/api/v1/simulations/${simId}/deactivate`, {
        method: 'PATCH',
        headers: { 'x-session-id': sessionId },
      });
    } catch {
      // Best-effort
    }
    set({ activeJob: null });
  },
}));
