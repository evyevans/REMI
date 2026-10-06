import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/auth-utils';
import { DEMO_MODE, MOCK_DEAL_SCOUT_STATUS } from '../demo/mockData';

export interface ScoutStatus {
  is_active: boolean;
  last_scan_at: string | null;
  next_scan_at: string | null;
  matches_since: number;
  matches_since_date: string | null;
  scan_regions: string[];
  scan_types: string[];
  price_min: number | null;
  price_max: number | null;
  score_min: number | null;
}

export function useDealScoutStatus() {
  if (DEMO_MODE) {
    return {
      status: MOCK_DEAL_SCOUT_STATUS as ScoutStatus,
      setStatus: (() => {}) as Dispatch<SetStateAction<ScoutStatus | null>>,
      loading: false,
    };
  }
  const [status, setStatus] = useState<ScoutStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getOrCreateUserId();

    async function fetchStatus() {
      const { data } = await supabase
        .from('deal_scout_status')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      setStatus(data ?? null);
      setLoading(false);
    }

    fetchStatus();

    // Sanitize userId for channel name — colons/hyphens break Supabase realtime channel parsing
    const safeId = userId.replace(/-/g, '_');
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(`deal_scout_status_${safeId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deal_scout_status',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => setStatus(payload.new as ScoutStatus)
        )
        .subscribe();
    } catch (err) {
      console.warn('[useDealScoutStatus] Realtime subscription failed (non-fatal):', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { status, setStatus, loading };
}
