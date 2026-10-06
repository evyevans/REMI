import { useMemo } from 'react';
import { MapPinned, RefreshCw, Clock } from 'lucide-react';
import type { Market } from '../../stores/marketStore';
import type { ResearchJob } from '../../stores/jobStore';

interface MapDataHeaderProps {
  currentMarket: Market | null;
  activeJob: ResearchJob | null;
  totalCount: number;
  lastSeenAt?: string | null;
  onRefresh?: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MapDataHeader({ currentMarket, activeJob, totalCount, lastSeenAt, onRefresh }: MapDataHeaderProps) {
  const isScanning = activeJob && ['pending', 'queued', 'resolving', 'ingesting', 'analyzing', 'scanning', 'writing', 'partial'].includes(activeJob.status);
  const freshnessLabel = useMemo(() => lastSeenAt ? formatRelativeTime(lastSeenAt) : null, [lastSeenAt]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPinned size={18} className="text-accent shrink-0" />
          <h1 className="text-sm font-bold text-text-primary tracking-tight truncate">
            {currentMarket?.displayName || 'Market Intelligence'}
          </h1>
        </div>

        {isScanning ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Live</span>
          </div>
        ) : onRefresh ? (
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-bg-surface rounded text-text-tertiary hover:text-text-primary transition-colors"
            title="Refresh active listings"
          >
            <RefreshCw size={14} />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
        {activeJob ? (
          <span>
            {(activeJob.analysisType || 'Market').replace('_', ' ')}: {activeJob.propertiesFound} found
            {activeJob.propertiesExpected ? ` / ${activeJob.propertiesExpected}` : ''}
          </span>
        ) : (
          <span>{totalCount} properties {currentMarket?.city ? `in ${currentMarket.city}` : currentMarket ? `in ${currentMarket.displayName}` : 'found'}</span>
        )}
        {freshnessLabel && !isScanning && (
          <span className="flex items-center gap-0.5 text-text-tertiary">
            <Clock size={10} /> {freshnessLabel}
          </span>
        )}
      </div>
    </div>
  );
}
