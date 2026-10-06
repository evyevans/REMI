import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/auth-utils';
import { useToast } from '../contexts/ToastContext';

export interface MemoryBlock {
  id: string;
  label: string;
  memory: any;
  type: 'quarter' | 'lifetime';
  created_at: string;
}

export function useMemoryManagement() {
  const [memories, setMemories] = useState<MemoryBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const userId = getOrCreateUserId();

      // Fetch Quarters
      const { data: quarters, error: qErr } = await supabase
        .from('memory_quarters')
        .select('*')
        .eq('user_id', userId)
        .order('quarter_start', { ascending: false });

      if (qErr) throw qErr;

      // Fetch Lifetime
      const { data: lifetime, error: lErr } = await supabase
        .from('memory_lifetime')
        .select('*')
        .eq('user_id', userId)
        .order('year_label', { ascending: false });

      if (lErr) throw lErr;

      const blocks: MemoryBlock[] = [
        ...(lifetime || []).map((l: any) => ({
          id: l.id,
          label: `Lifetime Profile ${l.year_label}`,
          memory: l.annual_memory,
          type: 'lifetime' as const,
          created_at: l.created_at,
        })),
        ...(quarters || []).map((q: any) => ({
          id: q.id,
          label: `Quarterly Insights ${q.quarter_label}`,
          memory: q.compact_memory,
          type: 'quarter' as const,
          created_at: q.created_at,
        }))
      ];

      setMemories(blocks);
    } catch (err: any) {
      console.error('Failed to load memory blocks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const clearMemory = async () => {
    try {
      const userId = getOrCreateUserId();
      // Delete quarters
      await supabase.from('memory_quarters').delete().eq('user_id', userId);
      // Delete lifetime
      await supabase.from('memory_lifetime').delete().eq('user_id', userId);
      
      setMemories([]);
      addToast('Long-term memory cleared successfully', 'success');
    } catch (err: any) {
      console.error('Failed to clear memory', err);
      addToast('Failed to clear memory', 'error');
    }
  };

  return {
    memories,
    isLoading,
    clearMemory,
    reload: loadMemories
  };
}
