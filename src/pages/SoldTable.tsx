/* ═══════════════════════════════════════════════════════════
   SOLD LISTINGS TABLE — listings_sold AI agent columns
   Per-agent manual trigger: each AI column has its own Run button.
   Agents fire only on explicit click — never automatically.
   Model: claude-haiku-4-5-20251001
   ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback } from 'react';
import {
  ArrowUpDown, ExternalLink, Loader2,
  Search, Sparkles, AlertTriangle, Trash2
} from 'lucide-react';
import { DealScoreBadge } from '../components/ui';
import { useMarket } from '../stores/marketStore';
import type { SessionProperty } from '../hooks/useProperties';
import { TextHoverEffect } from '../components/ui/text-hover-effect';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// The three AI agents on the sold table
const SOLD_AGENTS = ['ai_summary', 'ai_investment_score', 'ai_comp_analysis'] as const;
type SoldAgent = typeof SOLD_AGENTS[number];
type AgentState = 'idle' | 'running' | 'complete' | 'error';

// Per-property, per-agent run status overrides (running, error)
type AgentStatusOverride = 'running' | 'error';
type AgentOverrideMap = Record<string, Record<SoldAgent, AgentStatusOverride>>;

/* ─── Formatters ─────────────────────────────────────────── */

function em(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number' && val === 0) return '—';
  return String(val);
}

function fmtSoldPrice(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  return `$${Number(val).toLocaleString()}`;
}

function fmtPpsf(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${Number(val).toFixed(0)}/sqft`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: '2-digit',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return val; }
}

/* ─── Badge color maps ───────────────────────────────────── */

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  house:     'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  condo:     'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  townhouse: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25',
  other:     'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const DEAL_CATEGORY_COLORS: Record<string, string> = {
  'Excellent Deal': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Good Deal':      'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Fair Price':     'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Above Market':   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'High Price':     'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
};

const SIZE_CATEGORY_COLORS: Record<string, string> = {
  'Small':       'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/25',
  'Medium':      'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
  'Large':       'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Extra Large': 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const PRICE_TIER_COLORS: Record<string, string> = {
  'Budget':       'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  'Starter':      'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
  'Mid-Range':    'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  'Upper Mid':    'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Luxury':       'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  'Ultra Luxury': 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25',
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

/* ─── Column header ──────────────────────────────────────── */

function ColHeader({
  label, field, sortField, sortDir, onSort, align = 'left', width,
}: {
  label: string;
  field?: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (f: string) => void;
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

/* ─── Long text cell with expand/collapse ────────────────── */

function LongTextCell({ text }: { text: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-text-tertiary text-[11px]">—</span>;
  return (
    <div
      className="cursor-pointer"
      onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
    >
      <span className={`text-[11px] text-text-secondary leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
        {text}
      </span>
      {text.length > 80 && (
        <span className="text-[10px] text-accent hover:underline ml-1">
          {expanded ? 'less' : 'more'}
        </span>
      )}
    </div>
  );
}

/* ─── Per-agent cell ─────────────────────────────────────── */
/*
 * Shows the AI output when complete, or a Run button when idle/error.
 * Each column manages its own state independently — clicking "Run" on
 * ai_summary never triggers ai_investment_score or ai_comp_analysis.
 */

function SoldAgentCell({
  value,
  state,
  onRun,
}: {
  value: string | null | undefined;
  state: AgentState;
  onRun: () => void;
}) {
  if (state === 'running') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-full bg-bg-surface-hover rounded animate-pulse" />
      </div>
    );
  }

  if (state === 'complete' && value) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <LongTextCell text={value} />
        <button
          onClick={e => { e.stopPropagation(); onRun(); }}
          className="self-start flex items-center gap-1 text-[9px] text-text-tertiary hover:text-accent transition-colors mt-0.5"
          title="Re-run this agent"
        >
          <Sparkles size={8} />
          re-run
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={e => { e.stopPropagation(); onRun(); }}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-amber-400 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
      >
        <AlertTriangle size={10} />
        ⚠ Retry
      </button>
    );
  }

  // idle — no data yet
  return (
    <button
      onClick={e => { e.stopPropagation(); onRun(); }}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-accent border border-accent/40 bg-accent/10 hover:bg-accent/20 transition-colors whitespace-nowrap"
    >
      <Sparkles size={10} />
      ✦ Run
    </button>
  );
}



