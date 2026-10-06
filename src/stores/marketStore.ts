/**
 * marketStore.ts — Zustand-based Market Context Store
 *
 * Replaces React Context (MarketContext.tsx) to eliminate:
 * 1. Stale closure race conditions in useCallback
 * 2. localStorage hydration timing bugs (setTimeout hack)
 * 3. React Context propagation delays during tab switches
 *
 * Phase 4: Map-to-Chat Context Sync
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';
import { triggerBackgroundScrape } from '../services/backgroundScrape';
import { DEMO_MODE, DEMO_MARKETS, DEFAULT_DEMO_MARKET } from '../demo/mockData';

// ═══════════════════════════════════════════════════
// TYPE DEFINITIONS (migrated from MarketContext.tsx)
// ═══════════════════════════════════════════════════

export interface StateSelection {
  id: string;             // "ontario-on"
  name: string;           // "Ontario"
  abbr: string;           // "ON"
  country: 'US' | 'CA';
  bounds?: [[number, number], [number, number]];
}

export interface CitySelection {
  id: string;             // "toronto-on"
  name: string;           // "Toronto"
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  placeId?: string;
}

export interface NeighborhoodSelection {
  id: string;             // "yorkville-toronto-on"
  name: string;           // "Yorkville"
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  placeId?: string;
}

/** AI-generated neighborhood insight written to discovered_neighborhoods by the analytics pass */
export interface DiscoveredNeighborhood {
  name: string;
  slug: string;
  rank: number;
  analysis_type: string;
  score: number;
  highlights: string[];
  property_count: number;
  centroid: { lat: number; lng: number } | null;
  insight: string;
}

export interface GeographicCascade {
  state: StateSelection | null;
  city: CitySelection | null;
  neighborhood: NeighborhoodSelection | null;
  fingerprint?: string;
}

export interface Market {
  id: string;               // collision-proof slug: "yorkville-toronto-on-ca"
  city?: string;
  state_province?: string;
  abbr?: string;
  country: string;
  displayName: string;      // "Yorkville, Toronto, ON"
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  resolution?: 'state' | 'city' | 'neighborhood';
}

// ═══════════════════════════════════════════════════
// SUPPORTED TERRITORIES
// ═══════════════════════════════════════════════════

