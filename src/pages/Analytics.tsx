/* ═══════════════════════════════════════════════════════════
   ANALYTICS — Power-user charts and market intelligence
   Premium Dark Mode Redesign
   ═══════════════════════════════════════════════════════════ */

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { 
  TrendingUp, Activity, Loader2, Target, PieChart as PieChartIcon, Layers, Plus
} from 'lucide-react';
import { useMarketAnalytics } from '../hooks/useMarketAnalytics';

const CHART_TOOLTIP_STYLE = {
  background: 'rgba(253, 252, 248, 0.75)', // matches --color-bg-elevated
  border: '1px solid rgba(255, 255, 255, 0.6)',
  borderRadius: '12px',
  fontSize: '12px',
  color: '#11100F',
  boxShadow: '0 8px 32px rgba(20, 18, 16, 0.12)',
  backdropFilter: 'blur(24px)',
};

const AXIS_TICK = { fontSize: 11, fill: '#8C867C', fontWeight: 500 }; // matches --color-text-tertiary

/* ─── Premium Glass Card ────────────────────────────────── */
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-bg-surface border border-white/60 backdrop-blur-3xl p-5 shadow-lg ${className}`}>
      {/* Internal highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/80 to-transparent" />
      {children}
    </div>
  );
}

export default function Analytics() {
  const { 
    performanceTrend, 
    performanceSummary, 
    tenureBreakdown, 
    tenureSummary, 
    inventoryDistribution, 
    velocityVolume, 
    totalCount, 
    loading, 
    marketName 
  } = useMarketAnalytics();

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary text-text-primary relative">
      {/* Background Texture & Glow effects */}
      <div 
        className="fixed inset-0 opacity-10 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: 'url(/abstract-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }} 
      />
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-bg-primary opacity-50 blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-text-on-accent opacity-50 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 p-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/40 border border-white/60 text-[10px] font-bold tracking-widest uppercase text-text-secondary">
                Market Intelligence
              </span>
              {loading && <Loader2 size={14} className="animate-spin text-accent" />}
            </div>
            <h1 className="text-4xl font-light tracking-tight text-text-primary">
              {marketName} <span className="font-bold text-transparent bg-clip-text bg-linear-to-r from-accent to-accent-tertiary">Analytics</span>
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-text-tertiary font-medium">Verified Active Inventory</p>
            <p className="text-3xl font-bold tracking-tighter text-text-primary">
              {totalCount.toLocaleString()} <span className="text-base font-normal text-text-tertiary">listings</span>
            </p>
          </div>
        </div>

        {totalCount === 0 && !loading ? (
          <GlassCard className="p-16 text-center border-dashed border-border">
            <Target size={48} className="mx-auto text-text-tertiary opacity-50 mb-6" />
            <h3 className="text-2xl font-light text-text-primary mb-2">Awaiting Intelligence Sync</h3>
            <p className="text-text-secondary max-w-md mx-auto leading-relaxed">
              Analytic models require property data. Run a scan in <span className="text-text-primary font-medium">{marketName}</span> to populate these specialized breakdown views.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ─── 1. Market Performance Trend (Line Chart + side KPIs) ─── */}
            <GlassCard className="lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/40 border border-white/60">
                    <TrendingUp size={18} className="text-[#D4A843]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">Market Performance Trend</h3>
                    <p className="text-xs text-text-tertiary mt-1">Asking vs. Sold vs. Top Deals ($/Sqft)</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                <div className="md:col-span-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#fff' }} />
                      <Line type="monotone" dataKey="AskingPrice" name="Asking Price" stroke="#D4A843" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls={true} />
                      <Line type="monotone" dataKey="SoldPrice" name="Sold Price" stroke="#4A9E6B" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls={true} />
                      <Line type="monotone" dataKey="TopDeals" name="Top Deals" stroke="#E8733A" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} connectNulls={true} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="md:col-span-1 flex flex-col justify-center">
                  <ul className="space-y-6">
                    {performanceSummary.map((item) => (
                      <li key={item.name} className="flex space-x-3">
                        <span className={`w-1 shrink-0 rounded ${item.color}`} />
                        <div className="flex w-full items-center justify-between md:block">
                          <p className="order-last font-bold text-text-primary text-lg">{item.value}</p>
                          <p className="order-first text-xs font-medium text-text-secondary">{item.name}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-accent-hover hover:text-accent transition-colors">
                    <Plus size={16} /> Compare Sub-Market
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* ─── 2. Tenure Breakdown (Stacked Bar Chart) ─── */}
            <GlassCard className="flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-white/40 border border-white/60">
                  <Layers size={18} className="text-[#5A7EA6]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Market Inventory by Tenure</h3>
                  <p className="text-xs text-text-tertiary mt-1">Monthly volume of Active vs. Sold</p>
                </div>
              </div>
              
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-8">
                {tenureSummary.map((tab) => (
                  <div key={tab.name} className="rounded-xl border border-border bg-white/20 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tab.color}`} />
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">{tab.name}</p>
                    </div>
                    <p className="mt-1 text-xl font-bold text-text-primary">{tab.value}</p>
                  </div>
                ))}
              </div>
              
              <div className="h-64 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenureBreakdown} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'var(--color-border)' }} />
                    <Bar dataKey="ForSale" name="Active For Sale" stackId="a" fill="#D4A843" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="ForRent" name="Active For Rent" stackId="a" fill="#5A7EA6" />
                    <Bar dataKey="Sold" name="Historical Sold" stackId="a" fill="#4A9E6B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* ─── 3. Asset Allocation (Donut Chart) ─── */}
            <GlassCard className="flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-white/40 border border-white/60">
                  <PieChartIcon size={18} className="text-[#4A9E6B]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Asset Allocation</h3>
                  <p className="text-xs text-text-tertiary mt-1">Inventory distribution by property type</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center flex-1">
                <div className="h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryDistribution}
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="amount"
                        stroke="var(--color-bg-surface)"
                        strokeWidth={2}
                      >
                        {inventoryDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#11100F' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-text-primary">{totalCount.toLocaleString()}</span>
                    <span className="text-[10px] text-text-tertiary uppercase tracking-widest mt-0.5">Total</span>
                  </div>
                </div>
                
                <div>
                  <ul className="space-y-4">
                    {inventoryDistribution.map((item) => (
                      <li key={item.name} className="flex space-x-3 items-center">
                        <span className="w-1.5 h-8 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {item.amount.toLocaleString()} <span className="text-xs font-normal text-text-secondary ml-1">({item.share})</span>
                          </p>
                          <p className="text-xs font-medium text-text-tertiary mt-0.5">{item.name}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </GlassCard>

            {/* ─── 4. Velocity & Volume (Stacked Area Chart) ─── */}
            <GlassCard className="lg:col-span-2 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-white/40 border border-white/60">
                  <Activity size={18} className="text-[#E8733A]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Velocity & Volume</h3>
                  <p className="text-xs text-text-tertiary mt-1">New supply vs. pending vs. closed absorption</p>
                </div>
              </div>
              
              <div className="h-72 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocityVolume} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A843" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#D4A843" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E8733A" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#E8733A" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4A9E6B" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#4A9E6B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} itemStyle={{ color: '#11100F' }} />
                    <Area type="monotone" dataKey="NewListings" name="New Supply" stackId="1" stroke="#D4A843" fill="url(#colorNew)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Pending" name="Absorption (Pending)" stackId="1" stroke="#E8733A" fill="url(#colorPending)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Closed" name="Absorption (Closed)" stackId="1" stroke="#4A9E6B" fill="url(#colorClosed)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

          </div>
        )}
      </div>
    </div>
  );
}
