import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/auth-utils';
import { showToast } from '../utils/toast';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const userId = getOrCreateUserId();

    const fetchUnread = async () => {
      try {
        // Count unread deal scout alerts for this user
        const { count } = await supabase
          .from('deal_scout_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('[NotificationBell] Failed to fetch unread count:', err);
      }
    };
    fetchUnread();

    // Subscribe to new deal_scout_alerts for THIS user only
    const alertSub = supabase
      .channel(`deal_scout_alerts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deal_scout_alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setUnreadCount(c => c + 1);
          const alert = payload.new as Record<string, unknown>;
          const address = alert.address_norm as string;
          showToast(
            address
              ? `Deal Scout: New match at ${address}`
              : 'Deal Scout found a new match!',
            'success'
          );
        }
      )
      .subscribe();

    // Also subscribe to research_job_events for scan status (user-scoped via job ownership)
    const jobSub = supabase
      .channel(`research_job_events:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'research_job_events',
        },
        (payload) => {
          const event = payload.new as Record<string, unknown>;
          const eventType = event.event_type as string;
          if (eventType === 'source_completed' || eventType === 'source_batch') {
            // Don't count scan progress as notifications — just toast
            showToast('Scan progress update', 'info');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertSub);
      supabase.removeChannel(jobSub);
    };
  }, []);

  const handleClick = async () => {
    // Mark all as read on click
    if (unreadCount > 0) {
      const userId = getOrCreateUserId();
      try {
        await (supabase as any)
          .from('deal_scout_alerts')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
        setUnreadCount(0);
      } catch (err) {
        console.error('[NotificationBell] Failed to mark as read:', err);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer"
      title="Notifications"
    >
      <Bell size={18} className="text-text-secondary hover:text-text-primary transition-colors icon-interactive" />
      {unreadCount > 0 && (
        <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-error flex items-center justify-center border-2 border-bg-primary">
          <span className="text-[8px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
        </div>
      )}
    </button>
  );
}
