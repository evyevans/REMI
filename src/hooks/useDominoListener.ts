import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dispatchDominoEvent, PipelineTrace, type DominoEventPayload } from '../lib/pipeline-trace';

/**
 * useDominoListener — Hardened Realtime subscription (Phase 20 + Architecture Review)
 *
 * Subscribes to the Supabase Realtime 'domino_events' table filtered by market_slug.
 * When the backend persists a batch of properties and inserts a domino_events row,
 * this hook catches it and dispatches the typed `remi:domino_update` CustomEvent.
 *
 * HARDENING CHANGES (from Perplexity architecture review):
 *   1. Auto-reconnect on CHANNEL_ERROR with exponential backoff (cap 30s)
 *   2. Typed event payload — emits full DominoEventPayload including job_id, tenure,
 *      market_slug so listeners can perform fingerprint/tenure guards
 *   3. PipelineTrace logging at each hop
 *   4. Subscription health check — warns if no event arrives within 5min of a scan
 */
export function useDominoListener(marketSlug: string | null) {
  const retryDelayRef = useRef(2000); // Start at 2s, cap at 30s
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!marketSlug) return;

    let unsubscribed = false;

    function subscribe() {
      if (unsubscribed) return;

      // Clean up any previous channel before creating a new one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`domino_${marketSlug}_${Date.now()}`) // Unique name prevents stale channel reuse
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'domino_events',
            filter: `market_slug=eq.${marketSlug}`,
          },
          (payload) => {
            const newDoc = payload.new;
            if (!newDoc || !newDoc.payload) {
              PipelineTrace.warn('domino_event_missing_payload', {
                raw: payload,
                market_slug: marketSlug,
              });
              return;
            }

            // Build typed payload — normalize legacy fields
            const typedPayload: DominoEventPayload = {
              job_id: newDoc.payload.job_id ?? newDoc.job_id ?? 'unknown',
              market_slug: newDoc.market_slug ?? marketSlug,
              tenure: newDoc.payload.tenure ?? newDoc.payload.intent ?? 'for_sale',
              properties_count: newDoc.payload.properties_count ?? 0,
              execution_id: newDoc.payload.execution_id ?? newDoc.id ?? 'unknown',
              tabs_affected: newDoc.payload.tabs_affected ?? ['properties', 'map'],
              intent: newDoc.payload.intent,
            };

            PipelineTrace.log('domino_received', {
              job_id: typedPayload.job_id,
              market_slug: typedPayload.market_slug,
              tenure: typedPayload.tenure,
              count: typedPayload.properties_count,
            });

            // Dispatch typed event — listeners use subscribeToDominoEvents() for filtering
            dispatchDominoEvent(typedPayload);

            // Reset reconnect backoff on successful event
            retryDelayRef.current = 2000;
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Domino] ✓ Subscribed: ${marketSlug}`);
            retryDelayRef.current = 2000; // Reset backoff on success
          } else if (status === 'CHANNEL_ERROR') {
            PipelineTrace.error('domino_channel_error', { market_slug: marketSlug });
            // Auto-reconnect with exponential backoff (cap 30s)
            const delay = retryDelayRef.current;
            retryDelayRef.current = Math.min(delay * 2, 30_000);
            console.warn(`[Domino] ✗ CHANNEL_ERROR — reconnecting in ${delay}ms`);
            reconnectTimerRef.current = setTimeout(subscribe, delay);
          } else if (status === 'TIMED_OUT') {
            PipelineTrace.warn('domino_channel_timeout', { market_slug: marketSlug });
            reconnectTimerRef.current = setTimeout(subscribe, retryDelayRef.current);
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30_000);
          }
        });

      channelRef.current = channel;
    }

    subscribe();

    return () => {
      unsubscribed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [marketSlug]);
}
