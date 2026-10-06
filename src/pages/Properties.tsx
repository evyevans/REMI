/* ═══════════════════════════════════════════════════════════
   PROPERTIES GRID — Airtable 1:1 Replica (4-Table View)
   Column order exactly matches Airtable "Active Listings - For Sale"
   For Rent tab: dedicated ForRentTable component (blueprint-compliant)
   ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, ArrowUpDown, Loader2, Download, RefreshCw, ExternalLink, Sparkles, AlertTriangle, Trash2 } from 'lucide-react';
import { DealScoreBadge } from '../components/ui';
import { TextHoverEffect } from '../components/ui/text-hover-effect';
import { useProperties } from '../hooks/useProperties';
import type { ListingType, SessionProperty } from '../hooks/useProperties';
import { useMarket } from '../stores/marketStore';
import { useJobStore } from '../stores/jobStore';
import ForRentTable from './ForRentTable';
import SoldTable from './SoldTable';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Badge color maps — exact blueprint spec ────────────── */

// buyer_profile: 8-value enum
const BUYER_PROFILE_COLORS: Record<string, string> = {
  'First-Time Buyer':      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  'Growing Family':        'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Luxury Buyer':          'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Real Estate Investor':  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Downsizer':             'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
  'Second Home Buyer':     'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Young Professional':    'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  'Retiree':               'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

// risk_assessment: 5-value enum
const RISK_ASSESSMENT_COLORS: Record<string, string> = {
  'Low Risk':          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Medium-Low Risk':   'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  'Medium Risk':       'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Medium-High Risk':  'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25',
  'High Risk':         'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
};

function ColorBadge({ value, colorMap }: { value: string | null | undefined; colorMap: Record<string, string> }) {
  if (!value) return <span className="text-text-tertiary text-[11px]">—</span>;
  const cls = colorMap[value] ?? 'bg-bg-surface-hover text-text-secondary border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {value}
    </span>
  );
}

/* ─── Long-text cell with expand/collapse ────────────────── */

function LongTextCell({ value }: { value: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!value) return <span className="text-text-tertiary text-[11px]">—</span>;
  return (
    <div className="w-full">
      <p className={`text-[11px] text-text-secondary leading-snug ${expanded ? '' : 'line-clamp-2'}`}>
        {value}
      </p>
      <button
        onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
        className="text-[10px] text-accent hover:underline mt-0.5"
      >
        {expanded ? 'collapse' : 'expand'}
      </button>
    </div>
  );
}

/* ─── Agent cell with inline run button ──────────────────── */

function AgentCellWithRunButton({
  value,
  agentName,
  agentState,
  onRun,
  isLongText = false,
}: {
  value: string | number | null | undefined;
  agentName: string;
  agentState: AgentRunState;
  onRun: () => void;
  isLongText?: boolean;
}) {
  const isRunning = agentState === 'running';
  const isError = agentState === 'error';

  if (isLongText && value) {
    return (
      <div className="w-full flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <LongTextCell value={String(value)} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRun(); }}
          className={`shrink-0 mt-0.5 p-1 rounded transition-colors ${
            isRunning ? 'bg-accent/20 text-accent cursor-not-allowed' :
            isError ? 'text-red-400 hover:bg-red-400/10' :
            'text-text-tertiary hover:text-accent hover:bg-accent/10'
          }`}
          disabled={isRunning}
          title={`Run ${agentName}`}
        >
          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-1 justify-between group">
      <span className="text-[11px] text-text-secondary">
        {value ?? '—'}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onRun(); }}
        className={`shrink-0 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
          isRunning ? 'bg-accent/20 text-accent cursor-not-allowed' :
          isError ? 'text-red-400 hover:bg-red-400/10' :
          'text-text-tertiary hover:text-accent hover:bg-accent/10'
        }`}
        disabled={isRunning}
        title={`Run ${agentName}`}
      >
        {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
      </button>
    </div>
  );
}

/* ─── Tab config ─────────────────────────────────────────── */

const TABS: { label: string; value: ListingType }[] = [
  { label: 'For Sale',     value: 'for_sale'     },
  { label: 'For Rent',     value: 'for_rent'      },
  { label: 'Sold',         value: 'sold'          },
  { label: 'Market Intelligence', value: 'market_intel'  },
];

/* ─── Helpers ────────────────────────────────────────────── */

function fmtPrice(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  return `$${Number(val).toLocaleString()}`;
}

