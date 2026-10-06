
/* ═══════════════════════════════════════════════════════════
   DASHBOARD — First-impression trust builder (v4.0)
   Final Compression Pass — Steve Jobs Protocol
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingDown, Flame, Home, MapPin, ArrowRight, Eye,
  ChevronRight, Briefcase, CheckCircle2, Bot, AlertTriangle,
  TrendingUp, Crosshair
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { MetricTile, SourceLabel, Button, EmptyState, DealScoreBadge } from '../components/ui';
import { NoiseBackground } from '../components/ui/noise-background';
import { GlowingEffect } from '../components/ui/glowing-effect';
import { useMarket } from '../stores/marketStore';
import { useMapData, useMarketPulse, usePriceTrend } from '../hooks/useMapData';
import { useDealScout } from '../hooks/useDealScout';
import { useDealScoutStatus } from '../hooks/useDealScoutStatus';
import type { DealOpportunity } from '../hooks/useDealScout';
import { formatTimeAgo, computeConfidence } from '../services/analyticsService';
import { TextHoverEffect } from '../components/ui/text-hover-effect';


import DealScout from '../components/DealScout';
import DashboardErrorBoundary from '../components/DashboardErrorBoundary';
import { useAgentActivity } from '../hooks/useAgentActivity';
import { useQuota } from '../hooks/useQuota';
import { DEMO_MODE } from '../demo/mockData';



/* ═══════════════════════════════════════════════════════════
   Chart Empty State — honest "no data" instead of fake lines
   ═══════════════════════════════════════════════════════════ */

