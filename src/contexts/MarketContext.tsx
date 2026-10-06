import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useDominoListener } from '../hooks/useDominoListener';

// Legacy shape required by downstream consumers
export interface Market {
  id: string;            // Most specific slug: "midtown-sacramento-ca" or "sacramento-ca"
  city?: string;          
  state_province?: string; 
  abbr?: string;         
  country: string;       
  displayName: string;   // "Midtown, Sacramento, CA"
  lat: number;           
  lng: number;           
  bounds?: [[number, number], [number, number]];
  resolution?: 'state' | 'city' | 'neighborhood';
}

// Layer 1: State/Province/Territory
export interface StateSelection {
  id: string;              // "california-ca"
  name: string;            // "California"
  abbr: string;            // "CA"
  country: 'US' | 'CA';
  bounds?: [[number, number], [number, number]];
}

// Layer 2: City
export interface CitySelection {
  id: string;              // "sacramento-ca"
  name: string;            // "Sacramento"
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  placeId?: string;         
}

// Layer 3: Neighborhood
export interface NeighborhoodSelection {
  id: string;              // "midtown-sacramento-ca"
  name: string;            // "Midtown"
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  placeId?: string;
}

export interface GeographicCascade {
  state: StateSelection | null;
  city: CitySelection | null;
  neighborhood: NeighborhoodSelection | null;
  fingerprint?: string;
}

export type MarketContextType = {
  currentMarket: Market; // Never null thanks to fallback
  cascade: GeographicCascade;
  setStateSelection: (state: StateSelection | null) => void;
  setCitySelection: (city: CitySelection | null) => void;
  setNeighborhoodSelection: (neighborhood: NeighborhoodSelection | null) => void;
  
  // Backwards compatibility layer
  setCurrentMarket: (market: Market) => void;
  recentMarkets: Market[];
  savedMarkets: Market[];
  toggleSavedMarket: (market: Market) => void;
  isHydrated: boolean;
};

// Default cascade is now empty to force explicit selection or dynamic resolution
const DEFAULT_CASCADE: GeographicCascade = {
  state: null,
  city: null,
  neighborhood: null
};

// The raw list of supported STATE territories for the first dropdown
// eslint-disable-next-line react-refresh/only-export-components
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

const MOCK_RECENT_MARKETS: Market[] = [];
const MOCK_SAVED_MARKETS: Market[] = [];

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const LS_CASCADE = 'remi_geographic_cascade';
const LS_RECENT_MARKETS = 'remi_recent_markets';
const LS_SAVED_MARKETS = 'remi_saved_markets';

