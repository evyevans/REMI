import { create } from 'zustand';

export type AnalysisType = 
  | 'for_sale' 
  | 'rental' 
  | 'sold' 
  | 'comprehensive';

export type JobStatus =
  | 'pending'         // Job submitted, backend acknowledged with job_id
  | 'queued'          // Queued in backend
  | 'resolving'       // Geo-resolution step
  | 'ingesting'       // Fetching from Tier 1-4 data sources
  | 'analyzing'       // Scoring and enriching data
  | 'scanning'        // (Legacy) Frontend initial state
  | 'writing'         // Backend writing results
  | 'completed'       // All results written, job finished (fresh Zillow data)
  | 'completed_empty' // Job finished, but 0 properties found
  | 'completed_stale' // Job finished with cached data (Zillow failed, showing last scan)
  | 'partial_success' // Partial results — some sources succeeded
  | 'partial'         // (Legacy) Some results available
  | 'failed';         // Job failed — store error reason

export interface ResearchJob {
  jobId: string;
  marketSlug: string;          // e.g., "tanglewood--san-antonio--tx"
  analysisType: AnalysisType;
  status: JobStatus;
  propertiesFound: number;     // Increments as Realtime delivers rows
  propertiesExpected: number | null; // From initial job response, if known
  startedAt: string;           // ISO timestamp
  completedAt: string | null;
  error: string | null;
  failure_reason: string | null; // Set by backend on completed_empty/failed jobs
}

export interface MapViewRequest {
  // When Chat says "View on Map," this is what it passes
  jobId: string;
  analysisType: AnalysisType;
  marketSlug: string;
  timestamp: string;           // So Map knows this is a fresh request
}

interface JobState {
  // All tracked jobs (keyed by jobId)
  jobs: Record<string, ResearchJob>;
  
  // The most recent "View on Map" request from Chat
  pendingMapView: MapViewRequest | null;
  
  // Triggers a scan from outside MapView (e.g. Header bar)
  pendingScanTrigger: AnalysisType | null;

  // Actions
  registerJob: (job: ResearchJob) => void;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  incrementPropertiesFound: (jobId: string, count?: number) => void;
  completeJob: (jobId: string, finalStatus?: JobStatus) => void;
  failJob: (jobId: string, error: string) => void;
  setJobFailureReason: (jobId: string, reason: string | null) => void;
  requestMapView: (request: MapViewRequest) => void;
  consumeMapViewRequest: () => MapViewRequest | null;
  triggerScan: (type: AnalysisType) => void;
  consumeScanTrigger: () => AnalysisType | null;
  
  // Derived
  getActiveJobForMarket: (marketSlug: string) => ResearchJob | null;
  getLatestCompletedJob: (marketSlug: string, analysisType?: AnalysisType) => ResearchJob | null;
  getFailedJobForMarket: (marketSlug: string) => ResearchJob | null;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: {},
  pendingMapView: null,
  pendingScanTrigger: null,

  registerJob: (job) => set((state) => ({
    jobs: { ...state.jobs, [job.jobId]: job }
  })),

  updateJobStatus: (jobId, status) => set((state) => ({
    jobs: {
      ...state.jobs,
      [jobId]: { ...state.jobs[jobId], status }
    }
  })),

  incrementPropertiesFound: (jobId, count = 1) => set((state) => {
    const job = state.jobs[jobId];
    if (!job) return state;
    return {
      jobs: {
        ...state.jobs,
        [jobId]: { ...job, propertiesFound: job.propertiesFound + count }
      }
    };
  }),

  completeJob: (jobId, finalStatus) => set((state) => ({
    jobs: {
      ...state.jobs,
      [jobId]: {
        ...state.jobs[jobId],
        status: finalStatus || 'completed',
        completedAt: new Date().toISOString()
      }
    }
  })),

  failJob: (jobId, error) => set((state) => ({
    jobs: {
      ...state.jobs,
      [jobId]: { ...state.jobs[jobId], status: 'failed', error }
    }
  })),

  setJobFailureReason: (jobId, reason) => set((state) => ({
    jobs: {
      ...state.jobs,
      [jobId]: { ...state.jobs[jobId], failure_reason: reason }
    }
  })),

  requestMapView: (request) => set({ pendingMapView: request }),

  consumeMapViewRequest: () => {
    const current = get().pendingMapView;
    set({ pendingMapView: null });
    return current;
  },

  triggerScan: (type) => set({ pendingScanTrigger: type }),
  consumeScanTrigger: () => {
    const current = get().pendingScanTrigger;
    set({ pendingScanTrigger: null });
    return current;
  },

  getActiveJobForMarket: (marketSlug) => {
    const jobs = Object.values(get().jobs);
    // Explicitly excludes all terminal states so spinner always stops.
    const TERMINAL_STATUSES: JobStatus[] = ['completed', 'completed_empty', 'completed_stale', 'partial_success', 'failed'];
    return jobs.find(j =>
      j.marketSlug === marketSlug &&
      !TERMINAL_STATUSES.includes(j.status)
    ) || null;
  },

  getLatestCompletedJob: (marketSlug, analysisType) => {
    const jobs = Object.values(get().jobs)
      .filter(j =>
        j.marketSlug === marketSlug &&
        ['completed', 'completed_empty', 'partial_success'].includes(j.status) &&
        (!analysisType || j.analysisType === analysisType)
      )
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
    return jobs[0] || null;
  },

  getFailedJobForMarket: (marketSlug) => {
    const jobs = Object.values(get().jobs);
    return jobs.find(j => j.marketSlug === marketSlug && j.status === 'failed') || null;
  },
}));
