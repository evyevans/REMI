/* ═══════════════════════════════════════════════════════════
   OBJECT DETAIL PANEL v2 — Property Intelligence Dossier
   ─────────────────────────────────────────────────────────
   v2 Redesign:
   • Metrics Hero replaces broken "No Photo" — data IS the visual
   • Activated Comps tab — queries similar properties from Supabase
   • Activated Analytics tab — property metrics vs market context
   • Wired Watchlist → useSavedProperties store
   • Wired "Ask REMI" → injects property context into chat
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  X, Bed, Bath, Ruler, TrendingUp, TrendingDown,
  MapPin, ExternalLink, Bookmark, BookmarkCheck, Bell, Share2,
  MessageCircle, Clock, Activity, Loader2,
  ArrowUpRight, ArrowDownRight, Minus, Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DealScoreBadge } from '../ui';
import { useMarket } from '../../stores/marketStore';
import type { Property, OntologyEvent } from '../../types';
import type { CanonicalPropertyRow } from '../../types/database';
import { rowToProperty } from '../../hooks/useMapData';

type Tab = 'overview' | 'timeline' | 'comps' | 'analytics';

interface ObjectDetailPanelProps {
  property: Property | null;
  events?: OntologyEvent[];
  nearbyActivity?: { active_listings: number; recent_sales: number; developments: number };
  onClose: () => void;
  onAskRemi?: (property: Property) => void;
  onWatchlist?: (property: Property) => void;
  onAlert?: (property: Property) => void;
  onShare?: (property: Property) => void;
  isSaved?: boolean;
}

/* ─── Deal Score Radial ─────────────────────────────────── */

function DealScoreRadial({ score }: { score: number | null }) {
  const val = score ?? 0;
  const pct = Math.min(100, (val / 10) * 100);
  const color = val >= 8 ? '#4A9E6B' : val >= 6 ? '#D4A843' : val >= 3 ? '#E8733A' : '#C9503C';
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl opacity-30"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <svg width="96" height="96" viewBox="0 0 96 96" className="relative z-10">
        {/* Track */}
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-border/30" />
        {/* Progress */}
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-2xl font-black" style={{ color }}>{score !== null ? score.toFixed(1) : '—'}</span>
        <span className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest">Deal Score</span>
      </div>
    </div>
  );
}

/* ─── Metrics Hero — Property image + data-forward header ─── */

