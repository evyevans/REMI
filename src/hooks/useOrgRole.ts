import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface OrgMe {
  org_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  is_admin: boolean;
  is_owner: boolean;
  plan_tier: string;
}

/**
 * Fetches the calling user's org membership role.
 * Returns null while loading or when the user has no org.
 * Used to conditionally show the Team Dashboard tab.
 */
export function useOrgRole() {
  const { user } = useAuth();
  const [orgMe, setOrgMe] = useState<OrgMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrgMe(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchOrgMe() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) {
          setLoading(false);
          return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/v1/agents/org/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setOrgMe(data as OrgMe);
      } catch {
        // No org or network error — tab stays hidden
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOrgMe();
    return () => { cancelled = true; };
  }, [user]);

  return { orgMe, loading };
}
