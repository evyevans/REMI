/**
 * useOntologyData — Hooks for fetching from the /api/ontology/* endpoints.
 *
 * Provides reactive data access for Map OS components:
 *   - useOntologyProperties: spatial + filter queries
 *   - useOntologyRegions: neighborhood boundaries
 *   - usePropertyDossier: full property detail panel
 *   - useOntologySearch: unified search bar
 */

import { useEffect, useState, useCallback } from 'react';
import type { OntologyProperty, OntologyEvent, OntologyRegion, PropertyDossier } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Generic fetcher ─────────────────────────────────────── */

async function ontologyFetch<T>(path: string): Promise<T | null> {
  try {
    // Normalize path: always go through /api prefix to hit the Vite proxy
    const normalizedPath = path.replace(/^\/v1\//, '/api/v1/');
    const res = await fetch(`${API_BASE}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`);
    if (!res.ok) throw new Error(`Ontology API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[useOntologyData] ${path} failed:`, err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════ */
/* useOntologyRegions — Fetch neighborhood boundaries         */
/* ═══════════════════════════════════════════════════════════ */

interface UseOntologyRegionsReturn {
  regions: OntologyRegion[];
  loading: boolean;
}

export function useOntologyRegions(): UseOntologyRegionsReturn {
  const [regions, setRegions] = useState<OntologyRegion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRegions() {
      const result = await ontologyFetch<{ data: OntologyRegion[] }>('/v1/ontology/regions?type=neighborhood');
      if (mounted && result?.data) {
        setRegions(result.data);
      }
      if (mounted) setLoading(false);
    }

    fetchRegions();
    return () => { mounted = false; };
  }, []);

  return { regions, loading };
}

/* ═══════════════════════════════════════════════════════════ */
/* useOntologyEvents — Fetch market events for map layers     */
/* ═══════════════════════════════════════════════════════════ */

interface UseOntologyEventsReturn {
  events: OntologyEvent[];
  loading: boolean;
  refetch: () => void;
}

export function useOntologyEvents(
  eventTypes?: string[] | string,
  since?: string,
): UseOntologyEventsReturn {
  const [events, setEvents] = useState<OntologyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable string key — prevents callers passing a new array literal each render
  // (e.g. `[currentMarket.id]`) from triggering an infinite fetch loop.
  const eventTypesKey = Array.isArray(eventTypes)
    ? eventTypes.join(',')
    : (eventTypes ?? '');

  const fetchEvents = useCallback(async () => {
    if (!eventTypesKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set('type', eventTypesKey);
    if (since) params.set('since', since);
    params.set('limit', '200');

    const result = await ontologyFetch<{ data: OntologyEvent[] }>(`/api/v1/ontology/events?${params}`);
    if (result?.data) setEvents(result.data);
    setLoading(false);
  }, [eventTypesKey, since]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}

/* ═══════════════════════════════════════════════════════════ */
/* usePropertyDossier — Full property detail for panel        */
/* ═══════════════════════════════════════════════════════════ */

interface UsePropertyDossierReturn {
  dossier: PropertyDossier | null;
  loading: boolean;
  error: string | null;
}

export function usePropertyDossier(propertyId: string | null): UsePropertyDossierReturn {
  const [dossier, setDossier] = useState<PropertyDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDossier(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    async function fetchDossier() {
      const result = await ontologyFetch<PropertyDossier>(`/v1/ontology/properties/${propertyId}/full`);
      if (mounted) {
        if (result) {
          setDossier(result);
        } else {
          setError('Failed to load property details');
        }
        setLoading(false);
      }
    }

    fetchDossier();
    return () => { mounted = false; };
  }, [propertyId]);

  return { dossier, loading, error };
}

/* ═══════════════════════════════════════════════════════════ */
/* useOntologySearch — Unified search (addresses + regions)   */
/* ═══════════════════════════════════════════════════════════ */

interface SearchResult {
  properties: OntologyProperty[];
  regions: OntologyRegion[];
  suggestions: string[];
}

interface UseOntologySearchReturn {
  results: SearchResult | null;
  loading: boolean;
  search: (query: string) => void;
}

export function useOntologySearch(): UseOntologySearchReturn {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    const result = await ontologyFetch<SearchResult>(`/v1/ontology/search?q=${encodeURIComponent(query)}`);
    setResults(result);
    setLoading(false);
  }, []);

  return { results, loading, search };
}
