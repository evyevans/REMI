/* ═══════════════════════════════════════════════════════════
   Global Filter Context — Profile preferences flow to all views
   ═══════════════════════════════════════════════════════════
   Single source of truth for user preferences.
   ● Profile page writes to it
   ● Dashboard, Map, Properties, Alerts read from it
   ● Fetches from Supabase, caches to localStorage
   ═══════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { FilterState, UserProfile, SortOption } from '../types';
import { EMPTY_PROFILE } from '../data/mockData';
import { useMarket } from '../stores/marketStore';
import { supabase } from '../lib/supabase';

import { getOrCreateUserId } from '../lib/auth-utils';

/* ── Check if stored data is the legacy fake mock profile ── */
function isLegacyMockData(profile: UserProfile): boolean {
  if (!profile || !profile.neighborhoods) return false;
  const mockHoods = ['Wynwood', 'Coral Gables', 'Edgewater'];
  const hasMockHoods = profile.neighborhoods.length === 3 && 
                       profile.neighborhoods.every(h => mockHoods.includes(h));
  return hasMockHoods && profile.minDealScore === 5 && profile.aiScoutingEnabled === true;
}

/* ── Fetch profile from Supabase, fallback to cache, then EMPTY ── */
async function loadProfile(marketId: string): Promise<UserProfile> {
  const cacheKey = `remi_user_profile_${marketId}`;
  
  // 1. Check local cache (fast initial render)
  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const parsed = JSON.parse(stored) as UserProfile;
      // MIGRATION: If they have the old fake data, wipe it so they see empty state
      if (isLegacyMockData(parsed)) {
        localStorage.removeItem(cacheKey);
      } else {
        return parsed;
      }
    }
  } catch {
    localStorage.removeItem(cacheKey);
  }

  // 2. Fetch from Supabase
  try {
    const userId = getOrCreateUserId();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('market_slug', marketId)
      .maybeSingle();

    if (data && !error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbData = data as any;
      const profile: UserProfile = {
        userId: dbData.user_id,
        goals: dbData.investment_goals || [],
        riskTolerance: dbData.risk_tolerance as UserProfile['riskTolerance'],
        budgetMin: dbData.budget_min,
        budgetMax: dbData.budget_max,
        propertyTypes: dbData.property_types || [],
        neighborhoods: dbData.neighborhoods || [],
        minDealScore: dbData.min_deal_score || 0,
        aiScoutingEnabled: dbData.ai_scouting_enabled || false,
      };
      // Cache it
      localStorage.setItem(cacheKey, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.error('Failed to load profile from Supabase:', err);
  }

  // 3. Fall back to empty
  return { ...EMPTY_PROFILE };
}

function buildFiltersFromProfile(p: UserProfile): FilterState {
  return {
    status: ['for_sale'],
    priceMin: p.budgetMin ?? 0,
    priceMax: p.budgetMax ?? 1000000000000,
    bedsMin: 0,
    bathsMin: 0,
    propertyTypes: p.propertyTypes ?? [],
    minDealScore: p.minDealScore ?? 0,
    sqftMin: 0,
    sqftMax: 0,
    yearBuiltMin: 0,
    yearBuiltMax: 0,
    daysOnMarketMax: 0,
    neighborhoods: p.neighborhoods ?? [],
    sortBy: 'deal_score_desc' as SortOption,
  };
}

interface FilterContextValue {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  clearFilters: () => void;
  profileLoading: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const { currentMarket } = useMarket();

  // Start empty until initial load completes
  const [profile, setProfileState] = useState<UserProfile>(EMPTY_PROFILE);
  const [filters, setFilters] = useState<FilterState>(() => buildFiltersFromProfile(EMPTY_PROFILE));
  const [profileLoading, setProfileLoading] = useState(true);

  /* ── When market changes, load profile asynchronously ── */
  useEffect(() => {
    let cancelled = false;
    const marketId = currentMarket.id;

    setTimeout(() => {
      setProfileLoading(true);
    }, 0);

    loadProfile(marketId).then((loadedProfile) => {
      if (!cancelled && marketId === currentMarket.id) {
        setProfileState(loadedProfile);
        setFilters(buildFiltersFromProfile(loadedProfile));
        setProfileLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentMarket.id]);

  // Listen for global profile updates (e.g. from DealScout toggle)
  useEffect(() => {
    const handleUpdate = (e: any) => {
      // If the update is for the current market, refresh the profile state
      if (e.detail?.market_slug === currentMarket.id || !e.detail?.market_slug) {
        loadProfile(currentMarket.id).then(setProfileState);
      }
    };
    window.addEventListener('remi:profile_update', handleUpdate);
    return () => window.removeEventListener('remi:profile_update', handleUpdate);
  }, [currentMarket.id]);

  /* ── When profile is manually saved, sync it to context and cache ── */
  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    setFilters(buildFiltersFromProfile(p));
    localStorage.setItem(`remi_user_profile_${currentMarket.id}`, JSON.stringify(p));
  }, [currentMarket.id]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(buildFiltersFromProfile(profile)), [profile]);

  const clearFilters = useCallback(() => setFilters(buildFiltersFromProfile(EMPTY_PROFILE)), []);

  return (
    <FilterContext.Provider value={{ 
      profile, setProfile, filters, setFilters, updateFilter, resetFilters, clearFilters, profileLoading 
    }}>
      {children}
    </FilterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used inside FilterProvider');
  return ctx;
}
