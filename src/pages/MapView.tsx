/* ═══════════════════════════════════════════════════════════
   MAP OS v2 — Luxury Geospatial Intelligence Command Center
   ─────────────────────────────────────────────────────────
   v2 Redesign:
   • Sidebar → Curated "Saved Properties" watchlist (no image dependency)
   • Enriched marker tooltips with deal score, beds/baths, DOM
   • Marker clustering via leaflet.markercluster
   • "Ask REMI" wired to inject property context into chat
   • DiscoveredNeighborhoodsOverlay mounted
   • timeWindow wired to EventMarkersLayer
   • Luxury micro-animations and premium empty states
   ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
// CSS only — JS loaded dynamically in MarkerClusterLayer to avoid Vite optimizer hang
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  Bed, Bath, Ruler,
  Map as MapIcon, Satellite, Mountain, MapPinned,
  PanelLeftClose, PanelLeftOpen, Layers, Search,
  Bookmark, Trash2, Clock,
  Compass, Maximize2, AlertCircle, MapPin, RefreshCw, ScanEye
} from 'lucide-react';
import { DealScoreBadge } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useMarket, useMarketStore } from '../stores/marketStore';
import { useJobStore, type AnalysisType } from '../stores/jobStore';
import { useThemeStore } from '../stores/themeStore';
import { useMapData } from '../hooks/useMapData';
import { useScan, type ScanTenure } from '../hooks/useScan';
import { SCAN_TENURE } from '../types/scan';
import { useJobPoller } from '../hooks/useJobPoller';
import { useSavedProperties } from '../stores/useSavedProperties';
import ObjectDetailPanel from '../components/map/ObjectDetailPanel';
import NeighborhoodLayer from '../components/map/NeighborhoodLayer';
import TimeSlider from '../components/map/TimeSlider';
import EventMarkersLayer from '../components/map/EventMarkersLayer';
import TimelinePanel from '../components/map/TimelinePanel';
import { DiscoveredNeighborhoodsOverlay } from '../components/map/DiscoveredNeighborhoodsOverlay';
import { useOntologyEvents } from '../hooks/useOntologyData';
import type { Property, OntologyEvent } from '../types';
import { getOrCreateUserId } from '../lib/auth-utils';
import { MapDataHeader } from '../components/map/MapDataHeader';
import { MapFilterBar } from '../components/map/MapFilterBar';
import { useFilters } from '../contexts/FilterContext';
import RemiChat from './RemiChat';

/* ─── Tile Layer URLs ───────────────────────────────────── */

