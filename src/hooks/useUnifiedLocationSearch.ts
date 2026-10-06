// src/hooks/useUnifiedLocationSearch.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchAutocompleteSuggestions,    // no locationRestriction — all NA
  fetchLocalAddressSuggestions,    // with locationRestriction
  fetchPlaceDetails,
  generateSessionToken,
  type PlaceSuggestion,
} from '../services/geocodingService';
import { placeDetailsToMarket } from '../services/geocodingService';
import type { Market } from '../stores/marketStore';

export type SearchMode = 'market' | 'address';

export interface UnifiedSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: PlaceSuggestion[];
  mode: SearchMode;
  isSearching: boolean;
  isLoadingDetails: boolean;
  selectSuggestion: (s: PlaceSuggestion) => Promise<
    | { type: 'market'; market: Market }
    | { type: 'address'; lat: number; lng: number; label: string }
    | null
  >;
  clearSearch: () => void;
}

export function detectQueryMode(query: string): SearchMode {
  // Address pattern: starts with digits or contains street suffix
  const addressPattern = /^\d+\s|\b(st|ave|blvd|dr|rd|ln|ct|pl|way|hwy)\b/i;
  return addressPattern.test(query.trim()) ? 'address' : 'market';
}

export function useUnifiedLocationSearch(
  currentMarket: Market
): UnifiedSearchReturn {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [mode, setMode] = useState<SearchMode>('market');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Session token survives re-renders via ref — only rotates on selection
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortControllerRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const detectedMode = detectQueryMode(trimmed);
    setMode(detectedMode);
    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      try {
        let results: PlaceSuggestion[];
        
        if (detectedMode === 'market') {
          // NO locationRestriction — full North America city search
          results = await fetchAutocompleteSuggestions(
            trimmed,
            sessionTokenRef.current,
            abortControllerRef.current.signal
          );
        } else {
          // WITH locationRestriction — addresses within active market
          results = await fetchLocalAddressSuggestions(
            trimmed,
            sessionTokenRef.current,
            currentMarket.bounds
              ? {
                  sw: { lat: currentMarket.bounds[0][1], lng: currentMarket.bounds[0][0] },
                  ne: { lat: currentMarket.bounds[1][1], lng: currentMarket.bounds[1][0] },
                }
              : null,
            abortControllerRef.current.signal
          );
        }
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[useUnifiedLocationSearch] failed:', err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, [query, currentMarket.bounds]);

  const selectSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setIsLoadingDetails(true);
    // Capture and rotate — the closing token must match the opening token
    const closingToken = sessionTokenRef.current;
    sessionTokenRef.current = generateSessionToken();

    try {
      const details = await fetchPlaceDetails(suggestion.placeId, closingToken);
      
      if (mode === 'market') {
        const market = placeDetailsToMarket(details);
        if (!market) return null;
        return { type: 'market' as const, market };
      } else {
        return {
          type: 'address' as const,
          lat: details.lat,
          lng: details.lng,
          label: suggestion.mainText,
        };
      }
    } catch (err) {
      console.error('[useUnifiedLocationSearch] Details failed:', err);
      return null;
    } finally {
      setIsLoadingDetails(false);
    }
  }, [mode]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  return { query, setQuery, suggestions, mode, isSearching, isLoadingDetails, selectSuggestion, clearSearch };
}
