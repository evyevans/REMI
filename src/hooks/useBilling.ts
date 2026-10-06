/**
 * useBilling — Subscription status and Stripe portal redirect.
 *
 * Fetches the current org's subscription from the backend and provides
 * helpers to open the Stripe Customer Portal or checkout flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SubscriptionDetails {
  plan_tier: 'starter' | 'pro' | 'brokerage' | string;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete' | string;
  monthly_task_limit: number;
  tasks_used: number;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
}

interface UseBillingResult {
  subscription: SubscriptionDetails | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  startCheckout: (planTier: 'starter' | 'pro' | 'brokerage') => Promise<void>;
  openPortal: () => Promise<void>;
  refetch: () => void;
}

export function useBilling(): UseBillingResult {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/billing/subscription`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setSubscription(await resp.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const startCheckout = useCallback(
    async (planTier: 'starter' | 'pro' | 'brokerage') => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const resp = await fetch(`${API_BASE}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_tier: planTier }),
      });
      if (!resp.ok) throw new Error(`Checkout failed: ${resp.status}`);
      const { url } = await resp.json();
      if (url) window.location.href = url;
    },
    [session?.access_token],
  );

  const openPortal = useCallback(async () => {
    if (!session?.access_token) throw new Error('Not authenticated');
    const resp = await fetch(`${API_BASE}/api/v1/billing/portal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!resp.ok) throw new Error(`Portal failed: ${resp.status}`);
    const { url } = await resp.json();
    if (url) window.location.href = url;
  }, [session?.access_token]);

  const status = subscription?.subscription_status ?? '';

  return {
    subscription,
    loading,
    error,
    isActive: status === 'active',
    isTrialing: status === 'trialing',
    isPastDue: status === 'past_due',
    isCanceled: status === 'canceled',
    startCheckout,
    openPortal,
    refetch: fetchSubscription,
  };
}