const TILE_URLS: Record<string, string> = {
  default: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

const VIEW_MODES = [
  { key: 'default',   label: 'Default',   icon: MapIcon    },
  { key: 'satellite', label: 'Satellite', icon: Satellite   },
  { key: 'terrain',   label: 'Terrain',   icon: Mountain   },
  { key: 'street',    label: 'Street',    icon: MapPinned  },
] as const;

/* ─── Map Layers Config ─────────────────────────────────── */

const MAP_LAYERS = [
  { id: 'neighborhoods', label: 'Neighborhood Boundaries', category: 'boundary', desc: 'Show district polygons', available: true },
  { id: 'events',        label: 'Market Events',           category: 'data',     desc: 'Show timeline events', available: true },
  { id: 'priceDrops',   label: 'Price Drops (≥ 8)',        category: 'data',     desc: 'Highlight reductions', available: true },
  { id: 'newListings',  label: 'New Listings (≤1 day)',     category: 'data',     desc: 'Fresh inventory',      available: true },
  { id: 'daysOnMarket', label: 'Days on Market',            category: 'data',     desc: 'Color markers by age', available: true },
  { id: 'growthZones',  label: 'Growth Zones',              category: 'prediction', desc: 'Predictive areas',   available: false },
  { id: 'floodRisk',   label: 'Flood Risk',                 category: 'risk',     desc: 'Environmental risk',  available: false },
] as const;

type LayerId = typeof MAP_LAYERS[number]['id'];

/* ─── Deal score color ──────────────────────────────────── */

function dealScoreColor(score: number | null): string {
  if (score === null || score === undefined) return '#9E8E82';
  if (score >= 8) return '#4A9E6B';
  if (score >= 6) return '#D4A843';
  return '#C9503C';
}

/* ─── Marker icon factory ───────────────────────────────── */

// animDelay: undefined = no animation (icon update), 0+ = pop-in with that delay in ms
function getMarkerIcon(property: Property, useDom: boolean, isSelected: boolean, isSaved: boolean, marketAvgDom: number = 30, animDelay?: number) {
  let color: string;
  let label: string;

  if (useDom) {
    const fresh = Math.max(7, Math.floor(marketAvgDom * 0.25));
    const average = Math.max(14, marketAvgDom);
    color = property.daysOnMarket <= fresh ? '#4A9E6B'
          : property.daysOnMarket <= average ? '#D4A843'
          : '#C9503C';
    label = `${property.daysOnMarket}d`;
  } else {
    const ds = property.dealScore ?? 5;
    color = ds >= 8 ? '#4A9E6B'
          : ds >= 5 ? '#D4A843'
          : '#C9503C';
    const p = property.price;
    label = p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : `$${Math.round(p / 1000)}K`;
  }

  const size = isSelected ? 52 : 44;
  const ring = isSelected ? `box-shadow:0 0 0 2px white,0 0 0 4px ${color};` : '';
  const savedDot = isSaved
    ? `<span style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:#FFD700;border:1.5px solid white;"></span>`
    : '';
  const pulse = isSelected
    ? `<span style="position:absolute;inset:-6px;border-radius:999px;border:2px solid ${color};opacity:.5;animation:ping 1s cubic-bezier(0,0,.2,1) infinite;"></span>`
    : '';
  const anim = animDelay !== undefined
    ? `animation:markerAppear 0.35s cubic-bezier(0.34,1.56,0.64,1) ${animDelay}ms both;`
    : '';

  return L.divIcon({
    html: `<div style="position:relative;background:${color};color:white;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;font-family:Inter,sans-serif;white-space:nowrap;border:2px solid white;${ring}cursor:pointer;${anim}">${pulse}${savedDot}${label}</div>`,
    className: '',
    iconSize: [size, 22],
    iconAnchor: [size / 2, 11],
  });
}

/* ─── MapFlyTo ──────────────────────────────────────────── */

function MapFlyTo({ target }: { target: { lat: number; lng: number; ts: number } | null }) {
  const map = useMap();
  const prevTs = useRef<number>(0);
  useEffect(() => {
    if (target && target.ts !== prevTs.current) {
      prevTs.current = target.ts;
      map.flyTo([target.lat, target.lng], 16, { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

/* ─── MapMarketSync ─────────────────────────────────────── */

function MapMarketSync() {
  const map = useMap();
  const { currentMarket } = useMarket();
  const prevMarketRef = useRef(currentMarket.id);

  useEffect(() => {
    if (currentMarket.bounds) {
      const sw = L.latLng(currentMarket.bounds[0][0], currentMarket.bounds[0][1]);
      const ne = L.latLng(currentMarket.bounds[1][0], currentMarket.bounds[1][1]);
      map.fitBounds(L.latLngBounds(sw, ne));
    } else {
      map.setView([currentMarket.lat, currentMarket.lng], 12);
    }
    prevMarketRef.current = currentMarket.id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentMarket.id !== prevMarketRef.current) {
      prevMarketRef.current = currentMarket.id;
      if (currentMarket.bounds) {
        const sw = L.latLng(currentMarket.bounds[0][0], currentMarket.bounds[0][1]);
        const ne = L.latLng(currentMarket.bounds[1][0], currentMarket.bounds[1][1]);
        map.flyToBounds(L.latLngBounds(sw, ne), { padding: [50, 50], duration: 1.5, easeLinearity: 0.25 });
      } else {
        const zoom = currentMarket.resolution === 'neighborhood' ? 15 : 12;
        map.flyTo([currentMarket.lat, currentMarket.lng], zoom, { duration: 1.5 });
      }
    }
  }, [currentMarket, map]);

  return null;
}

/* ─── MapAutoResize — ResizeObserver-based tile refresh ─── */

function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/* ─── MarkerClusterLayer — Groups markers via leaflet.markercluster ── */
/* Incremental: new properties pop in one-by-one; existing markers never destroyed */

function MarkerClusterLayer({
  properties,
  useDom,
  marketAvgDom,
  selectedId,
  savedIds,
  onMarkerClick,
}: {
  properties: Property[];
  useDom: boolean;
  marketAvgDom?: number;
  selectedId: string | null;
  savedIds: Set<string>;
  onMarkerClick: (property: Property) => void;
}) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterGroupRef = useRef<any>(null);
  // Stable references so incremental effects don't need to re-close over them
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const addedIdsRef = useRef<Set<string>>(new Set());
  const propertiesRef = useRef<Property[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const [ready, setReady] = useState(false);

  // Keep click handler ref current so markers have a stable closure
  useEffect(() => { onMarkerClickRef.current = onMarkerClick; }, [onMarkerClick]);

  // Dynamically import leaflet.markercluster to avoid Vite optimizer hang
  useEffect(() => {
    import('leaflet.markercluster').then(() => setReady(true));
  }, []);

  // ── Effect 1: Create cluster group ONCE per map mount ────────────────
  useEffect(() => {
    if (!ready) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
      animateAddingMarkers: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();

        const scores = markers
          .map((m: L.Marker) => (m.options as Record<string, unknown>)._dealScore as number | null)
          .filter((s: number | null): s is number => s !== null && s !== undefined);

        const avgScore = scores.length > 0
          ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
          : null;

        const color = dealScoreColor(avgScore);
        const scoreLabel = avgScore !== null ? avgScore.toFixed(1) : '—';
        const hasTopDeal = scores.some((s: number) => s >= 8);

        const zoom = map.getZoom();
        const isZoomedOut = zoom <= 10;
        const size = count > 50 ? 56 : count > 20 ? 48 : 40;

        let containerStyle = '';
        if (isZoomedOut) {
          const glow = hasTopDeal
            ? 'box-shadow: 0 0 16px rgba(74, 158, 107, 0.6), inset 0 0 8px rgba(255,255,255,0.8);'
            : 'box-shadow: 0 4px 12px rgba(0,0,0,0.1), inset 0 0 8px rgba(255,255,255,0.7);';
          containerStyle = `
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.95);
            color: #1a1614;
            ${glow}
          `;
        } else {
          containerStyle = `
            background: linear-gradient(135deg, ${color}dd, ${color}99);
            border: 3px solid white;
            box-shadow: 0 2px 8px ${color}40;
            color: white;
          `;
        }

        return L.divIcon({
          html: `<div style="
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            width:${size}px;height:${size}px;
            border-radius:50%;
            font-family:Inter,sans-serif;cursor:pointer;
            transition: all 0.3s ease;
            ${containerStyle}
          ">
            ${isZoomedOut && hasTopDeal ? '<div style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#4A9E6B;border:2px solid white;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite;"></div><div style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#4A9E6B;border:2px solid white;"></div>' : ''}
            <span style="font-size:13px;font-weight:800;line-height:1;">${count}</span>
            <span style="font-size:8px;font-weight:600;opacity:0.85;margin-top:1px;">⌀${scoreLabel}</span>
          </div>`,
          className: 'remi-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
      markerMapRef.current.clear();
      addedIdsRef.current.clear();
      propertiesRef.current = [];
    };
  }, [ready, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Incrementally add NEW properties only ──────────────────
  // Never destroys existing markers — each arriving property pops in with animation
  useEffect(() => {
    if (!ready || !clusterGroupRef.current) return;
    const clusterGroup = clusterGroupRef.current;

    // Market changed or data reset: clear all markers and start fresh
    if (properties.length === 0 && addedIdsRef.current.size > 0) {
      clusterGroup.clearLayers();
      markerMapRef.current.clear();
      addedIdsRef.current.clear();
      propertiesRef.current = [];
      return;
    }

    // Identify only the properties not yet on the map
    const newProperties = properties.filter(p => !addedIdsRef.current.has(p.id));
    propertiesRef.current = properties;
    if (newProperties.length === 0) return;

    // Cap stagger at 20 markers — beyond that, add with minimal delay to avoid long waits
    const STAGGER_CAP = 20;
    newProperties.forEach((property, batchIndex) => {
      const isSelected = selectedId === property.id;
      const isSaved = savedIds.has(property.id);
      // Stagger: 50ms per marker, capped so large batches finish quickly
      const animDelay = Math.min(batchIndex, STAGGER_CAP) * 50;
      const icon = getMarkerIcon(property, useDom, isSelected, isSaved, marketAvgDom, animDelay);

      const marker = L.marker([property.lat, property.lng], {
        icon,
        _dealScore: property.dealScore,
        _listingStatus: property.listingStatus,
      } as L.MarkerOptions);

      const dsColor = dealScoreColor(property.dealScore);
      const tooltipHtml = `
        <div style="font-family:Inter,sans-serif;min-width:180px;padding:2px 0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="
              display:inline-flex;align-items:center;justify-content:center;
              width:28px;height:28px;border-radius:50%;
              background:${dsColor}20;color:${dsColor};
              font-size:11px;font-weight:800;
            ">${property.dealScore?.toFixed(1) ?? '—'}</span>
            <div style="min-width:0;">
              <p style="font-size:11px;font-weight:600;color:#1a1614;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">
                ${(property.address || '').split(',')[0]}
              </p>
              <p style="font-size:12px;font-weight:700;color:#1a1614;margin:0;">
                $${(Number(property.price ?? 0)).toLocaleString()}
              </p>
            </div>
          </div>
          <div style="display:flex;gap:8px;font-size:10px;color:#6b5d52;border-top:1px solid #f0ebe6;padding-top:4px;margin-top:2px;">
            <span>${property.bedrooms ?? 0} bd</span>
            <span>${property.bathrooms ?? 0} ba</span>
            <span>${(Number(property.sqft ?? 0)).toLocaleString()} sqft</span>
            <span style="margin-left:auto;color:${property.daysOnMarket <= Math.max(7, Math.floor((marketAvgDom ?? 30) * 0.25)) ? '#4A9E6B' : property.daysOnMarket <= Math.max(14, marketAvgDom ?? 30) ? '#D4A843' : '#C9503C'}">${property.daysOnMarket}d</span>
          </div>
          ${isSaved ? '<div style="margin-top:4px;font-size:9px;color:#D4A843;font-weight:600;">★ Saved to Watchlist</div>' : ''}
        </div>
      `;
      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -15],
        className: 'property-rich-tooltip',
      });

      marker.on('click', () => onMarkerClickRef.current(property));
      clusterGroup.addLayer(marker);
      markerMapRef.current.set(property.id, marker);
      addedIdsRef.current.add(property.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, ready]); // selectedId/savedIds/useDom handled by Effect 3

  // ── Effect 3: Update icons when selection / saved / display mode changes ─
  // Only re-draws icons — never adds or removes markers
  useEffect(() => {
    if (!ready || !clusterGroupRef.current) return;
    for (const property of propertiesRef.current) {
      const marker = markerMapRef.current.get(property.id);
      if (!marker) continue;
      const isSelected = selectedId === property.id;
      const isSaved = savedIds.has(property.id);
      // No animDelay (undefined) = no pop-in animation on icon update
      marker.setIcon(getMarkerIcon(property, useDom, isSelected, isSaved, marketAvgDom));
    }
  }, [selectedId, savedIds, useDom, marketAvgDom, ready]);

  return null;
}

/* ─── SavedPropertyCard — Intelligence card with photo thumbnail ── */

function SavedPropertyCardThumb({ src, address }: { src?: string | null; address: string }) {
  const [loading, setLoading] = useState(!!src);
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return (
      <div className="w-[72px] shrink-0 h-full min-h-[80px] bg-bg-surface-hover flex items-center justify-center rounded-l-lg overflow-hidden">
        <MapPin size={16} className="text-text-tertiary/30" />
      </div>
    );
  }
  return (
    <div className="w-[72px] shrink-0 h-full min-h-[80px] bg-bg-surface-hover rounded-l-lg overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-bg-surface-hover flex items-center justify-center">
          <div className="w-3 h-3 border border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={address}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
    </div>
  );
}

function SavedPropertyCard({
  property,
  savedAt,
  isSelected,
  onClick,
  onUnsave,
}: {
  property: Property;
  savedAt: string;
  isSelected: boolean;
  onClick: () => void;
  onUnsave: (e: React.MouseEvent) => void;
}) {
  const statusColor = property.listingStatus === 'for_sale' ? '#0F52BA'
    : property.listingStatus === 'sold' ? '#E8733A'
    : property.listingStatus === 'for_rent' ? '#333333'
    : '#7C3AED';

  const statusLabel = property.listingStatus === 'for_sale' ? 'For Sale'
    : property.listingStatus === 'sold' ? 'Sold'
    : property.listingStatus === 'for_rent' ? 'For Rent'
    : 'Full Scan';

  const ago = useMemo(() => {
    const diff = new Date().getTime() - new Date(savedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [savedAt]);

  const thumbSrc = property.imageUrls?.[0] ?? null;

  return (
    <div
      onClick={onClick}
      className={`group relative bg-bg-elevated border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md flex ${
        isSelected
          ? 'border-accent shadow-sm ring-1 ring-accent/20'
          : 'border-border hover:border-border-hover'
      }`}
    >
      {/* Photo thumbnail */}
      <SavedPropertyCardThumb src={thumbSrc} address={property.address || ''} />

      {/* Color accent bar — only shown when no image */}
      {!thumbSrc && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ background: statusColor }} />
      )}

      <div className="pl-3 pr-3 py-3 flex-1 min-w-0">
        {/* Top row: Address + unsave */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-text-primary leading-tight line-clamp-1">
              {(property.address || '').split(',')[0]}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                style={{ background: `${statusColor}15`, color: statusColor }}
              >
                {statusLabel}
              </span>
              <span className="text-[9px] text-text-tertiary">{ago}</span>
            </div>
          </div>
          <button
            onClick={onUnsave}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-bg-surface-hover text-text-quaternary hover:text-error transition-all"
            title="Remove from watchlist"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Price + Deal Score */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-text-primary">
            ${(Number(property.price ?? 0)).toLocaleString()}
          </span>
          <DealScoreBadge score={property.dealScore} size="sm" />
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-secondary">
          <span className="flex items-center gap-1"><Bed size={10} className="text-accent/60" />{property.bedrooms ?? 0}</span>
          <span className="flex items-center gap-1"><Bath size={10} className="text-accent/60" />{property.bathrooms ?? 0}</span>
          <span className="flex items-center gap-1"><Ruler size={10} className="text-accent/60" />{(Number(property.sqft ?? 0)).toLocaleString()}</span>
          <span className={`ml-auto flex items-center gap-1 font-medium ${
            property.daysOnMarket <= 14 ? 'text-success' : property.daysOnMarket <= 45 ? 'text-warning' : 'text-error'
          }`}>
            <Clock size={9} />{property.daysOnMarket}d
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Map Legend (pin color key) ─────────────────────────── */

function MapLegend() {
  const [collapsed, setCollapsed] = useState(true);
  const dealScores = [
    { color: '#4A9E6B', label: '8–10 (High ROI)' },
    { color: '#D4A843', label: '5–7 (Fair Value)' },
    { color: '#C9503C', label: '<5 (Caution)' },
    { color: null, isLiquidGlass: true, label: 'Unscored' },
  ];
  
  const statuses = [
    { color: '#0F52BA', label: 'For Sale' },
    { color: '#333333', label: 'For Rent' },
    { color: '#E8733A', label: 'Sold' },
    { color: '#7C3AED', label: 'Full Scan' },
  ];

  return (
    <div className="relative flex flex-col items-start" style={{ zIndex: 1000 }}>
      {!collapsed && (
        <div className="absolute top-full mt-2 left-0 bg-bg-primary/95 backdrop-blur-xl border border-border rounded-xl p-3 shadow-xl mb-3 w-[250px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
            <h4 className="text-[10px] font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
              Map Intelligence Key
            </h4>
            <button onClick={() => setCollapsed(true)} className="text-text-tertiary hover:text-text-primary bg-bg-surface hover:bg-bg-surface-hover p-1 rounded-md transition-colors cursor-pointer">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-2.5">Deal Score Pins</p>
              <div className="grid grid-cols-1 gap-2.5">
                {dealScores.map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    {item.isLiquidGlass ? (
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black shadow-sm bg-white/40 backdrop-blur-md" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40 shadow-sm" style={{ backgroundColor: item.color! }} />
                    )}
                    <span className="text-xs text-text-primary font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-2.5 mt-1">Listing Status Colors</p>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                {statuses.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded shrink-0 border border-white/20" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-text-secondary">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2 border-t border-border mt-1">
              <p className="text-[8px] font-bold text-text-tertiary uppercase tracking-widest mb-1.5">Zoomed-Out Mapping</p>
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-full border border-white/80 bg-white/75 backdrop-blur-md flex items-center justify-center shadow-md shrink-0">
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#4A9E6B] border-2 border-white animate-pulse" />
                </div>
                <div className="text-[9px] text-text-secondary leading-snug">
                  <span className="font-semibold text-text-primary">Property</span> clusters.<br />
                  <span className="text-[#4A9E6B] font-bold">Green dot</span> = Top deal inside.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="h-8 px-2.5 rounded-lg border shadow-sm flex items-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer bg-accent text-text-on-accent hover:bg-accent-hover border-accent"
        >
          <div className="relative flex items-center justify-center w-4 h-4 rounded-md">
            <ScanEye size={12} className="relative z-10" />
          </div>
          Intelligence Legend
        </button>
      )}
    </div>
  );
}

/* ─── Fit to Results (must be inside MapContainer for useMap) ─── */

function FitBoundsControl({ properties }: { properties: Property[] }) {
  const map = useMap();

  const handleFit = useCallback(() => {
    if (properties.length === 0) return;
    const bounds = L.latLngBounds(properties.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [properties, map]);

  if (properties.length === 0) return null;

  return (
    <div className="leaflet-top leaflet-right" style={{ top: 4, right: 200, position: 'absolute', zIndex: 500 }}>
      <button
        onClick={handleFit}
        title="Fit map to all results"
        className="h-8 w-8 rounded-lg border border-border bg-bg-elevated shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}

/* ─── MapView ───────────────────────────────────────────── */

type SortKey = 'deal_score_desc' | 'price_asc' | 'price_desc' | 'dom_asc';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'deal_score_desc', label: 'Deal Score ↓' },
  { value: 'price_asc',       label: 'Price ↑' },
  { value: 'price_desc',      label: 'Price ↓' },
  { value: 'dom_asc',         label: 'Newest' },
];

/* ─── AnalysisType → ScanTenure mapper ──────────────────── */
const ANALYSIS_TO_TENURE: Record<string, ScanTenure> = {
  for_sale: SCAN_TENURE.FOR_SALE,
  rental: SCAN_TENURE.FOR_RENT,
  sold: SCAN_TENURE.SOLD,
  comprehensive: SCAN_TENURE.FOR_SALE,  // Full Scan defaults to for_sale start
};

export default function MapView() {
  const { addToast } = useToast();
  const { currentMarket } = useMarket();
  const { theme } = useThemeStore();
  const discoveredNeighborhoods = useMarketStore((s) => s.discoveredNeighborhoods);
  const activeJob = useJobStore((s) => currentMarket ? s.getActiveJobForMarket(currentMarket.id) : null);
  // Pass active job's analysisType to filter properties by tenure (for_sale, rental, sold)
  const { properties, loading: mapLoading, error: mapError, totalCount, refetch: refetchProperties } = useMapData(activeJob?.analysisType);
  const registerJob = useJobStore((s) => s.registerJob);
  const consumeScanTrigger = useJobStore((s) => s.consumeScanTrigger);
  const pendingScanTrigger = useJobStore((s) => s.pendingScanTrigger);
  const { filters } = useFilters();
  const { triggerScan: fireScan } = useScan();

  const marketAvgDom = useMemo(() => {
    if (!properties || properties.length === 0) return 30;
    let totalDom = 0;
    let count = 0;
    for (const p of properties) {
      if (p.listingStatus === 'for_sale' && typeof p.daysOnMarket === 'number') {
        totalDom += p.daysOnMarket;
        count++;
      }
    }
    return count > 0 ? Math.max(7, Math.round(totalDom / count)) : 30;
  }, [properties]);

  // Polling fallback for Supabase Realtime drops
  useJobPoller(activeJob?.jobId ?? null);

  /* ─── SCAN TRIGGER CONSUMER ──────────────────────────────
     This is the critical bridge: the header buttons set
     pendingScanTrigger in the store, and this effect consumes
     it, fires the API, and registers the job.                */
  useEffect(() => {
    if (!pendingScanTrigger) return;
    if (!currentMarket?.id) return;

    const analysisType = consumeScanTrigger();
    if (!analysisType) return;

    const tenure = ANALYSIS_TO_TENURE[analysisType] || SCAN_TENURE.FOR_SALE;
    const marketSlug = currentMarket.id;
    const label = analysisType.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    addToast(`Scanning ${label} in ${currentMarket.displayName}…`, 'info');

    fireScan(marketSlug, tenure).then((result) => {
      // Register the job in the store so the header spinner + realtime kick in
      registerJob({
        jobId: result.job_id,
        marketSlug,
        analysisType: analysisType as AnalysisType,
        status: 'pending',
        propertiesFound: 0,
        propertiesExpected: null,
        startedAt: result.started_at,
        completedAt: null,
        error: null,
        failure_reason: null,
      });
      addToast(`Scan launched — job ${result.job_id.slice(0, 8)}… is running.`, 'success');
    }).catch((err: Error) => {
      addToast(err.message || 'Could not start scan. Check your connection.', 'error');
    });
  }, [pendingScanTrigger, currentMarket, consumeScanTrigger, fireScan, registerJob, addToast]);

  // Saved properties store
  const {
    getSavedList,
    toggleSave,
    unsaveProperty,
    isSaved,
    getCount: getSavedCount,
  } = useSavedProperties();
  const savedList = useSavedProperties((s) => s.order); // Subscribe to order changes
  const savedSet = useMemo(() => new Set(savedList), [savedList]);

  // Broadcast map context to VoiceAvatar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('remi:map-context-update', {
      detail: {
        visibleListings: totalCount,
        viewArea: currentMarket?.displayName || currentMarket?.city || 'Unknown',
        activeJob: activeJob?.analysisType || null,
      }
    }));
  }, [totalCount, currentMarket?.id, currentMarket?.displayName, currentMarket?.city, activeJob?.analysisType]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<keyof typeof TILE_URLS>('satellite');
  const [activeLayers, setActiveLayers] = useState<Record<LayerId, boolean>>({
    neighborhoods: false,
    events: true,
    priceDrops: false,
    newListings: false,
    daysOnMarket: false,
    growthZones: false,
    floodRisk: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [detailPanelProperty, setDetailPanelProperty] = useState<Property | null>(null);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [sort, setSort] = useState<SortKey>('deal_score_desc');
  const [showTimeline, setShowTimeline] = useState(false);
  const [timeWindow, setTimeWindow] = useState<{ since: string; until: string } | undefined>(undefined);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [askRemiProperty, setAskRemiProperty] = useState<Property | null>(null);
  const flyCounter = useRef(0);

  const { events: ontologyEvents } = useOntologyEvents(currentMarket?.id ? [currentMarket.id] : undefined);

  const filtered = useMemo(() => {
    let result = [...properties];

    // Apply FilterContext filters (client-side on loaded dataset)
    if (filters.minDealScore > 0) {
      result = result.filter(p => (p.dealScore ?? 0) >= filters.minDealScore);
    }
    // Price filter only applies to for_sale/sold — rental last_price is monthly rent,
    // not purchase price, so a $1.2M–$3M budget filter would eliminate all rentals.
    if (filters.priceMin > 0) {
      result = result.filter(p => p.listingStatus === 'for_rent' || p.price >= filters.priceMin);
    }
    if (filters.priceMax < 1000000000000) {
      result = result.filter(p => p.listingStatus === 'for_rent' || p.price <= filters.priceMax);
    }
    if (filters.bedsMin > 0) {
      result = result.filter(p => (p.bedrooms ?? 0) >= filters.bedsMin);
    }
    if (filters.propertyTypes.length > 0) {
      result = result.filter(p => filters.propertyTypes.includes(p.propertyType ?? ''));
    }

    // Apply Layer Filters
    if (activeLayers.newListings) {
      result = result.filter(p => p.daysOnMarket <= 1);
    }
    if (activeLayers.priceDrops) {
      result = result.filter(p =>
        p.priceHistory && p.priceHistory.length > 0 &&
        p.priceHistory.some(h => h.event === 'price_reduced')
      );
    }

    // Sort
    if (sort === 'deal_score_desc') result.sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0));
    else if (sort === 'price_asc')  result.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') result.sort((a, b) => b.price - a.price);
    else if (sort === 'dom_asc')    result.sort((a, b) => a.daysOnMarket - b.daysOnMarket);
    return result;
  }, [properties, sort, filters, activeLayers.newListings, activeLayers.priceDrops]);

  // Compute most recent data timestamp for freshness display
  const lastSeenAt = useMemo(() => {
    if (properties.length === 0) return null;
    let latest = '';
    for (const p of properties) {
      if (p.updatedAt && p.updatedAt > latest) latest = p.updatedAt;
    }
    return latest || null;
  }, [properties]);

  // Saved properties filtered by sidebar search
  const filteredSaved = useMemo(() => {
    const entries = getSavedList();
    if (!sidebarSearch.trim()) return entries;
    const q = sidebarSearch.toLowerCase();
    return entries.filter((e) =>
      e.property.address?.toLowerCase().includes(q) ||
      e.property.city?.toLowerCase().includes(q)
    );
  }, [savedList, sidebarSearch, getSavedList]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLayer = (id: LayerId) => setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }));

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedId(property.id);
    setDetailPanelProperty(property);
    setAskRemiProperty(null);
    setFlyTarget({ lat: property.lat, lng: property.lng, ts: ++flyCounter.current });
    document.getElementById(`saved-card-${property.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleSavedCardClick = useCallback((property: Property) => {
    setSelectedId(property.id);
    setDetailPanelProperty(property);
    setAskRemiProperty(null);
    setFlyTarget({ lat: property.lat, lng: property.lng, ts: ++flyCounter.current });
  }, []);

  const handleEventClick = useCallback((event: OntologyEvent) => {
    setFlyTarget({ lat: event.lat || 0, lng: event.lng || 0, ts: ++flyCounter.current });
    addToast(`Event: ${event.event_type}`, 'info');
  }, [addToast]);

  const handleCloseDetail = useCallback(() => {
    setDetailPanelProperty(null);
    setSelectedId(null);
    setAskRemiProperty(null);
  }, []);

  const handleWatchlist = useCallback((property: Property) => {
    toggleSave(property);
    const wasSaved = isSaved(property.id);
    addToast(wasSaved ? 'Removed from Watchlist' : 'Added to Watchlist', wasSaved ? 'info' : 'success');
  }, [toggleSave, isSaved, addToast]);

  const handleAskRemi = useCallback((property: Property) => {
    setAskRemiProperty(property);
    setDetailPanelProperty(null);
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-surface overflow-hidden font-sans">
      <div className="flex-1 flex overflow-hidden relative">

        {/* ─── Filter + Legend overlay ─────────────────────────────────────────────── */}
        {/* Rendered outside the Leaflet map div so Leaflet cannot intercept clicks.  */}
        {/* MapFilterBar portals its dropdown to document.body — no overflow clipping. */}
        <div
          className="absolute top-3 flex items-start gap-2 pointer-events-none"
          style={{ left: sidebarOpen ? '323px' : '64px', zIndex: 9998 }}
        >
          <div className="pointer-events-auto flex items-start gap-2">
            <MapFilterBar />
            <MapLegend />
          </div>
        </div>

        {/* ─── Left Sidebar — Saved Properties Watchlist ──── */}
        <div className={`relative bg-bg-surface border-r border-border transition-all duration-300 ease-in-out z-20 flex flex-col overflow-hidden h-full ${sidebarOpen ? 'w-[320px]' : 'w-0'}`}>
          
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bookmark size={14} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Watchlist</h2>
                <p className="text-[10px] text-text-tertiary font-medium">{getSavedCount()} saved properties</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-bg-surface-hover rounded-md text-text-tertiary transition-colors cursor-pointer">
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Search bar (shown when there are saved properties) */}
          {getSavedCount() > 0 && (
            <div className="p-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-elevated border border-border rounded-lg">
                <Search size={12} className="text-text-quaternary shrink-0" />
                <input
                  type="text"
                  placeholder="Filter saved properties..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[11px] outline-none text-text-primary placeholder:text-text-quaternary"
                />
              </div>
            </div>
          )}


          {/* Property list / empty state */}
          {getSavedCount() === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-bg-surface/80">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10 mb-6 shadow-sm">
                <Compass size={32} className="text-accent/80" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Your Intelligence Hub</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-8 max-w-[240px]">
                Click any pin on the map to explore properties, review deal intelligence, and save your favorites here.
              </p>
              
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center gap-3 p-3 bg-bg-elevated rounded-xl border border-border/60 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-success/15 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-success">1</span></div>
                  <span className="text-sm font-medium text-text-secondary">Click a map pin to explore</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg-elevated rounded-xl border border-border/60 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-warning/15 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-warning">2</span></div>
                  <span className="text-sm font-medium text-text-secondary">Review deal intelligence</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-bg-elevated rounded-xl border border-border/60 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-accent">3</span></div>
                  <span className="text-sm font-medium text-text-secondary">Save to your watchlist</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-track-bg-surface scrollbar-thumb-border">
              {filteredSaved.length === 0 && sidebarSearch ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search size={20} className="text-text-quaternary mb-2" />
                  <p className="text-xs text-text-tertiary">No saved properties match "{sidebarSearch}"</p>
                </div>
              ) : (
                filteredSaved.map((entry) => (
                  <SavedPropertyCard
                    key={entry.property.id}
                    property={entry.property}
                    savedAt={entry.savedAt}
                    isSelected={selectedId === entry.property.id}
                    onClick={() => handleSavedCardClick(entry.property)}
                    onUnsave={(e) => {
                      e.stopPropagation();
                      unsaveProperty(entry.property.id);
                      addToast('Removed from Watchlist', 'info');
                    }}
                  />
                ))
              )}
            </div>
          )}

          {/* Bottom stats bar */}
          {getSavedCount() > 0 && (
            <div className="px-3 py-2 border-t border-border bg-bg-surface/50 shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-text-tertiary">
                {getSavedCount()} saved · {totalCount} total in market
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent text-[10px] font-semibold text-text-tertiary outline-none cursor-pointer hover:text-accent transition-colors"
              >
                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}

          {/* ─── Map Data Header (Relocated) ───────────────────────────────── */}
          <div className="p-4 border-t border-border shrink-0 bg-bg-surface mt-auto">
            <MapDataHeader
              currentMarket={currentMarket}
              activeJob={activeJob}
              totalCount={totalCount}
              lastSeenAt={lastSeenAt}
            />
          </div>
        </div>

        {/* Re-open sidebar button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-[9999] p-2 bg-bg-elevated border border-border rounded-lg shadow-md text-text-primary hover:bg-bg-surface-hover transition-all cursor-pointer ring-1 ring-black/5"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        {/* ─── Map ─────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0 h-full">

          {/* ─── Scan Progress Banner (floats over the map) ── */}
          {activeJob && (() => {
            const TERMINAL = ['completed', 'completed_empty', 'partial_success', 'failed'];
            const isActive = !TERMINAL.includes(activeJob.status);
            if (!isActive) return null;
            const label = (activeJob.analysisType || 'scan').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none" style={{ zIndex: 1100 }}>
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-accent/30 bg-bg-elevated/95 shadow-xl backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                  <span className="text-xs font-semibold text-text-primary">
                    Scanning {label}
                    {activeJob.propertiesFound > 0 && (
                      <span className="ml-1.5 text-accent font-bold">{activeJob.propertiesFound} found</span>
                    )}
                  </span>
                  <span className="text-[10px] text-text-tertiary ml-1">— {currentMarket?.displayName}</span>
                </div>
                {/* Animated progress bar */}
                <div className="w-48 h-0.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-accent rounded-full animate-[scan-progress_2s_ease-in-out_infinite]" style={{ width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            );
          })()}

          <MapContainer
            center={[currentMarket?.lat ?? 43.6532, currentMarket?.lng ?? -79.3832]} // Default to Toronto if no market
            zoom={12}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer 
              url={
                viewMode === 'default'
                  ? (theme === 'night' || theme === 'colorblind')
                    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
                    : TILE_URLS.default
                  : TILE_URLS[viewMode] || TILE_URLS.default
              } 
              attribution="© CartoDB / OpenStreetMap" 
            />
            <MapAutoResize />
            <MapFlyTo target={flyTarget} />
            <MapMarketSync />
            <NeighborhoodLayer
              visible={activeLayers.neighborhoods}
              neighborhoods={discoveredNeighborhoods.map(n => {
                const c = n.centroid ?? { lat: currentMarket.lat, lng: currentMarket.lng };
                // Generate approximate bbox (~500m radius) from centroid when bbox is absent
                const OFFSET = 0.005;
                return {
                  name: n.name,
                  centroid: c,
                  bbox: [c.lat - OFFSET, c.lng - OFFSET, c.lat + OFFSET, c.lng + OFFSET] as [number, number, number, number],
                };
              })}
              onRegionClick={(name) => addToast(`Viewing ${name}`, 'info')}
            />
            <EventMarkersLayer
              events={ontologyEvents || []}
              visible={activeLayers.events}
              timeWindow={timeWindow}
              onEventClick={handleEventClick}
            />
            {/* Clustered property markers */}
            <MarkerClusterLayer
              properties={filtered}
              useDom={activeLayers.daysOnMarket}
              marketAvgDom={marketAvgDom}
              selectedId={selectedId}
              savedIds={savedSet}
              onMarkerClick={handleMarkerClick}
            />
            <FitBoundsControl properties={filtered} />
          </MapContainer>

          {/* View mode switcher */}
          <div className="absolute top-3 right-3 bg-bg-elevated rounded-xl border border-border shadow-sm flex overflow-hidden" style={{ zIndex: 1000 }}>
            {VIEW_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                title={mode.label}
                className={`flex items-center gap-1 px-2.5 py-2 text-[10px] font-medium border-r border-border last:border-r-0 transition-all cursor-pointer ${
                  viewMode === mode.key ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:bg-bg-surface'
                }`}
              >
                <mode.icon size={12} />
              </button>
            ))}
          </div>

          {/* Layers panel */}
          <div className="absolute top-14 right-3" style={{ zIndex: 1000 }}>
            <button
              onClick={() => setShowLayersPanel(v => !v)}
              className={`h-8 px-2.5 rounded-lg border shadow-sm flex items-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                Object.values(activeLayers).some(Boolean)
                  ? 'bg-accent text-text-on-accent border-accent'
                  : 'bg-bg-elevated border-border text-text-secondary hover:border-border-hover'
              }`}
            >
              <Layers size={12} /> Layers
            </button>
            {showLayersPanel && (
              <div className="mt-1 bg-bg-primary/95 backdrop-blur-xl rounded-xl border border-border shadow-lg p-3 w-56">
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Layers</p>
                <div className="space-y-0.5">
                  {MAP_LAYERS.map(layer => (
                    <button
                      key={layer.id}
                      onClick={() => layer.available && toggleLayer(layer.id as LayerId)}
                      disabled={!layer.available}
                      className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-all w-full text-left ${
                        layer.available ? 'cursor-pointer hover:bg-bg-surface' : 'opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        activeLayers[layer.id]
                          ? 'bg-[#E8733A] border-[#E8733A] text-white'
                          : 'border-border bg-bg-surface group-hover:border-border-hover'
                      }`}>
                        {activeLayers[layer.id] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <span className={`flex-1 text-xs block truncate ${activeLayers[layer.id] ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                        {layer.label}
                      </span>
                      {!layer.available && (
                        <span className="text-[9px] bg-bg-surface border border-border px-1.5 py-0.5 rounded text-text-tertiary uppercase tracking-wider ml-2 shadow-sm font-semibold">Soon</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Empty state overlay */}
          {!mapLoading && !activeJob && properties.length === 0 && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
              <div className="bg-bg-primary/95 backdrop-blur-xl border border-border rounded-xl p-3 text-center max-w-[200px] pointer-events-auto shadow-lg">
                <MapPin size={20} className="mx-auto text-text-tertiary mb-2" />
                <p className="text-[11px] font-bold text-text-primary mb-0.5">No properties in this market yet</p>
                <p className="text-[9px] text-text-secondary mb-2">Run a scan to discover deals and populate the map.</p>
              </div>
            </div>
          )}

          {/* Error state overlay */}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
              <div className="bg-bg-elevated/95 backdrop-blur-sm border border-red-500/30 rounded-2xl p-6 text-center max-w-xs pointer-events-auto shadow-lg">
                <AlertCircle size={32} className="mx-auto text-red-400 mb-3" />
                <p className="text-sm font-semibold text-text-primary mb-1">Unable to load properties</p>
                <p className="text-xs text-text-secondary mb-3">{mapError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-text-on-accent text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Completed-empty state (scan ran but found 0 results) */}
          {!mapLoading && activeJob?.status === 'completed_empty' && properties.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000 }}>
              <div className="bg-bg-elevated/95 backdrop-blur-sm border border-border rounded-2xl p-6 text-center max-w-xs pointer-events-auto shadow-lg">
                <Search size={32} className="mx-auto text-text-tertiary mb-3" />
                <p className="text-sm font-semibold text-text-primary mb-1">Scan completed — no properties matched</p>
                <p className="text-xs text-text-secondary">Try a larger market or different filters.</p>
              </div>
            </div>
          )}

          {/* Scan finished but map is empty — offer manual reload (Realtime may have missed events) */}
          {!mapLoading && activeJob && properties.length === 0 &&
            ['completed', 'completed_stale', 'partial_success', 'failed'].includes(activeJob.status) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto" style={{ zIndex: 1000 }}>
              <div className="bg-bg-elevated/95 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-md flex items-center gap-3">
                <p className="text-xs text-text-secondary">Scan finished but map is empty.</p>
                <button
                  onClick={refetchProperties}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-text-on-accent text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw size={11} /> Reload Properties
                </button>
              </div>
            </div>
          )}

          {/* Completed-stale state (cache fallback — live data unavailable) */}
          {!mapLoading && activeJob?.status === 'completed_stale' && properties.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto" style={{ zIndex: 1000 }}>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 shadow-md max-w-sm">
                <p className="text-xs font-medium text-amber-900">
                  ⚠️ Showing data from last successful scan. Live data is temporarily unavailable.
                </p>
              </div>
            </div>
          )}

          {/* Listing count pill */}
          <div className={`absolute ${activeLayers.events ? 'bottom-16' : 'bottom-5'} left-1/2 -translate-x-1/2 bg-bg-primary/95 backdrop-blur-xl border border-border rounded-full px-3 py-1.5 shadow-md transition-all`} style={{ zIndex: 1000 }}>
            <span className="text-xs text-text-secondary">
              {mapLoading
                ? <span className="text-text-tertiary">Loading...</span>
                : <><span className="text-text-primary font-semibold">{filtered.length}</span> properties · <span className="text-accent font-semibold">{getSavedCount()}</span> saved</>
              }
            </span>
          </div>

          {/* Discovered Neighborhoods floating overlay */}
          <DiscoveredNeighborhoodsOverlay
            marketSlug={currentMarket?.id ?? null}
            userId={getOrCreateUserId()}
          />

          <TimeSlider
            visible={activeLayers.events}
            eventCount={ontologyEvents?.length || 0}
            onTimeWindowChange={(s, u) => setTimeWindow({ since: s, until: u })}
          />
        </div>

        {/* ─── Right Panel: RemiChat or ObjectDetailPanel ────── */}
        <div className="w-[380px] h-full flex flex-col border-l border-border bg-bg-primary shrink-0 z-10">
          {detailPanelProperty ? (
            <ObjectDetailPanel
              property={detailPanelProperty}
              onClose={handleCloseDetail}
              onAskRemi={handleAskRemi}
              onWatchlist={handleWatchlist}
              onAlert={() => addToast('Price Alert set', 'info')}
              onShare={() => { navigator.clipboard.writeText(window.location.href); addToast('Link copied', 'success'); }}
              isSaved={isSaved(detailPanelProperty.id)}
            />
          ) : showTimeline && activeLayers.events ? (
            <TimelinePanel
              events={ontologyEvents || []}
              onClose={() => setShowTimeline(false)}
              onEventClick={handleEventClick}
            />
          ) : (
            <RemiChat
              injectedPropertyContext={askRemiProperty}
              onClearPropertyContext={() => setAskRemiProperty(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