export const SUPPORTED_TERRITORIES: StateSelection[] = [
  // US States
  { id: 'alabama-al',      name: 'Alabama',                  abbr: 'AL', country: 'US', bounds: [[30.22, -88.47], [35.01, -84.89]] },
  { id: 'alaska-ak',       name: 'Alaska',                   abbr: 'AK', country: 'US', bounds: [[51.21, -179.15], [71.39, -129.98]] },
  { id: 'arizona-az',      name: 'Arizona',                  abbr: 'AZ', country: 'US', bounds: [[31.33, -114.81], [37.00, -109.04]] },
  { id: 'arkansas-ar',     name: 'Arkansas',                 abbr: 'AR', country: 'US', bounds: [[33.00, -94.62], [36.50, -89.64]] },
  { id: 'california-ca',   name: 'California',               abbr: 'CA', country: 'US', bounds: [[32.53, -124.41], [42.01, -114.13]] },
  { id: 'colorado-co',     name: 'Colorado',                 abbr: 'CO', country: 'US', bounds: [[36.99, -109.06], [41.00, -102.04]] },
  { id: 'connecticut-ct',  name: 'Connecticut',              abbr: 'CT', country: 'US', bounds: [[40.95, -73.73], [42.05, -71.79]] },
  { id: 'delaware-de',     name: 'Delaware',                 abbr: 'DE', country: 'US', bounds: [[38.45, -75.79], [39.84, -75.05]] },
  { id: 'florida-fl',      name: 'Florida',                  abbr: 'FL', country: 'US', bounds: [[24.40, -87.63], [31.00, -79.97]] },
  { id: 'georgia-ga',      name: 'Georgia',                  abbr: 'GA', country: 'US', bounds: [[30.36, -85.61], [35.00, -80.75]] },
  { id: 'hawaii-hi',       name: 'Hawaii',                   abbr: 'HI', country: 'US', bounds: [[18.91, -160.24], [22.24, -154.81]] },
  { id: 'idaho-id',        name: 'Idaho',                    abbr: 'ID', country: 'US', bounds: [[41.99, -117.24], [49.00, -111.04]] },
  { id: 'illinois-il',     name: 'Illinois',                 abbr: 'IL', country: 'US', bounds: [[36.97, -91.51], [42.51, -87.02]] },
  { id: 'indiana-in',      name: 'Indiana',                  abbr: 'IN', country: 'US', bounds: [[37.77, -88.10], [41.76, -84.78]] },
  { id: 'iowa-ia',         name: 'Iowa',                     abbr: 'IA', country: 'US', bounds: [[40.38, -96.64], [43.50, -90.14]] },
  { id: 'kansas-ks',       name: 'Kansas',                   abbr: 'KS', country: 'US', bounds: [[36.99, -102.05], [40.00, -94.59]] },
  { id: 'kentucky-ky',     name: 'Kentucky',                 abbr: 'KY', country: 'US', bounds: [[36.50, -89.57], [39.15, -81.96]] },
  { id: 'louisiana-la',    name: 'Louisiana',                abbr: 'LA', country: 'US', bounds: [[28.93, -94.04], [33.02, -88.82]] },
  { id: 'maine-me',        name: 'Maine',                    abbr: 'ME', country: 'US', bounds: [[43.06, -71.08], [47.46, -66.95]] },
  { id: 'maryland-md',     name: 'Maryland',                 abbr: 'MD', country: 'US', bounds: [[37.91, -79.49], [39.72, -75.05]] },
  { id: 'massachusetts-ma',name: 'Massachusetts',            abbr: 'MA', country: 'US', bounds: [[41.24, -73.51], [42.89, -69.93]] },
  { id: 'michigan-mi',     name: 'Michigan',                 abbr: 'MI', country: 'US', bounds: [[41.70, -90.42], [48.24, -82.12]] },
  { id: 'minnesota-mn',    name: 'Minnesota',                abbr: 'MN', country: 'US', bounds: [[43.50, -97.24], [49.38, -89.49]] },
  { id: 'mississippi-ms',  name: 'Mississippi',              abbr: 'MS', country: 'US', bounds: [[30.17, -91.66], [34.99, -88.10]] },
  { id: 'missouri-mo',     name: 'Missouri',                 abbr: 'MO', country: 'US', bounds: [[35.99, -95.77], [40.61, -89.10]] },
  { id: 'montana-mt',      name: 'Montana',                  abbr: 'MT', country: 'US', bounds: [[44.36, -116.05], [49.00, -104.04]] },
  { id: 'nebraska-ne',     name: 'Nebraska',                 abbr: 'NE', country: 'US', bounds: [[39.99, -104.05], [43.00, -95.31]] },
  { id: 'nevada-nv',       name: 'Nevada',                   abbr: 'NV', country: 'US', bounds: [[35.00, -120.01], [42.00, -114.04]] },
  { id: 'new-hampshire-nh',name: 'New Hampshire',            abbr: 'NH', country: 'US', bounds: [[42.70, -72.56], [45.31, -70.70]] },
  { id: 'new-jersey-nj',   name: 'New Jersey',               abbr: 'NJ', country: 'US', bounds: [[38.93, -75.56], [41.36, -73.89]] },
  { id: 'new-mexico-nm',   name: 'New Mexico',               abbr: 'NM', country: 'US', bounds: [[31.33, -109.05], [37.00, -103.00]] },
  { id: 'new-york-ny',     name: 'New York',                 abbr: 'NY', country: 'US', bounds: [[40.48, -79.76], [45.02, -71.86]] },
  { id: 'north-carolina-nc',name: 'North Carolina',          abbr: 'NC', country: 'US', bounds: [[33.84, -84.32], [36.59, -75.40]] },
  { id: 'north-dakota-nd', name: 'North Dakota',             abbr: 'ND', country: 'US', bounds: [[45.94, -104.05], [49.00, -96.55]] },
  { id: 'ohio-oh',         name: 'Ohio',                     abbr: 'OH', country: 'US', bounds: [[38.40, -84.82], [41.98, -80.52]] },
  { id: 'oklahoma-ok',     name: 'Oklahoma',                 abbr: 'OK', country: 'US', bounds: [[33.62, -103.00], [37.00, -94.43]] },
  { id: 'oregon-or',       name: 'Oregon',                   abbr: 'OR', country: 'US', bounds: [[41.99, -124.57], [46.29, -116.46]] },
  { id: 'pennsylvania-pa', name: 'Pennsylvania',             abbr: 'PA', country: 'US', bounds: [[39.72, -80.52], [42.27, -74.69]] },
  { id: 'rhode-island-ri', name: 'Rhode Island',             abbr: 'RI', country: 'US', bounds: [[41.15, -71.86], [42.02, -71.12]] },
  { id: 'south-carolina-sc',name: 'South Carolina',          abbr: 'SC', country: 'US', bounds: [[32.03, -83.35], [35.22, -78.54]] },
  { id: 'south-dakota-sd', name: 'South Dakota',             abbr: 'SD', country: 'US', bounds: [[42.48, -104.06], [45.95, -96.44]] },
  { id: 'tennessee-tn',    name: 'Tennessee',                abbr: 'TN', country: 'US', bounds: [[34.98, -90.31], [36.68, -81.65]] },
  { id: 'texas-tx',        name: 'Texas',                    abbr: 'TX', country: 'US', bounds: [[25.84, -106.65], [36.50, -93.51]] },
  { id: 'utah-ut',         name: 'Utah',                     abbr: 'UT', country: 'US', bounds: [[36.99, -114.05], [42.00, -109.04]] },
  { id: 'vermont-vt',      name: 'Vermont',                  abbr: 'VT', country: 'US', bounds: [[42.73, -73.44], [45.02, -71.46]] },
  { id: 'virginia-va',     name: 'Virginia',                 abbr: 'VA', country: 'US', bounds: [[36.54, -83.68], [39.47, -75.24]] },
  { id: 'washington-wa',   name: 'Washington',               abbr: 'WA', country: 'US', bounds: [[45.54, -124.85], [49.00, -116.92]] },
  { id: 'west-virginia-wv',name: 'West Virginia',            abbr: 'WV', country: 'US', bounds: [[37.20, -82.64], [40.64, -77.72]] },
  { id: 'wisconsin-wi',    name: 'Wisconsin',                abbr: 'WI', country: 'US', bounds: [[42.49, -92.89], [47.08, -86.25]] },
  { id: 'wyoming-wy',      name: 'Wyoming',                  abbr: 'WY', country: 'US', bounds: [[40.99, -111.06], [45.01, -104.05]] },
  { id: 'washington-dc',   name: 'Washington D.C.',          abbr: 'DC', country: 'US', bounds: [[38.79, -77.12], [38.99, -76.91]] },
  // Canadian Provinces
  { id: 'alberta-ab',      name: 'Alberta',                  abbr: 'AB', country: 'CA', bounds: [[49.00, -120.00], [60.00, -110.00]] },
  { id: 'british-columbia-bc', name: 'British Columbia',     abbr: 'BC', country: 'CA', bounds: [[48.30, -139.06], [60.00, -114.04]] },
  { id: 'manitoba-mb',     name: 'Manitoba',                 abbr: 'MB', country: 'CA', bounds: [[49.00, -102.05], [60.00, -88.95]] },
  { id: 'new-brunswick-nb',name: 'New Brunswick',            abbr: 'NB', country: 'CA', bounds: [[44.60, -69.06], [48.07, -63.77]] },
  { id: 'newfoundland-nl', name: 'Newfoundland and Labrador',abbr: 'NL', country: 'CA', bounds: [[46.62, -67.81], [60.37, -52.62]] },
  { id: 'nova-scotia-ns',  name: 'Nova Scotia',              abbr: 'NS', country: 'CA', bounds: [[43.37, -66.42], [47.03, -59.68]] },
  { id: 'ontario-on',      name: 'Ontario',                  abbr: 'ON', country: 'CA', bounds: [[41.68, -95.16], [56.86, -74.34]] },
  { id: 'pei-pe',          name: 'Prince Edward Island',     abbr: 'PE', country: 'CA', bounds: [[45.95, -64.42], [47.07, -61.98]] },
  { id: 'quebec-qc',       name: 'Quebec',                   abbr: 'QC', country: 'CA', bounds: [[44.99, -79.76], [62.59, -57.10]] },
  { id: 'saskatchewan-sk', name: 'Saskatchewan',             abbr: 'SK', country: 'CA', bounds: [[49.00, -110.00], [60.00, -101.36]] },
  // Canadian Territories
  { id: 'northwest-territories-nt', name: 'Northwest Territories', abbr: 'NT', country: 'CA', bounds: [[60.00, -136.47], [78.77, -101.98]] },
  { id: 'nunavut-nu',      name: 'Nunavut',                  abbr: 'NU', country: 'CA', bounds: [[51.70, -120.38], [83.11, -61.16]] },
  { id: 'yukon-yt',        name: 'Yukon',                    abbr: 'YT', country: 'CA', bounds: [[60.00, -141.00], [69.65, -123.82]] },
];

