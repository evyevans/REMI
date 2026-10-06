/* ═══════════════════════════════════════════════════════════
   Layout Components — Header, Tab Navigation, Status Bar
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, Building2, BarChart3,
  Bell, User, RefreshCw, Clock, Home, TrendingUp, Radar, Loader2, MapPin, Brain, Key, LogOut, Bot,
} from 'lucide-react';
import ApiKeysModal from '../ApiKeysModal';
import { NotificationBell } from '../NotificationBell';
import { default as MarketSelector } from './MarketSelector';
import { useMarket, type Market } from '../../stores/marketStore';
import { useJobStore, type AnalysisType } from '../../stores/jobStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

/* ─── MAP HEADER CONTROLS ───────────────────────────────── */

const SCAN_OPTIONS = [
  { id: 'for_sale' as AnalysisType, label: 'For Sale', icon: Home, bg: 'hover:bg-scan-sale-hover/15 text-text-secondary hover:text-scan-sale-hover', active: 'bg-scan-sale text-white shadow-md shadow-scan-sale/20' },
  { id: 'rental' as AnalysisType, label: 'Rental', icon: Building2, bg: 'hover:bg-scan-rent-hover/15 text-text-secondary hover:text-scan-rent-hover', active: 'bg-scan-rent text-white shadow-md shadow-scan-rent/20' },
  { id: 'sold' as AnalysisType, label: 'Sold', icon: TrendingUp, bg: 'hover:bg-scan-sold-hover/15 text-text-secondary hover:text-scan-sold-hover', active: 'bg-scan-sold text-white shadow-md shadow-scan-sold/20' },
  { id: 'comprehensive' as AnalysisType, label: 'Full Scan', icon: Radar, bg: 'hover:bg-scan-full-hover/15 text-text-secondary hover:text-scan-full-hover', active: 'bg-scan-full text-white shadow-md shadow-scan-full/20' },
];

