/**
 * useQuota — Fetches subscription quota status for the current org.
 *
 * Exposes:
 *   - tasksUsed / taskLimit / remaining: raw counts
 *   - percentUsed: 0–1 float for progress bars
 *   - shouldWarn: ≥ 80% used
 *   - shouldAlert: ≥ 90% used
 *   - shouldShowUpsell: ≥ 90% used (alias for plan banner trigger)
 *   - planTier: 'starter' | 'pro' | 'brokerage'
 *   - subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | ...
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DEMO_MODE, MOCK_QUOTA } from '../demo/mockData';

export interface QuotaState {
  tasksUsed: number;
  taskLimit: number;
  remaining: number;
  percentUsed: number;
  shouldWarn: boolean;
  shouldAlert: boolean;
  shouldShowUpsell: boolean;
  planTier: string;
  subscriptionStatus: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useQuota(): QuotaState {
  if (DEMO_MODE) return MOCK_QUOTA;
  const { session } = useAuth();
  const [tasksUsed, setTasksUsed] = useState(0);
  const [taskLimit, setTaskLimit] = useState(2500);
  const [planTier, setPlanTier] = useState('starter');
  const [subscriptionStatus, setSubscriptionStatus] = useState('trialing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/billing/subscription`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setTasksUsed(data.tasks_used ?? 0);
      setTaskLimit(data.monthly_task_limit ?? 2500);
      setPlanTier(data.plan_tier ?? 'starter');
      setSubscriptionStatus(data.subscription_status ?? 'trialing');
    } catch (err) {
      // Fallback: query ledger directly from Supabase
      try {
        const { data: orgData } = await supabase
          .from('organization_members')
          .select('organizations(monthly_task_limit, plan_tier, subscription_status)')
          .eq('user_id', session.user!.id)
          .limit(1)
          .single();

        const org = (orgData as { organizations?: { monthly_task_limit?: number; plan_tier?: string; subscription_status?: string } } | null)
          ?.organizations;
        if (org) {
          setTaskLimit(org.monthly_task_limit ?? 2500);
          setPlanTier(org.plan_tier ?? 'starter');
          setSubscriptionStatus(org.subscription_status ?? 'trialing');
        }
      } catch {
        // ignore fallback failure
      }
      setError(err instanceof Error ? err.message : 'Failed to load quota');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const remaining = Math.max(0, taskLimit - tasksUsed);
  const percentUsed = taskLimit > 0 ? tasksUsed / taskLimit : 0;

  return {
    tasksUsed,
    taskLimit,
    remaining,
    percentUsed,
    shouldWarn: percentUsed >= 0.8,
    shouldAlert: percentUsed >= 0.9,
    shouldShowUpsell: percentUsed >= 0.9,
    planTier,
    subscriptionStatus,
    loading,
    error,
    refetch: fetchQuota,
  };
}
