// src/hooks/useLocalLocationSearch.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchLocalAddressSuggestions,
  fetchPlaceDetails,
  generateSessionToken,
  type PlaceSuggestion,
  type PlaceDetails,
  type LocalSearchBounds
} from '../services/geocodingService';

export interface UseLocalLocationSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: PlaceSuggestion[];
  isSearching: boolean;
  isLoadingDetails: boolean;
  selectSuggestion: (suggestion: PlaceSuggestion) => Promise<PlaceDetails | null>;
  clearSearch: () => void;
}

export function useLocalLocationSearch(bounds: LocalSearchBounds | null): UseLocalLocationSearchReturn {
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Session token survives re-renders via ref — only rotates on selection
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const results = await fetchLocalAddressSuggestions(trimmed, sessionTokenRef.current, bounds, abortControllerRef.current.signal);
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[useLocalLocationSearch] Autocomplete failed:', err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, [query, bounds]); // Re-fetch if bounds change while typing

  const selectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<PlaceDetails | null> => {
      setIsLoadingDetails(true);

      const closingToken = sessionTokenRef.current;
      sessionTokenRef.current = generateSessionToken();

      try {
        return await fetchPlaceDetails(suggestion.placeId, closingToken);
      } catch (err) {
        console.error('[useLocalLocationSearch] Place Details failed:', err);
        return null;
      } finally {
        setIsLoadingDetails(false);
      }
    },
    []
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  return { query, setQuery, suggestions, isSearching, isLoadingDetails, selectSuggestion, clearSearch };
}
