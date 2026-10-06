// src/hooks/useLocationSearch.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchAutocompleteSuggestions,
  fetchPlaceDetails,
  generateSessionToken,
  type PlaceSuggestion,
  type PlaceDetails,
} from '../services/geocodingService';

export interface UseLocationSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: PlaceSuggestion[];
  isSearching: boolean;       // debounce in-flight → show spinner in input
  isLoadingDetails: boolean;  // place details fetching → disable suggestion list
  selectSuggestion: (suggestion: PlaceSuggestion) => Promise<PlaceDetails | null>;
  clearSearch: () => void;
}

export function useLocationSearch(): UseLocationSearchReturn {
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
        const results = await fetchAutocompleteSuggestions(trimmed, sessionTokenRef.current, abortControllerRef.current.signal);
        setSuggestions(results);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('[useLocationSearch] Autocomplete failed:', err);
        if (err instanceof Error && err.message.includes('403')) {
          console.error('[useLocationSearch] 403 = API key missing, invalid, or not yet restricted correctly');
        }
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
    };
  }, [query]);

  const selectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<PlaceDetails | null> => {
      setIsLoadingDetails(true);

      // Capture and rotate — the closing token must match the opening token
      const closingToken = sessionTokenRef.current;
      sessionTokenRef.current = generateSessionToken();

      try {
        return await fetchPlaceDetails(suggestion.placeId, closingToken);
      } catch (err) {
        console.error('[useLocationSearch] Place Details failed:', err);
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
