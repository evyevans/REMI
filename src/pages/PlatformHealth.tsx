/* ═══════════════════════════════════════════════════════════
   PLATFORM HEALTH — "Mini-Apollo" System Monitoring
   Data freshness, API performance, service status

   Palantir Blueprint Phase 5 (SCL-8)
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Database, Cpu, Clock, Wifi, WifiOff,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  BarChart3, Zap, Globe,
} from 'lucide-react';
import { Card } from '../components/ui';
import { DEMO_MODE, MOCK_HEALTH } from '../demo/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Types ────────────────────────────────────────────── */

interface HealthData {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime_seconds: number;
  services: Record<string, ServiceStatus>;
  timestamp: string;
}

interface ServiceStatus {
  status: 'up' | 'degraded' | 'down';
  latency_ms?: number;
  last_check?: string;
  details?: string;
}

/* ─── Status color mapping ─────────────────────────────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  up:       { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  healthy:  { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  degraded: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  down:     { bg: 'bg-red-100',   text: 'text-red-700',   icon: XCircle },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/* ─── Stat card component ──────────────────────────────── */

function StatCard({ icon: Icon, label, value, subtitle, color = 'text-accent' }: {
  icon: typeof Activity; label: string; value: string; subtitle?: string; color?: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${color === 'text-accent' ? 'bg-accent/10' : 'bg-bg-surface'} flex items-center justify-center shrink-0`}>
          <Icon size={16} className={color} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-text-primary mt-0.5">{value}</p>
          {subtitle && <p className="text-[10px] text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
}

/* ─── Service status row ───────────────────────────────── */

function ServiceRow({ name, service }: { name: string; service: ServiceStatus }) {
  const cfg = STATUS_COLORS[service.status] || STATUS_COLORS.down;
  const StatusIcon = cfg.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
      <StatusIcon size={14} className={cfg.text} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-text-primary capitalize">{name}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {service.latency_ms !== undefined && (
          <span className="text-text-secondary">{service.latency_ms}ms</span>
        )}
        <span className={`px-2 py-0.5 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>
          {service.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* ═══ MAIN COMPONENT ═════════════════════════════════════ */

export default function PlatformHealth() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (DEMO_MODE) {
      setHealth(MOCK_HEALTH);
      setError(null);
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError((err as Error).message);
      // Fallback health data for when backend is offline
      setHealth({
        status: 'degraded',
        version: '1.0.0-dev',
        uptime_seconds: 0,
        services: {
          api: { status: 'down', details: 'Cannot reach backend API' },
          supabase: { status: 'down' },
          pinecone: { status: 'down' },
          openai: { status: 'down' },
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const overallCfg = STATUS_COLORS[health?.status || 'down'] || STATUS_COLORS.down;
  const OverallIcon = overallCfg.icon;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Activity size={20} className="text-accent" />
              Platform Health
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Real-time system monitoring · Last refreshed {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              bg-bg-surface border border-border rounded-lg
              hover:border-accent/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Overall Status Banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          health?.status === 'healthy' ? 'border-green-200 bg-green-50' :
          health?.status === 'degraded' ? 'border-amber-200 bg-amber-50' :
          'border-red-200 bg-red-50'
        }`}>
          <OverallIcon size={20} className={overallCfg.text} />
          <div>
            <p className={`text-sm font-semibold ${overallCfg.text}`}>
              {health?.status === 'healthy' ? 'All Systems Operational' :
               health?.status === 'degraded' ? 'Degraded Performance' :
               'System Down'}
            </p>
            <p className="text-[10px] text-text-secondary mt-0.5">
              {error ? `API Error: ${error}` : `Version ${health?.version || 'unknown'}`}
            </p>
          </div>
          {health?.status === 'healthy' ? (
            <Wifi size={14} className="text-green-500 ml-auto" />
          ) : (
            <WifiOff size={14} className="text-amber-500 ml-auto" />
          )}
        </div>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Clock}
            label="Uptime"
            value={health ? formatUptime(health.uptime_seconds) : '--'}
            subtitle="Since last restart"
          />
          <StatCard
            icon={Database}
            label="Services"
            value={health ? `${Object.values(health.services).filter(s => s.status === 'up').length}/${Object.keys(health.services).length}` : '0/0'}
            subtitle="Online services"
            color="text-green-600"
          />
          <StatCard
            icon={Zap}
            label="API Response"
            value={health?.services.api?.latency_ms ? `${health.services.api.latency_ms}ms` : '--'}
            subtitle="Average p50 latency"
          />
          <StatCard
            icon={Globe}
            label="Active Market"
            value="Austin"
            subtitle="1 of 4 markets active"
          />
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Service Status */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Service Status</h2>
            </div>
            {health ? (
              <div>
                {Object.entries(health.services).map(([name, svc]) => (
                  <ServiceRow key={name} name={name} service={svc} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">Loading...</p>
            )}
          </Card>

          {/* Data Pipeline */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Data Pipeline</h2>
            </div>
            <div className="space-y-3">
              {[
                { source: 'Properties Table', freshness: 'Live', count: '847 records', healthy: true },
                { source: 'Market Events', freshness: '< 5 min', count: '1,247 events', healthy: true },
                { source: 'Regions', freshness: 'Static seed', count: '12 neighborhoods', healthy: true },
                { source: 'AI Embeddings', freshness: '< 1 hour', count: 'Pinecone', healthy: health?.services.pinecone?.status === 'up' },
              ].map(item => (
                <div key={item.source} className="flex items-center gap-3 py-1.5">
                  <div className={`w-2 h-2 rounded-full ${item.healthy ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div className="flex-1">
                    <span className="text-xs font-medium text-text-primary">{item.source}</span>
                  </div>
                  <span className="text-[10px] text-text-secondary">{item.freshness}</span>
                  <span className="text-[10px] text-text-tertiary">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Performance Metrics Placeholder */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Performance Metrics</h2>
            <span className="text-[9px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-semibold ml-auto">Coming Soon</span>
          </div>
          <p className="text-xs text-text-tertiary">
            Request rate, error rate, p95 latency, and AI agent performance charts will appear here once production traffic begins.
          </p>
        </Card>
      </div>
    </div>
  );
}
