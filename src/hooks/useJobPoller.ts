/**
 * useJobPoller — Hardened polling fallback for Supabase Realtime disconnects.
 *
 * When the Realtime WebSocket drops (network blip, Supabase outage), the
 * frontend can miss the terminal `job_complete` or `job_failed` events and
 * get stuck in the scanning state.
 *
 * This hook polls GET /api/jobs/{jobId}/status every 5 seconds while a job
 * is in a non-terminal state, giving a hard guarantee that the scan always
 * resolves within one polling interval even if Realtime is down.
 *
 * FIX 3 (RC-4): Replaces the dangerous `if (!res.ok) return` silent swallow
 * with a bounded failure counter. After 3 consecutive failures (15 seconds),
 * the user sees a descriptive, actionable error — never infinite "Scanning...".
 */
import { useEffect, useRef } from 'react';
import { useJobStore, type JobStatus } from '../stores/jobStore';
import { getOrCreateSessionId } from '../lib/auth-utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const POLL_INTERVAL_MS = 5_000;
const CONSECUTIVE_FAILURE_LIMIT = 3;

const TERMINAL_STATUSES: JobStatus[] = [
  'completed',
  'completed_empty',
  'completed_stale',  // Cache fallback — showing data from last successful scan
  'partial_success',
  'failed',
];

interface JobStatusResponse {
  job_id: string;
  status: string;
  listings_found?: number;
  error_message?: string;
  failure_reason?: string;
}

/**
 * Polls for job status as a backup to Supabase Realtime.
 * Call this inside MapView.tsx alongside the Realtime subscription.
 *
 * @param activeJobId - The job ID currently being scanned (null = no active scan)
 */
export function useJobPoller(activeJobId: string | null): void {
  const updateJobStatus = useJobStore((s) => s.updateJobStatus);
  const completeJob = useJobStore((s) => s.completeJob);
  const failJob = useJobStore((s) => s.failJob);
  const jobs = useJobStore((s) => s.jobs);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failureCountRef = useRef<number>(0);

  useEffect(() => {
    if (!activeJobId) return;

    // Don't start polling if the job is already terminal in the store
    const currentJob = jobs[activeJobId];
    if (currentJob && TERMINAL_STATUSES.includes(currentJob.status)) return;

    const poll = async () => {
      try {
        const sessionId = getOrCreateSessionId();
        const res = await fetch(`${API_BASE}/api/jobs/${activeJobId}/status`, {
          headers: {
            'x-session-id': sessionId
          }
        });

        // Non-2xx response — increment failure counter, don't swallow
        if (!res.ok) {
          failureCountRef.current += 1;
          if (failureCountRef.current >= CONSECUTIVE_FAILURE_LIMIT) {
            const reason = res.status === 404
              ? 'Job tracker endpoint not found (404). Contact support.'
              : `Job tracker returned HTTP ${res.status}. Scan may still be running.`;
            failJob(activeJobId, reason);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
          return;
        }

        // Successful response — reset failure counter
        failureCountRef.current = 0;

        const data: JobStatusResponse = await res.json();
        const remoteStatus = data.status as JobStatus;

        if (TERMINAL_STATUSES.includes(remoteStatus)) {
          if (remoteStatus === 'failed') {
            failJob(activeJobId, data.error_message || data.failure_reason || 'Scan failed');
          } else {
            completeJob(activeJobId);
            updateJobStatus(activeJobId, remoteStatus);
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        // Network-level failure — count toward failure limit
        failureCountRef.current += 1;
        if (failureCountRef.current >= CONSECUTIVE_FAILURE_LIMIT) {
          failJob(activeJobId, 'Network error reaching job tracker. Check your connection.');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        console.warn('[useJobPoller] Poll failed, will retry:', err);
      }
    };

    // Start polling
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Cleanup on unmount or when activeJobId changes
    return () => {
      failureCountRef.current = 0;  // Reset on job change
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeJobId, updateJobStatus, completeJob, failJob, jobs]);
}
