/**
 * useAgentActivity — Rolling real-time feed of agent task completions.
 *
 * Subscribes to INSERT events on agent_tasks for the current org, prepending
 * each new task to a capped list. On mount, fetches the last N tasks to
 * pre-populate the feed before live events arrive.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DEMO_MODE, MOCK_AGENT_TASKS } from '../demo/mockData';

export interface AgentTask {
  id: string;
  organization_id: string;
  agent_id: string;
  task_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  action_summary: string | null;
  error_message: string | null;
  tokens_used: number;
  cost_usd: number;
  queued_at: string;
  completed_at: string | null;
  requires_approval: boolean;
  // Joined
  agent_name?: string;
  agent_type?: string;
}

interface UseAgentActivityResult {
  tasks: AgentTask[];
  loading: boolean;
}

const FEED_LIMIT = 50;

export function useAgentActivity(): UseAgentActivityResult {
  if (DEMO_MODE) return { tasks: MOCK_AGENT_TASKS, loading: false };
  const { session } = useAuth();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Resolve org_id
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

  // Initial fetch — last FEED_LIMIT tasks
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    supabase
      .from('agent_tasks')
      .select('*, agents(name, agent_type)')
      .eq('organization_id', orgId)
      .order('queued_at', { ascending: false })
      .limit(FEED_LIMIT)
      .then(({ data }) => {
        if (data) {
          const shaped = data.map(shapeTask);
          setTasks(shaped.reverse()); // oldest-first so newest appends at bottom
        }
        setLoading(false);
      });
  }, [orgId]);

  // Real-time subscription — prepend new tasks as they arrive
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`agent_activity:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_tasks',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setTasks((prev) => {
            const updated = [...prev, shapeTask(payload.new as RawTask)];
            return updated.slice(-FEED_LIMIT); // cap at limit
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_tasks',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === payload.new.id ? { ...t, ...(payload.new as Partial<AgentTask>) } : t,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  return { tasks, loading };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawTask = Record<string, any>;

function shapeTask(raw: RawTask): AgentTask {
  const agentData = raw.agents as { name?: string; agent_type?: string } | null;
  return {
    id: raw.id,
    organization_id: raw.organization_id,
    agent_id: raw.agent_id,
    task_type: raw.task_type,
    status: raw.status,
    action_summary: raw.action_summary ?? null,
    error_message: raw.error_message ?? null,
    tokens_used: raw.tokens_used ?? 0,
    cost_usd: raw.cost_usd ?? 0,
    queued_at: raw.queued_at,
    completed_at: raw.completed_at ?? null,
    requires_approval: raw.requires_approval ?? false,
    agent_name: agentData?.name,
    agent_type: agentData?.agent_type,
  };
}
