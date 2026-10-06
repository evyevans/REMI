/**
 * useChatSession — Supabase-backed session management for Oracle Chat
 *
 * Handles:
 *  - Session creation / resumption
 *  - Message persistence (user + assistant)
 *  - Session title auto-generation (first 6 words of first user message)
 *  - 100-message limit enforcement
 *  - New Chat / Delete session UI operations
 *  - Session history listing (most recent first)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatSessionMeta {
  id: string;
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
  market_context: Record<string, unknown> | null;
}

interface UseChatSessionOptions {
  userId: string | null;
  marketContext?: Record<string, unknown>;
}

interface UseChatSessionReturn {
  sessionId: string | null;
  messageCount: number;
  isAtLimit: boolean;
  sessions: ChatSessionMeta[];
  isLoadingSessions: boolean;
  persistMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  loadSessionMessages: (id: string) => Promise<Array<{ role: string; content: string; id: string; created_at: string }>>;
}

const MESSAGE_LIMIT = 50;

/** Generate session title from first 6 words of first user message */
function generateTitle(content: string): string {
  const words = content.trim().split(/\s+/).slice(0, 6);
  if (!words.length) return 'New Conversation';
  const title = words.join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function useChatSession({ userId, marketContext }: UseChatSessionOptions): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const isTitleSetRef = useRef(false);

  /* ── Load session history ── */
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setIsLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at, last_message_at, message_count, market_context')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      setSessions((data as ChatSessionMeta[]) ?? []);
    } catch (err) {
      console.warn('[useChatSession] Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId]);

  /* ── Create a brand new session ── */
  const createSession = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .insert({
          user_id: userId,
          market_context: marketContext ?? null,
          title: null,
          message_count: 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      isTitleSetRef.current = false;
      return data?.id ?? null;
    } catch (err) {
      console.warn('[useChatSession] Failed to create session:', err);
      return null;
    }
  }, [userId, marketContext]);

  /* ── On mount: resume latest active session or create new one ── */
  useEffect(() => {
    if (!userId) return;

    (async () => {
      await loadSessions();
      const { data } = await (supabase as any)
        .from('chat_sessions')
        .select('id, message_count')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: true })
        .limit(1)
        .single();

      if (data && data.message_count < MESSAGE_LIMIT) {
        setSessionId(data.id);
        setMessageCount(data.message_count ?? 0);
        isTitleSetRef.current = true; // existing session already has title
      } else {
        // No valid session — create fresh
        const newId = await createSession();
        if (newId) {
          setSessionId(newId);
          setMessageCount(0);
        }
      }
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Persist a single message and atomically increment count ── */
  const persistMessage = useCallback(async (role: 'user' | 'assistant', content: string) => {
    if (!sessionId || !userId) return;

    try {
      // Auto-generate title from first user message
      if (role === 'user' && !isTitleSetRef.current) {
        isTitleSetRef.current = true;
        const title = generateTitle(content);
        (supabase as any)
          .from('chat_sessions')
          .update({ title })
          .eq('id', sessionId)
          .then(() => loadSessions()); // refresh sidebar
      }

      // Insert message
      await (supabase as any)
        .from('chat_messages')
        .insert({ session_id: sessionId, role, content });

      // Atomic increment — prevents race conditions in multi-tab scenarios
      const { data } = await (supabase as any)
        .rpc('increment_session_message_count', { p_session_id: sessionId });

      if (typeof data === 'number') {
        setMessageCount(data);
      }
    } catch (err) {
      console.warn('[useChatSession] Failed to persist message:', err);
    }
  }, [sessionId, userId, loadSessions]);

  /* ── Start a new chat session ── */
  const startNewSession = useCallback(async () => {
    const newId = await createSession();
    if (newId) {
      setSessionId(newId);
      setMessageCount(0);
      await loadSessions();
    }
  }, [createSession, loadSessions]);

  /* ── Switch to an existing session ── */
  const switchSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setSessionId(id);
      setMessageCount(session.message_count);
      isTitleSetRef.current = true;
    }
  }, [sessions]);

  /* ── Delete (soft-archive) a session ── */
  const deleteSession = useCallback(async (id: string) => {
    try {
      await (supabase as any)
        .from('chat_sessions')
        .update({ is_archived: true })
        .eq('id', id);
      setSessions(prev => prev.filter(s => s.id !== id));
      // If we deleted the active session, start a fresh one
      if (id === sessionId) {
        await startNewSession();
      }
    } catch (err) {
      console.warn('[useChatSession] Failed to delete session:', err);
    }
  }, [sessionId, startNewSession]);

  /* ── Load messages for a specific session (for session switching) ── */
  const loadSessionMessages = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ role: string; content: string; id: string; created_at: string }>;
    } catch (err) {
      console.warn('[useChatSession] Failed to load session messages:', err);
      return [];
    }
  }, []);

  return {
    sessionId,
    messageCount,
    isAtLimit: messageCount >= MESSAGE_LIMIT,
    sessions,
    isLoadingSessions,
    persistMessage,
    startNewSession,
    switchSession,
    deleteSession,
    loadSessionMessages,
  };
}
