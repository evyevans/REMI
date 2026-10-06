/* ═══════════════════════════════════════════════════════════
   ALERTS — The Guardian System
   Set it. Forget it. Trust it.
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Bell, Plus, Pause, Play, Trash2, Clock, Zap, TrendingDown,
  Flame, ChevronDown, ChevronUp, X, CheckCircle2, AlertTriangle,
  RefreshCw, Star,
} from 'lucide-react';
import type { Alert, AlertConditions } from '../types';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { useMarket } from '../stores/marketStore';
import { getOrCreateUserId } from '../lib/auth-utils';
import { supabase } from '../lib/supabase';
import { DEMO_MODE, MOCK_ALERTS } from '../demo/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ── Trigger condition labels ── */
const TRIGGER_LABELS: Record<string, string> = {
  new_listing:  'New listing',
  price_drop:   'Price drop',
  deal_spike:   'Deal score ≥ threshold',
  status_change:'Status change',
  market_shift: 'Market shift',
};

const TRIGGER_ICONS: Record<string, typeof Bell> = {
  new_listing:  Plus,
  price_drop:   TrendingDown,
  deal_spike:   Flame,
  status_change:RefreshCw,
  market_shift: TrendingDown,
};

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */

const wasTriggeredToday = (ts: string | null): boolean => {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
};

const wasTriggeredThisWeek = (ts: string | null): boolean => {
  if (!ts) return false;
  const week = new Date();
  week.setDate(week.getDate() - 7);
  return new Date(ts) >= week;
};

const formatTimestamp = (ts: string | null): string => {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  if (d.toDateString() === now.toDateString()) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return `${Math.floor(diff / 86400000)} days ago`;
};

/* ══════════════════════════════════════════════════════════
   TOAST — lightweight inline notification
   ══════════════════════════════════════════════════════════ */

interface Toast { id: string; message: string; type: 'success' | 'error' }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const show = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, message, type }]);
    const timeout = setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id));
      timeoutRefs.current.delete(id);
    }, 3500);
    timeoutRefs.current.set(id, timeout);
  };

  useEffect(() => {
    const map = timeoutRefs.current;
    return () => {
      map.forEach((timeout: ReturnType<typeof setTimeout>) => clearTimeout(timeout));
      map.clear();
    };
  }, []);

  return { toasts, success: (m: string) => show(m, 'success'), error: (m: string) => show(m, 'error') };
}

/* ══════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ══════════════════════════════════════════════════════════ */

interface ConfirmProps {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmText = 'Confirm', onConfirm, onCancel }: ConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-primary/80 backdrop-blur-lg"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-bg-elevated rounded-2xl shadow-2xl border border-border p-6 w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-error/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-error" />
          </div>
          <h3 id="confirm-title" className="text-base font-bold text-text-primary">{title}</h3>
        </div>
        <p id="confirm-message" className="text-sm text-text-secondary mb-5 pl-12">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-bg-surface transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium bg-error text-white rounded-lg hover:bg-error/90 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-error"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEW ALERT MODAL
   ══════════════════════════════════════════════════════════ */



const TRIGGER_OPTIONS: { value: AlertConditions['triggerType']; label: string; description: string }[] = [
  { value: 'new_listing',  label: 'New Listing',       description: 'Fresh inventory hits the market' },
  { value: 'price_drop',  label: 'Price Drop',         description: 'Seller reduces asking price' },
  { value: 'deal_spike',  label: 'Deal Score ≥ Target', description: 'Property scores above your threshold' },
];

const ALERT_TEMPLATES = [
  { name: 'Hot Deals',      trigger: 'deal_spike'  as const, score: 8,  label: 'Score ≥ 8 in any neighborhood' },
  { name: 'Price Drops',    trigger: 'price_drop'  as const, score: 0,  label: 'Any property with a price reduction' },
  { name: 'New Listings',   trigger: 'new_listing' as const, score: 0,  label: 'Fresh inventory daily' },
];

