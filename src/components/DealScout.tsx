import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/auth-utils';
import { Bot, MapPin, RefreshCw, TrendingUp, CheckCircle2, Circle, Share2, Check } from 'lucide-react';
import { useDealScoutStatus } from '../hooks/useDealScoutStatus';
import { useDealScout } from '../hooks/useDealScout';
import { useMarket } from '../stores/marketStore';

type DisplayMode = 'label' | 'numbers';

function formatQuantitative(
  percentAboveMarket: number | null | undefined,
  pricePerSqft: number | null | undefined,
  baselinePpsf: number | null | undefined,
): string | null {
  if (percentAboveMarket == null || pricePerSqft == null || baselinePpsf == null) return null;
  const pct = (percentAboveMarket * 100).toFixed(1);
  const sign = percentAboveMarket <= 0 ? '' : '+';
  return `${sign}${pct}% vs market — $${Math.round(pricePerSqft)}/sqft vs $${Math.round(baselinePpsf)} baseline`;
}

export default function DealScout() {
  const navigate = useNavigate();
  const { status, setStatus, loading } = useDealScoutStatus();
  const { data: scoutData, isLoading: scoutLoading, error: scoutError } = useDealScout();
  const { isMarketSelected, currentMarket } = useMarket();

  const [timeNow, setTimeNow] = useState(() => Date.now());
  const [runningNow, setRunningNow] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    return (localStorage.getItem('remi:deal_display_mode') as DisplayMode) || 'label';
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleDisplayMode = (mode: DisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem('remi:deal_display_mode', mode);
  };

  const handleShareBrief = async (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/brief/${propertyId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedId(propertyId);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      // User cancelled — no action needed
    }
  };

  useEffect(() => {
    const int = setInterval(() => setTimeNow(Date.now()), 60000);
    return () => clearInterval(int);
  }, []);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const userId = getOrCreateUserId();

    if (!status) {
      navigate('/profile');
      return;
    }

    const newActiveState = !status.is_active;
    setStatus({ ...status, is_active: newActiveState });

    const currentMarketId = status.scan_regions?.[0] || 'unknown';


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('deal_scout_status') as any).update({ is_active: newActiveState }).eq('user_id', userId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('user_profiles') as any)
      .update({ ai_scouting_enabled: newActiveState })
      .eq('user_id', userId)
      .eq('market_slug', currentMarketId);

    window.dispatchEvent(new CustomEvent('remi:profile_update', {
      detail: { aiScoutingEnabled: newActiveState, market_slug: currentMarketId }
    }));
  };

  const handleRunNow = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (runningNow) return;
    setRunningNow(true);
    try {
      window.dispatchEvent(new CustomEvent('remi:domino_update'));
    } finally {
      // Give it a moment to show the loading state, then let useDealScout manage it
      setTimeout(() => setRunningNow(false), 2000);
    }
  }, [runningNow]);

  const formatTimeAgo = (iso: string | null) => {
    if (!iso) return 'Never';
    const diff = (timeNow - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const formatTimeUntil = (iso: string | null) => {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - timeNow) / 1000;
    if (diff <= 0)    return 'Soon';
    if (diff < 60)    return `${Math.floor(diff)}s`;
    if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const formatPrice = (v: number) =>
    v >= 1000000 ? `$${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M` : `$${(v / 1000).toFixed(0)}K`;

  if (loading) return <div className="h-[180px] bg-bg-surface animate-pulse rounded-2xl border border-border" />;

  // ─── PREREQUISITE CHECKLIST STATE ─────────────────────────────────
  // Show checklist when not active, not configured, or API returns missing/incomplete
  const missingData = scoutData?.status === 'insufficient_data' || scoutData?.status === 'incomplete' || scoutData?.missing;
  const noMatches = scoutData?.status === 'no_matches';
  const isUnconfigured = !status;
  const isInactive = status && !status.is_active;

  if (isUnconfigured || isInactive || missingData) {
    // Determine checklist step completion
    const step1Done = isMarketSelected && currentMarket?.id !== 'north-america';
    const step2Done = !!(status?.last_scan_at);
    const step3Done = !!(status?.price_max && status.price_max > 0);
    const step4Done = !!(status?.is_active);

    const steps = [
      { done: step1Done, label: 'Select a market', sub: 'Map → city selector' },
      { done: step2Done, label: 'Run a For Sale scan', sub: 'Map tab → start scan' },
      { done: step3Done, label: 'Configure your profile', sub: 'Budget + score threshold' },
      { done: step4Done, label: 'Enable AI Scouting', sub: 'Profile → toggle on' },
    ];

    return (
      <div className="w-full h-full">
        <div className="bg-bg-surface/60 rounded-2xl border border-border p-5 flex flex-col h-full min-h-[180px] w-full hover:shadow-md transition-shadow relative">

          <div className="absolute top-5 right-5 z-[9999] pointer-events-auto">
            {status ? (
              <button
                onClick={handleToggle}
                className="relative w-9 h-5 rounded-full transition-all cursor-pointer bg-border border border-border-hover shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
              >
                <div className="absolute top-[1.5px] w-4 h-4 bg-white rounded-full shadow-sm transition-all left-[2px]" />
              </button>
            ) : (
              <span className="text-[10px] font-bold text-text-tertiary bg-black/5 px-2 py-0.5 rounded-full border border-border">OFF</span>
            )}
          </div>

          <div className="w-full mb-3 pr-12">
            <div className="flex items-center gap-2">
              <Bot size={15} strokeWidth={1.5} className="text-foreground" />
              <span className="font-semibold text-sm text-foreground">Deal Scout</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Complete setup to activate</p>
          </div>

          {/* Prerequisite checklist */}
          <div className="flex-1 space-y-1.5 mb-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                {step.done
                  ? <CheckCircle2 size={13} className="text-success mt-0.5 shrink-0" />
                  : <Circle size={13} className="text-text-tertiary mt-0.5 shrink-0" />
                }
                <div className="min-w-0">
                  <span className={`text-[11px] font-medium ${step.done ? 'text-text-primary line-through opacity-50' : 'text-text-secondary'}`}>
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="text-[10px] text-text-tertiary ml-1.5">{step.sub}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              Go to Map
            </button>
            <span className="text-xs text-text-tertiary">·</span>
            <button
              onClick={() => navigate('/profile')}
              className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              Configure Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ACTIVE STATE ──────────────────────────────────────────────────
  const regionLabel = status.scan_regions?.join(', ') || 'All regions';
  const typeLabel   = status.scan_types?.join(', ') || 'All types';
  const priceLabel  = status.price_min && status.price_max
    ? `${formatPrice(status.price_min)}–${formatPrice(status.price_max)}`
    : 'Any price';

  const opportunities = scoutData?.opportunities ?? [];
  const isRunning = runningNow || scoutLoading;

  return (
    <div className="w-full h-full">
      <div className="bg-bg-surface/60 rounded-2xl border border-border p-5 flex flex-col h-full min-h-[180px] w-full hover:border-accent/40 hover:shadow-lg transition-colors relative">

        {/* Toggle */}
        <div className="absolute top-5 right-5 z-[9999] pointer-events-auto">
          <button
            onClick={handleToggle}
            className="relative w-9 h-5 rounded-full transition-all cursor-pointer bg-accent"
          >
            <div className="absolute top-[1.5px] w-4 h-4 bg-white rounded-full shadow-sm transition-all left-[18px]" />
          </button>
        </div>

        {/* Header */}
        <div className="w-full mb-2 pr-12">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot size={15} strokeWidth={1.5} className="text-foreground" />
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                Deal Scout
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
              </span>
            </div>
            {/* Label / Numbers display toggle */}
            <div className="flex rounded-md overflow-hidden border border-border text-[10px] font-medium">
              <button
                onClick={() => toggleDisplayMode('label')}
                className={`px-2 py-0.5 transition-colors cursor-pointer ${displayMode === 'label' ? 'bg-accent text-white' : 'bg-bg-primary text-text-tertiary hover:text-text-secondary'}`}
              >
                Label
              </button>
              <button
                onClick={() => toggleDisplayMode('numbers')}
                className={`px-2 py-0.5 transition-colors cursor-pointer ${displayMode === 'numbers' ? 'bg-accent text-white' : 'bg-bg-primary text-text-tertiary hover:text-text-secondary'}`}
              >
                Numbers
              </button>
            </div>
          </div>
          {/* Active search criteria */}
          <p className="text-[10px] text-text-tertiary mt-1 leading-relaxed">
            {regionLabel} · {typeLabel} · {priceLabel}
            {status.score_min ? ` · Score ≥ ${status.score_min}` : ''}
          </p>
        </div>

        {/* Opportunity cards or no-match state */}
        <div className="flex-1 min-h-0 mb-2">
          {isRunning ? (
            <div className="flex items-center gap-2 py-3 text-xs text-text-tertiary">
              <RefreshCw size={12} className="animate-spin" />
              Evaluating opportunities...
            </div>
          ) : scoutError ? (
            <p className="text-xs text-text-tertiary py-2">Unable to load opportunities.</p>
          ) : opportunities.length > 0 ? (
            <div className="space-y-2">
              {opportunities.slice(0, 2).map((opp) => {
                const quantLabel = displayMode === 'numbers'
                  ? formatQuantitative(opp.percent_above_market, opp.price_per_sqft, opp.market_baseline_ppsf)
                  : null;
                return (
                  <div key={opp.property_id} className="bg-bg-elevated rounded-lg border border-border p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <MapPin size={10} className="text-text-tertiary shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium text-text-primary truncate">{opp.address}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => handleShareBrief(e, opp.property_id)}
                          title="Share property brief"
                          className="flex items-center gap-0.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                        >
                          {copiedId === opp.property_id
                            ? <Check size={10} className="text-emerald-400" />
                            : <Share2 size={10} />
                          }
                        </button>
                        <div className="flex items-center gap-1">
                          <TrendingUp size={10} className="text-accent" />
                          <span className="text-[11px] font-bold text-accent">{opp.deal_score}</span>
                        </div>
                        {opp.investor_score != null && opp.investor_score > 0 && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400">
                            INV {opp.investor_score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-text-secondary mb-1">
                      <span className="font-semibold text-text-primary">{formatPrice(opp.price)}</span>
                      {opp.beds > 0 && <span>{opp.beds}bd</span>}
                      {opp.baths > 0 && <span>{opp.baths}ba</span>}
                      {opp.sqft > 0 && <span>{(opp.sqft / 1000).toFixed(1)}k sqft</span>}
                      {opp.dom > 0 && <span>{opp.dom}d on market</span>}
                    </div>
                    {/* Vocabulary toggle: label vs quantitative market framing */}
                    {quantLabel ? (
                      <p className="text-[10px] text-text-tertiary leading-snug">{quantLabel}</p>
                    ) : opp.deal_category ? (
                      <p className="text-[10px] text-text-tertiary leading-snug">{opp.deal_category}</p>
                    ) : opp.why ? (
                      <p className="text-[10px] text-text-tertiary leading-snug line-clamp-2">{opp.why}</p>
                    ) : null}
                  </div>
                );
              })}
              {(scoutData?.total ?? 0) > 2 && (
                <p className="text-[10px] text-text-tertiary text-center">
                  +{(scoutData!.total!) - 2} more matches
                </p>
              )}
            </div>
          ) : noMatches ? (
            <p className="text-xs text-text-tertiary py-2 leading-relaxed">
              No matches yet for current criteria. Try widening your budget or score threshold.
            </p>
          ) : (
            <div className="bg-bg-elevated rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary flex items-center gap-1.5 opacity-80">
                  <span className="text-sm">🕐</span> Last scan
                </span>
                <strong className="text-text-primary px-1">{formatTimeAgo(status.last_scan_at)}</strong>
              </div>
              {status.matches_since > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-tertiary flex items-center gap-1.5 opacity-80">
                    <span className="text-sm">🔍</span> Found
                  </span>
                  <span className="text-accent font-semibold px-1">
                    {status.matches_since} new {status.matches_since === 1 ? 'match' : 'matches'}
                    {status.matches_since_date && ` since ${status.matches_since_date}`}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary flex items-center gap-1.5 opacity-80">
                  <span className="text-sm">⏱</span> Next scan
                </span>
                <strong className="text-text-primary px-1">{formatTimeUntil(status.next_scan_at)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Run Now button */}
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
        >
          <RefreshCw size={11} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'Evaluating...' : 'Run Scout Now'}
        </button>
      </div>
    </div>
  );
}
