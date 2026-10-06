import { useState, useEffect, useRef, useCallback } from 'react';
import { MAJOR_CITIES, type CityDefinition } from '../utils/cities';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitySearchResult extends CityDefinition {
  source: 'static' | 'api';
  placeId?: string;
  secondaryText?: string; // "Georgia, USA" — for disambiguation
}

// ─── Google Places (New) API — City Autocomplete ─────────────────────────────

const PLACES_BASE = 'https://places.googleapis.com/v1';
const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string;

interface PlacesPrediction {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

interface PlacesDetailResponse {
  location?: { latitude: number; longitude: number };
  viewport?: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
}

async function searchCitiesAPI(
  query: string,
  stateAbbr: string,
  country: 'US' | 'CA',
  signal?: AbortSignal
): Promise<CitySearchResult[]> {
  if (!API_KEY) return [];

  const response = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: [country.toLowerCase()],
      includedPrimaryTypes: ['locality'],  // Cities only
    }),
    signal,
  });

  if (!response.ok) {
    console.error(`[useCitySearch] Autocomplete ${response.status}`);
    return [];
  }

  const data = await response.json();
  const suggestions: PlacesPrediction[] = (data.suggestions ?? []).filter(
    (s: Record<string, unknown>) => !!s.placePrediction
  );

  // Filter predictions to the selected state by checking secondaryText
  const stateUpper = stateAbbr.toUpperCase();
  const filtered = suggestions.filter((s) => {
    const secondary = s.placePrediction.structuredFormat.secondaryText.text;
    return secondary.includes(stateUpper) || secondary.includes(stateAbbr);
  });

  return filtered.map((s) => ({
    name: s.placePrediction.structuredFormat.mainText.text,
    secondaryText: s.placePrediction.structuredFormat.secondaryText.text,
    placeId: s.placePrediction.placeId,
    lat: 0,  // Resolved on selection via fetchCityDetails
    lng: 0,
    source: 'api' as const,
  }));
}

export async function fetchCityDetails(placeId: string): Promise<{
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
} | null> {
  if (!API_KEY) return null;

  const response = await fetch(
    `${PLACES_BASE}/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'location,viewport',
      },
    }
  );

  if (!response.ok) {
    console.error(`[useCitySearch] Place Details ${response.status}`);
    return null;
  }

  const d: PlacesDetailResponse = await response.json();
  if (!d.location) return null;

  return {
    lat: d.location.latitude,
    lng: d.location.longitude,
    bounds: d.viewport
      ? [
          [d.viewport.low.latitude, d.viewport.low.longitude],
          [d.viewport.high.latitude, d.viewport.high.longitude],
        ]
      : undefined,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCitySearch(
  query: string,
  stateId: string | null,
  stateAbbr: string | null,
  country: 'US' | 'CA' | null
) {
  const [apiResults, setApiResults] = useState<CitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Static results — instant from local data
  const staticResults: CitySearchResult[] = stateId
    ? (MAJOR_CITIES[stateId] || [])
        .filter((c) =>
          !query.trim() || c.name.toLowerCase().includes(query.toLowerCase())
        )
        .map((c) => ({ ...c, source: 'static' as const }))
    : [];

  // Debounced API search — fires 300ms after user stops typing
  const searchAPI = useCallback(
    async (q: string) => {
      if (!stateAbbr || !country || q.length < 2) {
        setApiResults([]);
        return;
      }

      // Cancel previous in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSearching(true);
      try {
        const results = await searchCitiesAPI(q, stateAbbr, country, controller.signal);
        // Dedupe: remove API results that match static results by name
        const staticNames = new Set(staticResults.map((r) => r.name.toLowerCase()));
        const deduped = results.filter((r) => !staticNames.has(r.name.toLowerCase()));
        setApiResults(deduped);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('[useCitySearch] API error:', err);
        }
        setApiResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateAbbr, country, stateId]
  );

  useEffect(() => {
    if (query.length < 2) {
      setApiResults([]);
      return;
    }

    const timer = setTimeout(() => searchAPI(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchAPI]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Merged results: static first, then API results
  const results: CitySearchResult[] = [...staticResults, ...apiResults];

  return { results, isSearching, hasApiKey: !!API_KEY };
}
