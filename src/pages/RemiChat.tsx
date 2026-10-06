/* ═══════════════════════════════════════════════════════════
   REMI CHAT v2 — Voice-Enabled Intelligence + Agentic AI
   ═══════════════════════════════════════════════════════════
   Phase 4 (Workflows + AI) upgrade:
   • Real API calls via useChatApi hook (fallback to smart mock)
   • Suggested action buttons (View on Map, Set Alert, Run Comps)
   • Deal Scout widget in landing state
   • Markdown-aware message rendering
   • Map bridge via navigation
   ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useChatApi } from '../hooks/useChatApi';
import { useChatSession } from '../hooks/useChatSession';
import { supabase } from '../lib/supabase';
import {
  Send, Home, Loader2,
  Mic, MicOff, ArrowRight, Map as MapIcon, Bell, BarChart,
  ScanLine, ChartNoAxesColumn, ArrowUpDown, Plus, Trash2, MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { useMarket } from '../stores/marketStore';
import { useJobStore, type AnalysisType } from '../stores/jobStore';
import type { ChatMessage, SuggestedAction } from '../types';
import DealScoutCard from '../components/chat/DealScoutCard';

/* ─── Analysis card configs ─────────────────────────────── */

/* ─── Action button icon mapping ────────────────────────── */

const ACTION_ICONS: Record<string, typeof MapIcon> = {
  view_on_map: MapIcon,
  set_alert: Bell,
  run_comps: BarChart,
  view_property: Home,
  ask_followup: ArrowRight,
};

/* ─── Live Pulse Item Component Removed per User Spec ─── */

/* ─── Waveform bars (mic recording visual) ──────────────── */

