import { Loader2, Search, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ResearchJob } from '../../stores/jobStore';

interface MapScanningStateProps {
  job: ResearchJob;
}

interface JobEvent {
  id: string;
  event_type: string;
  source_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function formatMarketSlug(slug: string): string {
  if (!slug) return '';
  const parts = slug.split('-');
  if (parts.length >= 2 && parts[parts.length - 1].length === 2) {
    return parts.map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '').join(' ');
  }
  return parts.map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '').join(' ');
}

function eventToMessage(event: JobEvent): string {
  const { event_type, source_id, payload } = event;

  const sourceLabel: Record<string, string> = {
    rentcast: 'RentCast',
    attom: 'ATTOM',
    rapidapi_realtor: 'Realtor API',
  };

  switch (event_type) {
    case 'geo_resolving':
      return `Resolving geography for ${payload.market_slug ?? ''}...`;
    case 'geo_resolved':
      return `Geography resolved`;
    case 'source_started': {
      const label = (source_id && sourceLabel[source_id]) ?? source_id ?? 'Source';
      const mode = payload.mode ? String(payload.mode).replace(/_/g, ' ') : '';
      return `${label} querying${mode ? ` (${mode})` : ''}...`;
    }
    case 'source_completed': {
      const label = (source_id && sourceLabel[source_id]) ?? source_id ?? 'Source';
      const count = payload.count as number | undefined;
      if (count !== undefined && count !== null) {
        return count > 0
          ? `${label}: ${count} propert${count === 1 ? 'y' : 'ies'} found`
          : `${label}: no results`;
      }
      return `${label}: complete`;
    }
    case 'analytics_started':
      return `Evaluating deal scores...`;
    default:
      return event_type.replace(/_/g, ' ');
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Subscribe to research_job_events for a given job_id and return events in order */
function useJobEvents(jobId: string | null): JobEvent[] {
  const [events, setEvents] = useState<JobEvent[]>([]);

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job_events:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'research_job_events',
          filter: `job_id=eq.${jobId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new as JobEvent;
          setEvents(prev => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      setEvents([]); // Reset when jobId changes
    };
  }, [jobId]);

  return events;
}


export function MapScanningState({ job }: MapScanningStateProps) {
  const isComplete = job.status === 'completed' || job.status === 'completed_empty' || job.status === 'partial_success';
  const isFailed = job.status === 'failed';
  const isWriting = job.status === 'writing' || job.status === 'partial' || job.status === 'resolving' || job.status === 'ingesting' || job.status === 'analyzing';

  const progressPercent = job.propertiesExpected
    ? Math.min(100, Math.round((job.propertiesFound / job.propertiesExpected) * 100))
    : 0;

  const events = useJobEvents(job.jobId ?? null);

  // Auto-scroll event log to bottom as new events arrive
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col items-center justify-center p-6 h-64 text-center rounded-xl bg-bg-surface border border-border overflow-hidden relative">
      {/* Background Pulse Effect if writing/scanning */}
      {!isComplete && !isFailed && (
        <div className="absolute inset-0 bg-accent/5 animate-pulse rounded-xl" />
      )}

      {/* Status Icon */}
      <div className="relative z-10 mb-4">
        {isComplete ? (
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
        ) : isFailed ? (
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
            <AlertCircle size={24} className="text-error" />
          </div>
        ) : isWriting ? (
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center backdrop-blur-md border border-accent/20">
            <Zap size={24} className="text-accent animate-pulse" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center backdrop-blur-md shadow-inner">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        )}
      </div>

      {/* Main Text */}
      <h3 className="text-base font-bold text-text-primary mb-1 relative z-10">
        {(() => {
          switch (job.status) {
            case 'completed': 
            case 'partial_success': return 'Analysis Complete';
            case 'failed': return 'Analysis Failed';
            case 'queued': return 'Warming Up...';
            case 'resolving': return 'Resolving Geometry...';
            case 'ingesting': return 'Fetching Market Data...';
            case 'analyzing': return 'Evaluating Deals...';
            case 'writing':
            case 'partial': return 'Parsing Results...';
            case 'completed_empty': return 'No Properties Found';
            default: return 'Scanning Live Data Sources...';
          }
        })()}
      </h3>

      <p className="text-xs text-text-tertiary mb-3 relative z-10 max-w-[200px]">
        {isFailed
          ? job.error || 'The backend encountered an issue.'
          : `Compiling ${(job.analysisType || 'Market').replace('_', ' ')} intelligence for ${formatMarketSlug(job.marketSlug || '')}`}
      </p>

      {/* Production Event Log */}
      {events.length > 0 && (
        <div
          ref={logRef}
          className="w-full max-w-xs relative z-10 mb-3 max-h-16 overflow-y-auto text-left space-y-0.5 scrollbar-none"
        >
          {events.map((event, i) => (
            <div key={event.id ?? i} className="flex items-start gap-1.5 text-[10px] leading-tight">
              <span className="text-text-quaternary shrink-0 tabular-nums">
                {formatTime(event.created_at)}
              </span>
              <span className="text-text-secondary">{eventToMessage(event)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar & Counter (only if not failed) */}
      {!isFailed && (
        <div className="w-full max-w-xs relative z-10">
          <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
            <span className="text-text-secondary flex items-center gap-1">
              <Search size={10} className="text-accent" />
              Properties Found
            </span>
            <span className="text-accent tabular-nums">
              {job.propertiesFound}
              {job.propertiesExpected ? ` / ${job.propertiesExpected}` : ''}
            </span>
          </div>

          <div className="h-1.5 w-full bg-bg-elevated rounded-full overflow-hidden border border-border/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end
                ${isComplete ? 'bg-emerald-500' : 'bg-linear-to-r from-accent to-accent/80'}
              `}
              style={{ width: job.propertiesExpected ? `${Math.max(5, progressPercent)}%` : '100%' }}
            >
              {!isComplete && job.propertiesExpected && (
                <div className="w-full h-full animate-[shimmer_2s_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
