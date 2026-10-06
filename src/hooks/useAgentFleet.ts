/**
 * useAgentFleet — Fetches the org's agent fleet and subscribes to status changes.
 *
 * Returns the list of agents for the current org, with live status updates
 * via Supabase Realtime. Used by AgentCommandCenter to render the fleet grid.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'offline';

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  agent_type: string;
  is_active: boolean;
  requires_approval: boolean;
  approval_threshold: 'always' | 'high_value' | 'first_contact' | 'never';
  status: AgentStatus;
  last_active_at: string | null;
  error_message: string | null;
  created_at: string;
  // Computed from agent_tasks aggregate (populated by useAgentActivity)
  tasks_today?: number;
  tasks_month?: number;
}

interface UseAgentFleetResult {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  toggleAgent: (agentId: string, isActive: boolean) => Promise<void>;
  refetch: () => void;
}

export function useAgentFleet(): UseAgentFleetResult {
  const { session } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Resolve org_id for current user
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setOrgId((data as { organization_id: string }).organization_id);
      });
  }, [session?.user?.id]);

  const fetchAgents = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      setAgents((data as Agent[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Subscribe to live agent status changes
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`agent_fleet:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agents',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setAgents((prev) =>
            prev.map((a) =>
              a.id === payload.new.id ? { ...a, ...(payload.new as Agent) } : a,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const toggleAgent = useCallback(
    async (agentId: string, isActive: boolean) => {
      const { error: updateErr } = await supabase
        .from('agents')
        // @ts-expect-error Supabase codegen doesn't include is_active+status update on agents
        .update({ is_active: isActive, status: isActive ? 'idle' : 'offline' })
        .eq('id', agentId);

      if (updateErr) throw updateErr;
      // Optimistic update
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, is_active: isActive, status: isActive ? 'idle' : 'offline' }
            : a,
        ),
      );
    },
    [],
  );

  return { agents, loading, error, toggleAgent, refetch: fetchAgents };
}
