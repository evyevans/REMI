/* ═══════════════════════════════════════════════════════════
   FULL MARKET INTEL — Executive Intelligence Table
   Airtable 1:1 replica with AI-powered analysis pipeline
   ═══════════════════════════════════════════════════════════ */

import { useState, useMemo } from 'react';
import {
  Search, ExternalLink, Loader2, RefreshCw,
  Play, RotateCcw, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, X, Zap
} from 'lucide-react';
import {
  useFullMarketIntel,
  deriveButtonState,
  type FullMarketIntelRecord,
  type AgentButtonState,
} from '../hooks/useFullMarketIntel';
import { useMarket } from '../stores/marketStore';

// ── Null rendering — em-dash for all null/undefined ────────────

function fmt(value: string | number | null | undefined, type: 'text' | 'currency' | 'number' | 'score' = 'text'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') return `$${Number(value).toLocaleString()}`;
  if (type === 'score') return `${Number(value).toFixed(1)} / 10`;
  if (type === 'number') return String(value);
  return String(value);
}

// ── Badge color maps ────────────────────────────────────────────

const MARKET_POSITION_CLS: Record<string, string> = {
  'Premium':      'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
  'Above Market': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'At Market':    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Below Market': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
};

const PRIORITY_LEVEL_CLS: Record<string, string> = {
  'Hot Lead':          'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  'Warm Opportunity':  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Monitor':           'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'Archive':           'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

const OPPORTUNITY_TYPE_CLS: Record<string, string> = {
  'Investment Opportunity': 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25',
  'Buyer Match':            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Comp for Listing':       'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  'Market Trend':           'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
  'Overpriced Alert':       'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
};

const STATUS_CLS: Record<string, string> = {
  'New Analysis':     'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'Under Review':     'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  'Action Taken':     'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25',
  'Client Contacted': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
  'Deal Closed':      'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  'Archived':         'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

function ColorBadge({
  value,
  colorMap,
}: {
  value: string | null | undefined;
  colorMap: Record<string, string>;
}) {
  if (!value) return <span className="text-text-tertiary text-[11px]">—</span>;
  const cls = colorMap[value] ?? 'bg-bg-surface text-text-secondary border-border';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {value}
    </span>
  );
}

// ── Investment score chip ───────────────────────────────────────

function ScoreChip({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-text-tertiary text-[11px]">—</span>;
  }
  const score = Number(value);
  const cls =
    score >= 8 ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/25' :
    score >= 6 ? 'text-blue-700 dark:text-blue-300 bg-blue-500/15 border-blue-500/25' :
    score >= 4 ? 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/25' :
    'text-red-700 dark:text-red-300 bg-red-500/15 border-red-500/25';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${cls}`}>
      {score.toFixed(1)}
      <span className="font-normal opacity-60">/10</span>
    </span>
  );
}

// ── AI agent run button ──────────────────────────────────────

function AiAgentButton({
  agentName,
  hasValue,
  isRunning,
  onRun,
}: {
  agentName: string;
  hasValue: boolean;
  isRunning: boolean;
  onRun: () => void;
}) {
  if (hasValue && !isRunning) {
    // Show small re-run icon on hover
    return (
      <button
        onClick={onRun}
        className="hidden group-hover:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-all"
        title={`Re-run ${agentName}`}
      >
        <Zap size={10} />
        Re-run
      </button>
    );
  }

  if (isRunning) {
    return (
      <button
        disabled
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-text-tertiary bg-bg-surface border border-border cursor-not-allowed"
      >
        <Loader2 size={10} className="animate-spin" />
        Running…
      </button>
    );
  }

  // No value — show Run button
  return (
    <button
      onClick={onRun}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-all"
      title={`Run ${agentName}`}
    >
      <Play size={10} />
      Run
    </button>
  );
}

// ── Run Analysis button — 5 states ─────────────────────────────

const BUTTON_LABEL: Record<AgentButtonState, string> = {
  idle:     'Run Analysis',
  running:  'Analyzing…',
  complete: 'Re-run Analysis',
  partial:  'Retry Failed Agents',
  error:    'Retry Analysis',
};

function RunAnalysisButton({
  record,
  isRunning,
  onRun,
}: {
  record: FullMarketIntelRecord;
  isRunning: boolean;
  onRun: () => void;
}) {
  const state: AgentButtonState = isRunning
    ? 'running'
    : deriveButtonState(record.agents_status);

  const disabled = state === 'running';

  const baseCls = 'flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all';
  const variantCls: Record<AgentButtonState, string> = {
    idle:     'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20',
    running:  'bg-bg-surface text-text-tertiary border-border cursor-not-allowed',
    complete: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
    partial:  'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
    error:    'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20',
  };

  return (
    <button
      onClick={onRun}
      disabled={disabled}
      className={`${baseCls} ${variantCls[state]}`}
      title={BUTTON_LABEL[state]}
    >
      {state === 'running' ? (
        <Loader2 size={11} className="animate-spin" />
      ) : state === 'complete' ? (
        <RotateCcw size={11} />
      ) : state === 'error' || state === 'partial' ? (
        <AlertTriangle size={11} />
      ) : (
        <Play size={11} />
      )}
      {BUTTON_LABEL[state]}
    </button>
  );
}

// ── AI Notes panel (expandable) ────────────────────────────────

function AiNotesPanel({
  record,
  onClose,
}: {
  record: FullMarketIntelRecord;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="pointer-events-auto w-[520px] max-h-[80vh] bg-bg-elevated border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wider font-semibold">
              Executive Intelligence Brief
            </p>
            <p className="text-sm font-semibold text-text-primary truncate mt-0.5">
              {record.property_address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 p-1.5 rounded-lg hover:bg-bg-surface-hover text-text-tertiary"
          >
            <X size={14} />
          </button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
          {record.ai_notes
            ? record.ai_notes
            : <span className="text-text-tertiary italic">No analysis yet — click Run Analysis.</span>
          }
        </div>
      </div>
    </div>
  );
}

// ── Sort helpers ───────────────────────────────────────────────

type SortKey = 'analysis_date' | 'investment_score' | 'property_price' | 'priority_level';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = {
  'Hot Lead': 0, 'Warm Opportunity': 1, 'Monitor': 2, 'Archive': 3,
};

function sortRecords(
  records: FullMarketIntelRecord[],
  key: SortKey,
  dir: SortDir,
): FullMarketIntelRecord[] {
  return [...records].sort((a, b) => {
    let av: string | number | null = a[key as keyof FullMarketIntelRecord] as any;
    let bv: string | number | null = b[key as keyof FullMarketIntelRecord] as any;

    if (key === 'priority_level') {
      av = PRIORITY_ORDER[String(av ?? '')] ?? 99;
      bv = PRIORITY_ORDER[String(bv ?? '')] ?? 99;
    } else if (key === 'investment_score' || key === 'property_price') {
      av = Number(av ?? -1);
      bv = Number(bv ?? -1);
    } else {
      av = String(av ?? '');
      bv = String(bv ?? '');
    }

    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Main component ──────────────────────────────────────────────

export default function FullMarketIntel() {
  const { currentMarket } = useMarket();
  const { records, loading, error, runningIds, runningAgents, refetch, runAgents, runAgent } =
    useFullMarketIntel();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('analysis_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter by search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      r.property_address.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      (r.market_position ?? '').toLowerCase().includes(q) ||
      (r.priority_level ?? '').toLowerCase().includes(q) ||
      (r.opportunity_type ?? '').toLowerCase().includes(q) ||
      (r.property_type ?? '').toLowerCase().includes(q)
    );
  }, [records, search]);

  const sorted = useMemo(
    () => sortRecords(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const expandedRecord = expandedId ? records.find(r => r.id === expandedId) : null;

  // Market context for display
  const marketLabel = currentMarket?.city
    ? `${currentMarket.city}${currentMarket.state_province ? `, ${currentMarket.state_province}` : ''}`
    : 'No market selected';

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-bg-elevated shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-text-primary">Full Market Intel</h2>
            <span className="text-[11px] text-text-tertiary bg-bg-surface px-2 py-0.5 rounded-full border border-border">
              {marketLabel}
            </span>
            {!loading && (
              <span className="text-[11px] text-text-tertiary">
                {sorted.length} record{sorted.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search records…"
            className="pl-7 pr-3 py-1.5 text-xs bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 w-52"
          />
        </div>

        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex items-center gap-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && records.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-text-tertiary">
            <Loader2 size={20} className="animate-spin text-accent" />
            <p className="text-xs">Loading market intelligence…</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-tertiary">
            <CheckCircle2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No records found</p>
            <p className="text-xs mt-1">
              {search ? 'Try a different search query.' : `No market intel for ${marketLabel}.`}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-bg-elevated border-b border-border">
              <tr>
                {/* Col: Address */}
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap w-52">
                  Address
                </th>
                {/* Col: Price */}
                <th
                  className="text-right px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-text-primary select-none"
                  onClick={() => toggleSort('property_price')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Price {sortKey === 'property_price' && (sortDir === 'desc' ? <ChevronDown size={11} className="text-accent" /> : <ChevronUp size={11} className="text-accent" />)}
                  </span>
                </th>
                {/* Col: Type */}
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Type
                </th>
                {/* Col: Beds / Baths */}
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Bed / Bath
                </th>
                {/* Col: Market Position + Run Button */}
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    Market Pos. <Zap size={10} className="opacity-40" />
                  </span>
                </th>
                {/* Col: Investment Score + Run Button */}
                <th
                  className="text-center px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-text-primary select-none"
                  onClick={() => toggleSort('investment_score')}
                >
                  <span className="flex items-center justify-center gap-1">
                    Score {sortKey === 'investment_score' && (sortDir === 'desc' ? <ChevronDown size={11} className="text-accent" /> : <ChevronUp size={11} className="text-accent" />)} <Zap size={10} className="opacity-40" />
                  </span>
                </th>
                {/* Col: Priority */}
                <th
                  className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-text-primary select-none"
                  onClick={() => toggleSort('priority_level')}
                >
                  <span className="flex items-center gap-1">
                    Priority {sortKey === 'priority_level' && (sortDir === 'desc' ? <ChevronDown size={11} className="text-accent" /> : <ChevronUp size={11} className="text-accent" />)}
                  </span>
                </th>
                {/* Col: Opportunity */}
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Opportunity
                </th>
                {/* Col: Listing */}
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Link
                </th>
                {/* Col: Date */}
                <th
                  className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-text-primary select-none"
                  onClick={() => toggleSort('analysis_date')}
                >
                  <span className="flex items-center gap-1">
                    Date {sortKey === 'analysis_date' && (sortDir === 'desc' ? <ChevronDown size={11} className="text-accent" /> : <ChevronUp size={11} className="text-accent" />)}
                  </span>
                </th>
                {/* Col: Status */}
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                {/* Col: Actions */}
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((record, idx) => {
                const isRunning = runningIds.has(record.id);
                const isExpanded = expandedId === record.id;
                const hasNotes = !!record.ai_notes;

                return (
                  <tr
                    key={record.id}
                    className={`border-b border-border/50 transition-colors hover:bg-bg-surface/40 ${
                      idx % 2 === 0 ? '' : 'bg-bg-elevated/30'
                    } ${isExpanded ? 'bg-accent/5' : ''}`}
                  >
                    {/* Address — clickable to expand AI notes */}
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="text-left group w-full"
                        title={hasNotes ? 'View executive brief' : 'No analysis yet'}
                      >
                        <span className={`text-xs font-medium leading-tight line-clamp-2 group-hover:text-accent transition-colors ${hasNotes ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {record.property_address}
                        </span>
                        <span className="text-[10px] text-text-tertiary mt-0.5 block">
                          {record.city}, {record.state_province}
                        </span>
                      </button>
                    </td>

                    {/* Price */}
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-text-primary whitespace-nowrap">
                      {fmt(record.property_price, 'currency')}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                      {fmt(record.property_type)}
                    </td>

                    {/* Bed / Bath */}
                    <td className="px-3 py-2.5 text-center text-text-secondary whitespace-nowrap">
                      {record.bedrooms !== null || record.bathrooms !== null
                        ? `${fmt(record.bedrooms, 'number')} / ${fmt(record.bathrooms, 'number')}`
                        : '—'
                      }
                    </td>

                    {/* Market Position + Run Button */}
                    <td className="px-3 py-2.5 whitespace-nowrap group">
                      <div className="flex items-center justify-between gap-1.5">
                        <ColorBadge value={record.market_position} colorMap={MARKET_POSITION_CLS} />
                        <AiAgentButton
                          agentName="market_position"
                          hasValue={!!record.market_position}
                          isRunning={runningAgents.has(`${record.id}:market_position`)}
                          onRun={() => runAgent(record.id, 'market_position')}
                        />
                      </div>
                    </td>

                    {/* Investment Score + Run Button */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap group">
                      <div className="flex items-center justify-center gap-1.5">
                        <ScoreChip value={record.investment_score} />
                        <AiAgentButton
                          agentName="investment_score"
                          hasValue={record.investment_score !== null}
                          isRunning={runningAgents.has(`${record.id}:investment_score`)}
                          onRun={() => runAgent(record.id, 'investment_score')}
                        />
                      </div>
                    </td>

                    {/* Priority Level */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ColorBadge value={record.priority_level} colorMap={PRIORITY_LEVEL_CLS} />
                    </td>

                    {/* Opportunity Type */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ColorBadge value={record.opportunity_type} colorMap={OPPORTUNITY_TYPE_CLS} />
                    </td>

                    {/* Listing URL */}
                    <td className="px-3 py-2.5 text-center">
                      {record.listing_url
                        ? (
                          <a
                            href={record.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:text-accent/80 transition-colors"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )
                        : <span className="text-text-tertiary text-[11px]">—</span>
                      }
                    </td>

                    {/* Analysis Date */}
                    <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-text-tertiary" />
                        {record.analysis_date ?? '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <ColorBadge value={record.status} colorMap={STATUS_CLS} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <RunAnalysisButton
                        record={record}
                        isRunning={isRunning}
                        onRun={() => runAgents(record.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Notes slide-in panel */}
      {expandedRecord && (
        <AiNotesPanel
          record={expandedRecord}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}