function MapHeaderControls() {
  const location = useLocation();
  const { currentMarket, geographyStatus, resolveGeography } = useMarket();
  const activeJob = useJobStore((s) => currentMarket ? s.getActiveJobForMarket(currentMarket.id) : null);
  const triggerScan = useJobStore((s) => s.triggerScan);
  const { addToast } = useToast();

  // Queue a scan type to fire once geo is ready
  const [queuedScanType, setQueuedScanType] = useState<AnalysisType | null>(null);

  // Auto-fire queued scan once geo becomes ready
  useEffect(() => {
    if (queuedScanType && geographyStatus === 'ready' && !activeJob) {
      triggerScan(queuedScanType);
      setQueuedScanType(null);
    }
  }, [geographyStatus, queuedScanType, activeJob, triggerScan]);

  if (location.pathname !== '/map') return null;
  if (!currentMarket.id) return null;

  const handleScanClick = (opt: typeof SCAN_OPTIONS[number]) => {
    if (activeJob) return;

    if (geographyStatus === 'ready') {
      triggerScan(opt.id);
    } else if (geographyStatus === 'resolving') {
      // Already resolving — queue the scan for when it finishes
      setQueuedScanType(opt.id);
      addToast(`Resolving location… ${opt.label} agent will deploy automatically.`, 'info');
    } else {
      // Not started yet — kick off geo resolution, then queue
      setQueuedScanType(opt.id);
      addToast(`Resolving ${currentMarket.displayName}… ${opt.label} agent will deploy automatically.`, 'info');
      resolveGeography();
    }
  };

  return (
    <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-3">
      {SCAN_OPTIONS.map((opt) => {
        const isRunningThis = activeJob?.analysisType === opt.id;
        const isRunningOther = activeJob !== null && !isRunningThis;
        const isQueued = queuedScanType === opt.id;
        
        // As requested: once you select one of them, the rest of them disappear
        if (isRunningOther) return null;

        return (
          <button
            key={opt.id}
            onClick={() => handleScanClick(opt)}
            disabled={activeJob !== null}
            title={
              isQueued ? 'Waiting for location to resolve…' :
              geographyStatus === 'resolving' ? 'Resolving your location…' : ''
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all border ${
              activeJob ? (isRunningThis ? `${opt.active} border-transparent` : 'opacity-50 cursor-not-allowed border-transparent')
              : isQueued ? `${opt.active} border-transparent opacity-80 animate-pulse`
              : `${opt.bg} border-transparent hover:border-border`
            }`}
          >
            {isRunningThis || isQueued || geographyStatus === 'resolving' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <opt.icon size={13} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── USER MENU ─────────────────────────────────────────── */

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const email = user.email || '';
  const initials = user.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#2C2A28] text-white text-xs font-bold flex items-center justify-center hover:bg-black transition cursor-pointer shadow-sm"
        title={email}
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-64 bg-bg-elevated backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-text-primary truncate">{user.user_metadata?.full_name || 'User'}</p>
              <p className="text-[11px] text-text-tertiary truncate">{email}</p>
            </div>
            <button
              onClick={async () => { setOpen(false); await signOut(); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs text-text-secondary hover:bg-error/10 hover:text-error transition cursor-pointer"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── HEADER ────────────────────────────────────────────── */

type RefreshState = 'idle' | 'loading' | 'success' | 'error';

export function Header() {
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const activeSimJob = useSimulationStore((s) => s.activeJob);

  const handleRefresh = useCallback(() => {
    if (refreshState === 'loading') return;
    setRefreshState('loading');

    // Simulate API refresh (2-3s)
    const duration = 2000 + Math.random() * 1000;
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate for demo
      if (success) {
        setRefreshState('success');
        setToastMessage('Data refreshed — 23 listings, 8 hot deals');
        setTimeout(() => setRefreshState('idle'), 3000);
      } else {
        setRefreshState('error');
        setToastMessage('Refresh failed. Please try again.');
        setTimeout(() => setRefreshState('idle'), 3000);
      }
    }, duration);
  }, [refreshState]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const refreshLabel = {
    idle: 'Refresh Data',
    loading: 'Refreshing...',
    success: 'Refreshed',
    error: 'Retry Refresh',
  }[refreshState];

  const refreshColor = {
    idle: 'text-text-secondary hover:text-accent hover:bg-bg-surface',
    loading: 'text-text-tertiary cursor-not-allowed',
    success: 'text-success hover:bg-bg-surface',
    error: 'text-error hover:text-error hover:bg-bg-surface',
  }[refreshState];

  return (
    <>
      <header className="relative z-50 h-14 bg-bg-elevated border-b border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-text-primary tracking-widest pl-1">REMI</h1>
          <span className="text-xs text-text-tertiary bg-bg-surface px-2 py-0.5 rounded-full ml-1">v2.0</span>
          <div className="h-4 w-px bg-border mx-2" />
          <MarketSelector />
          <MapHeaderControls />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowApiKeys(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-text-secondary hover:text-accent hover:bg-bg-surface"
            title="API Keys"
          >
            <Key size={14} />
            API Keys
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshState === 'loading'}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${refreshColor}`}
          >
            <RefreshCw
              size={14}
              className={refreshState === 'loading' ? 'animate-spin' : ''}
            />
            {refreshLabel}
          </button>

          {activeSimJob && (activeSimJob.status === 'queued' || activeSimJob.status === 'running') && (
            <NavLink
              to="/simulator"
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all"
            >
              <Brain size={14} className="animate-pulse" />
              Simulation {activeSimJob.progress_pct > 0 ? `${activeSimJob.progress_pct}%` : '...'}
            </NavLink>
          )}

          <NotificationBell />

          <UserMenu />
        </div>
      </header>

      {/* Toast notification for refresh result */}
      {toastMessage && (
        <div
          className={`fixed bottom-12 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 toast-enter 
            ${refreshState === 'error' ? 'bg-error text-white' : 'bg-bg-dark text-text-on-accent'}`}
        >
          {refreshState === 'error' ? '✗' : '✓'} {toastMessage}
        </div>
      )}

      {showApiKeys && <ApiKeysModal onClose={() => setShowApiKeys(false)} />}
    </>
  );
}

/* ─── TAB NAVIGATION ────────────────────────────────────── */

const BASE_TABS = [
  { path: '/', label: 'Command Center', icon: LayoutDashboard },
  { path: '/map', label: 'Market Scout', icon: Map },
  { path: '/properties', label: 'Property Grid', icon: Building2 },
  { path: '/agent-memory', label: 'Agent Memory', icon: Bot },
  { path: '/analytics', label: 'Market Intel', icon: BarChart3 },
  { path: '/simulator', label: 'Simulations', icon: Brain },
  { path: '/alerts', label: 'Active Alerts', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
];

export function TabBar() {
  const location = useLocation();
  const TABS = BASE_TABS;
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, top: 0, width: 0, height: 0 });

  // Find active path to keep indicator on it when not hovering
  const activePath = TABS.find(t =>
    t.path === '/' ? location.pathname === '/' : location.pathname.startsWith(t.path)
  )?.path || '/';

  const currentPath = hoveredPath || activePath;

  // Update indicator position whenever currentPath changes
  useEffect(() => {
    const node = tabRefs.current[currentPath];
    if (node) {
      setIndicator({ 
        left: node.offsetLeft, 
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight
      });
    }
  }, [currentPath]);

  // Also recalculate on resize
  useEffect(() => {
    const recalc = () => {
      const node = tabRefs.current[currentPath];
      if (node) {
        setIndicator({ 
          left: node.offsetLeft, 
          top: node.offsetTop,
          width: node.offsetWidth,
          height: node.offsetHeight
        });
      }
    };
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [currentPath]);

  return (
    <nav
      className="relative h-11 bg-bg-elevated border-b border-border flex items-center px-3 shrink-0 overflow-x-auto gap-1.5"
      onMouseLeave={() => setHoveredPath(null)}
    >
      {/* Sliding Indicator Background */}
      <div
        className="absolute top-0 left-0 bg-white border border-border shadow-sm rounded-lg origin-top-left"
        style={{
          width: indicator.width > 0 ? `${indicator.width}px` : '0px',
          height: indicator.height > 0 ? `${indicator.height}px` : '0px',
          transform: `translate(${indicator.left}px, ${indicator.top}px)`,
          opacity: indicator.width > 0 ? 1 : 0,
          pointerEvents: 'none',
          transition: `transform var(--dur-mid) var(--spring), width var(--dur-mid) var(--spring), height var(--dur-mid) var(--spring), opacity var(--dur-fast) var(--smooth)`,
        }}
      />

      {TABS.map(tab => {
        const isActive = tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path);
        const hasIndicator = currentPath === tab.path;

        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            onMouseEnter={() => setHoveredPath(tab.path)}
            ref={(node) => { tabRefs.current[tab.path] = node; }}
            className={
              `relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap
              ${hasIndicator
                ? 'text-black drop-shadow-sm font-semibold'
                : isActive
                  ? 'text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`
            }
            style={{
              transition: `color var(--dur-fast) var(--smooth), font-weight var(--dur-fast)`
            }}
          >
            <tab.icon size={14} className="icon-interactive" />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/* ─── RECENT MARKETS BAR ────────────────────────────────── */
/* Thin strip shown on every tab so users can jump between
   previously scanned markets (New York, Sacramento, SF…)
   without re-opening the full State → City selector.       */

export function RecentMarketsBar() {
  const { recentMarkets, currentMarket, setCurrentMarket } = useMarket();
  
  // Deduplicate by displayName to ensure users only see unique locations
  const uniqueRecentMarkets = useMemo(() => {
    const seen = new Set<string>();
    return recentMarkets.filter((m: Market) => {
      const label = m.city
        ? `${m.city}${m.state_province ? `, ${m.state_province}` : ''}`
        : m.displayName;
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  }, [recentMarkets]);

  // Only render if there's more than one unique market to switch between
  if (uniqueRecentMarkets.length <= 1) return null;

  return (
    <div className="h-8 bg-bg-primary border-b border-border flex items-center gap-2 px-4 overflow-x-auto scrollbar-none shrink-0">
      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider shrink-0 select-none">
        Recent:
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {uniqueRecentMarkets.map((market: Market) => {
          const isActive = market.id === currentMarket.id;
          const label = market.city
            ? `${market.city}${market.state_province ? `, ${market.state_province}` : ''}`
            : market.displayName;
          return (
            <button
              key={market.id}
              onClick={() => setCurrentMarket(market)}
              title={market.displayName}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all border whitespace-nowrap ${
                isActive
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-border-hover hover:text-text-primary hover:bg-bg-surface-hover'
              }`}
            >
              <MapPin size={9} className={isActive ? 'text-accent' : 'text-text-tertiary'} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── STATUS BAR ────────────────────────────────────────── */

export function StatusBar() {
  const location = useLocation();
  const [syncTime, setSyncTime] = useState<string>('2 min ago');

  // Dynamic timestamp: updates every 60 seconds
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 60000);
      setSyncTime(elapsed < 1 ? 'just now' : elapsed === 1 ? '1 min ago' : `${elapsed} min ago`);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-8 bg-bg-elevated border-t border-border flex items-center justify-between px-6 text-[11px] text-text-tertiary shrink-0">
      <div className="flex items-center gap-3">
        <span>Data from MLS + Zillow</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          Last synced: {syncTime}
        </span>
      </div>
      <span className="opacity-60">{location.pathname}</span>
    </footer>
  );
}
