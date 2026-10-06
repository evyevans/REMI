import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import { useJobStore } from '../stores/jobStore';
import type { Property } from '../types';
import type { CanonicalPropertyRow } from '../types/database';
import { rowToProperty } from './useMapData';

// Client-side scan timeout safety net (ms).
// If a scan runs longer than this without resolving, we auto-fail it on the frontend.
// This prevents the infinite spinner if Supabase Realtime UPDATE events are missed.
const CLIENT_SCAN_TIMEOUT_MS = 120_000; // 120 seconds

// Realtime batching constants:
// 150ms flush for faster UI updates vs the previous 200ms.
// MAX_BATCH_SIZE triggers an immediate flush on large bursts (e.g., RentCast returning 200 listings).
const BATCH_FLUSH_MS = 150;
const MAX_BATCH_SIZE = 50;

const FAILURE_MESSAGES: Record<string, string> = {
  GEO_RESOLUTION_FAILED: 'Could not resolve this city. Try spelling it differently or selecting a larger nearby city.',
  ALL_SOURCES_BLOCKED: 'Real estate platforms are temporarily blocking our scrapers. Please try again in a few minutes.',
  NO_LISTINGS_FOUND: 'We successfully scanned this market, but no properties match your criteria. Try widening your filters.',
  RATE_LIMITED: 'REMI is experiencing high traffic. Please try your scan again in 30 seconds.',
  JOB_TIMEOUT: 'The scan took too long to complete. Try searching a smaller or more specific market.',
};

interface UseRealtimePropertiesProps {
  marketSlug: string | null;
  onPropertyFound: (property: Property) => void;
  /** Called if no Realtime events arrive within 30s while a scan is active — triggers DB fallback */
  onFallbackFetch?: () => void;
}

/**
 * useRealtimeProperties
 *
 * Subscribes to Supabase Realtime for canonical_properties changes matching
 * a given market_slug. Uses a 200ms batching buffer to prevent React render storms
 * when many pins arrive in rapid succession during a city scan.
 *
 * Also listens for research_jobs status changes to sync job completion state.
 *
 * Safety net: if no completion/failure event arrives within CLIENT_SCAN_TIMEOUT_MS,
 * automatically fails the job on the frontend to stop the infinite spinner.
 */
