/* ═══════════════════════════════════════════════════════════
   FOR RENT TABLE — Airtable 1:1 Replica (30 columns)
   Blueprint: REMI_FOR_RENT_BLUEPRINT.md — PART 8
   Column order matches spec exactly. Miami contamination = zero.
   ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback } from 'react';
import {
  ArrowUpDown, ExternalLink, Home, Loader2,
  Search, Sparkles, AlertTriangle, CheckCircle2, Trash2
} from 'lucide-react';
import { DealScoreBadge } from '../components/ui';
import { useMarket } from '../stores/marketStore';
import type { SessionProperty } from '../hooks/useProperties';
import { TextHoverEffect } from '../components/ui/text-hover-effect';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Thumbnail ─────────────────────────────────────────── */

function TableThumb({ src, address }: { src?: string | null; address: string }) {
  const [loading, setLoading] = useState(!!src);
  const [failed, setFailed] = useState(!src);
  if (failed || !src) {
    return (
      <div className="w-12 h-10 bg-bg-surface-hover rounded overflow-hidden border border-border/50 flex items-center justify-center">
        <Home size={14} className="text-text-tertiary/40" />
      </div>
    );
  }
  return (
    <div className="w-12 h-10 bg-bg-surface-hover rounded overflow-hidden relative shadow-sm border border-border/50">
      {loading && (
        <div className="absolute inset-0 bg-bg-surface-hover flex items-center justify-center">
          <div className="w-3 h-3 border border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={address}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
    </div>
  );
}

/* ─── Null-safe formatters ───────────────────────────────── */

function em(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number' && val === 0) return '—';
  return String(val);
}

function fmtRentPrice(val: number | null | undefined): string {
  if (!val || val === 0) return '—';
  return `$${Number(val).toLocaleString()}/mo`;
}

function fmtCurrency(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPpsf(val: number | null | undefined): string {
  if (val == null) return '—';
  return `$${Number(val).toFixed(2)}`;
}

function fmtNum(val: number | null | undefined, decimals = 1): string {
  if (val == null) return '—';
  return Number(val).toFixed(decimals);
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return val; }
}

function fmtAffordability(val: number | null | undefined): string {
  if (val == null) return '—';
  // val is a decimal ratio: 0.4008 → "40.1%"
  // NEVER multiply by 100 again if already > 1 (that would be the Airtable 5300% bug)
  const pct = val <= 1 ? val * 100 : val; // defensive: treat >1 as already a percent
  return `${pct.toFixed(1)}%`;
}

/* ─── Computed derived fields ────────────────────────────── */

function computeAnnualRentIncome(price: number | null | undefined): number | null {
  if (!price || price === 0) return null;
  return Math.round(price * 12 * 100) / 100;
}

function computeIncomeRequired(price: number | null | undefined): number | null {
  if (!price || price === 0) return null;
  return Math.round(price * 3 * 100) / 100;
}

function computeValueRating(dealScore: number | null | undefined): number | null {
  if (dealScore == null) return null;
  if (dealScore >= 9) return 5;
  if (dealScore >= 8) return 4;
  if (dealScore >= 6) return 3;
  if (dealScore >= 4) return 2;
  return 1;
}

function computeSqftPerBedroom(sqft: number | null | undefined, bedrooms: number | null | undefined): number | null {
  if (sqft == null) return null;
  if (bedrooms && bedrooms > 0) return Math.round(sqft / bedrooms * 10) / 10;
  return sqft; // studio
}

/* ─── Value Rating Stars ─────────────────────────────────── */

function ValueRating({ dealScore }: { dealScore: number | null | undefined }) {
  const rating = computeValueRating(dealScore);
  if (rating == null) return <span className="text-text-tertiary text-[11px]">—</span>;
  return (
    <span className="text-amber-400 text-[13px] tracking-tight" title={`${rating} star${rating !== 1 ? 's' : ''}`}>
      {'⭐'.repeat(rating)}
    </span>
  );
}

/* ─── Affordability Index Badge ──────────────────────────── */

function AffordabilityBadge({ val }: { val: number | null | undefined }) {
  if (val == null) return <span className="text-text-tertiary text-[11px]">—</span>;
  // Color coding per spec
  let cls = 'text-[11px] font-semibold tabular-nums';
  if (val < 0.30) cls += ' text-emerald-400';
  else if (val < 0.40) cls += ' text-blue-400';
  else if (val < 0.50) cls += ' text-amber-400';
  else cls += ' text-red-400';
  return <span className={cls}>{fmtAffordability(val)}</span>;
}

/* ─── Badge Color Maps — Blueprint Exact ────────────────── */

const PROPERTY_TYPE_COLORS: Record<string, string> = {
  apartment:  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  house:      'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  condo:      'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  townhouse:  'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
  other:      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const LISTING_STATUS_COLORS: Record<string, string> = {
  'For Rent':  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'For Sale':  'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Sold':      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const DEAL_CATEGORY_COLORS: Record<string, string> = {
  'Excellent Deal': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Good Deal':      'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Fair Price':     'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Market Price':   'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  'Above Market':   'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'High Price':     'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  'Overpriced':     'bg-red-700/15 text-red-700 dark:text-red-300 border-red-700/25',
};

const SIZE_CATEGORY_COLORS: Record<string, string> = {
  'Small':       'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Medium':      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Large':       'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  'Extra Large': 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const PRICE_TIER_COLORS: Record<string, string> = {
  'Budget':       'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  'Mid-Range':    'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  'Upper Mid':    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Luxury':       'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/25',
  'Ultra Luxury': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
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

/* ─── Agent Run Button (per-column trigger) ──────────────── */

function AgentRunButton({
  agent,
  agentStatus,
  propertyId,
  onRunAgent,
}: {
  agent: string;
  agentStatus: string | undefined;
  propertyId: string;
  onRunAgent: (propertyId: string, agent: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agentStatus === 'complete') {
      setConfirmOpen(true);
      return;
    }
    onRunAgent(propertyId, agent);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmOpen(false);
    onRunAgent(propertyId, agent);
  };

  if (agentStatus === 'running') {
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-text-tertiary border border-border/40 bg-bg-surface-hover opacity-60 cursor-not-allowed select-none">
        <Loader2 size={8} className="animate-spin" />
        <span>Analyzing...</span>
      </div>
    );
  }

  if (confirmOpen) {
    return (
      <div
        className="flex flex-col gap-1 p-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-[8px]"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-amber-400 font-medium leading-tight">Rerun?</span>
        <div className="flex gap-1">
          <button
            onClick={handleConfirm}
            className="flex-1 px-1 py-0.5 bg-accent text-text-on-accent rounded text-[8px] font-bold hover:bg-accent-hover transition-colors"
          >
            Yes
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(false); }}
            className="flex-1 px-1 py-0.5 border border-border rounded text-[8px] font-medium text-text-secondary hover:bg-bg-surface-hover transition-colors"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  if (agentStatus === 'error') {
    return (
      <button
        onClick={handleClick}
        title="This agent failed. Click to retry."
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-amber-400 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
      >
        <AlertTriangle size={8} />
        Retry
      </button>
    );
  }

  if (agentStatus === 'complete') {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-text-tertiary border border-border/40 bg-bg-surface-hover hover:bg-bg-surface-hover/80 transition-colors"
      >
        <CheckCircle2 size={8} className="text-emerald-400" />
        Rerun
      </button>
    );
  }

  // pending
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-accent border border-accent/40 bg-accent/10 hover:bg-accent/20 transition-colors"
    >
      <Sparkles size={8} />
      Run
    </button>
  );
}

/* ─── Long Text Cell (truncated, expand on click) ─────────── */

function LongTextCell({
  text,
  agentStatus,
  agent,
  propertyId,
  onRunAgent,
}: {
  text: string | null | undefined;
  agentStatus?: string;
  agent?: string;
  propertyId?: string;
  onRunAgent?: (propertyId: string, agent: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (agentStatus === 'running') {
    return (
      <div className="flex items-center gap-1.5 px-1">
        <div className="h-2 w-full bg-bg-surface-hover rounded animate-pulse" />
      </div>
    );
  }
  if (!text) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-tertiary text-[11px]">—</span>
        {agent && propertyId && onRunAgent && (
          <AgentRunButton
            agent={agent}
            agentStatus={agentStatus}
            propertyId={propertyId}
            onRunAgent={onRunAgent}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 group">
      <div
        className="cursor-pointer flex-1"
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
      >
        <span className={`text-[11px] text-text-secondary leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {text}
        </span>
        {!expanded && text.length > 80 && (
          <span className="text-[10px] text-accent hover:underline ml-1">more</span>
        )}
        {expanded && (
          <span className="text-[10px] text-accent hover:underline ml-1">less</span>
        )}
      </div>
      {agent && propertyId && onRunAgent && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <AgentRunButton
            agent={agent}
            agentStatus={agentStatus}
            propertyId={propertyId}
            onRunAgent={onRunAgent}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Column Header ──────────────────────────────────────── */

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

/* ─── Main Component ─────────────────────────────────────── */

interface ForRentTableProps {
  properties: SessionProperty[];
  loading: boolean;
  onDelete?: (ids: string[]) => Promise<boolean>;
}

export default function ForRentTable({ properties, loading, onDelete }: ForRentTableProps) {
  const { currentMarket } = useMarket();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('deal_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // Track per-agent running state: "propertyId:agentName" -> true
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());

  /* Filter & Sort */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = properties.filter(p =>
      !q || p.address.toLowerCase().includes(q)
    );
    return result.sort((a, b) => {
      // For computed fields, calculate on the fly
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === 'annual_rent_income') {
        valA = computeAnnualRentIncome(a.list_price) ?? 0;
        valB = computeAnnualRentIncome(b.list_price) ?? 0;
      } else if (sortField === 'income_required') {
        valA = computeIncomeRequired(a.list_price) ?? 0;
        valB = computeIncomeRequired(b.list_price) ?? 0;
      } else if (sortField === 'value_rating') {
        valA = computeValueRating(a.deal_score) ?? 0;
        valB = computeValueRating(b.deal_score) ?? 0;
      } else if (sortField === 'sqft_per_bedroom') {
        valA = computeSqftPerBedroom(a.sqft, a.beds) ?? 0;
        valB = computeSqftPerBedroom(b.sqft, b.beds) ?? 0;
      } else {
        valA = ((a as Record<string, unknown>)[sortField] ?? 0) as number;
        valB = ((b as Record<string, unknown>)[sortField] ?? 0) as number;
      }

      if (valA === valB) return 0;
      return sortDir === 'asc'
        ? (valA > valB ? 1 : -1)
        : (valA < valB ? 1 : -1);
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

  /* Run Individual Agent Handler */
  const handleRunAgent = useCallback(async (propertyId: string, agent: string) => {
    if (!currentMarket?.displayName) return;

    const key = `${propertyId}:${agent}`;
    setRunningAgents(prev => new Set(prev).add(key));

    try {
      const response = await fetch(`${API_BASE}/api/properties/run-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: propertyId,
          market_context: currentMarket.displayName,
          listing_type: 'for_rent',
          agent_names: [agent], // Run only this agent
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[ForRent] run-agent failed:', err);
      }
    } catch (err) {
      console.error('[ForRent] run-agent error:', err);
    } finally {
      setRunningAgents(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [currentMarket]);

  const colProps = { sortField, sortDir, onSort: toggleSort };

  // Helper to get agent status for a specific property/agent combo
  const getAgentStatus = (propertyId: string, agent: string): string | undefined => {
    const key = `${propertyId}:${agent}`;
    if (runningAgents.has(key)) return 'running';
    // Could add logic here to check for "complete" / "error" from property data if needed
    return undefined;
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || !onDelete) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} For Rent listings?`)) {
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

  if (loading && properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-accent animate-spin" />
        <p className="text-sm text-text-tertiary">Loading For Rent listings...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="px-6 py-2 border-b border-border bg-bg-elevated/30 flex items-center justify-between">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search For Rent listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-tertiary font-mono">{filtered.length} listings</span>
            {runningAgents.size > 0 && (
              <div className="flex items-center gap-1.5 text-accent animate-pulse">
                <Loader2 size={11} className="animate-spin" />
                <span className="text-[10px] font-bold">Running {runningAgents.size} agent{runningAgents.size > 1 ? 's' : ''}...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-bg-surface scrollbar-thin">
        <div className="min-w-max border-collapse">

          {/* ── Header Row — 30 columns per blueprint ── */}
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

            {/* Col 3: Address */}
            <ColHeader label="Address"            field="address"          width="w-72"  {...colProps} />
            {/* Col 4: Price */}
            <ColHeader label="Price / Mo"         field="list_price"       width="w-36"  align="right" {...colProps} />
            {/* Col 5: Bedrooms */}
            <ColHeader label="Beds"               field="beds"             width="w-20"  align="center" {...colProps} />
            {/* Col 6: Bathrooms */}
            <ColHeader label="Baths"              field="baths"            width="w-20"  align="center" {...colProps} />
            {/* Col 7: Sqft */}
            <ColHeader label="Sqft"               field="sqft"             width="w-24"  align="center" {...colProps} />
            {/* Col 8: Property Type */}
            <ColHeader label="Type"               field="property_type"    width="w-32"  {...colProps} />
            {/* Col 9: Listing URL */}
            <div className="w-44 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Listing URL
            </div>
            {/* Col 10: Building / Complex */}
            <ColHeader label="Building / Complex" field="listing_agent"    width="w-44"  {...colProps} />
            {/* Col 11: Description */}
            <div className="w-52 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Description
            </div>
            {/* Col 12: Extracted At */}
            <ColHeader label="Extracted @"        field="extracted_at"     width="w-44"  align="center" {...colProps} />
            {/* Col 13: Listing Status */}
            <div className="w-28 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Status
            </div>
            {/* Col 14: Price/Sqft */}
            <ColHeader label="$/Sqft/Mo"          field="price_per_sqft"   width="w-28"  align="right" {...colProps} />
            {/* Col 15: Price/Bedroom */}
            <ColHeader label="$/Bedroom"          field="price_per_bedroom" width="w-32" align="right" {...colProps} />
            {/* Col 16: Deal Score */}
            <ColHeader label="Deal Score"         field="deal_score"       width="w-28"  align="center" {...colProps} />
            {/* Col 17: Deal Category */}
            <ColHeader label="Deal Category"      field="deal_category"    width="w-36"  align="center" {...colProps} />
            {/* Col 18: Size Category */}
            <ColHeader label="Size"               field="size_category"    width="w-28"  align="center" {...colProps} />
            {/* Col 19: Price Tier */}
            <ColHeader label="Price Tier"         field="price_tier"       width="w-32"  align="center" {...colProps} />
            {/* Col 20: Annual Rent Income */}
            <ColHeader label="Annual Income"      field="annual_rent_income" width="w-36" align="right" {...colProps} />
            {/* Col 21: Income Required */}
            <ColHeader label="Income Req'd"       field="income_required"  width="w-32"  align="right" {...colProps} />
            {/* Col 22: Value Rating */}
            <ColHeader label="Value"              field="value_rating"     width="w-28"  align="center" {...colProps} />
            {/* Col 23: Sqft/Bedroom */}
            <ColHeader label="Sqft/Bed"           field="sqft_per_bedroom" width="w-24"  align="center" {...colProps} />
            {/* Col 24: Affordability Index */}
            <div className="w-32 px-3 border-r border-border h-full flex items-center text-[10px] uppercase font-bold tracking-wider shrink-0">
              Affordability
            </div>
            {/* Col 25–30: AI Agent Columns */}
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ INVESTMENT POTENTIAL" /></div>
            </div>
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ NEIGHBORHOOD INSIGHTS" /></div>
            </div>
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ COMPETITIVE ANALYSIS" /></div>
            </div>
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ IDEAL TENANT PROFILE" /></div>
            </div>
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ RISK ASSESSMENT" /></div>
            </div>
            <div className="w-52 px-3 border-r border-border h-full flex items-center justify-center shrink-0">
              <div className="h-4 w-full"><TextHoverEffect text="✦ ROI ESTIMATE" /></div>
            </div>
          </div>

          {/* ── Empty state (inside table so headers remain visible) ── */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Search size={32} className="text-text-tertiary opacity-30" />
              <p className="text-sm font-medium text-text-secondary mt-2">No For Rent listings found</p>
              <p className="text-xs text-text-tertiary font-mono">Market: {currentMarket?.city || 'Not Selected'}</p>
              <p className="text-xs text-text-tertiary">Run a scan to populate rental listings</p>
            </div>
          )}

          {/* ── Data Rows ── */}
          {filtered.map((property) => {
            const thumbSrc = property.image_urls?.[0] ?? property.image_url ?? null;
            const price = property.list_price;

            // Computed fields
            const annualRentIncome = computeAnnualRentIncome(price);
            const incomeRequired = computeIncomeRequired(price);
            const sqftPerBedroom = computeSqftPerBedroom(property.sqft, property.beds);

            return (
              <div
                key={property.id}
                className="flex items-start border-b border-border group transition-colors min-h-12 hover:bg-accent/5"
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

                {/* Photo */}
                <div className="w-14 border-r border-border flex items-center justify-center px-1 py-3 shrink-0 self-start">
                  <TableThumb src={thumbSrc} address={property.address} />
                </div>

                {/* Col 3: Address */}
                <div className="w-72 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <span className="truncate text-[12px] font-semibold text-text-primary">{em(property.address)}</span>
                </div>

                {/* Col 4: Price/Mo */}
                <div className="w-36 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[13px] font-black text-text-primary tabular-nums">{fmtRentPrice(price)}</span>
                </div>

                {/* Col 5: Bedrooms */}
                <div className="w-20 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-primary tabular-nums">{property.beds != null ? property.beds.toFixed(1) : '—'}</span>
                </div>

                {/* Col 6: Bathrooms */}
                <div className="w-20 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-primary tabular-nums">{property.baths != null ? property.baths.toFixed(1) : '—'}</span>
                </div>

                {/* Col 7: Sqft */}
                <div className="w-24 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">
                    {property.sqft ? Number(property.sqft).toLocaleString() : '—'}
                  </span>
                </div>

                {/* Col 8: Property Type */}
                <div className="w-32 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.property_type} colorMap={PROPERTY_TYPE_COLORS} />
                </div>

                {/* Col 9: Listing URL */}
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
                      <span className="truncate">{property.listing_url.replace('https://', '').split('/')[0]}</span>
                    </a>
                  ) : (
                    <span className="text-text-tertiary text-[11px]">—</span>
                  )}
                </div>

                {/* Col 10: Building / Complex */}
                <div className="w-44 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <span className="truncate text-[11px] text-text-secondary">
                    {em(property.listing_agent)}
                  </span>
                </div>

                {/* Col 11: Description */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <span className="text-[11px] text-text-tertiary line-clamp-2">—</span>
                </div>

                {/* Col 12: Extracted At */}
                <div className="w-44 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[11px] text-text-tertiary tabular-nums">{fmtDate(property.extracted_at)}</span>
                </div>

                {/* Col 13: Listing Status */}
                <div className="w-28 px-3 border-r border-border flex items-center py-3 shrink-0 self-start">
                  <ColorBadge value="For Rent" colorMap={LISTING_STATUS_COLORS} />
                </div>

                {/* Col 14: Price/Sqft */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">{fmtPpsf(property.price_per_sqft)}</span>
                </div>

                {/* Col 15: Price/Bedroom */}
                <div className="w-32 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">{fmtCurrency(property.price_per_bedroom)}</span>
                </div>

                {/* Col 16: Deal Score */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <DealScoreBadge score={property.deal_score} size="sm" />
                </div>

                {/* Col 17: Deal Category */}
                <div className="w-36 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.deal_category} colorMap={DEAL_CATEGORY_COLORS} />
                </div>

                {/* Col 18: Size Category */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.size_category} colorMap={SIZE_CATEGORY_COLORS} />
                </div>

                {/* Col 19: Price Tier */}
                <div className="w-32 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ColorBadge value={property.price_tier} colorMap={PRICE_TIER_COLORS} />
                </div>

                {/* Col 20: Annual Rent Income */}
                <div className="w-36 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[12px] font-bold text-text-primary tabular-nums">{fmtCurrency(annualRentIncome)}</span>
                </div>

                {/* Col 21: Income Required */}
                <div className="w-32 px-3 border-r border-border flex items-center justify-end py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">{fmtCurrency(incomeRequired)}</span>
                </div>

                {/* Col 22: Value Rating (stars) */}
                <div className="w-28 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <ValueRating dealScore={property.deal_score} />
                </div>

                {/* Col 23: Sqft/Bedroom */}
                <div className="w-24 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  <span className="text-[12px] text-text-secondary tabular-nums">{fmtNum(sqftPerBedroom)}</span>
                </div>

                {/* Col 24: Affordability Index */}
                <div className="w-32 px-3 border-r border-border flex items-center justify-center py-3 shrink-0 self-start">
                  {/* affordability_index requires market baseline from market_metrics.
                      Shows "—" until baseline is seeded for this market.
                      NEVER shows 5300% — blueprint fix 1. */}
                  <AffordabilityBadge val={null} />
                </div>

                {/* Col 25: Investment Potential */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.investment_potential}
                    agent="investment_potential"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'investment_potential')}
                    onRunAgent={handleRunAgent}
                  />
                </div>

                {/* Col 26: Neighborhood Insights */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.neighborhood_insights}
                    agent="neighborhood_insights"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'neighborhood_insights')}
                    onRunAgent={handleRunAgent}
                  />
                </div>

                {/* Col 27: Competitive Analysis */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.competitive_position}
                    agent="competitive_analysis"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'competitive_analysis')}
                    onRunAgent={handleRunAgent}
                  />
                </div>

                {/* Col 28: Ideal Tenant Profile */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.ideal_tenant_profile}
                    agent="ideal_tenant_profile"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'ideal_tenant_profile')}
                    onRunAgent={handleRunAgent}
                  />
                </div>

                {/* Col 29: Risk Assessment */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.risk_assessment}
                    agent="risk_assessment"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'risk_assessment')}
                    onRunAgent={handleRunAgent}
                  />
                </div>

                {/* Col 30: ROI Estimate */}
                <div className="w-52 px-3 border-r border-border flex items-start py-3 shrink-0">
                  <LongTextCell
                    text={property.roi_estimate}
                    agent="roi_estimate"
                    propertyId={property.id}
                    agentStatus={getAgentStatus(property.id, 'roi_estimate')}
                    onRunAgent={handleRunAgent}
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