/* ─── Main component ─────────────────────────────────────── */

interface SoldTableProps {
  properties: SessionProperty[];
  loading: boolean;
  onDelete?: (ids: string[]) => Promise<boolean>;
}

export default function SoldTable({ properties, loading, onDelete }: SoldTableProps) {
  const { currentMarket } = useMarket();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('deal_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Per-property, per-agent run status overrides (running or error)
  const [overrides, setOverrides] = useState<AgentOverrideMap>({});

  // Helper to determine the current status of an agent for a property
  const getAgentStatus = (property: SessionProperty, agent: SoldAgent): AgentState => {
    // 1. Check for manual overrides (running or error)
    const override = overrides[property.id]?.[agent];
    if (override) return override;

    // 2. Derive from property data
    if (property[agent as keyof SessionProperty]) return 'complete';

    return 'idle';
  };

  /* ── Run a single agent for a single property ── */
  const runAgent = useCallback(async (
    propertyId: string,
    agent: SoldAgent,
  ) => {
    if (!currentMarket?.id || !currentMarket?.displayName) return;

    const marketSlug    = currentMarket.id;
    const marketContext = currentMarket.displayName;

    // Set this agent to running
    setOverrides(prev => ({
      ...prev,
      [propertyId]: {
        ...(prev[propertyId] ?? {}),
        [agent]: 'running',
      },
    }));

    try {
      const resp = await fetch(
        `${API_BASE}/api/sold/run-agents/${propertyId}` +
        `?market_slug=${encodeURIComponent(marketSlug)}` +
        `&market_context=${encodeURIComponent(marketContext)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agents: [agent] }),
        },
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[SoldTable] run-agents failed for ${propertyId} / ${agent}:`, errText);
        setOverrides(prev => ({
          ...prev,
          [propertyId]: {
            ...(prev[propertyId] ?? {}),
            [agent]: 'error',
          },
        }));
        return;
      }

      // Success: Clear the override (it will revert to 'complete' based on data if refreshed, 
      // or we can just leave it idle/complete if we manually refresh soon)
      // Actually, standard behavior is a refresh() follows.
      setOverrides(prev => {
        const next = { ...prev };
        if (next[propertyId]) {
          const propertyOverrides = { ...next[propertyId] };
          delete propertyOverrides[agent];
          if (Object.keys(propertyOverrides).length === 0) {
            delete next[propertyId];
          } else {
            next[propertyId] = propertyOverrides;
          }
        }
        return next;
      });
    } catch (err) {
      console.error(`[SoldTable] network error for ${propertyId} / ${agent}:`, err);
      setOverrides(prev => ({
        ...prev,
        [propertyId]: {
          ...(prev[propertyId] ?? {}),
          [agent]: 'error',
        },
      }));
    }
  }, [currentMarket]);

  /* ── Filter + Sort ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = properties.filter(p =>
      !q || p.address.toLowerCase().includes(q)
    );
    return rows.sort((a, b) => {
      const valA = ((a as Record<string, unknown>)[sortField] ?? 0) as number;
      const valB = ((b as Record<string, unknown>)[sortField] ?? 0) as number;
      if (valA === valB) return 0;
      return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [properties, search, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const colProps = { sortField, sortDir, onSort: toggleSort };

  // Count agents currently running across all rows
  const runningCount = Object.values(overrides).reduce((count, row) => {
    return count + Object.values(row).filter(s => s === 'running').length;
  }, 0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || !onDelete) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} Sold listings?`)) {
      await onDelete(Array.from(selectedIds));
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

  /* ── Empty states ── */
  if (loading && properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-accent animate-spin" />
        <p className="text-sm text-text-tertiary">Loading Sold listings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Sub-toolbar ── */}
      <div className="px-6 py-2 border-b border-border bg-bg-elevated/30 flex items-center justify-between">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search Sold listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 w-64 bg-bg-surface-dark border border-border rounded-lg text-xs focus:ring-1 focus:ring-accent focus:border-accent outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-4">
          {selectedIds.size > 0 && onDelete && (
            <button 
              onClick={handleDeleteSelected} 
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 font-medium bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors border border-red-500/20 cursor-pointer"
            >
              <Trash2 size={13} /> Delete {selectedIds.size} Selected
            </button>
          )}
          <div className="flex items-center gap-3">
            {runningCount > 0 && (
              <div className="flex items-center gap-1.5 text-accent animate-pulse">
                <Loader2 size={11} className="animate-spin" />
                <span className="text-[10px] font-bold">
                  Running {runningCount} agent{runningCount !== 1 ? 's' : ''}…
                </span>
              </div>
            )}
            <span className="text-[10px] text-text-tertiary font-mono">{filtered.length} listings</span>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto bg-bg-surface scrollbar-thin">
        <div className="min-w-max border-collapse">

          {/* ── Header ── */}
          <div className="flex items-center sticky top-0 z-30 h-10 bg-bg-surface-dark border-b border-border shadow-sm text-text-secondary">
            {/* Checkbox */}
            <div className="w-10 border-r border-border h-full flex items-center justify-center shrink-0">
              <input 
                type="checkbox" 
                className="rounded border-border cursor-pointer accent-accent"
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={toggleSelectAll}
              />
            </div>

            {/* 1. Address */}
            <ColHeader label="Address"              field="address"                width="w-80" {...colProps} />
            <ColHeader label="Sold Price"     field="sold_price"      width="w-36"  align="right" {...colProps} />
            <ColHeader label="Beds"           field="beds"            width="w-20"  align="center" {...colProps} />
            <ColHeader label="Baths"          field="baths"           width="w-20"  align="center" {...colProps} />
            <ColHeader label="Sqft"           field="sqft"            width="w-24"  align="center" {...colProps} />
            {/* 6. Property Type */}
            <ColHeader label="Property Type"        field="property_type"          width="w-36" {...colProps} />
            {/* 7. Listing URL */}
            <div className="w-48 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Listing URL
            </div>
            <ColHeader label="Agent"          field="listing_agent"   width="w-44"  {...colProps} />
            <ColHeader label="$/Sqft"         field="price_per_sqft"  width="w-28"  align="right" {...colProps} />
            <ColHeader label="Deal Score"     field="deal_score"      width="w-28"  align="center" {...colProps} />
            <ColHeader label="Deal Category"  field="deal_category"   width="w-36"  align="center" {...colProps} />
            <ColHeader label="Size"           field="size_category"   width="w-28"  align="center" {...colProps} />
            <ColHeader label="Price Tier"     field="price_tier"      width="w-32"  align="center" {...colProps} />
            <ColHeader label="Last Synced"    field="extracted_at"    width="w-44"  align="center" {...colProps} />

            {/* AI agent columns */}
            <div className="w-64 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ AI SUMMARY" /></div>
            </div>
            <div className="w-64 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ AI INVESTMENT SCORE" /></div>
            </div>
            <div className="w-64 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ AI COMP ANALYSIS" /></div>
            </div>
          </div>

          {/* ── Empty state (inside table so headers remain visible) ── */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Search size={32} className="text-text-tertiary opacity-30" />
              <p className="text-sm font-medium text-text-secondary mt-2">No Sold listings found</p>
              <p className="text-xs text-text-tertiary font-mono">Market: {currentMarket?.displayName || 'Not Selected'}</p>
              <p className="text-xs text-text-tertiary">Run a scan to populate sold listings</p>
            </div>
          )}

          {/* ── Data Rows ── */}
          {filtered.map(property => {
            const anyRunning = SOLD_AGENTS.some(a => getAgentStatus(property, a) === 'running');

            return (
              <div
                key={property.id}
                className={`flex items-start border-b border-border transition-colors min-h-12
                  ${anyRunning ? 'bg-accent/5' : 'hover:bg-accent/5'}`}
              >
                {/* Checkbox */}
                <div className="w-10 border-r border-border flex items-center justify-center py-3 shrink-0 self-start pt-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-border cursor-pointer accent-accent"
                    checked={selectedIds.has(property.id)}
                    onChange={() => toggleSelect(property.id)}
                  />
                </div>

                {/* Address */}
                <div className="w-72 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <span className="truncate text-[12px] font-semibold text-text-primary" title={property.address}>
                    {em(property.address)}
                  </span>
                </div>

                {/* Sold Price */}
                <div className="w-36 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[13px] font-black text-text-primary tabular-nums">
                    {fmtSoldPrice(property.sold_price ?? property.list_price)}
                  </span>
                </div>

                {/* Beds */}
                <div className="w-20 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-primary tabular-nums">
                    {property.beds != null ? property.beds.toFixed(0) : '—'}
                  </span>
                </div>

                {/* Baths */}
                <div className="w-20 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-primary tabular-nums">
                    {property.baths != null ? property.baths.toFixed(0) : '—'}
                  </span>
                </div>

                {/* Sqft */}
                <div className="w-24 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">
                    {property.sqft ? Number(property.sqft).toLocaleString() : '—'}
                  </span>
                </div>

                {/* Property Type */}
                <div className="w-32 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.property_type} colorMap={PROPERTY_TYPE_COLORS} />
                </div>

                {/* Listing URL */}
                <div className="w-44 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  {property.listing_url ? (
                    <a
                      href={property.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-accent hover:underline truncate max-w-full"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={10} className="shrink-0" />
                      <span className="truncate">
                        {property.listing_url.replace('https://', '').split('/')[0]}
                      </span>
                    </a>
                  ) : (
                    <span className="text-text-tertiary text-[11px]">—</span>
                  )}
                </div>

                {/* Listing Agent */}
                <div className="w-44 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <span className="truncate text-[11px] text-text-secondary uppercase">
                    {em(property.listing_agent)}
                  </span>
                </div>

                {/* Price/Sqft */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">
                    {fmtPpsf(property.price_per_sqft)}
                  </span>
                </div>

                {/* Deal Score */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <DealScoreBadge score={property.deal_score} size="sm" />
                </div>

                {/* Deal Category */}
                <div className="w-36 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.deal_category} colorMap={DEAL_CATEGORY_COLORS} />
                </div>

                {/* Size Category */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.size_category} colorMap={SIZE_CATEGORY_COLORS} />
                </div>

                {/* Price Tier */}
                <div className="w-32 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.price_tier} colorMap={PRICE_TIER_COLORS} />
                </div>

                {/* Last Synced */}
                <div className="w-44 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[11px] text-text-tertiary tabular-nums">
                    {fmtDate(property.extracted_at)}
                  </span>
                </div>

                {/* ── AI Agent Columns — each with its own Run button ── */}

                {/* Summary */}
                <div className="w-80 px-4 border-r border-border min-h-16 flex items-start py-3 overflow-hidden">
                  <SoldAgentCell
                    value={property.ai_summary}
                    state={getAgentStatus(property, 'ai_summary')}
                    onRun={() => runAgent(property.id, 'ai_summary')}
                  />
                </div>

                {/* Investment Score */}
                <div className="w-56 px-4 border-r border-border min-h-16 flex items-start py-3 overflow-hidden">
                  <SoldAgentCell
                    value={property.ai_investment_score != null ? String(property.ai_investment_score) : null}
                    state={getAgentStatus(property, 'ai_investment_score')}
                    onRun={() => runAgent(property.id, 'ai_investment_score')}
                  />
                </div>

                {/* Competitive Analysis */}
                <div className="w-xl px-4 border-r border-border min-h-16 flex items-start py-3 overflow-hidden">
                  <SoldAgentCell
                    value={property.ai_comp_analysis}
                    state={getAgentStatus(property, 'ai_comp_analysis')}
                    onRun={() => runAgent(property.id, 'ai_comp_analysis')}
                  />
                </div>

              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}