export function useRealtimeProperties({ marketSlug, onPropertyFound, onFallbackFetch }: UseRealtimePropertiesProps) {
  // 200ms batching buffer: accumulate events, flush in one batch tick
  const bufferRef = useRef<Property[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Channel retry tracking for error recovery
  const channelRetryRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_CHANNEL_RETRIES = 3;
  const CHANNEL_RETRY_DELAY_MS = 3000;

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const batch = [...bufferRef.current];
    bufferRef.current = [];
    // Process in chunks of 10 via requestAnimationFrame to prevent React render storms.
    // Each frame handles a small slice so the browser stays responsive during big bursts.
    const CHUNK_SIZE = 10;
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE);
      requestAnimationFrame(() => {
        for (const prop of chunk) {
          onPropertyFound(prop);
        }
      });
    }
  }, [onPropertyFound]);

  // Client-side safety timeout: arm when a job starts, clear when it finishes
  const startClientTimeout = useCallback((jobId: string) => {
    if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
    clientTimeoutRef.current = setTimeout(() => {
      const job = useJobStore.getState().jobs[jobId];
      // Only auto-fail if still in an active (unresolved) state
      if (job && ['pending', 'scanning', 'writing', 'partial', 'queued', 'resolving', 'ingesting', 'analyzing'].includes(job.status)) {
        console.warn(`[Realtime] Client-side timeout fired for job ${jobId} — marking as completed_empty`);
        // Timeout is not a failure — it means no data arrived. Use completed_empty so the
        // frontend shows the "Validated Zero" empty state rather than an error toast.
        useJobStore.getState().completeJob(jobId, 'completed_empty');
      }
      clientTimeoutRef.current = null;
    }, CLIENT_SCAN_TIMEOUT_MS);
  }, []);

  const clearClientTimeout = useCallback(() => {
    if (clientTimeoutRef.current) {
      clearTimeout(clientTimeoutRef.current);
      clientTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!marketSlug) return;

    // Subscribe to BOTH new inserts and updates for this market
    const channel = supabase
      .channel(`public:canonical_properties:${marketSlug}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT and UPDATE
          schema: 'public',
          table: 'canonical_properties',
          filter: `market_slug=eq.${marketSlug}`,
        },
        (payload: any) => {
          const row = payload.new as CanonicalPropertyRow;
          const property = rowToProperty(row);
          if (!property) return;

          // Only process events for the current active job
          const activeJob = useJobStore.getState().getActiveJobForMarket(marketSlug);
          if (activeJob && row.source_job_id && row.source_job_id !== activeJob.jobId) {
            return;
          }

          // Buffer + batch flush every 150ms (down from 200ms for snappier UI)
          // Flush immediately when batch exceeds MAX_BATCH_SIZE to handle large API bursts.
          bufferRef.current.push(property);
          if (bufferRef.current.length >= MAX_BATCH_SIZE) {
            // Immediate flush for large batches — don't wait for the timer
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            flushBuffer();
          } else if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushBuffer();
              flushTimerRef.current = null;
            }, BATCH_FLUSH_MS);
          }

          // Increment the job progress counter
          if (activeJob) {
            useJobStore.getState().incrementPropertiesFound(activeJob.jobId);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to canonical_properties for ${marketSlug}`);
          channelRetryRef.current = 0; // Reset retry count on successful subscribe

          // Fallback: if no properties arrive via Realtime within 30s while a scan is active,
          // trigger a DB re-fetch. Handles tables with Realtime not enabled, network drops, etc.
          if (onFallbackFetch) {
            fallbackTimerRef.current = setTimeout(() => {
              const activeJob = marketSlug ? useJobStore.getState().getActiveJobForMarket(marketSlug) : null;
              if (activeJob && activeJob.propertiesFound === 0) {
                console.warn('[Realtime] No events in 30s with active scan — triggering DB fallback fetch');
                onFallbackFetch();
              }
            }, 30_000);
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Channel error for canonical_properties:${marketSlug}`);
          // Auto-retry with delay, up to MAX_CHANNEL_RETRIES
          if (channelRetryRef.current < MAX_CHANNEL_RETRIES) {
            channelRetryRef.current++;
            console.warn(`[Realtime] Retrying subscription (attempt ${channelRetryRef.current}/${MAX_CHANNEL_RETRIES})...`);
            retryTimerRef.current = setTimeout(() => {
              // Re-subscribe the existing channel — Supabase channels support
              // calling subscribe() again after a CHANNEL_ERROR without removal
              console.log(`[Realtime] Re-subscribing channel for ${marketSlug} (attempt ${channelRetryRef.current})`);
              channel.subscribe();
            }, CHANNEL_RETRY_DELAY_MS);
          } else {
            console.error(`[Realtime] Max retries (${MAX_CHANNEL_RETRIES}) exhausted for ${marketSlug}. Client timeout will handle completion.`);
          }
        }
      });

    channelRef.current = channel;

    // Subscribe to job status updates for this market
    const jobsChannel = supabase
      .channel(`public:research_jobs:${marketSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'research_jobs',
          filter: `market_slug=eq.${marketSlug}`,
        },
        (payload: RealtimePostgresUpdatePayload<Record<string, unknown>>) => {
          const row = payload.new as Record<string, string | null | undefined>;
          const jobId = (row.job_id || row.id) as string;
          const status = row.status;
          if (jobId && status) {
            if (status === 'complete' || status === 'completed' || status === 'partial_success') {
              clearClientTimeout();
              useJobStore.getState().completeJob(jobId, 'completed');
            } else if (status === 'completed_empty') {
              // Scan succeeded but returned 0 listings — clear spinner, mark as completed_empty
              clearClientTimeout();
              useJobStore.getState().completeJob(jobId, 'completed_empty');
              useJobStore.getState().setJobFailureReason(jobId, (row.failure_reason as string) ?? null);
            } else if (status === 'failed') {
              clearClientTimeout();
              const rawReason = row.failure_reason as string | undefined;
              let errorMessage = 'Scan failed to complete. Try a smaller area or use filters.';

              if (rawReason && FAILURE_MESSAGES[rawReason]) {
                errorMessage = FAILURE_MESSAGES[rawReason];
              } else if (row.error_message) {
                 errorMessage = row.error_message as string;
              }
              
              useJobStore.getState().failJob(jobId, errorMessage);
            } else if (status === 'ingesting' || status === 'resolving' || status === 'queued' || status === 'analyzing') {
              // Job just started or moved to next step — arm the client-side safety timeout
              startClientTimeout(jobId);
              useJobStore.getState().updateJobStatus(jobId, status);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to research_jobs for ${marketSlug}`);
        }
      });

    return () => {
      // Flush any remaining buffered properties on unmount
      flushBuffer();
      clearClientTimeout();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      channelRetryRef.current = 0;
      channelRef.current = null;
      supabase.removeChannel(channel);
      supabase.removeChannel(jobsChannel);
    };
  }, [marketSlug, flushBuffer, startClientTimeout, clearClientTimeout]);
}