// ═══════════════════════════════════════════════════
// FALLBACK MARKET
// ═══════════════════════════════════════════════════

export const FALLBACK_MARKET: Market = {
  id: 'north-america',
  city: '',
  state_province: '',
  country: 'US/CA',
  displayName: 'North America',
  lat: 48.0,
  lng: -100.0,
  bounds: [[15.0, -170.0], [75.0, -50.0]],
};

const DEFAULT_CASCADE: GeographicCascade = {
  state: null,
  city: null,
  neighborhood: null,
};

/**
 * Build a fully-resolved cascade from a flat Market (demo mode only).
 * Lets the store boot with a market already selected so the Command Center
 * never falls through to the "Standby" gate.
 */
function demoCascadeFor(market: Market): GeographicCascade {
  const stateMatch = SUPPORTED_TERRITORIES.find((t) => t.abbr === market.state_province) ?? null;
  return {
    state: stateMatch,
    city: {
      id: market.id,
      name: market.city ?? market.displayName,
      lat: market.lat,
      lng: market.lng,
      bounds: market.bounds,
    },
    neighborhood: null,
  };
}

const INITIAL_CASCADE: GeographicCascade = DEMO_MODE ? demoCascadeFor(DEFAULT_DEMO_MARKET) : DEFAULT_CASCADE;

