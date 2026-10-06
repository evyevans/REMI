/**
 * useVoiceVariables — Builds the dynamic variable payload for ElevenLabs.
 *
 * Pulls from three sources at session start:
 *   1. marketStore  — current market + active page
 *   2. Supabase auth — authenticated user's display name
 *   3. Supabase user_profiles — budget, neighborhoods, property types, deal score
 *
 * All values fall back gracefully so the voice session always starts,
 * even if the profile fetch fails or the user has no preferences saved.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMarket } from '../stores/marketStore';
import { supabase } from '../lib/supabase';

export interface VoiceVariables {
  marketName: string;
  activePage: string;
  userName: string;
  budgetMin: string;
  budgetMax: string;
  neighborhoods: string;
  propertyTypes: string;
  minDealScore: string;
  _neighborhoods: string; // ElevenLabs Handlebars block duplicate
}

interface UserProfile {
  budget_min: number | null;
  budget_max: number | null;
  preferred_neighborhoods: string[] | null;
  preferred_property_types: string[] | null;
  min_deal_score: number | null;
}

const FALLBACKS: VoiceVariables = {
  marketName: 'your selected market',
  activePage: 'dashboard',
  userName: 'there',
  budgetMin: 'not set',
  budgetMax: 'not set',
  neighborhoods: 'not configured',
  propertyTypes: 'not configured',
  minDealScore: '7.0',
  _neighborhoods: 'not configured',
};

export function useVoiceVariables(): {
  variables: VoiceVariables;
  isReady: boolean;
} {
  const location = useLocation();
  const { currentMarket } = useMarket();
  const [variables, setVariables] = useState<VoiceVariables>(FALLBACKS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        // ── Auth user ──────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setVariables((prev) => ({ ...prev, ...resolvePageAndMarket() }));
          setIsReady(true);
          return;
        }

        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'there';

        // ── User profile ───────────────────────────────────────
        const { data: rawProfile } = await supabase
          .from('user_profiles')
          .select(
            'budget_min, budget_max, preferred_neighborhoods, preferred_property_types, min_deal_score'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        const profile = rawProfile as UserProfile | null;


        const neighborhoods =
          Array.isArray(profile?.preferred_neighborhoods) && profile.preferred_neighborhoods.length > 0
            ? profile.preferred_neighborhoods.join(', ')
            : FALLBACKS.neighborhoods;

        const propertyTypes =
          Array.isArray(profile?.preferred_property_types) && profile.preferred_property_types.length > 0
            ? profile.preferred_property_types.join(', ')
            : FALLBACKS.propertyTypes;

        const budgetMin = profile?.budget_min
          ? `$${Number(profile.budget_min).toLocaleString()}`
          : FALLBACKS.budgetMin;

        const budgetMax = profile?.budget_max
          ? `$${Number(profile.budget_max).toLocaleString()}`
          : FALLBACKS.budgetMax;

        const minDealScore = profile?.min_deal_score
          ? String(profile.min_deal_score)
          : FALLBACKS.minDealScore;

        setVariables({
          ...resolvePageAndMarket(),
          userName: displayName,
          budgetMin,
          budgetMax,
          neighborhoods,
          propertyTypes,
          minDealScore,
          _neighborhoods: neighborhoods,
        });
      } catch {
        // Non-fatal — voice still starts with fallbacks
        if (!cancelled) {
          setVariables((prev) => ({ ...prev, ...resolvePageAndMarket() }));
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    function resolvePageAndMarket() {
      const page = location.pathname.replace('/', '') || 'dashboard';
      const market = currentMarket?.displayName || FALLBACKS.marketName;
      return { marketName: market, activePage: page };
    }

    fetchProfile();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, currentMarket?.id]);

  // Keep page + market live even after initial load (navigation updates)
  useEffect(() => {
    const page = location.pathname.replace('/', '') || 'dashboard';
    const market = currentMarket?.displayName || FALLBACKS.marketName;
    setVariables((prev) => ({
      ...prev,
      marketName: market,
      activePage: page,
    }));
  }, [location.pathname, currentMarket?.displayName]);

  return { variables, isReady };
}
