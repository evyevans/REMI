/* ═══════════════════════════════════════════════════════════
   API KEYS — White-Glove Configuration Panel
   Plug-and-play key management for enterprise deployments
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  X, Eye, EyeOff, Check, AlertTriangle, Key,
  Bell, Shield, Loader2, ExternalLink, Zap, Copy
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/auth-utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ── Key Group Definitions ───────────────────────────────── */

interface KeyDef {
  id: string;
  label: string;
  placeholder: string;
  required?: boolean;
  helpUrl?: string;
  helpText?: string;
  isGenerated?: boolean;
}

interface KeyGroup {
  title: string;
  icon: typeof Key;
  description: string;
  keys: KeyDef[];
}

const KEY_GROUPS: KeyGroup[] = [
  {
    title: 'System Access',
    icon: Shield,
    description: 'Provide secure access to your REMI system for external agents',
    keys: [
      { id: 'REMI_API_KEY', label: 'REMI Integration Key', placeholder: 'remi_sk_...', helpText: 'Generate a key to connect external Agentic OS systems', isGenerated: true }
    ]
  },
  {
    title: 'Notifications & Identity',
    icon: Bell,
    description: 'Account integrations and alert delivery channels',
    keys: [
      { id: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token', placeholder: 'xoxb-...', helpUrl: 'https://api.slack.com/apps', helpText: 'Team notifications via Slack' },
      { id: 'SLACK_CHANNEL_ID', label: 'Slack Channel ID', placeholder: 'C0...' },
      { id: 'GMAIL_USER', label: 'Google Configuration', placeholder: 'alerts@yourdomain.com', helpText: 'Google API integration email' },
    ],
  },
];

const ALL_KEY_IDS = KEY_GROUPS.flatMap(g => g.keys.map(k => k.id));

/* ── Component ───────────────────────────────────────────── */

interface ApiKeysModalProps {
  onClose: () => void;
}

export default function ApiKeysModal({ onClose }: ApiKeysModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>('System Access');
  const [testResults, setTestResults] = useState<Record<string, { valid: boolean; message: string; loading: boolean }>>({});

  /* ── Load existing keys ─────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const userId = getOrCreateUserId();
        const { data } = await supabase
          .from('user_api_keys')
          .select('key_name, key_value')
          .eq('user_id', userId);

        if (data) {
          const map: Record<string, string> = {};
          data.forEach((row: { key_name: string; key_value: string }) => {
            map[row.key_name] = row.key_value;
          });
          setValues(map);
        }
      } catch (err) {
        console.error('[ApiKeys] Load failed:', err);
        // Non-fatal — user hasn't saved keys yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── Escape to close ────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* ── Save all keys via backend API ─────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const userId = getOrCreateUserId();
      const keysPayload = ALL_KEY_IDS
        .filter(id => values[id]?.trim())
        .map(id => ({
          key_name: id,
          key_value: values[id].trim(),
        }));

      if (keysPayload.length > 0) {
        const resp = await fetch(`${API_BASE}/api/v1/keys/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({ keys: keysPayload }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          throw new Error(errBody.message || `Save failed (${resp.status})`);
        }
      }

      // Also persist locally to Supabase for the frontend reads
      const rows = ALL_KEY_IDS
        .filter(id => values[id]?.trim())
        .map(id => ({
          user_id: getOrCreateUserId(),
          key_name: id,
          key_value: values[id].trim(),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        await (supabase.from('user_api_keys') as any)
          .upsert(rows, { onConflict: 'user_id,key_name' });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      console.error('[ApiKeys] Save error:', err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [values]);

  /* ── Test a specific key via backend ────────────────────── */
  const handleTestKey = useCallback(async (keyId: string) => {
    setTestResults(prev => ({ ...prev, [keyId]: { valid: false, message: 'Testing...', loading: true } }));
    try {
      const userId = getOrCreateUserId();
      const resp = await fetch(`${API_BASE}/api/v1/keys/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          key_name: keyId,
          key_value: values[keyId]?.trim() || null,
        }),
      });

      if (resp.ok) {
        const result = await resp.json();
        setTestResults(prev => ({ ...prev, [keyId]: { valid: result.valid, message: result.message, loading: false } }));
      } else {
        setTestResults(prev => ({ ...prev, [keyId]: { valid: false, message: 'Test request failed', loading: false } }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [keyId]: { valid: false, message: 'Connection error', loading: false } }));
    }

    // Clear result after 5s
    setTimeout(() => {
      setTestResults(prev => {
        const next = { ...prev };
        delete next[keyId];
        return next;
      });
    }, 5000);
  }, [values]);

  /* ── Helpers ────────────────────────────────────────────── */
  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const maskValue = (val: string) => {
    if (!val || val.length < 8) return '••••••••';
    return val.slice(0, 4) + '•'.repeat(Math.min(val.length - 8, 20)) + val.slice(-4);
  };

  const configuredCount = ALL_KEY_IDS.filter(id => values[id]?.trim()).length;
  const requiredKeys = KEY_GROUPS.flatMap(g => g.keys.filter(k => k.required));
  const missingRequired = requiredKeys.filter(k => !values[k.id]?.trim());

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-primary/80 backdrop-blur-lg p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-bg-elevated rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="api-keys-title"
        aria-modal="true"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Key size={20} className="text-accent" />
            </div>
            <div>
              <h2 id="api-keys-title" className="text-xl font-bold text-text-primary">API Keys</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                {configuredCount}/{ALL_KEY_IDS.length} services configured
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-surface transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        </div>

        {/* ── Missing Required Warning ────────────────────── */}
        {missingRequired.length > 0 && !loading && (
          <div className="mx-6 mt-4 flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-xl text-sm">
            <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-text-primary">
                {missingRequired.length} required key{missingRequired.length > 1 ? 's' : ''} missing
              </p>
              <p className="text-text-secondary text-xs mt-0.5">
                {missingRequired.map(k => k.label).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* ── Key Groups ──────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-text-tertiary animate-spin" />
            </div>
          ) : (
            KEY_GROUPS.map(group => {
              const isExpanded = expandedGroup === group.title;
              const groupConfigured = group.keys.filter(k => values[k.id]?.trim()).length;
              const GroupIcon = group.icon;

              return (
                <div
                  key={group.title}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  {/* Group header */}
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-surface/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <GroupIcon size={18} className="text-text-tertiary" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-text-primary">{group.title}</p>
                        <p className="text-xs text-text-tertiary">{group.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        groupConfigured === group.keys.length
                          ? 'bg-success/10 text-success'
                          : groupConfigured > 0
                            ? 'bg-warning/10 text-warning'
                            : 'bg-bg-surface text-text-tertiary'
                      }`}>
                        {groupConfigured}/{group.keys.length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded keys */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                      {group.keys.map(keyDef => {
                        const val = values[keyDef.id] || '';
                        const isRevealed = revealed.has(keyDef.id);
                        const isConfigured = val.trim().length > 0;

                        return (
                          <div key={keyDef.id}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                                {keyDef.label}
                                {keyDef.required && (
                                  <span className="text-error text-[10px]">required</span>
                                )}
                                {isConfigured && (
                                  <Check size={12} className="text-success" />
                                )}
                              </label>
                              {keyDef.helpUrl && (
                                <a
                                  href={keyDef.helpUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent hover:underline flex items-center gap-1"
                                >
                                  Get key <ExternalLink size={10} />
                                </a>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={isRevealed ? 'text' : 'password'}
                                  placeholder={keyDef.placeholder}
                                  value={isRevealed ? val : (val ? maskValue(val) : '')}
                                  onChange={e => {
                                    if (isRevealed) {
                                      setValues(prev => ({ ...prev, [keyDef.id]: e.target.value }));
                                    }
                                  }}
                                  onFocus={() => {
                                    if (!isRevealed) {
                                      setRevealed(prev => new Set(prev).add(keyDef.id));
                                    }
                                  }}
                                  className="w-full border border-border rounded-lg px-3 py-2.5 pr-10 text-sm bg-bg-surface text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition font-mono"
                                />
                                <button
                                  onClick={() => toggleReveal(keyDef.id)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bg-primary/50 transition cursor-pointer"
                                  title={isRevealed ? 'Hide' : 'Reveal'}
                                >
                                  {isRevealed
                                    ? <EyeOff size={14} className="text-text-tertiary" />
                                    : <Eye size={14} className="text-text-tertiary" />
                                  }
                                </button>
                              </div>
                              {keyDef.isGenerated && (
                                <div className="flex gap-2">
                                  {isConfigured && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(val);
                                        // Optional: Fire a toast, but usually just copying is fine.
                                      }}
                                      className="px-3 py-2.5 bg-bg-surface border border-border text-text-secondary rounded-lg hover:bg-bg-primary hover:text-text-primary transition-colors cursor-pointer"
                                      title="Copy to clipboard"
                                    >
                                      <Copy size={16} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const newKey = 'remi_sk_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
                                      setValues(prev => ({ ...prev, [keyDef.id]: newKey }));
                                      setRevealed(prev => new Set(prev).add(keyDef.id));
                                    }}
                                    className="px-4 py-2.5 bg-accent text-text-on-accent rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors shadow-sm whitespace-nowrap cursor-pointer"
                                  >
                                    Generate
                                  </button>
                                </div>
                              )}
                            </div>

                            {keyDef.helpText && (
                              <p className="text-[11px] text-text-tertiary mt-1">{keyDef.helpText}</p>
                            )}

                            {/* Test Connection + Result */}
                            <div className="flex items-center gap-2 mt-1.5">
                              {isConfigured && (
                                <button
                                  onClick={() => handleTestKey(keyDef.id)}
                                  disabled={testResults[keyDef.id]?.loading}
                                  className="text-[10px] font-medium text-accent hover:text-accent-hover flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {testResults[keyDef.id]?.loading
                                    ? <Loader2 size={10} className="animate-spin" />
                                    : <Zap size={10} />
                                  }
                                  Test
                                </button>
                              )}
                              {testResults[keyDef.id] && !testResults[keyDef.id].loading && (
                                <span className={`text-[10px] font-medium ${
                                  testResults[keyDef.id].valid ? 'text-success' : 'text-error'
                                }`}>
                                  {testResults[keyDef.id].message}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-border bg-bg-elevated shrink-0">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Shield size={14} />
            <span>Keys are stored encrypted per-account</span>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-xs text-error">{error}</span>
            )}
            {saved && (
              <span className="text-xs text-success flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-bg-surface transition-all cursor-pointer text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
