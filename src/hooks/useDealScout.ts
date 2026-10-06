import { useState, useEffect } from 'react';
import { useMarket } from '../stores/marketStore';
import { getOrCreateUserId } from '../lib/auth-utils';
import { DEMO_MODE, getMockDealScoutForMarket } from '../demo/mockData';

export interface DealOpportunity {
  property_id: string;
  address: string;
  deal_score: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  dom: number;
  why: string;
  actions: { label: string; action: string }[];
  // Vocabulary toggle fields (from canonical_properties)
  deal_category?: string | null;
  price_per_sqft?: number | null;
  percent_above_market?: number | null;
  market_baseline_ppsf?: number | null;
  // Investor scoring (Sprint 3) — null means not applicable for this user's profile
  investor_score?: number | null;
}

export interface DealScoutResponse {
  status: 'success' | 'incomplete' | 'no_matches' | 'insufficient_data' | 'capped';
  missing?: 'profile' | 'location' | 'data';
  opportunities?: DealOpportunity[];
  message?: string;
  profile_summary?: string;
  action?: { type: string; target: string };
  total?: number;
  cascade?: string;
  new_alerts?: number;
}

export function useDealScout() {
  const { cascade, currentMarket, isMarketSelected } = useMarket();
  if (DEMO_MODE) {
    return { data: getMockDealScoutForMarket(currentMarket.id), isLoading: false, error: null as Error | null };
  }

  const [data, setData] = useState<DealScoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Guard: Don't fetch if no market is selected or cascade is incomplete
  const canFetch = isMarketSelected && currentMarket?.id && currentMarket.id !== 'north-america';

  useEffect(() => {
    let isMounted = true;

    async function fetchDealScout() {
      // Validate market is properly selected (not fallback)
      if (!canFetch) {
        if (isMounted) {
          setData(null);
          setError(null);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const userId = getOrCreateUserId();
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        // Compute fingerprint identically to backend GeographicCascadePayload.recompute_fingerprint
        const country = cascade.state!.country;
        const stateCode = cascade.state!.abbr.toUpperCase();
        const city = cascade.city!.name.toLowerCase().trim();
        const neighborhoodPart = cascade.neighborhood ? cascade.neighborhood.name.toLowerCase().trim() : "__none__";
        const canonical = `${country}|${stateCode}|${city}|${neighborhoodPart}`;
        const msgBuffer = new TextEncoder().encode(canonical);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Build payload matching GeographicCascadePayload exactly
        const payload = {
          country_code: cascade.state!.country,
          state_code: cascade.state!.abbr,
          state_name: cascade.state!.name,
          city_name: cascade.city!.name,
          city_center: {
            lat: cascade.city!.lat,
            lng: cascade.city!.lng,
          },
          city_bounds: cascade.city!.bounds ? {
            sw: { lat: cascade.city!.bounds[0][0], lng: cascade.city!.bounds[0][1] },
            ne: { lat: cascade.city!.bounds[1][0], lng: cascade.city!.bounds[1][1] },
          } : {
            // Fallback to strict reasonable bounds if not provided
            sw: { lat: cascade.city!.lat - 0.1, lng: cascade.city!.lng - 0.1 },
            ne: { lat: cascade.city!.lat + 0.1, lng: cascade.city!.lng + 0.1 },
          },
          neighborhood: cascade.neighborhood ? {
            name: cascade.neighborhood.name,
            center: {
              lat: cascade.neighborhood.lat,
              lng: cascade.neighborhood.lng,
            }
          } : null,
          fingerprint,
        };

        const res = await fetch(`${apiUrl}/api/deal-scout/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Deal Scout API error: ${res.status} ${res.statusText} - ${errorText}`);
        }

        const response = await res.json();
        if (isMounted) {
          setData(response as DealScoutResponse);
          setError(null);
        }
      } catch (err) {
        console.error("Deal Scout Evaluation Error", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDealScout();

    // Enhanced event listeners for profile updates
    const handleDominoUpdate = () => {
      console.log('[Deal Scout] Received remi:domino_update event, refreshing');
      fetchDealScout();
    };

    const handleProfileUpdate = () => {
      console.log('[Deal Scout] Received remi:profile_update event, refreshing');
      fetchDealScout();
    };

    window.addEventListener('remi:domino_update', handleDominoUpdate);
    window.addEventListener('remi:profile_update', handleProfileUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('remi:domino_update', handleDominoUpdate);
      window.removeEventListener('remi:profile_update', handleProfileUpdate);
    };
  }, [canFetch, currentMarket, cascade, isMarketSelected]); // ✅ Fixed: Added cascade and full currentMarket to deps

  return { data, isLoading, error };
}