interface NewAlertModalProps {
  existingAlerts: Alert[];
  onClose: () => void;
  onCreate: (alert: Omit<Alert, 'id' | 'userId' | 'lastTriggered' | 'createdAt'>) => void;
}

function NewAlertModal({ existingAlerts, onClose, onCreate }: NewAlertModalProps) {
  const { neighborhoods: dynamicNeighborhoods } = useNeighborhoods();
  const [name, setName]       = useState('');
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [triggerType, setTriggerType]     = useState<AlertConditions['triggerType']>('new_listing');
  const [minScore, setMinScore] = useState(7);
  const [maxPrice, setMaxPrice] = useState(500000);
  const [frequency, setFrequency] = useState<Alert['frequency']>('instant');
  const [channel, setChannel]   = useState<Alert['channel']>('both');
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<Alert | null>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleNeighborhood = (n: string) => {
    setNeighborhoods(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);
    setErrors(prev => ({ ...prev, neighborhoods: '' }));
  };

  const applyTemplate = (t: typeof ALERT_TEMPLATES[0]) => {
    setName(t.name);
    setTriggerType(t.trigger);
    if (t.score) setMinScore(t.score);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Alert name is required';
    if (name.length > 100) e.name = 'Alert name is too long (max 100 characters)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const checkDuplicate = (): Alert | null => {
    return existingAlerts.find(a =>
      a.conditions.triggerType === triggerType &&
      JSON.stringify(a.conditions.neighborhoods?.sort()) === JSON.stringify([...neighborhoods].sort())
    ) ?? null;
  };

  const handleCreate = () => {
    if (!validate()) return;
    const dup = checkDuplicate();
    if (dup) { setDuplicate(dup); return; }

    const conditions: AlertConditions = {
      triggerType,
      neighborhoods,
      ...(triggerType === 'deal_spike' && { minDealScore: minScore }),
      ...(triggerType === 'price_drop' && maxPrice && { priceMax: maxPrice }),
    };

    onCreate({ name: name.trim(), conditions, frequency, channel, status: 'active' });
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-bg-primary/80 backdrop-blur-lg p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-bg-elevated rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-text-primary">Create Alert</h2>
            <p className="text-xs text-text-tertiary mt-0.5">REMI will watch the market 24/7 and notify you instantly</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-surface transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Close dialog"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Duplicate warning */}
          {duplicate && (
            <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-xl text-sm">
              <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary">Similar alert already exists</p>
                <p className="text-text-secondary text-xs mt-0.5">"{duplicate.name}" monitors the same trigger + neighborhoods. Create anyway?</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setDuplicate(null); }} className="text-xs underline text-text-secondary cursor-pointer">Edit mine instead</button>
                  <button
                    onClick={() => {
                      setDuplicate(null);
                      const conditions: AlertConditions = { triggerType, neighborhoods, ...(triggerType === 'deal_spike' && { minDealScore: minScore }) };
                      onCreate({ name: name.trim(), conditions, frequency, channel, status: 'active' });
                    }}
                    className="text-xs underline text-accent cursor-pointer"
                  >Create anyway</button>
                </div>
              </div>
            </div>
          )}

          {/* Quick templates */}
          <div>
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Quick Templates</p>
            <div className="flex flex-wrap gap-2">
              {ALERT_TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:border-accent hover:text-accent transition-all cursor-pointer text-text-secondary"
                >
                  <Star size={10} className="inline mr-1 text-accent" />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1: Name */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Alert Name
            </label>
            <input
              type="text"
              placeholder="e.g., Hot Deals in Brickell"
              className={`w-full border rounded-xl px-4 py-3 text-sm bg-bg-surface text-text-primary placeholder:text-text-tertiary outline-none transition ${
                errors.name ? 'border-error' : 'border-border focus:border-accent'
              }`}
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
              maxLength={100}
            />
            {errors.name && <p className="text-xs text-error mt-1">{errors.name}</p>}
            <p className="text-xs text-text-tertiary mt-1">Max 100 characters</p>
          </div>

          {/* Step 2: Trigger */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Trigger When
            </label>
            <div className="space-y-2">
              {TRIGGER_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    triggerType === opt.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-border-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={opt.value}
                    checked={triggerType === opt.value}
                    onChange={() => setTriggerType(opt.value)}
                    className="accent-accent"
                  />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{opt.label}</p>
                    <p className="text-xs text-text-tertiary">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Conditional: deal score threshold */}
            {triggerType === 'deal_spike' && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-text-secondary whitespace-nowrap">Minimum deal score:</label>
                <input
                  type="range" min={5} max={10} value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-sm font-bold text-accent w-5 text-right">{minScore}</span>
              </div>
            )}

            {/* Conditional: price cap for drops */}
            {triggerType === 'price_drop' && (
              <div className="mt-3">
                <label className="text-xs text-text-secondary block mb-1">Max price (optional)</label>
                <input
                  type="number" step={50000} value={maxPrice}
                  onChange={e => setMaxPrice(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary outline-none focus:border-accent"
                />
              </div>
            )}
          </div>

          {/* Step 2b: Neighborhoods */}
          <div>
            <label className={`block text-sm font-semibold text-text-primary mb-2 ${errors.neighborhoods ? 'text-error' : ''}`}>
              Neighborhoods
            </label>
            <div className="flex flex-wrap gap-2">
              {dynamicNeighborhoods.map(n => (
                <div
                  key={n.name}
                  onClick={() => { toggleNeighborhood(n.name); setErrors(p => ({ ...p, neighborhoods: '' })); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors
                    ${neighborhoods.includes(n.name) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-bg-surface text-text-secondary border border-border hover:border-text-tertiary'}
                  `}
                >
                  {n.name}
                </div>
              ))}
            </div>
            {errors.neighborhoods && <p className="text-xs text-error mt-1">{errors.neighborhoods}</p>}
          </div>

          {/* Step 3: Frequency + Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as Alert['frequency'])}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-bg-surface text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily (8am)</option>
                <option value="weekly">Weekly (Mon)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Notify via</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value as Alert['channel'])}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-bg-surface text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="both">Email + In-app</option>
                <option value="in-app">In-app only</option>
                <option value="email">Email only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-6 border-t border-border bg-bg-elevated shrink-0">
          <button
            onClick={handleCreate}
            className="flex-1 bg-accent text-text-on-accent py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={!name.trim()}
          >
            Create Alert
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-border rounded-xl text-sm font-medium hover:bg-bg-surface transition-all cursor-pointer text-text-secondary focus:outline-none focus:ring-2 focus:ring-border"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */


export default function Alerts() {
  const { currentMarket } = useMarket();
  const [alerts, setAlerts]         = useState<Alert[]>([]);
  const [events, setEvents]         = useState<Record<string, { address: string; when: string }[]>>({});
  const [loading, setLoading]       = useState<boolean>(true);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<'all' | 'active' | 'paused'>('all');
  const [showModal, setShowModal]   = useState(false);
  const [histories, setHistories]   = useState<Record<string, boolean>>({});
  const [confirm, setConfirm]       = useState<{ id: string; name: string } | null>(null);
  const [operatingIds, setOperatingIds] = useState<Set<string>>(new Set());
  const { toasts, success, error: showError }  = useToast();

  const fetchAlerts = useCallback(async (isMounted: { current: boolean } = { current: true }) => {
    if (DEMO_MODE) {
      if (isMounted.current) {
        setAlerts(MOCK_ALERTS);
        setError(null);
        setLoading(false);
      }
      return;
    }
    if (!currentMarket?.id) {
      setError('No market selected');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const userId = getOrCreateUserId();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        'x-user-id': userId,
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      // 1. Fetch rules
      const rulesRes = await fetch(`${API_BASE}/api/v1/alerts?market_slug=${currentMarket.id}`, {
        headers: authHeaders
      });

      if (!rulesRes.ok) {
        let errorMsg = `API error: ${rulesRes.status}`;
        try {
          const errorData = await rulesRes.json();
          errorMsg = errorData.detail || errorMsg;
        } catch {
          // Response was not JSON, use default error
        }

        // Transform raw HTTP errors into human-readable messages
        if (rulesRes.status === 500) {
          errorMsg = "We're having trouble loading your alerts right now. Your alerts are saved and monitoring — try refreshing in a moment.";
        } else if (rulesRes.status === 401) {
          errorMsg = "Your session has expired. Please sign in again to view your alerts.";
        } else if (rulesRes.status === 400) {
          errorMsg = "Invalid request. Please make sure you have a market selected.";
        }

        throw new Error(errorMsg);
      }

      const rulesData = await rulesRes.json();
      const dbAlerts = rulesData.alerts || [];

      if (!isMounted.current) return;

      const mappedAlerts = dbAlerts.map((d: { id: string; user_id: string; name: string; trigger_type: 'new_listing' | 'price_drop' | 'deal_spike'; neighborhoods: string[]; min_deal_score: number; is_active: boolean; created_at: string; frequency: 'instant' | 'daily' | 'weekly'; notify_via: 'both' | 'in-app' | 'email' }) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        conditions: {
          triggerType: d.trigger_type,
          neighborhoods: d.neighborhoods,
          minDealScore: d.min_deal_score,
        },
        status: d.is_active ? 'active' : 'paused',
        lastTriggered: d.created_at,
        frequency: d.frequency,
        channel: d.notify_via,
        createdAt: d.created_at,
      }));

      setAlerts(mappedAlerts);

      // 2. Fetch notifications mapping to rules
      try {
        const notifRes = await fetch(`${API_BASE}/api/v1/alerts/notifications`, {
          headers: authHeaders
        });

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          const dbNotifs = notifData.notifications || [];

          const eventMap: Record<string, { address: string; when: string }[]> = {};
          dbNotifs.forEach((n: { rule_id: string; session_properties?: { address: string }; created_at: string }) => {
            if (!eventMap[n.rule_id]) eventMap[n.rule_id] = [];
            if (n.session_properties) {
              eventMap[n.rule_id].push({
                address: n.session_properties.address,
                when: formatTimestamp(n.created_at)
              });
            }
          });

          if (isMounted.current) {
            setEvents(eventMap);
          }
        }
      } catch (notifErr) {
        console.warn('[Alerts] Failed to load notifications:', notifErr);
        // Don't fail the entire operation for notifications
      }

      if (isMounted.current) {
        setLoading(false);
      }
    } catch(err) {
      console.error('[Alerts] Fetch failed', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load alerts';
      if (isMounted.current) {
        setError(errorMsg);
        setLoading(false);
      }
    }
  }, [currentMarket?.id]);

  useEffect(() => {
    const isMounted = { current: true };
    fetchAlerts(isMounted);
    return () => {
      isMounted.current = false;
    };
  }, [fetchAlerts]);

  /* ── Persist filter across route changes ── */
  useEffect(() => {
    const stored = localStorage.getItem('remi_alert_filter') as 'all' | 'active' | 'paused' | null;
    if (stored) setFilter(stored);
  }, []);
  useEffect(() => {
    localStorage.setItem('remi_alert_filter', filter);
  }, [filter]);

  /* ── Derived stats (dynamic, not hardcoded) ── */
  const stats = useMemo(() => ({
    active:    alerts.filter(a => a.status === 'active').length,
    today:     alerts.filter(a => wasTriggeredToday(a.lastTriggered)).length,
    thisWeek:  alerts.filter(a => wasTriggeredThisWeek(a.lastTriggered)).length,
    total:     alerts.length,
  }), [alerts]);

  const filteredAlerts = useMemo(() => 
    alerts.filter(a => filter === 'all' ? true : a.status === filter),
    [alerts, filter]
  );

  /* ── Pause / Resume ── */
  const handleToggle = async (id: string) => {
    if (operatingIds.has(id)) return; // Prevent double-click

    const a = alerts.find(x => x.id === id);
    if (!a) return;

    const newStatus = a.status !== 'active';
    const previousAlerts = alerts;

    setOperatingIds(prev => new Set([...prev, id]));

    // Optimistic update
    setAlerts(prev => prev.map(alert =>
      alert.id === id ? {...alert, status: newStatus ? 'active' : 'paused'} : alert
    ));

    try {
      const userId = getOrCreateUserId();
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId
      };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE}/api/v1/alerts/${id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ is_active: newStatus })
      });

      if (!response.ok) {
        throw new Error(`Failed to update alert: ${response.status}`);
      }

      success(newStatus ? `"${a.name}" activated` : `"${a.name}" paused`);
    } catch (err) {
      // Revert optimistic update on error
      setAlerts(previousAlerts);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update alert', err);
      showError('Failed to update alert: ' + errorMsg);
    } finally {
      setOperatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  /* ── Delete (with confirmation) ── */
  const confirmDelete = (id: string, name: string) => setConfirm({ id, name });

  const handleDelete = async () => {
    if (!confirm || operatingIds.has(confirm.id)) return;

    const confirmCopy = confirm;
    setConfirm(null);
    setOperatingIds(prev => new Set([...prev, confirmCopy.id]));

    try {
      const userId = getOrCreateUserId();
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        'x-user-id': userId
      };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_BASE}/api/v1/alerts/${confirmCopy.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to delete alert: ${response.status}`);
      }

      success(`"${confirmCopy.name}" deleted`);
      fetchAlerts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete alert', err);
      showError('Failed to delete alert: ' + errorMsg);
    } finally {
      setOperatingIds(prev => {
        const next = new Set(prev);
        next.delete(confirmCopy.id);
        return next;
      });
    }
  };

  /* ── Create new alert ── */
  const handleCreate = async (draft: Omit<Alert, 'id' | 'userId' | 'lastTriggered' | 'createdAt'>) => {
    if (!currentMarket?.id) {
      showError('No market selected');
      return;
    }

    const userId = getOrCreateUserId();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId
      };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_BASE}/api/v1/alerts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: draft.name,
          trigger_type: draft.conditions.triggerType,
          neighborhoods: draft.conditions.neighborhoods || [],
          min_deal_score: draft.conditions.minDealScore || 0,
          frequency: draft.frequency,
          notify_via: draft.channel,
          market_slug: currentMarket.id
        })
      });

      if (!res.ok) {
        let errorMsg = 'Create failed';
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorMsg;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg);
      }

      setShowModal(false);
      success(`"${draft.name}" created — REMI is now watching`);
      fetchAlerts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to create alert', err);
      showError('Failed to create alert: ' + errorMsg);
    }
  };

  /* ── Toggle trigger history ── */
  const toggleHistory = async (id: string) => {
    setHistories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /* ══════════════════════ RENDER ═════════════════════════ */

  if (loading && alerts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Alerts</h1>
              <p className="text-xs text-text-tertiary mt-0.5">Loading your alerts...</p>
            </div>
          </div>

          {/* Loading skeleton — 3 alert card placeholders */}
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="bg-bg-elevated border border-border rounded-xl p-5 animate-pulse h-24 flex items-start justify-between gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-bg-surface rounded w-3/4" />
                  <div className="h-3 bg-bg-surface rounded w-1/2" />
                </div>
                <div className="h-8 bg-bg-surface rounded w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Alerts</h1>
              <p className="text-xs text-text-tertiary mt-0.5">Unable to load</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mb-6">
              <AlertTriangle size={40} className="text-error" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Unable to Load Alerts</h3>
            <p className="text-sm text-text-secondary mb-8 text-center max-w-sm leading-relaxed">
              {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchAlerts();
              }}
              className="bg-accent text-text-on-accent px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent flex items-center gap-2"
            >
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Alerts</h1>
            <p className="text-xs text-text-tertiary mt-0.5">REMI monitors the market 24/7 and notifies you the moment conditions are met</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-accent text-text-on-accent px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed border border-accent/30"
            disabled={alerts.length >= 20}
            aria-label="Create new alert"
            title={alerts.length >= 20 ? `Alert limit reached: ${alerts.length}/20` : 'Create new alert'}
          >
            <Plus size={16} strokeWidth={2.5} /> New Alert {alerts.length >= 20 && `(${alerts.length}/20)`}
          </button>
        </div>

        {/* ── Summary cards — only shown once there's something to count ── */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" role="region" aria-label="Alert statistics">
            {[
              { icon: Zap,   label: 'Active',    value: stats.active,   onClick: () => setFilter('active'), ariaLabel: `${stats.active} active alerts` },
              { icon: Clock, label: 'Today',     value: stats.today,    onClick: () => setFilter('all'), ariaLabel: `${stats.today} alerts triggered today` },
              { icon: Bell,  label: 'This Week', value: stats.thisWeek, onClick: () => setFilter('all'), ariaLabel: `${stats.thisWeek} alerts triggered this week` },
              { icon: Bell,  label: 'Total',     value: stats.total,    onClick: () => setFilter('all'), ariaLabel: `${stats.total} total alerts` },
            ].map(({ icon: Icon, label, value, onClick, ariaLabel }) => (
              <button
                key={label}
                onClick={onClick}
                className="bg-bg-elevated border border-border rounded-xl p-4 text-left hover:border-border-hover transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={ariaLabel}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon size={14} className="text-accent" />
                  </div>
                  <span className="text-xs text-text-tertiary font-medium">{label}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary group-hover:text-accent transition-colors">{value}</p>
              </button>
            ))}
          </div>
        )}


        {/* ── Filter tabs ── */}
        <div className="flex gap-2" role="tablist">
          {(['all', 'active', 'paused'] as const).map(f => {
            const count = f === 'all' ? alerts.length : alerts.filter(a => a.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                role="tab"
                aria-selected={filter === f}
                aria-label={`${f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} alerts (${count})`}
                className={`px-5 py-2 text-[13px] font-bold rounded-full border transition-all capitalize cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent ${
                  filter === f
                    ? 'bg-accent text-text-on-accent border-accent shadow-md shadow-accent/20'
                    : 'bg-bg-surface border-border text-text-primary hover:bg-bg-surface-hover hover:border-accent/40 shadow-sm'
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Alert list or empty state ── */}
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-5">
              <Bell size={36} className="text-accent" />
            </div>
            <h3 className="text-xl font-black text-text-primary mb-3">
              {filter === 'all' ? 'No Alerts Yet' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Alerts`}
            </h3>
            <p className="text-[15px] text-text-secondary font-medium tracking-wide mb-8 text-center max-w-sm leading-relaxed">
              {filter === 'all'
                ? 'Create an alert and REMI will notify you the moment a matching property appears.'
                : `You have no ${filter} alerts right now.`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-accent text-text-on-accent px-8 py-3.5 rounded-2xl text-[15px] font-black hover:bg-accent-hover transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent shadow-2xl shadow-accent/30 border border-accent/50 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
              >
                <Plus size={20} strokeWidth={3} /> Create Your First Alert
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3" role="list">
            {filteredAlerts.map(alert => {
              const TriggerIcon = TRIGGER_ICONS[alert.conditions.triggerType] || Bell;
              const history = events[alert.id] ?? [];
              const isOwnHistory = histories[alert.id];

              return (
                <article
                  key={alert.id}
                  className="bg-bg-elevated border border-border rounded-xl p-5 hover:border-border-hover transition-all"
                  role="listitem"
                  aria-label={`Alert: ${alert.name} (${alert.status})`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Icon + Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                        <TriggerIcon size={16} className="text-accent" />
                      </div>
                      <div className="min-w-0">
                        {/* Name + status badge */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary">{alert.name}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            alert.status === 'active'
                              ? 'bg-success/10 text-success'
                              : 'bg-bg-surface text-text-tertiary border border-border'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${alert.status === 'active' ? 'bg-success' : 'bg-text-tertiary'}`} />
                            {alert.status === 'active' ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Conditions summary */}
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {alert.conditions.neighborhoods?.length
                            ? alert.conditions.neighborhoods.join(', ')
                            : 'All neighborhoods'}
                          {alert.conditions.minDealScore && ` · Score ≥ ${alert.conditions.minDealScore}`}
                          {alert.conditions.priceMax && ` · Under $${alert.conditions.priceMax >= 1000000 ? (alert.conditions.priceMax / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M' : (alert.conditions.priceMax / 1000).toFixed(0) + 'K'}`}
                        </p>
                        <p className="text-[11px] text-text-tertiary mt-0.5">
                          {TRIGGER_LABELS[alert.conditions.triggerType]}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-text-tertiary">
                          <span className="capitalize">
                            Frequency: <span className="font-medium text-text-secondary">{alert.frequency}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            Last triggered: <span className="font-medium text-text-secondary ml-1">{formatTimestamp(alert.lastTriggered)}</span>
                          </span>
                          {history.length > 0 && (
                            <span className="text-success font-medium">
                              <CheckCircle2 size={10} className="inline mr-0.5" />
                              {history.length} match{history.length !== 1 ? 'es' : ''} found
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggle(alert.id)}
                        disabled={operatingIds.has(alert.id)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title={alert.status === 'active' ? 'Pause' : 'Resume'}
                        aria-label={alert.status === 'active' ? 'Pause alert' : 'Resume alert'}
                      >
                        {alert.status === 'active'
                          ? <Pause size={12} className="text-text-secondary" />
                          : <Play size={12} className="text-text-secondary" />}
                      </button>
                      <button
                        onClick={() => confirmDelete(alert.id, alert.name)}
                        disabled={operatingIds.has(alert.id)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-error hover:text-error transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                        aria-label="Delete alert"
                      >
                        <Trash2 size={12} className="text-text-secondary" />
                      </button>
                    </div>
                  </div>

                  {/* Trigger history toggle */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => toggleHistory(alert.id)}
                      className="flex items-center gap-1.5 text-xs text-accent hover:underline cursor-pointer"
                    >
                      {isOwnHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {isOwnHistory ? 'Hide' : 'Show'} trigger history
                      {history.length > 0 && <span className="text-text-tertiary">({history.length})</span>}
                    </button>

                    {isOwnHistory && (
                      <div className="mt-3 space-y-2">
                        {history.length === 0 ? (
                          <p className="text-xs text-text-tertiary italic">No triggers recorded yet</p>
                        ) : (
                          history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-bg-surface rounded-lg">
                              <span className="text-xs text-text-primary font-medium truncate mr-3">{h.address}</span>
                              <span className="text-xs text-text-tertiary whitespace-nowrap">{h.when}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <NewAlertModal
          existingAlerts={alerts}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete Alert?`}
          message={`Are you sure you want to delete "${confirm.name}"? This cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Toast stack ── */}
      <div className="fixed bottom-16 right-4 z-10000 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto ${
              t.type === 'success'
                ? 'bg-success text-white'
                : 'bg-error text-white'
            }`}
            style={{ animation: 'remi-fade-up 0.2s ease-out' }}
          >
            {t.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}