function fmtPpsf(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${Number(val).toFixed(0)}`;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  // val might be stored as 7.0 (meaning 7%) or 0.07 (meaning 7%)
  const pct = val > 1 ? val : val * 100;
  return `${pct.toFixed(2)}%`;
}

function fmtSignedPct(val: number | null | undefined): { text: string; cls: string } {
  if (val == null) return { text: '—', cls: 'text-text-tertiary' };
  const pct = val * 100;
  const text = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  // Below market → green (good for buyer), above market → red (expensive)
  const cls = pct < 0 ? 'text-emerald-400' : 'text-red-400';
  return { text, cls };
}

function fmtRoi(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  } catch { return val; }
}

/* ─── Column header helper ───────────────────────────────── */

function ColHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align = 'left',
  width,
}: {
  label: string;
  field?: keyof SessionProperty;
  sortField: keyof SessionProperty;
  sortDir: 'asc' | 'desc';
  onSort: (f: keyof SessionProperty) => void;
  align?: 'left' | 'right' | 'center';
  width: string;
}) {
  const active = field && sortField === field;
  const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <div
      onClick={field ? () => onSort(field) : undefined}
      className={`${width} px-3 border-r border-border h-full flex items-center gap-1 ${justifyClass} shrink-0
        text-[10px] uppercase font-bold text-text-secondary tracking-wider
        ${field ? 'cursor-pointer hover:bg-bg-surface-hover hover:text-text-primary transition-colors' : ''}
        ${active ? 'text-accent scale-105 transition-transform' : ''}`}
    >
      {label}
      {field && <ArrowUpDown size={9} className={active ? 'text-accent' : 'opacity-40'} style={{ transform: active && sortDir === 'desc' ? 'rotate(180deg)' : 'none' }} />}
    </div>
  );
}

/* ─── Run AI button ──────────────────────────────────────── */

type AgentRunState = 'idle' | 'running' | 'complete' | 'error';

function RunAIButton({
  state,
  onRun,
}: {
  state: AgentRunState;
  onRun: () => void;
}) {
  if (state === 'running') {
    return (
      <button disabled className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20 opacity-70 cursor-not-allowed whitespace-nowrap">
        <Loader2 size={10} className="animate-spin" />
        Analyzing…
      </button>
    );
  }
  if (state === 'complete') {
    return (
      <button
        onClick={onRun}
        title="Re-run AI agents for this property"
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-bg-surface-hover text-text-tertiary border border-border hover:border-accent/40 hover:text-accent transition-colors whitespace-nowrap"
      >
        <Sparkles size={10} />
        Re-run AI
      </button>
    );
  }
  if (state === 'error') {
    return (
      <button
        onClick={onRun}
        title="One or more insights failed — click to retry"
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors whitespace-nowrap"
      >
        <AlertTriangle size={10} />
        Retry AI
      </button>
    );
  }
  // idle
  return (
    <button
      onClick={onRun}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors whitespace-nowrap"
    >
      <Sparkles size={10} />
      ✦ Run AI
    </button>
  );
}

/* ─── Main Component ─────────────────────────────────────── */

export default function Properties() {
  const { currentMarket } = useMarket();
  const [viewType, setViewType] = useState<ListingType>('for_sale');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [sortField, setSortField] = useState<keyof SessionProperty>('deal_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { properties, loading: dataLoading, refresh, deleteProperties, lastRefreshed } = useProperties(viewType, sortField, sortDir);

  const getActiveJobForMarket = useJobStore((s) => s.getActiveJobForMarket);
  const activeJob = currentMarket?.id ? getActiveJobForMarket(currentMarket.id) : null;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewType]);

  // Broadcast active tab + listing count to voice bridge so REMI knows what's on screen
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('remi:map-context-update', {
      detail: {
        activePage: 'properties',
        propertiesContext: { activeTab: viewType, count: properties.length },
      },
    }));
  }, [viewType, properties.length]);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} listings?`)) {
      await deleteProperties(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Per-row AI run state (idle | running | complete | error)
  // Per-agent run state: property ID → agent name → state (idle | running | complete | error)
  const [agentRunState, setAgentRunState] = useState<Record<string, Record<string, AgentRunState>>>({});

  // Animated tab indicator (mirrors the global TabBar pattern)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const currentTabKey = hoveredTab || viewType;
  useEffect(() => {
    const node = tabRefs.current[currentTabKey];
    if (node) {
      setTabIndicator({
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    }
  }, [currentTabKey]);;

  /* ── Run single agent ── */
  const runSingleAgent = useCallback(async (property: SessionProperty, agentName: string) => {
    if (!currentMarket) return;

    const marketContext = currentMarket.displayName;
    const marketSlug = currentMarket.id;

    if (!marketContext || !marketSlug) return;

    const propStates = agentRunState[property.id] ?? {};
    const current = propStates[agentName] ?? 'idle';

    if (current === 'running') return;
    if (current === 'complete') {
      const ok = window.confirm(`Re-run ${agentName}? This will overwrite existing insights.`);
      if (!ok) return;
    }

    setAgentRunState(prev => ({
      ...prev,
      [property.id]: { ...propStates, [agentName]: 'running' }
    }));

    try {
      const resp = await fetch(`${API_BASE}/api/properties/run-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: property.id,
          market_context: marketContext,
          market_slug: marketSlug,
          listing_type: 'for_sale',
          agent_names: [agentName],
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      setAgentRunState(prev => ({
        ...prev,
        [property.id]: { ...propStates, [agentName]: 'complete' }
      }));
      refresh();
    } catch (err) {
      console.error(`[RunAgent ${agentName}] failed for`, property.id, err);
      setAgentRunState(prev => ({
        ...prev,
        [property.id]: { ...propStates, [agentName]: 'error' }
      }));
    }
  }, [currentMarket, agentRunState, refresh]);

  /* ── Run all agents ── */
  const runAllAgents = useCallback(async (property: SessionProperty) => {
    if (!currentMarket) return;

    const marketContext = currentMarket.displayName;
    const marketSlug = currentMarket.id;

    if (!marketContext || !marketSlug) return;

    const propStates = agentRunState[property.id] ?? {};
    const anyRunning = Object.values(propStates).includes('running');
    const anyComplete = Object.values(propStates).includes('complete');

    if (anyRunning) return;
    if (anyComplete) {
      const ok = window.confirm('Re-run all agents? This will overwrite existing insights.');
      if (!ok) return;
    }

    const allAgents = [
      "deal_category", "size_category", "price_tier", "buyer_profile",
      "risk_assessment", "showing_priority", "investment_analysis",
      "competitive_position", "neighborhood_insights", "negotiation_strategy",
    ];

    const newStates: Record<string, AgentRunState> = {};
    allAgents.forEach(a => { newStates[a] = 'running'; });
    setAgentRunState(prev => ({
      ...prev,
      [property.id]: { ...propStates, ...newStates }
    }));

    try {
      const resp = await fetch(`${API_BASE}/api/properties/run-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: property.id,
          market_context: marketContext,
          market_slug: marketSlug,
          listing_type: 'for_sale',
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const completedStates: Record<string, AgentRunState> = {};
      allAgents.forEach(a => { completedStates[a] = 'complete'; });
      setAgentRunState(prev => ({
        ...prev,
        [property.id]: { ...propStates, ...completedStates }
      }));
      refresh();
    } catch (err) {
      console.error('[RunAllAgents] failed for', property.id, err);
      const errorStates: Record<string, AgentRunState> = {};
      allAgents.forEach(a => { errorStates[a] = 'error'; });
      setAgentRunState(prev => ({
        ...prev,
        [property.id]: { ...propStates, ...errorStates }
      }));
    }
  }, [currentMarket, agentRunState, refresh]);

  /* Filter & Sort */
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const result = properties.filter(p =>
      !q || p.address.toLowerCase().includes(q)
    );
    // Even though backend sorts by default, we apply client-side sort to filtered search results 
    // to maintain instant UI feedback
    return result.sort((a, b) => {
      const valA = (a[sortField] ?? 0) as number;
      const valB = (b[sortField] ?? 0) as number;
      if (valA === valB) return 0;
      return sortDir === 'asc'
        ? (valA > valB ? 1 : -1)
        : (valA < valB ? 1 : -1);
    });
  }, [properties, debouncedSearch, sortField, sortDir]);

  const toggleSort = (field: keyof SessionProperty) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const headers = [
      'Address','Price','Bedrooms','Bathrooms','Sqft','Property Type',
      'Listing URL','Listing Agent','Extracted At','Price/Sqft',
      'Est. Monthly Payment','Deal Score','Deal Category','Size Category',
      'Price Tier','Mortgage Rate','Mortgage Down Payment','Mortgage Term Years',
      'Investment Analysis','Buyer Profile','Competitive Position','Risk Assessment',
      'Showing Priority','Neighborhood Insights','Negotiation Strategy',
      'Percent Above Market','Price Per Bedroom','Estimated ROI',
    ];
    const rows = filtered.map(p => [
      p.address,
      p.list_price ?? '',
      p.beds ?? '',
      p.baths ?? '',
      p.sqft ?? '',
      p.property_type ?? '',
      p.listing_url ?? '',
      p.listing_agent ?? '',
      p.extracted_at ?? '',
      p.price_per_sqft != null ? Number(p.price_per_sqft).toFixed(0) : '',
      p.est_monthly_payment != null ? Number(p.est_monthly_payment).toFixed(2) : '',
      p.deal_score ?? '',
      p.deal_category ?? '',
      p.size_category ?? '',
      p.price_tier ?? '',
      p.mortgage_interest_rate ?? '',
      p.mortgage_down_payment != null ? (p.mortgage_down_payment > 1 ? p.mortgage_down_payment + '%' : (p.mortgage_down_payment * 100).toFixed(0) + '%') : '',
      p.mortgage_term_years ?? '',
      p.investment_analysis ?? '',
      p.buyer_profile ?? '',
      p.competitive_position ?? '',
      p.risk_assessment ?? '',
      p.showing_priority ?? '',
      p.neighborhood_insights ?? '',
      p.negotiation_strategy ?? '',
      p.percent_above_market != null ? `${(p.percent_above_market * 100).toFixed(1)}%` : '',
      p.price_per_bedroom ?? '',
      p.estimated_roi != null ? `${(p.estimated_roi * 100).toFixed(2)}%` : '',
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remi-properties-${viewType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentTab = TABS.find(t => t.value === viewType);

  const colProps = {
    sortField,
    sortDir,
    onSort: toggleSort,
  };

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="h-14 bg-bg-surface-dark border-b border-border flex items-center justify-between px-4 gap-4 shrink-0">
      {/* Tabs with animated sliding indicator */}
        <div
          className="relative h-11 flex items-center gap-1.5"
          onMouseLeave={() => setHoveredTab(null)}
        >
          {/* Sliding Indicator Background */}
          <div
            className="absolute top-0 left-0 bg-white border border-border shadow-sm rounded-lg origin-top-left pointer-events-none"
            style={{
              width: tabIndicator.width > 0 ? `${tabIndicator.width}px` : '0px',
              height: tabIndicator.height > 0 ? `${tabIndicator.height}px` : '0px',
              transform: `translate(${tabIndicator.left}px, ${tabIndicator.top}px)`,
              opacity: tabIndicator.width > 0 ? 1 : 0,
              transition: `transform var(--dur-mid) var(--spring), width var(--dur-mid) var(--spring), height var(--dur-mid) var(--spring), opacity var(--dur-fast) var(--smooth)`,
            }}
          />
          {TABS.map(tab => (
            <button
              key={tab.value}
              ref={(node) => { tabRefs.current[tab.value] = node; }}
              onClick={() => setViewType(tab.value)}
              onMouseEnter={() => setHoveredTab(tab.value)}
              className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors
                ${viewType === tab.value || hoveredTab === tab.value
                  ? 'text-black drop-shadow-sm font-semibold'
                  : 'text-text-secondary hover:text-black'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {lastRefreshed && (
            <span className="text-[10px] text-text-tertiary">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            className="h-8 w-8 flex items-center justify-center rounded border border-border text-text-tertiary hover:text-accent hover:border-accent transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={exportCsv}
            className="h-8 w-8 flex items-center justify-center rounded border border-border text-text-tertiary hover:text-accent hover:border-accent transition-colors"
            title="Export CSV"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {viewType === 'for_rent' ? (
        <ForRentTable properties={properties} loading={dataLoading} onDelete={deleteProperties} />
      ) : viewType === 'sold' ? (
        <SoldTable properties={properties} loading={dataLoading} onDelete={deleteProperties} />
      ) : (

      <div className="flex flex-col h-full overflow-hidden flex-1">
        {/* Search bar */}
        <div className="px-6 py-2 border-b border-border bg-bg-elevated/30 flex items-center justify-between shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder={`Search ${currentTab?.label || ''} listings...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-1.5 w-64 bg-bg-surface-dark border border-border rounded-lg text-xs focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.size > 0 && (
              <button 
                onClick={handleDeleteSelected} 
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 font-medium bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors border border-red-500/20 cursor-pointer"
              >
                <Trash2 size={13} /> Delete {selectedIds.size} Selected
              </button>
            )}
            <span className="text-[10px] text-text-tertiary font-mono">{filtered.length} listings</span>
            {(() => {
              const dates = properties
                .map(p => p.extracted_at)
                .filter(Boolean)
                .map(d => new Date(d as string).getTime())
                .filter(t => !isNaN(t));
              if (dates.length === 0) return null;
              const latest = Math.max(...dates);
              const diff = Date.now() - latest;
              const mins = Math.floor(diff / 60000);
              const hrs = Math.floor(mins / 60);
              const days = Math.floor(hrs / 24);
              const ago = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : mins > 0 ? `${mins}m ago` : 'just now';
              return <span className="text-[10px] text-text-tertiary/60 font-mono ml-2">· Updated {ago}</span>;
            })()}
          </div>
        </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">

          {/* ── Column headers ── */}
          <div className="flex items-center sticky top-0 z-30 h-10 bg-bg-surface-dark border-b border-border shadow-sm text-text-secondary">
            {/* Checkbox */}
            <div className="w-12 border-r border-border h-full flex items-center justify-center shrink-0">
              <input 
                type="checkbox" 
                className="rounded border-border cursor-pointer accent-accent"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
              />
            </div>

            {/* 1. Address */}
            <ColHeader label="Address"              field="address"                width="w-80" {...colProps} />
            {/* 2. Price */}
            <ColHeader label="Price"                field="list_price"             width="w-36" align="right" {...colProps} />
            {/* 3. Bedrooms */}
            <ColHeader label="Bedrooms"             field="beds"                   width="w-28" align="center" {...colProps} />
            {/* 4. Bathrooms */}
            <ColHeader label="Bathrooms"            field="baths"                  width="w-28" align="center" {...colProps} />
            {/* 5. Sqft */}
            <ColHeader label="Sqft"                 field="sqft"                   width="w-28" align="center" {...colProps} />
            {/* 6. Property Type */}
            <ColHeader label="Property Type"        field="property_type"          width="w-36" {...colProps} />
            {/* 7. Listing URL */}
            <div className="w-48 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Listing URL
            </div>
            {/* 8. Listing Agent */}
            <ColHeader label="Listing Agent"        field="listing_agent"          width="w-44" {...colProps} />
            {/* 9. Extracted At */}
            <ColHeader label="Extracted @"          field="extracted_at"           width="w-32" align="center" {...colProps} />
            {/* 10. Price / Sqft */}
            <ColHeader label="Price/Sqft"           field="price_per_sqft"         width="w-28" align="right" {...colProps} />
            {/* 11. Est. Monthly Payment */}
            <ColHeader label="Est. Monthly Payment" field="est_monthly_payment"    width="w-44" align="right" {...colProps} />
            {/* 12. Deal Score */}
            <ColHeader label="Deal Score"           field="deal_score"             width="w-32" align="center" {...colProps} />
            {/* 13. Deal Category */}
            <ColHeader label="Deal Category"        field="deal_category"          width="w-36" align="center" {...colProps} />
            {/* 14. Size Category */}
            <ColHeader label="Size Category"        field="size_category"          width="w-32" align="center" {...colProps} />
            {/* 15. Price Tier */}
            <ColHeader label="Price Tier"           field="price_tier"             width="w-36" align="center" {...colProps} />
            {/* 16. Mortgage Interest Rate */}
            <ColHeader label="Mortgage Rate"        field="mortgage_interest_rate" width="w-36" align="right" {...colProps} />
            {/* 17. Mortgage Down Payment */}
            <ColHeader label="Down Payment"         field="mortgage_down_payment"  width="w-36" align="right" {...colProps} />
            {/* 18. Mortgage Term Years */}
            <ColHeader label="Term (yrs)"           field="mortgage_term_years"    width="w-28" align="center" {...colProps} />
            {/* 19. Investment Analysis */}
            <div className="w-72 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="INVESTMENT ANALYSIS" /></div>
            </div>
            {/* 20. Buyer Profile */}
            <ColHeader label="Buyer Profile"        field="buyer_profile"          width="w-44" align="center" {...colProps} />
            {/* 21. Competitive Position */}
            <div className="w-72 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="COMPETITIVE POSITION" /></div>
            </div>
            {/* 22. Risk Assessment */}
            <ColHeader label="Risk Assessment"      field="risk_assessment"        width="w-40" align="center" {...colProps} />
            {/* 23. Showing Priority */}
            <ColHeader label="Priority"             field="showing_priority"       width="w-24" align="center" {...colProps} />
            {/* 24. Neighborhood Insights */}
            <div className="w-72 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="NEIGHBORHOOD INSIGHTS" /></div>
            </div>
            {/* 25. Negotiation Strategy */}
            <div className="w-72 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="NEGOTIATION STRATEGY" /></div>
            </div>
            {/* 26. Percent Above Market */}
            <ColHeader label="% Above Market"       field="percent_above_market"   width="w-32" align="right" {...colProps} />
            {/* 27. Price Per Bedroom */}
            <ColHeader label="Price/Bed"            field="price_per_bedroom"      width="w-32" align="right" {...colProps} />
            {/* 28. Estimated ROI */}
            <ColHeader label="Est. ROI"             field="estimated_roi"          width="w-28" align="right" {...colProps} />
            {/* Run AI action (not a data column — no sort) */}
            <div className="w-36 px-3 h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="AI AGENTS" viewBox="0 0 500 100" /></div>
            </div>
          </div>

          {/* ── Data Rows ── */}
          {dataLoading && properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 size={32} className="text-accent animate-spin" />
              <p className="text-sm text-text-tertiary">Loading {currentTab?.label} properties...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2">
              <Search size={32} className="text-text-tertiary opacity-30" />
              <p className="text-sm font-medium text-text-secondary mt-2">No {currentTab?.label} properties found</p>
              <p className="text-xs text-text-tertiary font-mono">Market: {currentMarket?.displayName || 'Not Selected'}</p>
              <p className="text-xs text-text-tertiary">Run a scan to populate this view</p>
            </div>
          ) : (
            filtered.map((property) => {
              const downPct = property.mortgage_down_payment != null
                ? property.mortgage_down_payment > 1
                  ? `${property.mortgage_down_payment.toFixed(0)}%`
                  : `${(property.mortgage_down_payment * 100).toFixed(0)}%`
                : '—';
              const pam = fmtSignedPct(property.percent_above_market);
              const propAgentStates = agentRunState[property.id] ?? {};

              return (
                <div
                  key={property.id}
                  className="flex items-start border-b border-border group hover:bg-accent/5 transition-colors min-h-12"
                >
                  {/* Checkbox */}
                  <div className="w-12 border-r border-border min-h-12 flex items-center justify-center shrink-0">
                    <input 
                      type="checkbox" 
                      className="rounded border-border cursor-pointer accent-accent"
                      checked={selectedIds.has(property.id)}
                      onChange={() => toggleSelect(property.id)}
                    />
                  </div>

                  {/* 1. Address & Thumbnail */}
                  <div className="w-80 px-3 border-r border-border min-h-12 flex items-center gap-2 text-[12px] font-semibold text-text-primary shrink-0">
                    {property.image_url || (property.image_urls && property.image_urls.length > 0) ? (
                      <div className="w-8 h-8 rounded border border-border/50 shrink-0 bg-bg-surface overflow-hidden">
                        <img 
                          src={property.image_url || (property.image_urls ? property.image_urls[0] : '')} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded border border-border/50 shrink-0 bg-bg-surface flex items-center justify-center opacity-50">
                        <span className="text-[8px] uppercase tracking-wider text-text-tertiary">No Img</span>
                      </div>
                    )}
                    <span className="truncate">{property.address || '—'}</span>
                  </div>

                  {/* 2. Price */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center justify-end text-[13px] font-black text-text-primary tabular-nums shrink-0">
                    {fmtPrice(property.list_price)}
                  </div>

                  {/* 3. Bedrooms */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-center text-[12px] text-text-primary tabular-nums shrink-0">
                    {property.beds != null ? property.beds.toFixed(1) : '—'}
                  </div>

                  {/* 4. Bathrooms */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-center text-[12px] text-text-primary tabular-nums shrink-0">
                    {property.baths != null ? property.baths.toFixed(1) : '—'}
                  </div>

                  {/* 5. Sqft */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-center text-[12px] text-text-secondary tabular-nums shrink-0">
                    {property.sqft ? Number(property.sqft).toLocaleString() : '—'}
                  </div>

                  {/* 6. Property Type */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center text-[11px] text-text-secondary capitalize shrink-0">
                    {property.property_type ?? '—'}
                  </div>

                  {/* 7. Listing URL */}
                  <div className="w-48 px-3 border-r border-border min-h-12 flex items-center shrink-0">
                    {property.listing_url ? (
                      <a
                        href={property.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-accent hover:underline truncate max-w-full"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={10} className="shrink-0" />
                        <span className="truncate">{property.listing_url.replace('https://', '').split('/')[0]}</span>
                      </a>
                    ) : (
                      <span className="text-text-tertiary text-[11px]">—</span>
                    )}
                  </div>

                  {/* 8. Listing Agent */}
                  <div className="w-44 px-3 border-r border-border min-h-12 flex items-center text-[11px] text-text-secondary shrink-0">
                    <span className="truncate uppercase">{property.listing_agent ?? '—'}</span>
                  </div>

                  {/* 9. Extracted At */}
                  <div className="w-32 px-3 border-r border-border min-h-12 flex items-center justify-center text-[11px] text-text-tertiary tabular-nums shrink-0">
                    {fmtDate(property.extracted_at)}
                  </div>

                  {/* 10. Price / Sqft */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] text-text-secondary tabular-nums shrink-0">
                    {fmtPpsf(property.price_per_sqft)}
                  </div>

                  {/* 11. Est. Monthly Payment */}
                  <div className="w-44 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] font-bold text-text-primary tabular-nums shrink-0">
                    {fmtPrice(property.est_monthly_payment)}
                  </div>

                  {/* 12. Deal Score */}
                  <div className="w-32 px-3 border-r border-border min-h-12 flex items-center justify-center shrink-0">
                    <DealScoreBadge score={property.deal_score} size="sm" />
                  </div>

                  {/* 13. Deal Category — with run button */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center justify-center group relative shrink-0">
                    <AgentCellWithRunButton
                      value={property.deal_category}
                      agentName="deal_category"
                      agentState={propAgentStates['deal_category'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'deal_category')}
                    />
                  </div>

                  {/* 14. Size Category — with run button */}
                  <div className="w-32 px-3 border-r border-border min-h-12 flex items-center justify-center group relative shrink-0">
                    <AgentCellWithRunButton
                      value={property.size_category}
                      agentName="size_category"
                      agentState={propAgentStates['size_category'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'size_category')}
                    />
                  </div>

                  {/* 15. Price Tier — with run button */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center justify-center group relative shrink-0">
                    <AgentCellWithRunButton
                      value={property.price_tier}
                      agentName="price_tier"
                      agentState={propAgentStates['price_tier'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'price_tier')}
                    />
                  </div>

                  {/* 16. Mortgage Rate */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] text-text-secondary tabular-nums shrink-0">
                    {fmtPct(property.mortgage_interest_rate)}
                  </div>

                  {/* 17. Down Payment */}
                  <div className="w-36 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] text-text-secondary tabular-nums shrink-0">
                    {downPct}
                  </div>

                  {/* 18. Mortgage Term Years */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-center text-[12px] text-text-secondary tabular-nums shrink-0">
                    {property.mortgage_term_years ?? '—'}
                  </div>

                  {/* 19. Investment Analysis — long text with run */}
                  <div className="w-72 px-3 border-r border-border min-h-12 flex items-start py-2 shrink-0">
                    <AgentCellWithRunButton
                      value={property.investment_analysis}
                      agentName="investment_analysis"
                      agentState={propAgentStates['investment_analysis'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'investment_analysis')}
                      isLongText
                    />
                  </div>

                  {/* 20. Buyer Profile — badge with run */}
                  <div className="w-44 px-3 border-r border-border min-h-12 flex items-center justify-center group gap-1 shrink-0">
                    <div className="flex-1">
                      <ColorBadge value={property.buyer_profile} colorMap={BUYER_PROFILE_COLORS} />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); runSingleAgent(property, 'buyer_profile'); }}
                      className={`shrink-0 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                        propAgentStates['buyer_profile'] === 'running' ? 'bg-accent/20 text-accent cursor-not-allowed' :
                        propAgentStates['buyer_profile'] === 'error' ? 'text-red-400 hover:bg-red-400/10' :
                        'text-text-tertiary hover:text-accent hover:bg-accent/10'
                      }`}
                      disabled={propAgentStates['buyer_profile'] === 'running'}
                      title="Run buyer_profile"
                    >
                      {propAgentStates['buyer_profile'] === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                  </div>

                  {/* 21. Competitive Position — long text with run */}
                  <div className="w-72 px-3 border-r border-border min-h-12 flex items-start py-2 shrink-0">
                    <AgentCellWithRunButton
                      value={property.competitive_position}
                      agentName="competitive_position"
                      agentState={propAgentStates['competitive_position'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'competitive_position')}
                      isLongText
                    />
                  </div>

                  {/* 22. Risk Assessment — badge with run */}
                  <div className="w-40 px-3 border-r border-border min-h-12 flex items-center justify-center group gap-1 shrink-0">
                    <div className="flex-1">
                      <ColorBadge value={property.risk_assessment} colorMap={RISK_ASSESSMENT_COLORS} />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); runSingleAgent(property, 'risk_assessment'); }}
                      className={`shrink-0 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                        propAgentStates['risk_assessment'] === 'running' ? 'bg-accent/20 text-accent cursor-not-allowed' :
                        propAgentStates['risk_assessment'] === 'error' ? 'text-red-400 hover:bg-red-400/10' :
                        'text-text-tertiary hover:text-accent hover:bg-accent/10'
                      }`}
                      disabled={propAgentStates['risk_assessment'] === 'running'}
                      title="Run risk_assessment"
                    >
                      {propAgentStates['risk_assessment'] === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                  </div>

                  {/* 23. Showing Priority — number with run */}
                  <div className="w-24 px-3 border-r border-border min-h-12 flex items-center justify-center group gap-1 shrink-0">
                    <span className="text-[13px] font-bold text-text-primary tabular-nums">
                      {property.showing_priority ?? '—'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); runSingleAgent(property, 'showing_priority'); }}
                      className={`shrink-0 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                        propAgentStates['showing_priority'] === 'running' ? 'bg-accent/20 text-accent cursor-not-allowed' :
                        propAgentStates['showing_priority'] === 'error' ? 'text-red-400 hover:bg-red-400/10' :
                        'text-text-tertiary hover:text-accent hover:bg-accent/10'
                      }`}
                      disabled={propAgentStates['showing_priority'] === 'running'}
                      title="Run showing_priority"
                    >
                      {propAgentStates['showing_priority'] === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    </button>
                  </div>

                  {/* 24. Neighborhood Insights — long text with run */}
                  <div className="w-72 px-3 border-r border-border min-h-12 flex items-start py-2 shrink-0">
                    <AgentCellWithRunButton
                      value={property.neighborhood_insights}
                      agentName="neighborhood_insights"
                      agentState={propAgentStates['neighborhood_insights'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'neighborhood_insights')}
                      isLongText
                    />
                  </div>

                  {/* 25. Negotiation Strategy — long text with run */}
                  <div className="w-72 px-3 border-r border-border min-h-12 flex items-start py-2 shrink-0">
                    <AgentCellWithRunButton
                      value={property.negotiation_strategy}
                      agentName="negotiation_strategy"
                      agentState={propAgentStates['negotiation_strategy'] ?? 'idle'}
                      onRun={() => runSingleAgent(property, 'negotiation_strategy')}
                      isLongText
                    />
                  </div>

                  {/* 26. Percent Above Market — green if below, red if above */}
                  <div className={`w-32 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] font-semibold tabular-nums shrink-0 ${pam.cls}`}>
                    {pam.text}
                  </div>

                  {/* 27. Price Per Bedroom */}
                  <div className="w-32 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] text-text-secondary tabular-nums shrink-0">
                    {fmtPpsf(property.price_per_bedroom)}
                  </div>

                  {/* 28. Estimated ROI */}
                  <div className="w-28 px-3 border-r border-border min-h-12 flex items-center justify-end text-[12px] text-text-secondary tabular-nums shrink-0">
                    {fmtRoi(property.estimated_roi)}
                  </div>

                  {/* Run All AI button */}
                  <div className="w-36 px-3 min-h-12 flex items-center shrink-0">
                    <RunAIButton
                      state={propAgentStates['deal_category'] === 'running' ? 'running' : (Object.values(propAgentStates).includes('complete') ? 'complete' : 'idle')}
                      onRun={() => runAllAgents(property)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>
      )}

      {/* ── Footer ── */}
      <div className="h-10 bg-bg-surface-dark border-t border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-text-tertiary font-medium">Selected: {selectedIds.size}</span>
          {activeJob && (
            <div className="flex items-center gap-2 animate-pulse text-accent">
              <RefreshCw size={10} className="animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Processing Market Stream...</span>
            </div>
          )}
        </div>
        <span className="text-[10px] text-text-tertiary font-mono">Displaying {filtered.length} listings</span>
      </div>
    </div>
  );
}
