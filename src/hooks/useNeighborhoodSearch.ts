// src/hooks/useNeighborhoodSearch.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchNeighborhoods,
  type NeighborhoodSuggestion,
} from '../services/geocodingService';

export type { NeighborhoodSuggestion };

interface UseNeighborhoodSearchParams {
  cityName: string;
  stateName: string;
  countryCode: string;
  cityCenter: { lat: number; lng: number };
  isEnabled: boolean; // false until a city is selected
}

interface UseNeighborhoodSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: NeighborhoodSuggestion[];
  isLoading: boolean;
  selectedNeighborhood: string | null;
  selectSuggestion: (suggestion: NeighborhoodSuggestion) => Promise<{ id: string; name: string; lat: number; lng: number; bounds?: [[number, number], [number, number]] } | null>;
  clearSearch: () => void;
  onFocus: () => void;
}

export function useNeighborhoodSearch({
  cityName,
  stateName,
  countryCode,
  cityCenter,
  isEnabled,
}: UseNeighborhoodSearchParams): UseNeighborhoodSearchReturn {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NeighborhoodSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFocus = useCallback(() => {}, []);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!isEnabled || !query || query.trim().length < 2 || !cityName) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (selectedNeighborhood && query === selectedNeighborhood) return;

    setIsLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const results = await fetchNeighborhoods(
          query,
          cityName,
          stateName,
          cityCenter,
          countryCode,
          controller.signal
        );
        setSuggestions(results);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[useNeighborhoodSearch] Fetch error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, cityName, stateName, cityCenter, countryCode, isEnabled, selectedNeighborhood]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setQuery('');
    setSuggestions([]);
    setSelectedNeighborhood(null);
  }, [cityName, stateName]);

  const selectSuggestion = useCallback(
    async (suggestion: NeighborhoodSuggestion) => {
      setQuery(suggestion.name);
      setSelectedNeighborhood(suggestion.name);
      setSuggestions([]);

      return {
        id: suggestion.placeId,
        name: suggestion.name,
        lat: suggestion.latitude,
        lng: suggestion.longitude,
        bounds: suggestion.bounds,
      };
    },
    []
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setSelectedNeighborhood(null);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    selectedNeighborhood,
    selectSuggestion,
    clearSearch,
    onFocus,
  };
}