function ChartEmptyState({ icon: Icon, title, message }: { icon: React.ComponentType<{ size: number; className: string }>; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] gap-2 text-center px-6">
      <div className="w-12 h-12 rounded-full border border-border bg-bg-elevated flex items-center justify-center mb-3 shadow-sm">
        <Icon size={24} className="text-text-secondary" />
      </div>
      <p className="text-sm font-semibold text-text-secondary">{title}</p>
      <p className="text-xs text-text-tertiary max-w-[260px] leading-relaxed">{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Chart Skeleton — loading state
   ═══════════════════════════════════════════════════════════ */

function ChartSkeleton() {
  return (
    <div className="h-[200px] rounded-lg animate-pulse bg-bg-surface" />
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate();

  const { isMarketSelected } = useMarket();

  // All data sourced from the unified dashboard hook
  const { properties: liveProperties, error: propertiesError } = useMapData();
  const livePulse = useMarketPulse();
  const { data: dealScout } = useDealScout();
  const { status: scoutStatus } = useDealScoutStatus();

  const { trend: performanceTrend, loading: trendLoading } = usePriceTrend();
  const { tasks: agentTasks } = useAgentActivity();
  const { tasksUsed, taskLimit, percentUsed, shouldAlert } = useQuota();

  const scoreData = useMemo(() => {
    let exc = 0, good = 0, fair = 0, poor = 0;
    liveProperties.forEach(p => {
      const s = p.dealScore || 0;
      if (s >= 7) exc++;
      else if (s >= 4) good++;
      else if (s >= 2) fair++;
      else if (s > 0) poor++;
    });
    return [
      { name: 'Exc', count: exc, fill: 'var(--color-deal-excellent)' },
      { name: 'Good', count: good, fill: 'var(--color-deal-good)' },
      { name: 'Fair', count: fair, fill: 'var(--color-info)' },
      { name: 'Poor', count: poor, fill: 'var(--color-deal-poor)' },
    ];
  }, [liveProperties]);

  const chartTrendData = useMemo(
    () => (performanceTrend ?? []).map(p => ({
      date: p.name,
      soldAvg: p.soldAvg,
      forSaleAvg: p.forSaleAvg,
    })),
    [performanceTrend],
  );
  
  const [offlineState, setOfflineState] = useState<{ isOffline: boolean; dealsAtRisk: number; since: string | null }>({ isOffline: false, dealsAtRisk: 0, since: null });

  useEffect(() => {
    const handleSubscriptionExpired = (e: Event | CustomEvent | any) => {
      console.warn("AGENT FLEET OFFLINE (HTTP 402)");
      const details = e.detail?.details || e.detail || {};
      setOfflineState({
        isOffline: true,
        dealsAtRisk: details.deals_at_risk || 0,
        since: details.offline_since || null
      });
    };
    window.addEventListener('remi:subscription-expired', handleSubscriptionExpired);
    return () => window.removeEventListener('remi:subscription-expired', handleSubscriptionExpired);
  }, []);

  const hasTrendData = performanceTrend && performanceTrend.length > 0 && performanceTrend.some(d => d.soldAvg > 0 || d.forSaleAvg > 0);
  const hasScoreData = scoreData.some(d => d.count > 0);
  const scoreLoading = false;
  const hotDealsCount = scoreData.find(d => d.name === 'Exc')?.count || 0;
  const trendError: string | null = null;
  const scoreError: string | null = null;
  const fetchTrendData = () => {};
  const fetchScoreData = () => {};

  // Broadcast dashboard pulse metrics to VoiceAvatar context
  useEffect(() => {
    if (livePulse.hotDeals > 0 || livePulse.newListings > 0) {
      window.dispatchEvent(new CustomEvent('remi:dashboard-context-update', {
        detail: {
          hotDeals: livePulse.hotDeals,
          newListings: livePulse.newListings,
          priceDrops: livePulse.priceDrops,
          avgDom: livePulse.avgDom,
        }
      }));
    }
  }, [livePulse.hotDeals, livePulse.newListings, livePulse.priceDrops, livePulse.avgDom]);


  // Check if market is selected first
  if (offlineState.isOffline) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-xl w-full border border-red-500/30 bg-red-500/5 p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Agent Fleet Offline</h2>
          <p className="text-text-secondary mb-6 text-sm">
            Your intelligence agents have been paused due to an inactive subscription.
            Reactivate to deploy your workforce and resume market scanning.
          </p>
          <div className="bg-bg-surface border border-border rounded-xl p-4 mb-6">
            <h3 className="text-lg font-bold text-text-primary tracking-tight">{offlineState.dealsAtRisk}+</h3>
            <p className="text-xs text-text-tertiary">High-score deals currently unmonitored</p>
          </div>
          <Button 
            onClick={() => navigate('/billing')} 
            className="w-full bg-red-500 hover:bg-red-600 text-white border-0 shadow-lg"
          >
            Reactivate Agents
          </Button>
        </div>
      </div>
    );
  }

  if (!isMarketSelected && !DEMO_MODE) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="h-20 w-48 mx-auto mb-2">
            <TextHoverEffect text="REMI" />
          </div>
          <h2 className="text-xl font-semibold mb-4">Command Center Standby</h2>
          <p className="text-text-secondary mb-6">
            Select a market to activate your intelligence dashboard. All deal detection, pipeline analysis, and market intelligence will come online.
          </p>
          <Button 
            onClick={() => navigate('/')} 
            className="bg-accent hover:bg-accent/90"
          >
            Select Market
          </Button>
        </div>
      </div>
    );
  }


  // Pipeline: top 3 by deal score across all live listings 
  const pipelineProperties = liveProperties
    .filter(p => p.dealScore != null && p.dealScore >= 8)
    .sort((a, b) => (b.dealScore || 0) - (a.dealScore || 0))
    .slice(0, 3);

  // ─── Computed labels from real data ──────────────────────
  const listingCount = liveProperties.length;
  const lastSyncedRaw = livePulse?.lastSynced;
  const lastUpdated = lastSyncedRaw && lastSyncedRaw !== 'never'
    ? formatTimeAgo(lastSyncedRaw)
    : 'Syncing…';
  const confidence = computeConfidence(listingCount);
  const ppsfLabel = null;

  const chartScoreData = scoreData;

  // Show error state if properties loading failed
  if (propertiesError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-error mb-2">Data Loading Error</h2>
          <p className="text-text-secondary mb-4">{propertiesError}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="secondary"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // Agent activity: last 3 completed tasks
  const recentAgentTasks = [...agentTasks].reverse().slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full">

      {/* ─── Agent Activity Widget ────────────────────────────── */}
      {(recentAgentTasks.length > 0 || shouldAlert || percentUsed > 0) && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Bot size={16} className="text-primary" />
              Agent Activity
            </h2>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated divide-y divide-border">
            {shouldAlert && (
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 bg-red-500/5">
                <AlertTriangle size={12} />
                <span>{tasksUsed.toLocaleString()} / {taskLimit.toLocaleString()} tasks — agents at risk of stopping</span>
                <a href="/billing" className="ml-auto underline hover:no-underline">Upgrade plan</a>
              </div>
            )}
            {recentAgentTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2 px-4 py-2.5 text-xs">
                <CheckCircle2 size={12} className={`mt-0.5 shrink-0 ${task.status === 'failed' ? 'text-red-400' : 'text-emerald-400'}`} />
                <span className="text-text-secondary">
                  {task.agent_name && <span className="font-medium text-text-primary">{task.agent_name} · </span>}
                  {task.action_summary ?? task.task_type}
                </span>
              </div>
            ))}
            {recentAgentTasks.length === 0 && !shouldAlert && (
              <div className="px-4 py-3 text-xs text-text-tertiary">No recent agent activity</div>
            )}
          </div>
          {/* Usage bar */}
          {percentUsed > 0 && (
            <div className="mt-1.5 h-1 w-full rounded-full bg-bg-surface overflow-hidden">
              <div
                className={`h-full rounded-full ${shouldAlert ? 'bg-red-500' : percentUsed >= 0.8 ? 'bg-amber-400' : 'bg-primary'}`}
                style={{ width: `${Math.min(percentUsed * 100, 100)}%` }}
              />
            </div>
          )}
        </section>
      )}

      {/* ─── Today's Market Pulse — LIVE DATA ────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Today's Market Pulse</h2>
          <span className="text-xs text-text-tertiary bg-bg-elevated px-2 py-0.5 rounded-full border border-border">
            {livePulse.lastSynced ? `Market data · Synced ${livePulse.lastSynced.toLowerCase()}` : 'Market data · Syncing...'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricTile
            icon={Flame}
            label="Hot Deals"
            value={livePulse.hotDeals}
            sublabel={`Score ≥ 7.0`}
          />
          <MetricTile
            icon={Home}
            label="New Listings"
            value={livePulse.newListings}
            sublabel={`${listingCount} total tracked`}
          />
          <MetricTile
            icon={TrendingDown}
            label="Price Drops"
            value={livePulse.priceDrops}
            sublabel={livePulse.priceDrops > 0 ? 'Below asking' : 'No drops detected'}
          />
          <MetricTile
            icon={MapPin}
            label="Trending Area"
            value={livePulse.trendingArea || 'Multiple Areas'}
            sublabel={livePulse.avgDom > 0 ? `Avg ${livePulse.avgDom} DOM` : 'Calculating...'}
          />
        </div>
      </section>

        {/* ─── Market Intelligence & Deal Scout ─────────── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Market Intelligence & Deal Scout</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          {/* Deal Scout Opportunities — no GlowingEffect */}
          <DashboardErrorBoundary sectionName="Deal Scout Opportunities">
          <div className="lg:col-span-3 bg-bg-surface border border-border/60 rounded-2xl p-4 h-[360px] flex flex-col relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.1)] transition-shadow duration-500">
            <div className="absolute inset-0 bg-white/20 pointer-events-none rounded-2xl" />
            <div className="absolute top-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crosshair size={15} strokeWidth={1.5} className="text-accent" />
                <h3 className="text-sm font-semibold text-text-primary">Deal Scout Opportunities</h3>
              </div>
              <span className="text-[10px] text-text-tertiary bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-border">
                Powered by REMI AI
              </span>
            </div>

            <div className="relative z-10 w-full flex-1 overflow-y-auto pr-2 pb-2">
              {!dealScout || !dealScout.opportunities || dealScout.opportunities.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6">
                  <div className="max-w-[280px]">
                    <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center mx-auto mb-4 border border-border">
                      <Crosshair size={24} className="text-text-tertiary" />
                    </div>
                    {scoutStatus?.is_active ? (
                      <>
                        <h4 className="text-sm font-medium text-text-primary mb-1">Scanning for Deals</h4>
                        <p className="text-xs text-text-tertiary leading-relaxed">
                          REMI is currently scanning the market for opportunities matching your criteria.
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="text-sm font-medium text-text-primary mb-1">Deal Scout OFF</h4>
                        <p className="text-xs text-text-tertiary leading-relaxed">
                          Toggle Deal Scout ON to automatically scan this market for top investment opportunities.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {dealScout.opportunities.slice(0, 5).map((p: DealOpportunity) => (
                    <button
                      key={p.property_id}
                      className="w-full flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-bg-elevated hover:border-border group transition-all"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {p.address}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-text-secondary font-medium">
                            {p.beds}bd/{p.baths}ba · {p.sqft?.toLocaleString()} sqft
                          </span>
                          {p.dom && (
                            <span className="text-[10px] text-text-tertiary border-l border-border pl-2">
                              DOM: {p.dom}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <span className="text-[11px] text-text-secondary font-medium bg-bg-primary px-2 py-0.5 rounded-md border border-border/50 inline-block">
                            Asking: ${p.price?.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-text-tertiary truncate w-full flex items-center gap-1.5 mt-1">
                            <Crosshair size={12} className="text-success shrink-0" />
                            {p.why}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0 h-full justify-center pl-2 border-l border-border/30">
                        <DealScoreBadge score={p.deal_score ?? 0} size="md" />
                        <span className="text-[10px] text-accent font-medium mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Analyze <ChevronRight size={10} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </DashboardErrorBoundary>

          {/* Deal Scout Config — GlowingEffect wrapper */}
          <div className="lg:col-span-2">
            <div className="relative h-full rounded-2xl border border-border/60 p-2 md:rounded-3xl md:p-3">
              <GlowingEffect
                blur={0}
                borderWidth={2}
                spread={60}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
              />
              <div className="relative flex h-full flex-col overflow-visible rounded-xl bg-bg-surface dark:shadow-[0px_0px_27px_0px_#2D2D2D]">
                <DealScout />
              </div>
            </div>
          </div>

        </div>
      </section>



      {/* ─── Your Deal Pipeline — Prestige Edge-Glow Cards ─────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Your Deal Pipeline</h2>
          {pipelineProperties.length > 0 && (
            <span className="text-[10px] text-text-tertiary bg-bg-elevated border border-border px-2.5 py-1 rounded-full font-medium">
              {pipelineProperties.length} high-score properties
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelineProperties.length > 0 ? (
            pipelineProperties.map((p) => (
              <div key={p.id}>
                <div
                  className="relative rounded-2xl md:rounded-3xl border border-border/60 p-2 md:p-3
                             shadow-[0_2px_16px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.10)] transition-all duration-500"
                >
                  <GlowingEffect blur={0} borderWidth={2} spread={60} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />
                  <div className="relative h-full flex flex-col bg-bg-surface rounded-xl overflow-hidden p-4 group/glowing">
                    <div className="absolute top-0 left-5 right-5 h-px bg-linear-to-r from-transparent via-white/60 to-transparent pointer-events-none" />

                    <div className="flex items-start justify-between mb-3 w-full">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-text-primary truncate">{p.address}</h3>
                        <p className="text-xs text-text-tertiary mt-0.5 truncate">{p.city}, {p.state_province}</p>
                      </div>
                      <DealScoreBadge score={p.dealScore || 0} />
                    </div>

                    <div className="flex items-center justify-between w-full mb-4">
                      <div className="text-lg font-semibold text-text-primary tracking-tight">
                        {p.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                      </div>
                      <div className="flex gap-1.5">
                        {[`${p.bedrooms}bd`, `${p.bathrooms}ba`, p.sqft ? `${Number(p.sqft).toLocaleString()} sqft` : 'N/A sqft'].map(label => (
                          <span key={label} className="text-[10px] px-2 py-0.5 bg-bg-elevated/80 text-text-tertiary rounded-md border border-border/50 font-medium">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="w-full">
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" icon={Eye} className="flex-1" onClick={() => navigate(`/properties/${p.id}`)}>Details</Button>
                        <div className="flex-1 min-w-[110px]">
                          <NoiseBackground
                            containerClassName="w-full p-[2px] rounded-full"
                            gradientColors={[
                              "rgb(200, 160, 120)",
                              "rgb(140, 160, 200)",
                              "rgb(180, 210, 170)",
                            ]}
                          >
                            <button
                              onClick={() => navigate(`/properties/${p.id}`)}
                              className="flex items-center justify-center gap-1.5 h-full w-full cursor-pointer rounded-full bg-linear-to-r from-black via-black to-neutral-900 px-3 py-1.5 text-white/90 hover:text-white shadow-[0px_1px_0px_0px_var(--color-neutral-950)_inset,0px_1px_0px_0px_var(--color-neutral-800)] transition-all duration-150 active:scale-98 text-xs font-medium"
                            >
                              Analyze <ArrowRight size={12} strokeWidth={1.5} />
                            </button>
                          </NoiseBackground>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState 
                icon={Briefcase} 
                title="No pipeline properties yet" 
                message="As REMI finds high-scoring deals matching your criteria, they'll appear here for review."
              />
            </div>
          )}
        </div>
      </section>

      {/* ─── Price Trend & Deal Score Distribution — Bottom, Larger ─── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Market Intelligence</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Price Trend — no GlowingEffect */}
          <DashboardErrorBoundary sectionName="Price Trend ($/sqft)" onRetry={fetchTrendData}>
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-bg-surface p-4 flex flex-col h-[380px] shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-shadow duration-500">
              <div className="relative z-10 w-full mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} strokeWidth={1.5} className="text-text-secondary" />
                  <h3 className="text-xs font-semibold text-text-primary">Price Trend</h3>
                </div>
                <span className="text-[10px] text-text-tertiary font-medium">$/sqft</span>
              </div>
              <div className="relative z-10 w-full mb-2">
                <SourceLabel timestamp={lastUpdated && lastUpdated !== 'never' ? `Updated ${lastUpdated}` : 'Awaiting Market Sync'} sampleSize={listingCount} />
              </div>
              <div className="relative z-10 w-full flex-1">
                {trendLoading ? (
                  <ChartSkeleton />
                ) : trendError ? (
                  <ChartEmptyState icon={TrendingUp} title="Sync Error" message={trendError} />
                ) : !hasTrendData || chartTrendData.length === 0 ? (
                  <ChartEmptyState icon={TrendingUp} title="Awaiting Market Sync" message="Price trend streams in as listings sync from MLS + Zillow." />
                ) : (
                  <div className="flex flex-col h-full justify-end">
                    <div className="h-[220px] mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,37,32,0.06)" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9E8E82' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#9E8E82' }} axisLine={false} tickLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
                          <Tooltip contentStyle={{ background: 'rgba(251,247,240,0.96)', backdropFilter: 'blur(12px)', border: '1px solid rgba(44,37,32,0.10)', borderRadius: 10, fontSize: 11 }} />
                          <Line type="monotone" dataKey="forSaleAvg" stroke="#E8733A" strokeWidth={1.5} dot={{ r: 2, fill: '#E8733A' }} name="For Sale" />
                          <Line type="monotone" dataKey="soldAvg" stroke="#4A9E6B" strokeWidth={1.5} dot={{ r: 2, fill: '#4A9E6B' }} name="Sold" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-text-secondary">{ppsfLabel ? `For Sale ${ppsfLabel} · ${chartTrendData.length}mo` : `${chartTrendData.length} months`}</p>
                      <span className="inline-flex items-center text-[10px] font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">{confidence}% confidence</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DashboardErrorBoundary>

          {/* Deal Score Distribution — no GlowingEffect */}
          <DashboardErrorBoundary sectionName="Deal Score Distribution" onRetry={fetchScoreData}>
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-bg-surface p-4 flex flex-col h-[380px] shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-shadow duration-500">
              <div className="relative z-10 w-full mb-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} strokeWidth={1.5} className="text-text-secondary" />
                  <h3 className="text-xs font-semibold text-text-primary">Deal Score Distribution</h3>
                </div>
              </div>
              <div className="relative z-10 w-full mb-2">
                <SourceLabel timestamp={`Updated ${lastUpdated}`} sampleSize={listingCount} />
              </div>
              <div className="relative z-10 w-full flex-1">
                {scoreLoading ? (
                  <ChartSkeleton />
                ) : scoreError ? (
                  <ChartEmptyState icon={CheckCircle2} title="Sync Error" message={scoreError} />
                ) : !hasScoreData || chartScoreData.length === 0 ? (
                  <ChartEmptyState icon={CheckCircle2} title="Calibrating Deal Scores" message="Distribution populates once the scoring engine processes your market." />
                ) : (
                  <div className="flex flex-col h-full justify-end">
                    <div className="h-[220px] mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartScoreData} margin={{ top: 8, right: 8, bottom: 8, left: -24 }} barSize={28}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(44,37,32,0.06)" />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9E8E82' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#9E8E82' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip cursor={{ fill: 'rgba(44,37,32,0.04)' }} contentStyle={{ background: 'rgba(251,247,240,0.96)', backdropFilter: 'blur(12px)', border: '1px solid rgba(44,37,32,0.10)', borderRadius: 10, fontSize: 11 }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {chartScoreData.map((entry, index) => (
                              <Cell key={`score-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-text-secondary">{chartScoreData.reduce((sum, d) => sum + d.count, 0)} deals analyzed</p>
                      <span className="inline-flex items-center text-[10px] font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">{confidence}% confidence</span>
                    </div>
                    {hotDealsCount > 0 && <p className="text-[10px] text-accent font-medium mt-0.5">{hotDealsCount} hot deals identified</p>}
                  </div>
                )}
              </div>
            </div>
          </DashboardErrorBoundary>

        </div>
      </section>
    </div>
  );
}