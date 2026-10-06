// src/services/geocodingService.ts
const PLACES_BASE = 'https://places.googleapis.com/v1';
const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string;

// ─── Public Types ────────────────────────────────────────────────────────────

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;       // "Toronto" — rendered bold in dropdown
  secondaryText: string;  // "Ontario, Canada" — rendered faded
}

export interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  lat: number;
  lng: number;
  viewport: {
    sw: { lat: number; lng: number };
    ne: { lat: number; lng: number };
  } | null;
  addressComponents: AddressComponent[];
}

// ─── Session Tokens ──────────────────────────────────────────────────────────
// Each UUID covers one autocomplete session (keystrokes → selection).
// Passing the SAME token to Place Details bundles both calls into one
// billable session. Rotate after every selection.

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

// ─── Local Map Search ────────────────────────────────────────────────────────

export interface LocalSearchBounds {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}

export async function fetchLocalAddressSuggestions(
  input: string,
  sessionToken: string,
  bounds: LocalSearchBounds | null,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const requestBody: Record<string, unknown> = {
    input,
    sessionToken,
    includedPrimaryTypes: [
      'street_address',
      'route',
      'premise'
    ],
  };

  // If bounds exist, restrict results to the active market's bounding box
  if (bounds) {
    requestBody.locationRestriction = {
      rectangle: {
        low:  { latitude: bounds.sw.lat, longitude: bounds.sw.lng },
        high: { latitude: bounds.ne.lat, longitude: bounds.ne.lng },
      },
    };
  }

  const response = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    throw new Error(`[geocodingService] Local Autocomplete ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();

  return (data.suggestions ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => !!s.placePrediction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any): PlaceSuggestion => ({
      placeId: s.placePrediction.placeId,
      mainText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
      secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }));
}

// ─── Global Autocomplete ─────────────────────────────────────────────────────

export async function fetchAutocompleteSuggestions(
  input: string,
  sessionToken: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const response = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ['us', 'ca'],
      includedPrimaryTypes: [
        'locality',
        'sublocality',
        'administrative_area_level_2',
        'neighborhood',
        'postal_code'
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`[geocodingService] Autocomplete ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();

  return (data.suggestions ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => !!s.placePrediction)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any): PlaceSuggestion => ({
      placeId: s.placePrediction.placeId,
      mainText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
      secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
    }));
}

// ─── Strict Neighborhood Search ────────────────────────────────────────────────

