/**
 * MarketConfig — Multi-market configuration registry
 *
 * Defines market definitions and provides the useActiveMarket hook
 * for switching between markets. Designed to support any US market
 * without code changes.
 *
 * Palantir Blueprint Phase 5
 */

import { useState, useCallback, useMemo } from 'react';

/* ─── Market Definition ────────────────────────────────── */

export interface MarketDefinition {
  id: string;
  name: string;
  shortName: string;
  state: string;
  center: { lat: number; lng: number };
  zoom: number;
  neighborhoods: string[];
  dataSources: string[];
  timezone: string;
  active: boolean;
}

/* ─── Market Registry ──────────────────────────────────── */

export const MARKETS: MarketDefinition[] = [
  {
    id: 'miami',
    name: 'Miami-Dade County',
    shortName: 'Miami',
    state: 'FL',
    center: { lat: 25.77, lng: -80.19 },
    zoom: 12,
    neighborhoods: [
      'Brickell', 'Downtown Miami', 'Wynwood', 'Edgewater', 'Midtown',
      'Design District', 'Little Havana', 'Coral Gables', 'Coconut Grove',
      'South Beach', 'North Beach', 'Bay Harbor Islands', 'Aventura',
      'Sunny Isles Beach', 'Key Biscayne', 'Doral', 'Homestead',
    ],
    dataSources: ['MLS', 'Zillow', 'Supabase'],
    timezone: 'America/New_York',
    active: true,
  },
  {
    id: 'austin',
    name: 'Austin Metro Area',
    shortName: 'Austin',
    state: 'TX',
    center: { lat: 30.27, lng: -97.74 },
    zoom: 11,
    neighborhoods: [
      'Downtown Austin', 'East Austin', 'South Congress', 'Zilker',
      'Mueller', 'Domain', 'Westlake', 'Cedar Park', 'Round Rock',
      'Pflugerville', 'Lakeway', 'Bee Cave',
    ],
    dataSources: ['MLS'],
    timezone: 'America/Chicago',
    active: false,
  },
  {
    id: 'nyc',
    name: 'New York City',
    shortName: 'NYC',
    state: 'NY',
    center: { lat: 40.71, lng: -74.01 },
    zoom: 11,
    neighborhoods: [
      'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island',
      'Williamsburg', 'DUMBO', 'Tribeca', 'SoHo', 'Upper East Side',
    ],
    dataSources: ['MLS'],
    timezone: 'America/New_York',
    active: false,
  },
  {
    id: 'la',
    name: 'Los Angeles Metro',
    shortName: 'LA',
    state: 'CA',
    center: { lat: 34.05, lng: -118.24 },
    zoom: 10,
    neighborhoods: [
      'Beverly Hills', 'Santa Monica', 'Hollywood', 'Downtown LA',
      'Venice', 'Malibu', 'Brentwood', 'West Hollywood', 'Pasadena',
    ],
    dataSources: ['MLS'],
    timezone: 'America/Los_Angeles',
    active: false,
  },
];

const STORAGE_KEY = 'remi_active_market';

/* ─── Hook: useActiveMarket ────────────────────────────── */

interface UseActiveMarketReturn {
  market: MarketDefinition;
  setMarket: (marketId: string) => void;
  allMarkets: MarketDefinition[];
  activeMarkets: MarketDefinition[];
}

export function useActiveMarket(): UseActiveMarketReturn {
  const [marketId, setMarketId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || MARKETS[0].id;
    } catch {
      return MARKETS[0].id;
    }
  });

  const market = useMemo(
    () => MARKETS.find(m => m.id === marketId) || MARKETS[0],
    [marketId],
  );

  const activeMarkets = useMemo(() => MARKETS.filter(m => m.active), []);

  const setMarket = useCallback((id: string) => {
    setMarketId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  return { market, setMarket, allMarkets: MARKETS, activeMarkets };
}

/* ─── Helpers ──────────────────────────────────────────── */

export function getMarketById(id: string): MarketDefinition | undefined {
  return MARKETS.find(m => m.id === id);
}

export function getActiveMarkets(): MarketDefinition[] {
  return MARKETS.filter(m => m.active);
}
