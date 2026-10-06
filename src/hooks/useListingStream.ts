/**
 * useListingStream — React hook for consuming SSE listing progress events.
 *
 * Usage:
 *   const { progress, comps, isStreaming, streamComps } = useListingStream();
 *   streamComps('sheridan-washington-dc', 'rental');
 */

import { useState, useCallback, useRef } from 'react';

export interface StreamProgress {
  platform?: string;   // Sprint 1 Fix: optional — not all events include platform name
  // 'orchestrator_complete' is an internal progress event, NOT the terminal event.
  // Only 'complete' (with comps) closes the stream. This prevents premature closure.
  status: 'searching' | 'done' | 'failed' | 'synthesizing' | 'orchestrator_complete' | 'complete' | 'error';
  count?: number;
  message?: string;
  error?: string;
  comps?: PropertyComp[];       // Only present on 'complete' events
  data_freshness?: 'live' | 'stale';  // Present on 'complete' events for UX warning
}

export interface PropertyComp {
  address: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  property_type: string | null;
  synthesized_estimate: number | null;
  days_on_market: number | null;
  price_per_sqft: number | null;
  sources: string[];
  source_urls: string[];
  lat: number | null;
  lng: number | null;
}

export function useListingStream() {
  const [progress, setProgress] = useState<StreamProgress[]>([]);
  const [comps, setComps] = useState<PropertyComp[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const streamComps = useCallback(
    (
      marketSlug: string,
      listingType: string = 'for_sale',
      // Sprint 1: Accept raw bounding box from map selection
      rawBounds?: { swLat: number; swLng: number; neLat: number; neLng: number }
    ) => {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setIsStreaming(true);
      setProgress([]);
      setComps([]);
      setError(null);

      const baseUrl = import.meta.env.VITE_API_URL || '';
      let url = `${baseUrl}/api/v1/listings/stream/live-comps/${marketSlug}?listing_type=${listingType}`;

      // Sprint 1 Fix: Pass exact map coordinates if available
      // This bypasses the market slug resolver entirely, preventing the DC default bug
      if (rawBounds) {
        url += `&sw_lat=${rawBounds.swLat}&sw_lng=${rawBounds.swLng}&ne_lat=${rawBounds.neLat}&ne_lng=${rawBounds.neLng}`;
      }

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamProgress;

          if (data.status === 'complete') {
            // Terminal event — includes comps array and freshness metadata
            setComps(data.comps || []);
            if (data.data_freshness === 'stale') {
              setError('Showing cached data. Live data temporarily unavailable.');
            }
            setIsStreaming(false);
            eventSource.close();
          } else if (data.status === 'error') {
            setError(data.message || 'An error occurred');
            setIsStreaming(false);
            eventSource.close();
          } else {
            // All other statuses (searching, done, failed, synthesizing, orchestrator_complete)
            // are progress updates — do NOT close the stream
            setProgress((prev) => [...prev, data]);
          }
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = () => {
        setIsStreaming(false);
        setError('Connection lost. Please try again.');
        eventSource.close();
      };
    },
    [],
  );

  const cancelStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return { progress, comps, isStreaming, error, streamComps, cancelStream };
}