const MAPBOX_BASE = 'https://api.mapbox.com/search/geocode/v6/forward';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Cache: prevents redundant API calls for repeated queries in same city
const searchCache = new Map<string, { results: NeighborhoodSuggestion[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface NeighborhoodSuggestion {
  placeId: string;          // Mapbox mapbox_id
  name: string;             // "Midtown"
  fullAddress: string;      // "Midtown, Sacramento, California, United States"
  latitude: number;
  longitude: number;
  bounds?: [[number, number], [number, number]];
}

/**
 * fetchNeighborhoods — Mapbox Geocoding v6 implementation
 *
 * Advantages over Google Places:
 * 1. `types=neighborhood` is a first-class feature type — no type-guessing
 * 2. `proximity` biases to city center — no hard rectangle that over-filters
 * 3. `autocomplete=true` enables prefix matching ("Mid" → "Midtown")
 * 4. `country=US,CA` restricts to North America
 * 5. Response includes coordinates directly — no separate Place Details call
 * 6. 100K free requests/month, then $0.75/1K (cheaper than Google at scale)
 */
export async function fetchNeighborhoods(
  query: string,
  cityName: string,
  stateName: string,
  cityCenter: { lat: number; lng: number },
  _countryCode: string,       // "US" or "CA" — from GeographicCascade (unused by Mapbox currently)
  signal?: AbortSignal
): Promise<NeighborhoodSuggestion[]> {
  // Guard: don't fire on empty or single-character input
  if (!query || query.trim().length < 2) {
    return [];
  }

  // Check cache first
  const cacheKey = `${query.trim().toLowerCase()}|${cityName}|${stateName}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  // Build Mapbox Geocoding v6 request
  const params = new URLSearchParams({
    q: query.trim(),
    types: 'neighborhood',                           // First-class feature type
    country: 'US,CA',                                 // North America scope
    proximity: `${cityCenter.lng},${cityCenter.lat}`, // Bias toward selected city
    limit: '5',                                       // Max suggestions
    autocomplete: 'true',                             // Prefix matching enabled
    language: 'en',                                   // English results
    access_token: MAPBOX_TOKEN,
  });

  try {
    const response = await fetch(`${MAPBOX_BASE}?${params.toString()}`, {
      method: 'GET',
      signal,
    });

    if (!response.ok) {
      console.error(
        `[geocodingService] Mapbox geocode failed: ${response.status}`,
        await response.text()
      );
      return [];
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: NeighborhoodSuggestion[] = data.features
      .map((feature: Record<string, unknown>) => {
        const props = (feature.properties || {}) as Record<string, unknown>;
        const geom = (feature.geometry || {}) as Record<string, unknown>;
        const coords = props.coordinates as Record<string, number> | undefined;
        const geomCoords = geom.coordinates as number[] | undefined;
        const bbox = feature.bbox as number[] | undefined;
        
        let bounds: [[number, number], [number, number]] | undefined;
        if (bbox && bbox.length === 4) {
          bounds = [
            [bbox[1], bbox[0]], // [minLat, minLon]
            [bbox[3], bbox[2]]  // [maxLat, maxLon]
          ];
        }

        return {
          placeId: (props.mapbox_id as string) || (feature.id as string) || '',
          name: (props.name as string) || (props.name_preferred as string) || '',
          fullAddress: (props.full_address as string) || '',
          latitude: coords?.latitude || geomCoords?.[1] || 0,
          longitude: coords?.longitude || geomCoords?.[0] || 0,
          bounds
        };
      })
      // Post-filter: ensure results are relevant to the selected city/state
      // Mapbox's proximity bias is soft — this catches edge cases
      .filter((r: NeighborhoodSuggestion) => {
        const addr = r.fullAddress.toLowerCase();
        return (
          addr.includes(cityName.toLowerCase()) ||
          addr.includes(stateName.toLowerCase())
        );
      });

    // Cache the results
    searchCache.set(cacheKey, { results, timestamp: Date.now() });

    return results;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return [];
    }
    console.error('[geocodingService] Mapbox geocode error:', error);
    return [];
  }
}

// ─── Place Details ───────────────────────────────────────────────────────────
// sessionToken must match the one used during autocomplete for billing bundling.

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails> {
  const response = await fetch(
    `${PLACES_BASE}/places/${placeId}?sessionToken=${sessionToken}`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'id,location,viewport,addressComponents',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`[geocodingService] Place Details ${response.status}: ${await response.text()}`);
  }

  const d = await response.json();

  return {
    placeId: d.id,
    lat: d.location?.latitude ?? 0,
    lng: d.location?.longitude ?? 0,
    viewport: d.viewport
      ? {
          sw: { lat: d.viewport.low.latitude,  lng: d.viewport.low.longitude  },
          ne: { lat: d.viewport.high.latitude, lng: d.viewport.high.longitude },
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addressComponents: (d.addressComponents ?? []).map((c: any): AddressComponent => ({
      longText:  c.longText,
      shortText: c.shortText,
      types:     c.types,
    })),
  };
}

// ─── Shared Utilities ────────────────────────────────────────────────────────

// Resolves a Google PlaceDetails payload into a REMI Market object
// Resolution order (city) Mirrors Google: locality > sublocality > admin_2
import type { Market } from '../stores/marketStore';

export function placeDetailsToMarket(details: PlaceDetails): Market | null {
  const find = (type: string, key: 'longText' | 'shortText' = 'longText') =>
    details.addressComponents.find((c) => c.types.includes(type))?.[key] ?? '';

  const neighborhood = find('neighborhood') || 
                       find('sublocality_level_1') || 
                       find('sublocality') ||
                       find('colloquial_area');
  const city         = find('locality') || 
                       find('administrative_area_level_2') ||
                       find('administrative_area_level_3');
  const stateShort   = find('administrative_area_level_1', 'shortText');
  const stateLong    = find('administrative_area_level_1', 'longText');
  const country      = find('country', 'shortText') || 'US';

  // Require at minimum a state/province to form a valid Market
  if (!stateShort) {
    console.warn('[geocodingService] No state component found:', details);
    return null;
  }

  const stateSlug = stateShort.toLowerCase();

  // Layer 3: Neighborhood
  if (neighborhood && city) {
    const neighborhoodSlug = neighborhood.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const citySlug = city.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return {
      id:             `${neighborhoodSlug}-${citySlug}-${stateSlug}`,
      city:           neighborhood,
      state_province: stateShort,
      country,
      displayName:    `${neighborhood}, ${city}, ${stateShort}`,
      lat:            details.lat,
      lng:            details.lng,
      bounds:         details.viewport ? [
        [details.viewport.sw.lat, details.viewport.sw.lng],
        [details.viewport.ne.lat, details.viewport.ne.lng],
      ] : undefined,
    };
  }

  // Layer 2: City
  if (city) {
    const citySlug = city.toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return {
      id:             `${citySlug}-${stateSlug}`,
      city,
      state_province: stateShort,
      country,
      displayName:    `${city}, ${stateShort}`,
      lat:            details.lat,
      lng:            details.lng,
      bounds:         details.viewport ? [
        [details.viewport.sw.lat, details.viewport.sw.lng],
        [details.viewport.ne.lat, details.viewport.ne.lng],
      ] : undefined,
    };
  }

  // Layer 1: State / Province / Territory
  return {
    id:             `${stateLong.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${stateSlug}`,
    city:           stateLong,
    state_province: stateShort,
    country,
    displayName:    `${stateLong}, ${country}`,
    lat:            details.lat,
    lng:            details.lng,
    bounds:         details.viewport ? [
      [details.viewport.sw.lat, details.viewport.sw.lng],
      [details.viewport.ne.lat, details.viewport.ne.lng],
    ] : undefined,
  };
}

// Splits text into [matched, remainder] for bold prefix highlighting
export function splitMatch(
  text: string,
  query: string
): [string, string] | null {
  if (!query.trim()) return null;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerText.startsWith(lowerQuery)) return null;
  return [text.slice(0, query.length), text.slice(query.length)];
}