function MetricsHero({ property, isSaved }: { property: Property; isSaved: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = property.imageUrls?.[0] ?? null;
  const showImage = !!imgSrc && !imgFailed;

  const handleImgError = useCallback(() => setImgFailed(true), []);

  const statusColor = property.listingStatus === 'for_sale' ? '#4A9E6B'
    : property.listingStatus === 'sold' ? '#C9503C'
    : property.listingStatus === 'for_rent' ? '#3B82F6'
    : '#9E8E82';

  const statusLabel = property.listingStatus === 'for_sale' ? 'For Sale'
    : property.listingStatus === 'sold' ? 'Sold'
    : property.listingStatus === 'for_rent' ? 'For Rent'
    : 'Pending';

  const domColor = property.daysOnMarket <= 14 ? '#4A9E6B' : property.daysOnMarket <= 45 ? '#D4A843' : '#C9503C';

  return (
    <div className="w-full relative overflow-hidden bg-[#111111] border-b border-border/50 shadow-sm flex flex-col">

      {/* ── Property Photo ── */}
      {showImage ? (
        <div className="relative w-full h-[180px] overflow-hidden shrink-0">
          <img
            src={imgSrc!}
            alt={property.address}
            className="w-full h-full object-cover"
            onError={handleImgError}
            referrerPolicy="no-referrer"
          />
          {/* Bottom gradient so metrics below read cleanly */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent pointer-events-none" />
          {/* Status badge over image */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-md"
              style={{ background: `${statusColor}60`, border: `1px solid ${statusColor}80`, color: '#fff' }}
            >
              {statusLabel}
            </span>
          </div>
          {isSaved && (
            <span className="absolute top-3 right-10 flex items-center gap-1 text-[9px] font-bold text-[#D4A843] backdrop-blur-md bg-black/50 px-2 py-1 rounded-full">
              <Star size={10} fill="#D4A843" /> Saved
            </span>
          )}
        </div>
      ) : (
        /* No image — subtle gradient fallback */
        <div className="px-5 pt-5 pb-0">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-0" />
          <div className="flex items-center justify-between mb-4 relative z-10 w-full">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-md"
              style={{ background: `${statusColor}40`, border: `1px solid ${statusColor}60`, color: '#fff' }}
            >
              {statusLabel}
            </span>
            {isSaved && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#D4A843] backdrop-blur-md bg-black/40 px-2 py-1 rounded-full">
                <Star size={10} fill="#D4A843" /> Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className={`flex items-center gap-4 px-5 pb-5 relative z-10 w-full ${showImage ? '-mt-14' : 'mt-0'}`}>
        <DealScoreRadial score={property.dealScore} />
        <div className="flex-1 min-w-0 drop-shadow-lg">
          <p className="text-xl font-black text-white tracking-tight drop-shadow-md">
            ${(Number(property.price ?? 0)).toLocaleString()}
          </p>
          {property.sqft > 0 && (
            <p className="text-xs text-white/90 mt-0.5 font-medium drop-shadow">
              ${Math.round(property.price / property.sqft)}/sqft
            </p>
          )}
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white font-medium drop-shadow">
            <span className="flex items-center gap-1"><Bed size={12} className="text-white/80" />{property.bedrooms ?? '--'}</span>
            <span className="flex items-center gap-1"><Bath size={12} className="text-white/80" />{property.bathrooms ?? '--'}</span>
            <span className="flex items-center gap-1"><Ruler size={12} className="text-white/80" />{property.sqft ? (Number(property.sqft)).toLocaleString() : '--'}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 drop-shadow">
            <Clock size={11} style={{ color: domColor }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: domColor }}>
              {property.daysOnMarket} days on market
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Event type → icon + color ───────────────────────────── */
function eventMeta(type: string) {
  switch (type) {
    case 'listing_created':  return { color: '#4A9E6B', label: 'New Listing', icon: <TrendingUp size={12} /> };
    case 'price_reduced':    return { color: '#C9503C', label: 'Price Reduced', icon: <TrendingDown size={12} /> };
    case 'price_increased':  return { color: '#D4A843', label: 'Price Increased', icon: <TrendingUp size={12} /> };
    case 'under_contract':   return { color: '#5A7EA6', label: 'Under Contract', icon: <Activity size={12} /> };
    case 'closed_sale':      return { color: '#4A9E6B', label: 'Closed Sale', icon: <TrendingUp size={12} /> };
    case 'back_on_market':   return { color: '#D4A843', label: 'Back on Market', icon: <Activity size={12} /> };
    case 'withdrawn':        return { color: '#9E8E82', label: 'Withdrawn', icon: <X size={12} /> };
    default:                 return { color: '#9E8E82', label: type.replace(/_/g, ' '), icon: <Activity size={12} /> };
  }
}

/* ─── CompCard — Mini comparable property card ─────────── */

function CompCard({ comp, referencePrice }: { comp: Property; referencePrice: number }) {
  const diff = comp.price - referencePrice;
  const pctDiff = referencePrice > 0 ? (diff / referencePrice) * 100 : 0;
  const isHigher = diff > 0;
  const isEqual = Math.abs(pctDiff) < 1;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-text-primary truncate">
          {(comp.address || '').split(',')[0]}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-tertiary">
          <span>{comp.bedrooms}bd / {comp.bathrooms}ba</span>
          <span>·</span>
          <span>{(Number(comp.sqft ?? 0)).toLocaleString()} sqft</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-bold text-text-primary">${(Number(comp.price ?? 0)).toLocaleString()}</p>
        <div className={`flex items-center gap-0.5 justify-end text-[10px] font-semibold ${
          isEqual ? 'text-text-tertiary' : isHigher ? 'text-error' : 'text-success'
        }`}>
          {isEqual ? <Minus size={9} /> : isHigher ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
          <span>{isEqual ? 'Same' : `${Math.abs(pctDiff).toFixed(1)}%`}</span>
        </div>
      </div>
      <DealScoreBadge score={comp.dealScore} size="sm" />
    </div>
  );
}

/* ─── useComparables — Supabase query for similar properties ─── */

function useComparables(property: Property | null) {
  const { currentMarket } = useMarket();
  const [comps, setComps] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!property || !currentMarket?.id) {
      setComps([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchComps() {
      try {
        const bedMin = Math.max(0, (property!.bedrooms ?? 0) - 1);
        const bedMax = (property!.bedrooms ?? 0) + 1;
        const sqftMin = Math.round((property!.sqft ?? 1000) * 0.75);
        const sqftMax = Math.round((property!.sqft ?? 1000) * 1.25);

        const { data, error } = await supabase
          .from('canonical_properties')
          .select('*')
          .eq('market_slug', currentMarket!.id)
          .gte('bedrooms', bedMin)
          .lte('bedrooms', bedMax)
          .gte('sqft', sqftMin)
          .lte('sqft', sqftMax)
          .neq('id', property!.id)
          .order('deal_score', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (cancelled) return;

        const mapped = (data ?? [])
          .map((row: CanonicalPropertyRow) => rowToProperty(row))
          .filter((p): p is Property => p !== null);

        setComps(mapped);
      } catch (err) {
        console.error('[useComparables] Failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchComps();
    return () => { cancelled = true; };
  }, [property?.id, currentMarket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { comps, loading };
}

/* ─── Inline Mini Bar Chart ─────────────────────────────── */

function MiniBarChart({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-text-primary">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-bg-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(5, pct)}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* ═══ MAIN PANEL ══════════════════════════════════════════ */

export default function ObjectDetailPanel({
  property,
  events = [],
  nearbyActivity,
  onClose,
  onAskRemi,
  onWatchlist,
  onAlert,
  onShare,
  isSaved = false,
}: ObjectDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { comps, loading: compsLoading } = useComparables(activeTab === 'comps' ? property : null);

  if (!property) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline', count: events.length || undefined },
    { key: 'comps', label: 'Comps' },
    { key: 'analytics', label: 'Analytics' },
  ];

  const pricePerSqft = property.sqft > 0
    ? Math.round(property.price / property.sqft)
    : 0;

  return (
    <div className="odp-slide-in w-full h-full bg-bg-elevated flex flex-col overflow-hidden">

      {/* ─── Header: Metrics Hero ─── */}
      <div className="relative shrink-0">
        <MetricsHero property={property} isSaved={isSaved} />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer shadow-sm"
        >
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* ─── Property Address ─── */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-sm font-semibold text-text-primary leading-snug">{(property.address || '').split(',')[0]}</p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {property.city} {property.state_province}
        </p>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-border shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all cursor-pointer relative ${
              activeTab === tab.key
                ? 'text-accent'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-[8px] font-bold bg-accent/10 text-accent px-1 py-0.5 rounded-full">{tab.count}</span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Listing History */}
            <section>
              <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Listing History</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                  <span className="text-text-primary">Active — Listed {property.daysOnMarket}d ago at ${(Number(property.price ?? 0)).toLocaleString()}</span>
                </div>
                {property.priceHistory?.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-text-tertiary shrink-0" />
                    <span className="text-text-secondary">{entry.event}: ${(Number(entry.price ?? 0)).toLocaleString()} ({entry.date})</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Market Context */}
            <section>
              <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Market Context</h4>
              <div className="bg-bg-surface rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Days on Market</span>
                  <span className={`font-medium ${property.daysOnMarket <= 14 ? 'text-success' : property.daysOnMarket <= 45 ? 'text-warning' : 'text-error'}`}>
                    {property.daysOnMarket}d
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Price/sqft</span>
                  <span className="text-text-primary font-medium">${pricePerSqft}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Deal Score</span>
                  <span className={`font-bold ${(property.dealScore ?? 0) >= 8 ? 'text-success' : (property.dealScore ?? 0) >= 6 ? 'text-warning' : 'text-error'}`}>
                    {property.dealScore?.toFixed(1) ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Property Type</span>
                  <span className="text-text-primary font-medium capitalize">{property.propertyType}</span>
                </div>
                {property.priceTier && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Price Tier</span>
                    <span className="text-text-primary font-medium capitalize">{property.priceTier.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Nearby Activity */}
            {nearbyActivity && (
              <section>
                <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Nearby Activity</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-bg-surface rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{nearbyActivity.active_listings}</p>
                    <p className="text-[9px] text-text-tertiary">Active</p>
                  </div>
                  <div className="bg-bg-surface rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{nearbyActivity.recent_sales}</p>
                    <p className="text-[9px] text-text-tertiary">Sales</p>
                  </div>
                  <div className="bg-bg-surface rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-text-primary">{nearbyActivity.developments}</p>
                    <p className="text-[9px] text-text-tertiary">Dev</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="p-4">
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">Events (Last 90 Days)</h4>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock size={24} className="text-text-tertiary mb-2" />
                <p className="text-xs text-text-secondary">No events recorded yet</p>
                <p className="text-[10px] text-text-tertiary mt-1">Events will appear when Ontology data is populated</p>
              </div>
            ) : (
              <div className="space-y-1">
                {events.map((event) => {
                  const meta = eventMeta(event.event_type);
                  return (
                    <div key={event.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary">{meta.label}</p>
                        {event.description && <p className="text-[10px] text-text-secondary mt-0.5">{event.description}</p>}
                        <p className="text-[9px] text-text-tertiary mt-0.5">
                          {new Date(event.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* COMPS — ACTIVATED with real comparable data */}
        {activeTab === 'comps' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Comparable Properties</h4>
              <span className="text-[9px] text-text-tertiary">
                ±1 bed · ±25% sqft
              </span>
            </div>

            {compsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 size={20} className="text-accent animate-spin" />
                <p className="text-xs text-text-tertiary">Finding comps...</p>
              </div>
            ) : comps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MapPin size={24} className="text-text-tertiary mb-2" />
                <p className="text-xs text-text-secondary">No comparable properties found</p>
                <p className="text-[10px] text-text-tertiary mt-1">Run a scan to populate more data</p>
              </div>
            ) : (
              <>
                {/* Reference property */}
                <div className="bg-accent/5 border border-accent/15 rounded-lg px-3 py-2.5 mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-accent uppercase tracking-wider">Subject Property</p>
                      <p className="text-xs font-semibold text-text-primary mt-0.5">{(property.address || '').split(',')[0]}</p>
                    </div>
                    <p className="text-sm font-bold text-text-primary">${(Number(property.price ?? 0)).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-text-tertiary">
                    <span>{property.bedrooms}bd / {property.bathrooms}ba</span>
                    <span>{(Number(property.sqft ?? 0)).toLocaleString()} sqft</span>
                    <span>${pricePerSqft}/sqft</span>
                  </div>
                </div>

                {/* Comp list */}
                <div className="space-y-0">
                  {comps.map((comp) => (
                    <CompCard key={comp.id} comp={comp} referencePrice={property.price} />
                  ))}
                </div>

                {/* Summary stats */}
                <div className="mt-4 bg-bg-surface rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Comp Analysis</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg Comp Price</span>
                      <span className="text-text-primary font-medium">
                        ${Math.round(comps.reduce((s, c) => s + c.price, 0) / comps.length).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Avg $/sqft</span>
                      <span className="text-text-primary font-medium">
                        ${Math.round(comps.reduce((s, c) => s + (c.sqft > 0 ? c.price / c.sqft : 0), 0) / comps.length)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Position</span>
                      <span className={`font-semibold ${
                        property.price <= comps.reduce((s, c) => s + c.price, 0) / comps.length ? 'text-success' : 'text-warning'
                      }`}>
                        {property.price <= comps.reduce((s, c) => s + c.price, 0) / comps.length ? 'Below Market' : 'Above Market'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ANALYTICS — ACTIVATED with property-level insights */}
        {activeTab === 'analytics' && (
          <div className="p-4 space-y-4">
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1">Property Metrics</h4>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <p className="text-lg font-black text-text-primary">${pricePerSqft}</p>
                <p className="text-[9px] text-text-tertiary mt-0.5">Price/sqft</p>
              </div>
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <p className={`text-lg font-black ${property.daysOnMarket <= 14 ? 'text-success' : property.daysOnMarket <= 45 ? 'text-warning' : 'text-error'}`}>
                  {property.daysOnMarket}d
                </p>
                <p className="text-[9px] text-text-tertiary mt-0.5">Days on Market</p>
              </div>
            </div>

            {/* Visual bars */}
            <section className="bg-bg-surface rounded-lg p-3 space-y-3">
              <MiniBarChart value={property.dealScore ?? 0} max={10} color="#E8733A" label="Deal Score" />
              <MiniBarChart value={pricePerSqft} max={800} color="#4A9E6B" label="Price/sqft (vs $800 benchmark)" />
              <MiniBarChart value={property.daysOnMarket} max={120} color={property.daysOnMarket <= 14 ? '#4A9E6B' : property.daysOnMarket <= 45 ? '#D4A843' : '#C9503C'} label="Days on Market (vs 120d)" />
              {property.bedrooms > 0 && (
                <MiniBarChart value={Math.round(property.price / property.bedrooms)} max={500000} color="#5A7EA6" label="Price/Bedroom" />
              )}
            </section>

            {/* Property profile */}
            <section>
              <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Property Profile</h4>
              <div className="bg-bg-surface rounded-lg p-3 space-y-2 text-xs">
                {property.dealCategory && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Deal Category</span>
                    <span className="text-text-primary font-medium capitalize">{property.dealCategory.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {property.sizeCategory && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Size Category</span>
                    <span className="text-text-primary font-medium capitalize">{property.sizeCategory.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {property.priceTier && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Price Tier</span>
                    <span className="text-text-primary font-medium capitalize">{property.priceTier.replace(/_/g, ' ')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Listing Status</span>
                  <span className="text-text-primary font-medium capitalize">{property.listingStatus.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ─── Bottom Actions ─── */}
      <div className="border-t border-border p-3 space-y-2 shrink-0">
        {onAskRemi && (
          <button
            onClick={() => onAskRemi(property)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <MessageCircle size={14} /> Ask REMI about this property
          </button>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onWatchlist?.(property)}
            className={`flex items-center justify-center gap-1 py-2 text-[10px] font-medium rounded-lg border transition-colors cursor-pointer ${
              isSaved
                ? 'bg-accent/10 text-accent border-accent/30'
                : 'text-text-secondary bg-bg-surface border-border hover:bg-bg-primary'
            }`}
          >
            {isSaved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={() => onAlert?.(property)}
            className="flex items-center justify-center gap-1 py-2 text-[10px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-primary border border-border transition-colors cursor-pointer"
          >
            <Bell size={11} /> Alert
          </button>
          <button
            onClick={() => onShare?.(property)}
            className="flex items-center justify-center gap-1 py-2 text-[10px] font-medium text-text-secondary bg-bg-surface rounded-lg hover:bg-bg-primary border border-border transition-colors cursor-pointer"
          >
            <Share2 size={11} /> Share
          </button>
        </div>
        {property.zillowUrl && property.zillowUrl.startsWith('http') ? (
          <a
            href={property.zillowUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-[#E8733A] border border-[#E8733A]/30 rounded-lg hover:bg-[#E8733A]/5 transition-colors"
          >
            <ExternalLink size={12} /> View Listing
          </a>
        ) : (
          <span className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-text-tertiary border border-border rounded-lg cursor-not-allowed opacity-50">
            <ExternalLink size={12} /> Listing URL Unavailable
          </span>
        )}
      </div>
    </div>
  );
}
