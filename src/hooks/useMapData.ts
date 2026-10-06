/**
 * useMapData — Fetches live listings from the backend's session_properties
 * table for the Map and Analytics views. 
 * Linked natively to the Domino Effect realtime events.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useMarket } from '../stores/marketStore';
import { useJobStore } from '../stores/jobStore';
import { subscribeToDominoEvents, PipelineTrace } from '../lib/pipeline-trace';
import type { Property } from '../types';
import type { CanonicalPropertyRow } from '../types/database';
import { useRealtimeProperties } from './useRealtimeProperties';
import { DEMO_MODE, getMockPropertiesForMarket, getMockPulseForMarket, getMockPriceTrendForMarket } from '../demo/mockData';

/** Validate if a URL points to a specific property detail page vs a generic search page */
function isValidListingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  
  if (!lowerUrl.startsWith('http')) return false;
  
  const searchPatterns = [
    '/homes/for_sale', '/homes/for_rent', '/homes/sold',
    '/realestateandhomes-search', 'search.html', '?search='
  ];
  if (searchPatterns.some(p => lowerUrl.includes(p))) return false;
  
  // Detail pages usually have a numeric ID (5+ digits) or a specific path segment
  const hasNumericId = /\d{5,}/.test(url);
  const isDetailPage = lowerUrl.includes('/homedetails/') || lowerUrl.includes('/building/');
  
  return hasNumericId || isDetailPage;
}

/** Build a real listing URL or return null if no valid direct link exists */
export function getPropertyUrl(storedUrl?: string | null): string | null {
  // Only return the stored URL if it's a valid, high-fidelity property detail page.
  // This prevents the "Price Unknown" fuzzy search experience.
  if (isValidListingUrl(storedUrl)) return storedUrl!;
  
  return null;
}

/** Map the canonical_properties schema to the Property type used by MapView and Dashboard */
export function rowToProperty(row: CanonicalPropertyRow): Property | null {
  // Skip if no lat/lng — can't place on map
  if (!row.lat || !row.lng) return null;

  // Derive a display address — address_norm is lowercase, do a quick title-case pass
  const displayAddress = row.address_norm
    ? row.address_norm.replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown Address';

  // Derive listingStatus from tenure
  const listingStatusMap: Record<string, Property['listingStatus']> = {
    sale: 'for_sale',
    for_sale: 'for_sale',
    sold: 'sold',
    rent: 'for_rent',
    for_rent: 'for_rent',
    rental: 'for_rent',
    airbnb: 'for_rent',
  };
  const listingStatus = listingStatusMap[row.tenure ?? 'for_sale'] ?? 'for_sale';

  // Derive listing URL: prefer top-level listing_url column (new), then fall back
  // to source_payload_ref JSON (legacy), then generate a high-precision search URL.
  const topLevelListingUrl = (row as Record<string, unknown>).listing_url as string | null | undefined;
  const payloadListingUrl = (row.source_payload_ref as { listing_url?: string } | null)?.listing_url;
  const listingUrl = topLevelListingUrl || payloadListingUrl || null;

  // Image URL: filter out falsy values and use the first valid URL.
  // Handles single string, array of strings, or undefined.
  const rawImageUrls = row.image_urls;
  const imageUrls = Array.isArray(rawImageUrls)
    ? rawImageUrls.filter((url): url is string => typeof url === 'string' && url.trim() !== '')
    : typeof rawImageUrls === 'string' && (rawImageUrls as string).trim() !== ''
      ? [rawImageUrls as string]
      : row.image_url ? [row.image_url] : [];

  // if (!imageUrls.length) {
  //   // Production monitoring: silenced to reduce console spam during data load.
  //   // Issue is tracked in enrichment pipeline monitoring dashboard.
  // }

  return {
    id: row.id,
    address: displayAddress,
    price: row.last_price || 0,
    bedrooms: row.bedrooms || 0,
    bathrooms: row.bathrooms || 0,
    sqft: row.sqft || 0,
    propertyType: (row.property_type ?? 'condo') as Property['propertyType'],
    neighborhood: '',
    listingAgent: '',
    listingStatus,
    dealScore: row.deal_score ?? null,
    lat: row.lat,
    lng: row.lng,
    zillowUrl: getPropertyUrl(listingUrl) || '',
    city: displayAddress.split(',')[1]?.trim() || row.market_slug?.split('-').slice(0, -2).join(' ') || 'Unknown',
    state_province: displayAddress.split(',')[2]?.trim().split(' ').find(p => /^[A-Z]{2}$/.test(p))
      || row.market_slug?.split('-').slice(-2, -1)[0]?.toUpperCase() || '',
    investmentScore: 5,
    listedAt: row.last_seen_at?.split('T')[0] ?? '',
    updatedAt: row.last_seen_at?.split('T')[0] ?? '',
    daysOnMarket: row.days_on_market ?? 0,
    yearBuilt: 0,
    description: '',
    imageUrls: imageUrls,
    priceTier: row.price_tier || '',
    sizeCategory: row.size_category || '',
    dealCategory: row.deal_category || '',
    pricePerSqft: row.price_per_sqft || 0,
    sourceJobId: row.source_job_id || null,
  };
}

