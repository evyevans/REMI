/**
 * pipeline-trace.ts
 *
 * Enterprise-grade observability for the REMI Scrape → Persist → Realtime → UI pipeline.
 *
 * DESIGN PRINCIPLES (from Perplexity/Architecture review):
 *   1. Every hop in the pipeline has a typed contract.
 *   2. Any row that exists in the DB but is NOT visible in the UI must produce
 *      a clear, structured, searchable log entry.
 *   3. Search fingerprinting prevents stale job completions from overwriting
 *      newer searches (e.g., user switches city/tenure mid-scan).
 *   4. All log entries carry: search_id, job_id, market_slug, tenure, stage.
 */

// ─── Typed Domino Event Contract ─────────────────────────────────────────────
//
// INVARIANTS:
//   - market_slug must match the user's currently active market
//   - tenure must be one of: 'for_sale' | 'sold' | 'for_rent' | 'market_intel'
//   - job_id must be non-null for filtering stale events
//   - properties_count must be > 0 for a meaningful update

export type DominoTenure = 'for_sale' | 'sold' | 'for_rent' | 'market_intel';

export interface DominoEventPayload {
  /** The job that produced this data */
  job_id: string;
  /** The market slug (e.g., 'sacramento-ca-us') */
  market_slug: string;
  /** The tenure of properties returned (critical filter guard) */
  tenure: DominoTenure;
  /** Number of properties persisted in this batch */
  properties_count: number;
  /** Unique ID for this execution run — used for dedup */
  execution_id: string;
  /** Which UI tabs to refresh */
  tabs_affected: string[];
  /** Legacy / optional intent field */
  intent?: string;
}

/** Type-safe factory for dispatching the remi:domino_update event */
export function dispatchDominoEvent(payload: DominoEventPayload): void {
  const event = new CustomEvent<DominoEventPayload>('remi:domino_update', {
    detail: payload,
  });
  window.dispatchEvent(event);
}

/** Type-safe subscription to the remi:domino_update event */
export function subscribeToDominoEvents(
  handler: (payload: DominoEventPayload) => void,
  filter?: { market_slug?: string; tenure?: DominoTenure }
): () => void {
  const listener = (e: Event) => {
    const payload = (e as CustomEvent<DominoEventPayload>).detail;
    if (!payload) return;

    // Market slug guard — never apply updates from a different market
    if (filter?.market_slug && payload.market_slug !== filter.market_slug) {
      PipelineTrace.warn('domino_event_market_mismatch', {
        expected: filter.market_slug,
        received: payload.market_slug,
        job_id: payload.job_id,
      });
      return;
    }

    // Tenure guard — optional, allows callers to only react to their tenure
    if (filter?.tenure && payload.tenure !== filter.tenure) {
      return; // Silent skip: this is an expected filter, not an error
    }

    handler(payload);
  };

  window.addEventListener('remi:domino_update', listener);
  return () => window.removeEventListener('remi:domino_update', listener);
}


// ─── Search Fingerprint ───────────────────────────────────────────────────────
//
// A fingerprint captures the EXACT search context at the moment a job was created.
// When a job completes, we compare its launch fingerprint to the CURRENT UI state.
// If they differ, the user has changed context → discard the stale update.

export interface SearchFingerprint {
  market_slug: string;
  tenure: DominoTenure;
  /** ISO timestamp of when this search was initiated */
  initiated_at: string;
  /** SHA-style string for fast equality checks */
  hash: string;
}

export function createSearchFingerprint(
  market_slug: string,
  tenure: DominoTenure
): SearchFingerprint {
  const initiated_at = new Date().toISOString();
  const hash = `${market_slug}::${tenure}::${initiated_at}`;
  return { market_slug, tenure, initiated_at, hash };
}

export function fingerprintsMatch(a: SearchFingerprint | null, b: SearchFingerprint | null): boolean {
  if (!a || !b) return false;
  // Two fingerprints match if they're for the same market+tenure
  // (Time-independent: we don't want rapid re-scans to be considered "different")
  return a.market_slug === b.market_slug && a.tenure === b.tenure;
}


// ─── Pipeline Trace Logger ────────────────────────────────────────────────────
//
// Structured observability for each hop in the pipeline.
// In dev: logs to console with full context.
// In prod: can be routed to a monitoring service (e.g., Sentry, Datadog).
//
// DESIGN GOAL: It must be IMPOSSIBLE to have "data in DB but UI shows nothing"
// without a PipelineTrace entry that says exactly WHICH stage the data stopped at.

export type PipelineStage =
  | 'scrape_triggered'
  | 'scrape_completed'
  | 'db_persisted'
  | 'realtime_emitted'
  | 'domino_received'
  | 'domino_filtered_market_mismatch'
  | 'domino_filtered_tenure_mismatch'
  | 'domino_filtered_stale_fingerprint'
  | 'properties_fetched'
  | 'map_rendered'
  | 'table_rendered';

interface TraceEntry {
  stage: PipelineStage;
  job_id?: string;
  market_slug?: string;
  tenure?: string;
  count?: number;
  detail?: Record<string, unknown>;
  ts: string;
}

export const PipelineTrace = {
  log(stage: PipelineStage, meta: Omit<TraceEntry, 'stage' | 'ts'>): void {
    const entry: TraceEntry = { stage, ts: new Date().toISOString(), ...meta };
    console.log(
      `%c[PipelineTrace] ${stage}`,
      'color: #4A9E6B; font-weight: bold',
      entry
    );
  },

  warn(stage: string, meta: Record<string, unknown>): void {
    console.warn(`%c[PipelineTrace] ⚠ ${stage}`, 'color: #D4A843; font-weight: bold', {
      ...meta,
      ts: new Date().toISOString(),
    });
  },

  error(stage: string, meta: Record<string, unknown>): void {
    // In production, route to Sentry/Datadog here
    console.error(`%c[PipelineTrace] ✗ ${stage}`, 'color: #C9503C; font-weight: bold', {
      ...meta,
      ts: new Date().toISOString(),
    });
  },

  /**
   * CRITICAL INVARIANT CHECK:
   * If fetched_count > 0 but visible_count === 0, we have a blindspot.
   * Log it as a structured anomaly so it's immediately searchable.
   */
  assertSync(params: {
    market_slug: string;
    tenure: string;
    fetched_count: number;
    map_count: number;
    table_count: number;
  }): void {
    const { fetched_count, map_count, table_count } = params;

    if (fetched_count > 0 && map_count === 0) {
      PipelineTrace.error('data_exists_but_map_empty', {
        ...params,
        anomaly: 'FETCH_MAP_DIVERGENCE',
        actionable: 'Check MarkerClusterLayer tenure filter and useMapData subscription',
      });
    }

    if (fetched_count > 0 && table_count === 0) {
      PipelineTrace.error('data_exists_but_table_empty', {
        ...params,
        anomaly: 'FETCH_TABLE_DIVERGENCE',
        actionable: 'Check useProperties tenure filter and Domino event subscription',
      });
    }

    if (map_count !== table_count && fetched_count > 0) {
      PipelineTrace.warn('map_table_count_mismatch', {
        ...params,
        delta: Math.abs(map_count - table_count),
        actionable: 'Map and table sources are diverged — check for tenure filter inconsistency',
      });
    }
  },
};