// ═══════════════════════════════════════════════════
// COLLISION-PROOF SLUG BUILDER
// ═══════════════════════════════════════════════════

function buildMarketSlug(
  neighborhood: string | null,
  city: string,
  stateAbbr: string,
  country: string,
): string {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const parts = [
    neighborhood ? normalize(neighborhood) : null,
    normalize(city),
    stateAbbr.toLowerCase(),
    country.toLowerCase(), // Backend always includes country code (e.g. 'los-angeles-ca-us')
  ].filter(Boolean);
  return parts.join('-');
}

// ═══════════════════════════════════════════════════
// DERIVE MARKET FROM CASCADE
// ═══════════════════════════════════════════════════

function deriveMarket(cascade: GeographicCascade): Market | null {
  const { state, city, neighborhood } = cascade;
  if (neighborhood && city && state) {
    return {
      id: buildMarketSlug(neighborhood.name, city.name, state.abbr, state.country),
      city: city.name,
      state_province: state.abbr,
      abbr: state.abbr,
      country: state.country,
      displayName: `${neighborhood.name}, ${city.name}, ${state.abbr}`,
      resolution: 'neighborhood',
      lat: neighborhood.lat,
      lng: neighborhood.lng,
      bounds: neighborhood.bounds ?? city.bounds,
    };
  }
  if (city && state) {
    return {
      id: buildMarketSlug(null, city.name, state.abbr, state.country),
      city: city.name,
      state_province: state.abbr,
      abbr: state.abbr,
      country: state.country,
      displayName: `${city.name}, ${state.abbr}`,
      resolution: 'city',
      lat: city.lat,
      lng: city.lng,
      bounds: city.bounds,
    };
  }
  if (state) {
    return {
      id: `${state.abbr.toLowerCase()}-${state.country.toLowerCase()}`,
      state_province: state.abbr,
      abbr: state.abbr,
      country: state.country,
      displayName: `${state.name}, ${state.country}`,
      resolution: 'state',
      lat: state.bounds ? (state.bounds[0][0] + state.bounds[1][0]) / 2 : 0,
      lng: state.bounds ? (state.bounds[0][1] + state.bounds[1][1]) / 2 : 0,
      bounds: state.bounds ?? undefined,
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════

interface MarketStore {
  cascade: GeographicCascade;
  isHydrated: boolean;
  isMarketSelected: boolean;
  geographyStatus: 'unselected' | 'resolving' | 'ready';
  recentMarkets: Market[];
  savedMarkets: Market[];

  // Synchronous derived state — always returns the latest value
  getCurrentMarket: () => Market | null;

  // Actions
  setStateSelection: (state: StateSelection | null) => void;
  setCitySelection: (city: CitySelection | null) => void;
  setNeighborhoodSelection: (neighborhood: NeighborhoodSelection | null) => void;
  setCurrentMarket: (market: Market) => void;
  toggleSavedMarket: (market: Market) => void;
  resetCascade: () => void;
  resolveGeography: () => Promise<void>;
  /** Discovered neighborhoods from an AI analytics pass */
  discoveredNeighborhoods: DiscoveredNeighborhood[];
  setDiscoveredNeighborhoods: (neighborhoods: DiscoveredNeighborhood[]) => void;
}

// ═══════════════════════════════════════════════════
// CREATE ZUSTAND STORE
// ═══════════════════════════════════════════════════

export const useMarketStore = create<MarketStore>()(
  persist(
    immer((set, get) => ({
      cascade: INITIAL_CASCADE,
      isHydrated: false,
      isMarketSelected: DEMO_MODE,
      geographyStatus: DEMO_MODE ? 'ready' : 'unselected',
      recentMarkets: DEMO_MODE ? [...DEMO_MARKETS] : [],
      savedMarkets: [],
      discoveredNeighborhoods: [],

      getCurrentMarket: () => deriveMarket(get().cascade),

      setStateSelection: (state) =>
        set((draft) => {
          draft.cascade.state = state;
          draft.cascade.city = null;
          draft.cascade.neighborhood = null;
          draft.discoveredNeighborhoods = [];
          draft.geographyStatus = 'unselected';
        }),

      setCitySelection: (city) => {
        set((draft) => {
          draft.cascade.city = city;
          draft.cascade.neighborhood = null;
          draft.isMarketSelected = !!city;
          draft.geographyStatus = city ? 'resolving' : 'unselected';
        });
        if (city) {
          get().resolveGeography();
        }
      },

      setNeighborhoodSelection: (neighborhood) => {
        set((draft) => {
          draft.cascade.neighborhood = neighborhood;
          // Fire background scrape when neighborhood is selected
          if (neighborhood && draft.cascade.city && draft.cascade.state) {
            const market = deriveMarket({
              state: draft.cascade.state,
              city: draft.cascade.city,
              neighborhood,
            });
            if (market) {
              triggerBackgroundScrape(market);
            }
          }
        });
        if (neighborhood) {
          get().resolveGeography();
        }
      },

      setCurrentMarket: (market) => {
        // Backwards-compat: derive cascade from a flat Market object
        const stateMatch = market.state_province
          ? SUPPORTED_TERRITORIES.find((t) => t.abbr === market.state_province)
          : SUPPORTED_TERRITORIES.find((t) => t.id === market.id);

        set((draft) => {
          if (stateMatch && market.city) {
            draft.cascade.state = stateMatch;
            if (market.resolution === 'neighborhood') {
              const parts = market.displayName.split(', ');
              const nName = parts[0] || market.displayName;
              draft.cascade.city = {
                id: market.city!.toLowerCase().replace(/\s+/g, '-') + '-' + stateMatch.abbr.toLowerCase(),
                name: market.city!,
                lat: market.lat,
                lng: market.lng,
                bounds: market.bounds,
              };
              draft.cascade.neighborhood = {
                id: market.id,
                name: nName,
                lat: market.lat,
                lng: market.lng,
                bounds: market.bounds,
              };
            } else {
              draft.cascade.city = {
                id: market.id,
                name: market.city!,
                lat: market.lat,
                lng: market.lng,
                bounds: market.bounds,
              };
              draft.cascade.neighborhood = null;
            }
          } else if (stateMatch) {
            draft.cascade.state = stateMatch;
            draft.cascade.city = null;
            draft.cascade.neighborhood = null;
          }

          // Add to recents — ensure uniqueness by both ID AND DisplayName to avoid visual repeats
          draft.recentMarkets = [
            market,
            ...draft.recentMarkets.filter(
              (m) => m.id !== market.id && m.displayName !== market.displayName
            ),
          ].slice(0, 5);
          
          draft.isMarketSelected = true;
        });

        // Resolve geography backend first
        get().resolveGeography().then(() => {
          // Then fire background scrape for the selected market
          triggerBackgroundScrape(market);
        });
      },

      toggleSavedMarket: (market) =>
        set((draft) => {
          const idx = draft.savedMarkets.findIndex((m) => m.id === market.id);
          if (idx >= 0) {
            draft.savedMarkets.splice(idx, 1);
          } else {
            draft.savedMarkets.push(market);
          }
        }),

      resetCascade: () =>
        set((draft) => {
          draft.cascade = DEFAULT_CASCADE;
          draft.isMarketSelected = false;
          draft.geographyStatus = 'unselected';
        }),

      setDiscoveredNeighborhoods: (neighborhoods) =>
        set((draft) => {
          draft.discoveredNeighborhoods = neighborhoods;
        }),

      resolveGeography: async () => {
        // Demo mode has no backend — markets are always "ready".
        if (DEMO_MODE) {
          set({ geographyStatus: 'ready' });
          return;
        }
        set({ geographyStatus: 'resolving' });
        const { cascade } = get();
        const market = deriveMarket(cascade);
        if (!market) {
          set({ geographyStatus: 'unselected' });
          return;
        }

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const res = await fetch(`${apiUrl}/api/geo/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              market_slug: market.id,
              display_name: market.displayName,
              lat: market.lat,
              lng: market.lng,
              country: market.country,
              state_abbr: market.state_province,
              city_name: market.city,
              neighborhood_name: cascade.neighborhood?.name,
              resolution: market.resolution,
            }),
          });
          
          if (res.ok) {
            set({ geographyStatus: 'ready' });
          } else {
            console.error('Geo resolution failed:', await res.text());
            set({ geographyStatus: 'unselected' });
          }
        } catch (err) {
          console.error('Geo resolution error:', err);
          set({ geographyStatus: 'unselected' });
        }
      },
    })),
    {
      name: 'remi-market-store',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;

          // Demo mode: always boot with a selected market + all demo markets
          // in the switcher, so the Command Center never shows "Standby".
          if (DEMO_MODE) {
            const have = new Set(state.recentMarkets.map((m) => m.id));
            state.recentMarkets = [
              ...state.recentMarkets,
              ...DEMO_MARKETS.filter((m) => !have.has(m.id)),
            ];
            if (!state.cascade.city) {
              state.cascade = demoCascadeFor(DEFAULT_DEMO_MARKET);
            }
            state.isMarketSelected = true;
            state.geographyStatus = 'ready';
            return;
          }

          // Force isMarketSelected based on cascade content
          state.isMarketSelected = !!state.cascade.city;

          // Trigger geo resolution if we have a city but status is not ready
          // We use a small delay to ensure the store is fully ready
          if (state.cascade.city && state.geographyStatus !== 'ready') {
            setTimeout(() => {
              state.resolveGeography();
            }, 100);
          }
        }
      },
      partialize: (state) => ({
        cascade: state.cascade,
        recentMarkets: state.recentMarkets,
        savedMarkets: state.savedMarkets,
        isMarketSelected: state.isMarketSelected,
        geographyStatus: state.geographyStatus,
      }),
    },
  ),
);

// ═══════════════════════════════════════════════════
// COMPATIBILITY HOOK: useMarket()
// Drop-in replacement for the old React Context hook.
// Components that call useMarket() will continue to work.
// ═══════════════════════════════════════════════════

export type MarketContextType = {
  currentMarket: Market;
  cascade: GeographicCascade;
  setStateSelection: (state: StateSelection | null) => void;
  setCitySelection: (city: CitySelection | null) => void;
  setNeighborhoodSelection: (neighborhood: NeighborhoodSelection | null) => void;
  setCurrentMarket: (market: Market) => void;
  recentMarkets: Market[];
  savedMarkets: Market[];
  toggleSavedMarket: (market: Market) => void;
  isHydrated: boolean;
  isMarketSelected: boolean;
  geographyStatus: 'unselected' | 'resolving' | 'ready';
  resolveGeography: () => Promise<void>;
};

export function useMarket(): MarketContextType {
  const store = useMarketStore();
  // Selecting the entire cascade ensures reactivity
  const cascade = useMarketStore((s) => s.cascade);
  
  const currentMarket = useMemo(() => deriveMarket(cascade) || FALLBACK_MARKET, [cascade]);
  
  return {
    currentMarket,
    cascade: store.cascade,
    setStateSelection: store.setStateSelection,
    setCitySelection: store.setCitySelection,
    setNeighborhoodSelection: store.setNeighborhoodSelection,
    setCurrentMarket: store.setCurrentMarket,
    recentMarkets: store.recentMarkets,
    savedMarkets: store.savedMarkets,
    toggleSavedMarket: store.toggleSavedMarket,
    isHydrated: store.isHydrated,
    isMarketSelected: store.isMarketSelected,
    geographyStatus: store.geographyStatus,
    resolveGeography: store.resolveGeography,
  };
}
