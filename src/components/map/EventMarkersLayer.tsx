/* ═══════════════════════════════════════════════════════════
   EVENT MARKERS LAYER — Renders ont_market_events on map
   Color-coded by severity, icon by event type
   Time-aware opacity (fades for older events)

   Palantir Blueprint Phase 3
   ═══════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { OntologyEvent } from '../../types';

/* ─── Event type config ────────────────────────────────── */

const EVENT_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  listing_created:  { emoji: '', color: '#4A9E6B', label: 'New Listing' },
  price_reduced:    { emoji: '', color: '#C9503C', label: 'Price Reduced' },
  price_increased:  { emoji: '', color: '#D4A843', label: 'Price Increased' },
  under_contract:   { emoji: '', color: '#5A7EA6', label: 'Under Contract' },
  back_on_market:   { emoji: '', color: '#D4A843', label: 'Back on Market' },
  closed_sale:      { emoji: '', color: '#4A9E6B', label: 'Closed Sale' },
  withdrawn:        { emoji: '', color: '#9E8E82', label: 'Withdrawn' },
  expired:          { emoji: '', color: '#9E8E82', label: 'Expired' },
  permit_filed:     { emoji: '', color: '#8B5E3C', label: 'Permit Filed' },
  market_alert:     { emoji: '', color: '#E8733A', label: 'Market Alert' },
  status_changed:   { emoji: '', color: '#5A7EA6', label: 'Status Changed' },
};

const SEVERITY_GLOW: Record<string, string> = {
  info:        '0 0 0 1px rgba(158,142,130,0.3)',
  notable:     '0 0 0 2px rgba(212,168,67,0.4)',
  significant: '0 0 0 2px rgba(232,115,58,0.5)',
  critical:    '0 0 4px 2px rgba(201,80,60,0.6)',
};

/* ─── Create event marker icon ─────────────────────────── */

function createEventIcon(event: OntologyEvent, opacity: number) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.status_changed;
  const glow = SEVERITY_GLOW[event.severity] || SEVERITY_GLOW.info;

  return L.divIcon({
    html: `<div style="
      background:${config.color};
      color:white;
      width:14px;height:14px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;
      border:2px solid white;
      box-shadow:${glow};
      opacity:${opacity};
      cursor:pointer;
      font-family:Inter,sans-serif;
    "></div>`,
    className: 'event-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/* ─── Calculate temporal opacity ───────────────────────── */

function getTemporalOpacity(eventDate: string, windowCenter: number, windowSpan: number): number {
  const eventMs = new Date(eventDate).getTime();
  const distance = Math.abs(eventMs - windowCenter);
  const halfSpan = windowSpan / 2;
  if (distance > halfSpan) return 0.3;
  return 0.5 + 0.5 * (1 - distance / halfSpan); // 0.5 → 1.0
}

/* ═══ MAIN COMPONENT ═════════════════════════════════════ */

interface EventMarkersLayerProps {
  events: OntologyEvent[];
  visible: boolean;
  timeWindow?: { since: string; until: string };
  onEventClick?: (event: OntologyEvent) => void;
}

export default function EventMarkersLayer({
  events,
  visible,
  timeWindow,
  onEventClick,
}: EventMarkersLayerProps) {
  /* ── Compute window center + span for opacity calc ── */
  const windowMeta = useMemo(() => {
    if (!timeWindow) {
      // Stable fallback: reference point is midnight today (not Date.now)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { center: today.getTime(), span: 30 * 86400000 };
    }
    const sinceMs = new Date(timeWindow.since).getTime();
    const untilMs = new Date(timeWindow.until).getTime();
    return { center: (sinceMs + untilMs) / 2, span: untilMs - sinceMs };
  }, [timeWindow]);

  if (!visible || events.length === 0) return null;

  /* ── Only render events that have coordinates ── */
  const geoEvents = events.filter(e => e.lat && e.lng);

  return (
    <>
      {geoEvents.map(event => {
        const opacity = getTemporalOpacity(event.occurred_at, windowMeta.center, windowMeta.span);
        const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.status_changed;

        return (
          <Marker
            key={event.id}
            position={[event.lat!, event.lng!]}
            icon={createEventIcon(event, opacity)}
            eventHandlers={{
              click: () => onEventClick?.(event),
            }}
          >
            <Tooltip direction="top" offset={[0, -15]} className="event-tooltip">
              <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 140 }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                    style={{ background: config.color }}
                  >
                    {config.emoji}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: '#1a1614' }}>
                    {config.label}
                  </span>
                </div>
                {event.description && (
                  <p className="text-[10px]" style={{ color: '#6b5d52' }}>{event.description}</p>
                )}
                <p className="text-[9px] mt-1" style={{ color: '#9E8E82' }}>
                  {new Date(event.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <span
                  className="inline-block mt-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    background: config.color + '15',
                    color: config.color,
                  }}
                >
                  {event.severity}
                </span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
