/* ═══════════════════════════════════════════════════════════
   TIMELINE PANEL — Chronological event feed
   Shows when no property is selected in the detail area

   Palantir Blueprint Phase 3
   ═══════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import {
  X, TrendingUp, TrendingDown, Activity, Clock,
  MapPin, AlertTriangle,
} from 'lucide-react';
import type { OntologyEvent } from '../../types';

/* ─── Event type → visual config ───────────────────────── */

const EVENT_META: Record<string, { color: string; label: string; Icon: typeof Activity }> = {
  listing_created:  { color: '#4A9E6B', label: 'New Listing',      Icon: TrendingUp },
  price_reduced:    { color: '#C9503C', label: 'Price Reduced',     Icon: TrendingDown },
  price_increased:  { color: '#D4A843', label: 'Price Increased',   Icon: TrendingUp },
  under_contract:   { color: '#5A7EA6', label: 'Under Contract',    Icon: Activity },
  back_on_market:   { color: '#D4A843', label: 'Back on Market',    Icon: Activity },
  closed_sale:      { color: '#4A9E6B', label: 'Closed Sale',       Icon: TrendingUp },
  withdrawn:        { color: '#9E8E82', label: 'Withdrawn',         Icon: X },
  expired:          { color: '#9E8E82', label: 'Expired',           Icon: Clock },
  permit_filed:     { color: '#8B5E3C', label: 'Permit Filed',      Icon: Activity },
  market_alert:     { color: '#E8733A', label: 'Market Alert',      Icon: AlertTriangle },
  status_changed:   { color: '#5A7EA6', label: 'Status Changed',    Icon: Activity },
};

const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  info:        { bg: '#9E8E8220', text: '#9E8E82' },
  notable:     { bg: '#D4A84320', text: '#D4A843' },
  significant: { bg: '#E8733A20', text: '#E8733A' },
  critical:    { bg: '#C9503C20', text: '#C9503C' },
};

/* ─── Group events by date ─────────────────────────────── */

interface GroupedEvents {
  date: string;
  displayDate: string;
  events: OntologyEvent[];
}

function groupByDate(events: OntologyEvent[]): GroupedEvents[] {
  const groups: Record<string, OntologyEvent[]> = {};

  for (const event of events) {
    const date = event.occurred_at 
      ? new Date(event.occurred_at).toISOString().split('T')[0]
      : 'Unknown Date';
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([date, evts]) => ({
      date,
      displayDate: new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      }),
      events: evts,
    }));
}

/* ═══ MAIN COMPONENT ═════════════════════════════════════ */

interface TimelinePanelProps {
  events: OntologyEvent[];
  onClose: () => void;
  onEventClick?: (event: OntologyEvent) => void;
  selectedEventTypes?: string[];
  onToggleEventType?: (type: string) => void;
}

export default function TimelinePanel({
  events,
  onClose,
  onEventClick,
}: TimelinePanelProps) {
  /* ── Group events ── */
  const grouped = useMemo(() => groupByDate(events), [events]);

  /* ── Count by type ── */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    }
    return counts;
  }, [events]);

  return (
    <div className="odp-slide-in w-[340px] h-full bg-bg-elevated border-l border-border flex flex-col shadow-lg overflow-hidden">

      {/* ─── Header ─── */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Event Timeline</h3>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-bg-surface flex items-center justify-center hover:bg-bg-primary transition-all cursor-pointer">
          <X size={14} className="text-text-secondary" />
        </button>
      </div>

      {/* ─── Stats bar ─── */}
      <div className="px-4 py-2 border-b border-border bg-bg-surface/50 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(typeCounts).slice(0, 5).map(([type, count]) => {
            const meta = EVENT_META[type] || EVENT_META.status_changed;
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                style={{ background: meta.color + '15', color: meta.color }}
              >
                {meta.label}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* ─── Event list ─── */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Clock size={28} className="text-text-tertiary mb-3" />
            <p className="text-sm font-medium text-text-secondary">No events in this window</p>
            <p className="text-xs text-text-tertiary mt-1">Try expanding the time range using the slider below</p>
          </div>
        ) : (
          <div className="px-4 py-3">
            {grouped.map(group => (
              <div key={group.date} className="mb-4 last:mb-0">
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{group.displayDate}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[9px] text-text-tertiary">{group.events.length}</span>
                </div>

                {/* Events for this date */}
                <div className="space-y-1.5">
                  {group.events.map(event => {
                    const meta = EVENT_META[event.event_type] || EVENT_META.status_changed;
                    const sevBadge = SEVERITY_BADGE[event.severity] || SEVERITY_BADGE.info;
                    const EventIcon = meta.Icon;

                    return (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-bg-surface transition-colors text-left cursor-pointer group"
                      >
                        {/* Icon */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: meta.color + '20', color: meta.color }}
                        >
                          <EventIcon size={13} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-text-primary">{meta.label}</span>
                            <span
                              className="text-[8px] font-bold uppercase px-1 py-0.5 rounded-full"
                              style={{ background: sevBadge.bg, color: sevBadge.text }}
                            >
                              {event.severity}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[9px] text-text-tertiary">
                            <span>{new Date(event.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                            {event.lat && event.lng && (
                              <span className="flex items-center gap-0.5 text-accent group-hover:underline">
                                <MapPin size={8} /> View on map
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Footer stats ─── */}
      <div className="px-4 py-2 border-t border-border bg-bg-surface/30 shrink-0">
        <p className="text-[10px] text-text-tertiary text-center">
          {events.length} total events · {grouped.length} days
        </p>
      </div>
    </div>
  );
}