function loadMarketData<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return parsed;
  } catch {
    return fallback;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const FALLBACK_MARKET: Market = {
  id: 'select-market',
  city: 'Select City',
  state_province: '',
  country: 'US',
  displayName: 'Select a Market',
  lat: 40.7128, // Defaulting to central US or a neutral point
  lng: -74.0060,
};

export function MarketProvider({ children }: { children: ReactNode }) {
  const [cascade, setCascadeStateInner] = useState<GeographicCascade>(DEFAULT_CASCADE);
  const [recentMarkets, setRecentMarkets] = useState<Market[]>(MOCK_RECENT_MARKETS);
  const [savedMarkets, setSavedMarkets] = useState<Market[]>(MOCK_SAVED_MARKETS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Try to load cascade, fallback to default
    const savedCascade = loadMarketData<GeographicCascade>(LS_CASCADE, DEFAULT_CASCADE);
    // basic validation
    
    // Defer state update to next tick to avoid synchronous update in effect
    setTimeout(() => {
      let initialCascade = DEFAULT_CASCADE;
      if (savedCascade && savedCascade.state && typeof savedCascade.state.id === 'string') {
        initialCascade = savedCascade;
      }
      setCascadeStateInner(() => initialCascade);
      setRecentMarkets(() => loadMarketData<Market[]>(LS_RECENT_MARKETS, MOCK_RECENT_MARKETS));
      setSavedMarkets(() => loadMarketData<Market[]>(LS_SAVED_MARKETS, MOCK_SAVED_MARKETS));
      setIsHydrated(true);
    }, 0);
  }, []);

  // Hook up the Realtime Domino Listener
  useDominoListener(cascade.fingerprint || null);

  const updateCascade = (newCascade: GeographicCascade) => {
    setCascadeStateInner(newCascade);
    localStorage.setItem(LS_CASCADE, JSON.stringify(newCascade));
  };

  const setStateSelection = (state: StateSelection | null) => {
    updateCascade({ state, city: null, neighborhood: null });
  };

  const setCitySelection = (city: CitySelection | null) => {
    updateCascade({ ...cascade, city, neighborhood: null });
  };

  const setNeighborhoodSelection = (neighborhood: NeighborhoodSelection | null) => {
    updateCascade({ ...cascade, neighborhood });
  };

  const currentMarket = useMemo((): Market | null => {
    const { state, city, neighborhood } = cascade;
    if (neighborhood && city && state) {
      return {
        id: `${neighborhood.name.toLowerCase().replace(/\s+/g, '-')}-${city.id}`,
        city: city.name,
        state_province: state.abbr,
        country: state.country,
        displayName: `${neighborhood.name}, ${city.name}, ${state.abbr}`,
        resolution: 'neighborhood',
        lat: neighborhood.lat,
        lng: neighborhood.lng,
        bounds: neighborhood.bounds ?? city.bounds
      };
    }
    if (city && state) {
      return {
        id: city.id,
        city: city.name,
        state_province: state.abbr,
        country: state.country,
        displayName: `${city.name}, ${state.abbr}`,
        resolution: 'city',
        lat: city.lat,
        lng: city.lng,
        bounds: city.bounds
      };
    }
    if (state) {
      return {
        id: state.id,
        state_province: state.abbr,
        country: state.country,
        displayName: `${state.name}, ${state.country}`,
        resolution: 'state',
        lat: state.bounds ? (state.bounds[0][0] + state.bounds[1][0]) / 2 : 0,
        lng: state.bounds ? (state.bounds[0][1] + state.bounds[1][1]) / 2 : 0,
        bounds: state.bounds ?? undefined
      };
    }
    return null; // The strict null case
  }, [cascade]);

  // Backwards compat layer for components manually pushing a "Market" (like from saved or recent)
  const setCurrentMarket = (market: Market) => {
    // We attempt to derive the cascade backwards.
    // This is a naive heuristic because Market represents a flat derived state.
    // For a robust implementation, those places should use the cascade setter directly.
    
    // Quick and dirty "state" lookup:
    const stateMatch = market.state_province 
      ? SUPPORTED_TERRITORIES.find(t => t.abbr === market.state_province)
      : SUPPORTED_TERRITORIES.find(t => t.id === market.id);

    if (stateMatch && market.city) {
      // It's a city or neighborhood layer based on resolution
      if (market.resolution === 'neighborhood') {
        const parts = market.displayName.split(', ');
        const nName = parts[0] || market.displayName;
        updateCascade({
          state: stateMatch,
          city: {
            id: market.city.toLowerCase().replace(/\s+/g, '-') + '-' + stateMatch.abbr.toLowerCase(),
            name: market.city,
            lat: market.lat,
            lng: market.lng,
            bounds: market.bounds
          },
          neighborhood: {
            id: market.id,
            name: nName,
            lat: market.lat,
            lng: market.lng,
            bounds: market.bounds
          }
        });
      } else {
        updateCascade({
          state: stateMatch,
          city: {
            id: market.id,
            name: market.city,
            lat: market.lat,
            lng: market.lng,
            bounds: market.bounds
          },
          neighborhood: null
        });
      }
    } else if (stateMatch) {
      updateCascade({
        state: stateMatch,
        city: null,
        neighborhood: null
      });
    }

    // Add to recents using the derived market so shape stays consistent
    setRecentMarkets((prev) => {
      const filtered = prev.filter(m => m.id !== market.id);
      const updated = [market, ...filtered].slice(0, 5);
      localStorage.setItem(LS_RECENT_MARKETS, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSavedMarket = (market: Market) => {
    setSavedMarkets(prev => {
      const isSaved = prev.some(m => m.id === market.id);
      const updated = isSaved 
        ? prev.filter(m => m.id !== market.id)
        : [...prev, market];

      localStorage.setItem(LS_SAVED_MARKETS, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <MarketContext.Provider value={{
      currentMarket: currentMarket || FALLBACK_MARKET,  // <-- CRITICAL: Protects downstream consumers from `null` crashes during transition phase. We can remove fallback once all components natively observe null states.
      cascade,
      setStateSelection,
      setCitySelection,
      setNeighborhoodSelection,
      setCurrentMarket,
      recentMarkets,
      savedMarkets,
      toggleSavedMarket,
      isHydrated
    }}>
      {children}
    </MarketContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