function WaveformBars() {
  const heights = [6, 14, 10, 16, 8];
  return (
    <div className="flex items-center gap-[3px] h-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] bg-accent rounded-full"
          style={{
            animation: `waveform 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
            height: `${h}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Extended message type with actions ─────────────────── */

interface ChatMessageWithActions extends ChatMessage {
  actions?: SuggestedAction[];
  confidence?: number;
  source?: string;
}

/* ─── Memoized MessageBubble — prevents re-render of old messages ── */

const MessageBubble = memo(function MessageBubble({
  msg,
  onAction,
}: {
  msg: ChatMessageWithActions;
  onAction: (action: SuggestedAction) => void;
}) {
  return (
    <div>
      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          msg.role === 'user'
            ? 'bg-accent text-text-on-accent rounded-br-md'
            : 'bg-bg-surface border border-border rounded-bl-md'
        }`}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

          {/* Source + confidence badge */}
          {msg.role === 'assistant' && (msg.source || (msg.confidence != null && msg.confidence > 0)) && (
            <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/50">
              <span className="text-[9px] font-bold uppercase tracking-tighter text-[#E8733A]/80">Team Leader</span>
              {msg.confidence != null && msg.confidence > 0 && (
                <>
                  <span className="text-[8px] text-text-quaternary">•</span>
                  <span className="text-[9px] font-medium text-text-tertiary">
                    {Math.round(msg.confidence * 100)}% Match
                  </span>
                </>
              )}
            </div>
          )}

          <p className={`text-[10px] mt-2 ${msg.role === 'user' ? 'opacity-60' : 'text-text-tertiary'}`}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 ml-0">
          {msg.actions.map((action, idx) => {
            const ActionIcon = ACTION_ICONS[action.type] || ArrowRight;
            return (
              <button
                key={idx}
                onClick={() => onAction(action)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium
                  bg-bg-elevated border border-border rounded-lg
                  text-text-secondary hover:text-accent hover:border-accent/40
                  transition-all cursor-pointer group"
              >
                <ActionIcon size={12} className="group-hover:text-accent transition-colors" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

interface RemiChatProps {
  injectedPropertyContext?: import('../types').Property | null;
  onClearPropertyContext?: () => void;
}

export default function RemiChat({ injectedPropertyContext, onClearPropertyContext }: RemiChatProps = {}) {
  const { currentMarket, isMarketSelected, geographyStatus } = useMarket();
  const navigate = useNavigate();
  const activeJob = useJobStore((s) => currentMarket ? s.getActiveJobForMarket(currentMarket.id) : null);

  /* ── Auth ── */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  // Guardrail 4: Conversation Boundaries (client-side UUID for pre-auth fallback)
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());

  // Reset conversation UUID when market changes (city level)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversationId(uuidv4());
  }, [currentMarket.id]);

  const { sendMessage: apiSend, isLoading: apiLoading } = useChatApi({ sessionId: conversationId });

  /* ── Session persistence ── */
  const {
    sessionId: persistedSessionId,
    persistMessage,
    startNewSession,
    switchSession,
    deleteSession,
    loadSessionMessages,
    isAtLimit,
    sessions,
    isLoadingSessions,
  } = useChatSession({
    userId,
    marketContext: currentMarket ? { city: currentMarket.id, displayName: currentMarket.displayName } : undefined,
  });

  /* ── Session dropdown UI state ── */
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSessionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Chat state ── */
  const [messages, setMessages] = useState<ChatMessageWithActions[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [lastAnalysisType, setLastAnalysisType] = useState<AnalysisType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Auto-resize textarea + expanded state ── */
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 240);
    el.style.height = `${newHeight}px`;
    setInputValue(el.value);
    setIsInputExpanded(newHeight > 68); // >68px ≈ 3 lines → switch to expanded layout
  }, []);

  const resetTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    setIsInputExpanded(false);
  }, []);

  /* ── Voice state (real Deepgram transcription) ── */
  const {
    isRecording,
    liveTranscript,
    finalTranscript,
    error: voiceError,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useVoiceInput();

  const hasConversation = messages.length > 0;

  // Replaced legacy Miami default checks with isMarketSelected

  /* ── Inject waveform animation CSS once ── */
  useEffect(() => {
    if (document.getElementById('remi-waveform-style')) return;
    const style = document.createElement('style');
    style.id = 'remi-waveform-style';
    style.textContent = `
      @keyframes waveform {
        0% { height: 4px; }
        100% { height: 16px; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById('remi-waveform-style');
      if (existing) existing.remove();
    };
  }, []);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Sync Top Bar Scans into Chat Transcript ── */
  const prevJobRef = useRef<string | null>(null);
  const jobTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeJob && activeJob.jobId !== prevJobRef.current) {
      prevJobRef.current = activeJob.jobId;

      const isCardInitiated = lastJobId === activeJob.jobId;
      if (!isCardInitiated && activeJob.status === 'scanning') {
         const text = `🔍 Scanning ${currentMarket.displayName} for ${(activeJob.analysisType || '').replace('_', ' ')} intelligence...`;

         jobTimeoutRef.current = setTimeout(() => {
           setMessages(prev => {
              if (prev.length > 0 && prev[prev.length - 1].content.includes('Scanning')) return prev;
              return [...prev, {
                id: activeJob.jobId,
                sessionId: conversationId,
                role: 'assistant',
                content: text,
                timestamp: new Date().toISOString(),
              }];
           });
           jobTimeoutRef.current = null;
         }, 0);
      }
    }

    return () => {
      if (jobTimeoutRef.current) {
        clearTimeout(jobTimeoutRef.current);
        jobTimeoutRef.current = null;
      }
    };
  }, [activeJob, currentMarket.displayName, conversationId, lastJobId]);

  /* ── Send message handler — REAL API ── */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || apiLoading || isAtLimit) return;

    const userMsg: ChatMessageWithActions = {
      id: crypto.randomUUID(),
      sessionId: persistedSessionId ?? conversationId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    resetTextareaHeight();
    clearTranscript();

    // Persist user message to Supabase (non-blocking)
    persistMessage('user', content);

    // Call real Oracle API (with fallback)
    const response = await apiSend(content);

    if (response.jobId) setLastJobId(response.jobId);
    if (response.analysisType) setLastAnalysisType(response.analysisType as AnalysisType);

    const aiMsg: ChatMessageWithActions = {
      id: crypto.randomUUID(),
      sessionId: persistedSessionId ?? conversationId,
      role: 'assistant',
      content: response.text,
      timestamp: new Date().toISOString(),
      actions: response.actions,
      confidence: response.confidence,
      source: response.source,
    };

    setMessages(prev => [...prev, aiMsg]);

    // Persist assistant message to Supabase (non-blocking)
    persistMessage('assistant', response.text);
  }, [apiLoading, isAtLimit, clearTranscript, apiSend, conversationId, persistedSessionId, persistMessage, resetTextareaHeight]);

  const prevFinalRef = useRef('');
  useEffect(() => {
    const trimmed = finalTranscript.trim();
    if (trimmed && trimmed !== prevFinalRef.current) {
      queueMicrotask(() => {
        setInputValue(trimmed);
      });
      prevFinalRef.current = trimmed;
    } else if (!trimmed) {
      prevFinalRef.current = '';
    }
  }, [finalTranscript]);

  /* ── Handle injected property context ("Ask REMI") ── */
  useEffect(() => {
    if (injectedPropertyContext && !apiLoading) {
      const p = injectedPropertyContext;
      const address = (p.address || '').split(',')[0];
      const contextPrompt = `Analyze this property for me: ${address} — priced at $${(Number(p.price ?? 0)).toLocaleString()}, ${p.bedrooms}bd/${p.bathrooms}ba, ${(Number(p.sqft ?? 0)).toLocaleString()} sqft, deal score ${p.dealScore?.toFixed(1) ?? 'N/A'}, ${p.daysOnMarket} days on market. Is this a good deal? What should I know before making an offer?`;
      // Defer to avoid React cascading setState lint warning
      queueMicrotask(() => {
        sendMessage(contextPrompt);
        onClearPropertyContext?.();
      });
    }
  }, [injectedPropertyContext]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mic toggle handler (real Deepgram) ── */
  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      clearTranscript();
      setInputValue('');
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording, clearTranscript]);

  /* ── Action button handler ── */
  const handleAction = useCallback((action: SuggestedAction) => {
    switch (action.type) {
      case 'view_on_map':
        if (lastJobId && lastAnalysisType) {
          useJobStore.getState().requestMapView({
            jobId: lastJobId,
            analysisType: lastAnalysisType,
            marketSlug: currentMarket.id,
            timestamp: new Date().toISOString(),
          });
        }
        navigate('/map');
        break;
      case 'set_alert':
        navigate('/alerts');
        break;
      case 'run_comps':
        sendMessage(action.data?.prompt as string || 'Run a comparable analysis for the properties you mentioned');
        break;
      case 'view_property':
        navigate('/map');
        break;
      case 'ask_followup':
        if (action.data?.prompt) {
          sendMessage(action.data.prompt as string);
        }
        break;
    }
  }, [navigate, sendMessage, lastJobId, lastAnalysisType, currentMarket.id]);

  /* ═══════════════════════ RENDER ═══════════════════════ */

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-bg-primary">

      {/* ─── Chat Header: New Chat + Session History ── */}
      {userId && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-bg-primary shrink-0">
          {/* Session history dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowSessionDropdown(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>History</span>
              <ChevronDown size={11} className={`transition-transform ${showSessionDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showSessionDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-bg-elevated border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Recent Chats</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {isLoadingSessions ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={14} className="animate-spin text-text-tertiary" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-text-tertiary text-center">No past conversations</div>
                  ) : (
                    sessions.map(session => (
                      <div
                        key={session.id}
                        className={`group flex items-center gap-2 px-3 py-2.5 hover:bg-bg-surface transition-colors cursor-pointer ${
                          session.id === persistedSessionId ? 'bg-accent/5 border-l-2 border-accent' : ''
                        }`}
                      >
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => {
                            switchSession(session.id);
                            loadSessionMessages(session.id).then(msgs => {
                              setMessages(msgs.map(m => ({
                                id: m.id,
                                sessionId: session.id,
                                role: m.role as 'user' | 'assistant',
                                content: m.content,
                                timestamp: m.created_at,
                              })));
                            });
                            setShowSessionDropdown(false);
                          }}
                        >
                          <p className="text-xs font-medium text-text-primary truncate">
                            {session.title || 'Untitled Conversation'}
                          </p>
                          <p className="text-[10px] text-text-tertiary mt-0.5">
                            {session.message_count} msgs
                          </p>
                        </div>
                        {/* Delete with confirmation */}
                        {deleteConfirmId === session.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={async () => { await deleteSession(session.id); setDeleteConfirmId(null); }}
                              className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded cursor-pointer"
                            >Delete</button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[10px] px-1.5 py-0.5 bg-bg-surface border border-border rounded cursor-pointer text-text-secondary"
                            >Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirmId(session.id); }}
                            className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* New Chat button */}
          <button
            onClick={async () => {
              await startNewSession();
              setMessages([]);
              setShowSessionDropdown(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-accent hover:bg-accent/5 border border-transparent hover:border-accent/20 transition-all cursor-pointer"
          >
            <Plus size={13} />
            <span>New Chat</span>
          </button>
        </div>
      )}

      {/* ─── Scrollable Content Area ── */}
      <div
        className="flex-1 overflow-y-scroll"
        style={{
          contain: 'strict',
          willChange: 'scroll-position',
          WebkitOverflowScrolling: 'touch' as never,
        }}
      >

        {/* ═══ LANDING STATE (before any messages) ═══ */}
        {!hasConversation && (
          <div className="px-6 pt-8 pb-4">

            {/* Market Scope Badge */}
            <div className="flex justify-center mb-6">
              <button
                onClick={() => navigate('/map')}
                className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-xs font-medium text-accent hover:bg-accent/20 transition-colors cursor-pointer group"
              >
                <MapIcon size={14} />
                <span className="font-bold">{currentMarket.displayName}</span>
                <span className="opacity-70 flex items-center gap-1">
                  {geographyStatus === 'ready' ? <><span className="text-[#E8733A] font-extrabold group-hover:animate-pulse">✓</span> Geography Ready</> : (isMarketSelected ? '· All analyses scoped to this market' : '· Geography Not Set')}
                </span>
                <ArrowRight size={12} className="ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all outline-none" />
              </button>
            </div>

            {/* Default Market Nudge */}
            {!isMarketSelected && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                border: '1px solid #FDE68A',
                marginBottom: '24px',
                fontSize: '14px'
              }}>
                <p style={{ fontWeight: 600, marginBottom: '4px', color: '#92400E' }}>
                  📍 No Market Selected
                </p>
                <p style={{ color: '#92400E' }}>
                  Search a city on the Map tab to set your market, or just tell me
                  which city you'd like to explore.
                </p>
              </div>
            )}

            {/* Live Market Pulse — REMI is already working for you */}
            <div className="bg-bg-elevated rounded-xl border border-border p-4 mb-6 relative overflow-hidden">
              {/* Live Market Feed header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                  Live Market Feed
                </span>
              </div>

              {/* Feed item 1 — Scanning for new listings */}
              <div className="flex items-center gap-2.5 py-1.5">
                <ScanLine 
                  size={14} 
                  strokeWidth={1.5} 
                  className="text-muted-foreground shrink-0" 
                />
                <span className="text-sm text-foreground">Scanning for new listings...</span>
              </div>

              {/* Feed item 2 — Analyzing deal scores */}
              <div className="flex items-center gap-2.5 py-1.5">
                <ChartNoAxesColumn 
                  size={14} 
                  strokeWidth={1.5} 
                  className="text-muted-foreground shrink-0" 
                />
                <span className="text-sm text-foreground">Analyzing deal scores...</span>
              </div>

              {/* Feed item 3 — Monitoring price movements */}
              <div className="flex items-center gap-2.5 py-1.5">
                <ArrowUpDown 
                  size={14} 
                  strokeWidth={1.5} 
                  className="text-muted-foreground shrink-0" 
                />
                <span className="text-sm text-foreground">Monitoring price movements...</span>
              </div>

              {/* Subtle gradient accent */}
              <div className="absolute top-0 right-0 w-32 h-full bg-linear-to-l from-accent/4 to-transparent pointer-events-none" />
            </div>

            {/* Deal Scout Widget (Phase 4) */}
            <div className="mb-6">
              <DealScoutCard
                onPropertyClick={() => navigate('/map')}
                onViewAll={() => navigate('/map')}
              />
            </div>

            {/* Conversational Invitation (Kimi-style concierge) */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-text-primary mb-1.5">
                Your market intelligence partner
              </h1>
              <p className="text-sm text-text-secondary">
                Ask me anything about {currentMarket.displayName}
              </p>
            </div>
          </div>
        )}

        {/* ═══ CHAT MESSAGES ═══ */}
        {hasConversation && (
          <div className="px-6 py-4 space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
            ))}

            {/* Loading indicator */}
            {apiLoading && (
              <div className="flex justify-start">
                <div className="bg-bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2.5">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  <span className="text-sm text-text-secondary">REMI is analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ═══ INPUT BAR — Mic + Text + Send ═══ */}
      <div className="px-6 pb-6 pt-3 bg-linear-to-t from-bg-primary via-bg-primary to-transparent">


        {/* Voice error (mic denied / API key missing) */}
        {voiceError && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-[11px] text-red-600">{voiceError}</span>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-medium text-accent">Listening...</span>
            <WaveformBars />
            <span className="text-[10px] text-text-tertiary ml-auto">Tap mic to finish</span>
          </div>
        )}

        {/* Live transcript preview (interim Deepgram results) */}
        {liveTranscript && (
          <div className="mb-2 bg-bg-surface/80 backdrop-blur-sm rounded-lg border border-border px-3 py-2">
            <p className="text-xs text-text-secondary italic">"{liveTranscript}"</p>
          </div>
        )}

        {/* 50-Message Limit Banner */}
        {isAtLimit && (
          <div className="flex items-start gap-3 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-500 text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Conversation Output Limit Reached</p>
              <p className="text-xs text-text-secondary mt-1">
                This discussion has reached its max capacity to ensure Oracle performance and memory efficiency. Please start a New Chat to continue analyzing.
              </p>
            </div>
          </div>
        )}

        {/* Input area — horizontal when short, vertical stack when paragraph-length */}
        <div className={`flex gap-2 transition-all duration-200 ${isInputExpanded ? 'flex-col' : 'items-end'}`}>

          {/* Auto-sizing textarea — full width when expanded */}
          <div className="flex-1 flex items-center border border-border rounded-xl bg-bg-elevated px-4 py-2.5 focus-within:border-accent transition-colors">
            <textarea
              ref={textareaRef}
              placeholder="What deal are you chasing?"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputValue);
                }
                // Shift+Enter always inserts a line break (default textarea behavior)
              }}
              rows={1}
              style={{
                minHeight: '24px',
                maxHeight: '240px',
                resize: 'none',
                overflowY: 'auto',
              }}
              className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary w-full leading-relaxed"
              disabled={apiLoading}
            />
          </div>

          {/* Buttons row — beside textarea when compact, full-width row with hint when expanded */}
          <div className={`flex gap-2 shrink-0 ${isInputExpanded ? 'items-center justify-between' : 'items-end'}`}>
            {/* Mic button */}
            <button
              onClick={handleMicToggle}
              aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 ${isInputExpanded ? '' : 'mb-0.5'} ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 scale-105'
                  : 'bg-bg-surface border border-border text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/5'
              }`}
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Hint text shown only when expanded */}
            {isInputExpanded && (
              <span className="text-xs text-text-tertiary select-none">Enter to send · Shift+Enter for new line</span>
            )}

            {/* Send button */}
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || apiLoading}
              aria-label="Send message"
              className={`w-10 h-10 bg-[#E8733A] rounded-xl flex items-center justify-center hover:bg-[#D66A35] disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm shadow-[#E8733A]/20 ${isInputExpanded ? '' : 'mb-0.5'}`}
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