interface UseMapDataReturn {
  properties: Property[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

/**
 * useMapData
 *
 * Primary data hook for the Map tab. Reads canonical_properties from Supabase
 * and subscribes to Realtime INSERTs for live pin drops.
 *
 * @param analysisType - Filter by scan type: 'for_sale' | 'rental' | 'sold' | etc.
 *                       When provided, only properties with matching tenure are shown.
 *                       When omitted, shows all properties for the market.
 */
export function useMapData(analysisType?: string): UseMapDataReturn {
  const { currentMarket } = useMarket();
  if (DEMO_MODE) {
    const properties = getMockPropertiesForMarket(currentMarket.id, analysisType);
    return {
      properties,
      loading: false,
      error: null,
      totalCount: properties.length,
      refetch: () => {},
    };
  }
  const marketSlug = currentMarket.id;
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Derive the tenure filter from analysis_type
  const tenureFilter = analysisType ? _analysisTypeToTenure(analysisType) : null;

  // Track the last job ID we re-fetched for — prevents re-fetching the same completion twice
  const lastCompletedJobRef = useRef<string | null>(null);

  const fetchMapData = useCallback(async () => {
    // Check if we have a market selected first
    if (!marketSlug) {
      setProperties([]);
      setTotalCount(0);
      setLoading(false);
      setError("No market selected. Please select a market to view properties.");
      return;
    }

    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      let query = supabase
        .from('canonical_properties')
        .select('id, address_norm, lat, lng, last_price, bedrooms, bathrooms, sqft, property_type, tenure, deal_score, deal_category, days_on_market, market_slug, last_seen_at, source_job_id, image_url, image_urls, listing_url, price_tier, size_category, price_per_sqft, unit_norm, currency')
        .eq('market_slug', marketSlug)
        .order('deal_score', { ascending: false })
        .limit(500);

      if (tenureFilter) {
        query = query.eq('tenure', tenureFilter);
      }

      const { data, error: sbError } = await query;
      if (sbError) throw sbError;

      const rawRows = (data ?? []) as CanonicalPropertyRow[];
      const mapped = rawRows
        .map(rowToProperty)
        .filter((p): p is Property => p !== null);

      setProperties(mapped);
      setTotalCount(mapped.length);

      PipelineTrace.log('map_rendered', {
        market_slug: marketSlug,
        tenure: tenureFilter ?? 'all',
        count: mapped.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to fetch map data: ${errorMessage}`);
      console.error('[useMapData] Failed to fetch map listings:', err);
    } finally {
      setLoading(false);
    }
  }, [marketSlug, tenureFilter]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Re-fetch from DB when the active scan job for this market completes.
  // This ensures scored properties (written by score_node after ingestion) are loaded
  // even if the realtime UPDATE events were missed or arrived before scoring finished.
  const activeJob = useJobStore(s => marketSlug ? s.getActiveJobForMarket(marketSlug) : null);
  useEffect(() => {
    if (!activeJob) return;
    const isTerminal = activeJob.status === 'completed' || activeJob.status === 'completed_empty' || activeJob.status === 'completed_stale' || activeJob.status === 'partial_success' || activeJob.status === 'failed';
    if (!isTerminal) return;
    if (lastCompletedJobRef.current === activeJob.jobId) return;
    lastCompletedJobRef.current = activeJob.jobId;
    fetchMapData();
  }, [activeJob?.jobId, activeJob?.status, fetchMapData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription — new pins drop live during scanning
  useRealtimeProperties({
    marketSlug,
    onFallbackFetch: fetchMapData,
    onPropertyFound: useCallback((newProperty: Property) => {
      // Filter by tenure if an analysis type is active
      // Use tenureFilter (DB value like "for_rent") not analysisType ("rental") for comparison
      if (tenureFilter && newProperty.listingStatus !== tenureFilter) {
        return;
      }
      setProperties(prev => {
        const idx = prev.findIndex(p => p.id === newProperty.id);
        if (idx >= 0) {
          // UPDATE: replace in-place so score/field changes (from score_node) land in state
          const next = [...prev];
          next[idx] = newProperty;
          return next;
        }
        return [newProperty, ...prev];
      });
      setTotalCount(prev => prev + 1);
    }, [tenureFilter]),
  });

  // Domino event subscription: batch-refresh after ingestion completes
  // Distinct from useRealtimeProperties (which handles live row-by-row INSERTs).
  // This handles the SCORED batch insert where the backend inserts a domino_events
  // row AFTER all properties + scores have been written, ensuring the map shows
  // the final scored version, not just the raw unscored rows.
  useEffect(() => {
    if (!marketSlug) return;
    const unsubscribe = subscribeToDominoEvents(
      (payload) => {
        PipelineTrace.log('properties_fetched', {
          job_id: payload.job_id,
          market_slug: payload.market_slug,
          tenure: tenureFilter ?? 'all',
          count: payload.properties_count,
          detail: { trigger: 'domino_batch_refresh' },
        });
        fetchMapData();
      },
      { market_slug: marketSlug }
    );
    return unsubscribe;
  }, [marketSlug, tenureFilter, fetchMapData]);

  return { properties, loading, error, totalCount, refetch: fetchMapData };
}

/** Map analysis_type → tenure value stored in canonical_properties */
function _analysisTypeToTenure(analysisType: string): string {
  const map: Record<string, string> = {
    for_sale: 'for_sale',
    sold: 'sold',
    rental: 'for_rent',
    for_rent: 'for_rent',
  };
  return map[analysisType] ?? 'for_sale';
}

/** useMarketPulse — Computes live market pulse metrics from Supabase data */
import { getOrCreateUserId } from '../lib/auth-utils';

export function useMarketPulse() {
  const { cascade, currentMarket } = useMarket();
  if (DEMO_MODE) return getMockPulseForMarket(currentMarket.id);
  const [pulse, setPulse] = useState({
    hotDeals: 0,
    newListings: 0,
    priceDrops: 0,
    avgDom: 0,
    trendingArea: cascade.city?.name || 'Local',
    lastSynced: '',
    source: 'Live Market Data',
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPulse() {
      if (!currentMarket?.id) return;

      try {
        const userId = getOrCreateUserId();
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/v1/dashboard/pulse?market_slug=${currentMarket.id}`, {
          headers: {
            'x-user-id': userId
          }
        });
        
        if (!res.ok) {
          throw new Error(`Pulse API error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        
        if (cancelled) return;

        setPulse({
          hotDeals: data.hot_deals || 0,
          newListings: data.new_listings_24h || 0,
          priceDrops: data.price_drops || 0,
          avgDom: data.avg_dom || 0,
          trendingArea: cascade.city?.name || 'Local',
          lastSynced: 'Just now',
          source: 'Live Market Data',
        });
      } catch (err) {
        console.error('[useMarketPulse] Error fetching pulse:', err);
      }
    }

    fetchPulse();
    
    // Add event listener here as well for Domino Effect
    const handleDominoUpdate = () => fetchPulse();
    window.addEventListener('remi:domino_update', handleDominoUpdate);
    
    return () => {
      cancelled = true;
      window.removeEventListener('remi:domino_update', handleDominoUpdate);
    };
  }, [currentMarket?.id, cascade.city?.name]);

  return pulse;
}

export function usePriceTrend() {
  const { currentMarket } = useMarket();
  if (DEMO_MODE) return getMockPriceTrendForMarket(currentMarket.id);
  const [trend, setTrend] = useState<{name: string, soldAvg: number, forSaleAvg: number}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrend() {
      if (!currentMarket?.id) return;
      setLoading(true);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/v1/dashboard/price-trend?market_slug=${currentMarket.id}`, {
          headers: {
            'x-user-id': 'system' // Using system since it is read-only public market data
          }
        });
        
        if (!res.ok) {
          throw new Error(`Trend API error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        
        if (cancelled) return;

        setTrend((data.points || []).map((p: {name: string, sold_ppsf: number, for_sale_ppsf: number}) => ({
          name: p.name,
          soldAvg: p.sold_ppsf || 0,
          forSaleAvg: p.for_sale_ppsf || 0
        })));
      } catch (err) {
        console.error('[usePriceTrend] Error fetching trend:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrend();
    
    return () => {
      cancelled = true;
    };
  }, [currentMarket?.id]);

  return { trend, loading };
}
