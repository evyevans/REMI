/**
 * DiscoveredNeighborhoodsOverlay.tsx
 *
 * City-First Intelligence: Renders AI-discovered neighborhoods as
 * polygonal overlay cards on the MapView after a job completes.
 *
 * Data flow:
 *   job_complete event (Realtime) → fetch discovered_neighborhoods table
 *   → setDiscoveredNeighborhoods() → this component renders
 *
 * Features:
 * - Shows top-5 AI-ranked neighborhoods as floating info chips
 * - Each chip shows: name, deal score, rank badge, top highlights
 * - "Save to Profile" CTA upserts to user_market_preferences
 * - Fades in smoothly after job completion so it doesn't interrupt scanning UX
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useMarketStore, type DiscoveredNeighborhood } from '../../stores/marketStore';
import { useJobStore } from '../../stores/jobStore';

interface DiscoveredNeighborhoodsOverlayProps {
  marketSlug: string | null;
  analysisType?: string;
  userId?: string | null;
}

// Freshness TTL constants (in milliseconds)
const FRESHNESS_TTL: Record<string, number> = {
  for_sale: 24 * 60 * 60 * 1000,    // 24 hours
  rental:   24 * 60 * 60 * 1000,    // 24 hours
  sold:     7  * 24 * 60 * 60 * 1000, // 7 days
  comprehensive: 24 * 60 * 60 * 1000,
};

export function DiscoveredNeighborhoodsOverlay({
  marketSlug,
  analysisType,
  userId,
}: DiscoveredNeighborhoodsOverlayProps) {
  const { discoveredNeighborhoods, setDiscoveredNeighborhoods } = useMarketStore();
  const { jobs } = useJobStore();
  const [visible, setVisible] = useState(false);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [savingName, setSavingName] = useState<string | null>(null);

  // Fetch discovered neighborhoods from Supabase after the latest job completes
  const fetchDiscoveries = useCallback(async (slug: string, aType?: string) => {
    try {
      let query = supabase
        .from('discovered_neighborhoods')
        .select('*')
        .eq('market_slug', slug)
        .order('rank', { ascending: true })
        .limit(5);

      if (aType) {
        query = query.eq('analysis_type', aType);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        setDiscoveredNeighborhoods(data as DiscoveredNeighborhood[]);
        // Fade in after a short delay to not compete with scan completion animation
        setTimeout(() => setVisible(true), 800);
      }
    } catch (err) {
      console.error('[DiscoveredNeighborhoodsOverlay] Failed to fetch discoveries:', err);
    }
  }, [setDiscoveredNeighborhoods]);

  // Watch for job completion to trigger fetch
  useEffect(() => {
    if (!marketSlug) return;

    const marketJobs = Object.values(jobs).filter(
      (j) => j.marketSlug === marketSlug
    ) as Array<{ status: string; jobId: string }>;

    const justCompleted = marketJobs.find(
      (j) => j.status === 'completed' || j.status === 'partial_success'
    );

    if (justCompleted) {
      fetchDiscoveries(marketSlug, analysisType);
    }
  }, [jobs, marketSlug, analysisType, fetchDiscoveries]);

  // Also fetch on mount if we have stale data
  useEffect(() => {
    if (!marketSlug || discoveredNeighborhoods.length > 0) return;
    fetchDiscoveries(marketSlug, analysisType);
  }, [marketSlug, analysisType, discoveredNeighborhoods.length, fetchDiscoveries]);

  // Save a neighborhood to user_market_preferences
  const saveNeighborhood = useCallback(async (neighborhood: DiscoveredNeighborhood) => {
    if (!userId || !marketSlug) return;
    setSavingName(neighborhood.name);

    try {
      // Fetch existing saved array first
      const { data: existing } = await (supabase
        .from('user_market_preferences') as any)
        .select('saved_neighborhoods')
        .eq('user_id', userId)
        .eq('market_slug', marketSlug)
        .maybeSingle();

      const currentSaved: DiscoveredNeighborhood[] = (existing?.saved_neighborhoods as DiscoveredNeighborhood[]) ?? [];
      const alreadySaved = currentSaved.some((n) => n.name === neighborhood.name);

      if (!alreadySaved) {
        const updated = [
          ...currentSaved,
          { ...neighborhood, saved_at: new Date().toISOString() },
        ];

        const [city, state] = (marketSlug || '').split('-');
        await (supabase.from('user_market_preferences') as any).upsert(
          {
            user_id: userId,
            market_slug: marketSlug,
            city: city ?? '',
            state: state?.toUpperCase() ?? '',
            country: 'US',
            saved_neighborhoods: updated as unknown as any,
          },
          { onConflict: 'user_id,market_slug' }
        );
      }

      setSavedNames((prev) => new Set([...prev, neighborhood.name]));
    } catch (err) {
      console.error('[DiscoveredNeighborhoodsOverlay] Save failed:', err);
    } finally {
      setSavingName(null);
    }
  }, [userId, marketSlug]);

  if (discoveredNeighborhoods.length === 0) return null;

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#6B7280';
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 12,
        padding: '10px 14px',
        borderLeft: '3px solid #6366F1',
        color: '#E2E8F0',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}>
        AI-DISCOVERED TOP NEIGHBORHOODS
      </div>

      {/* Neighborhood cards */}
      {discoveredNeighborhoods.map((n) => (
        <div
          key={n.slug}
          style={{
            background: 'rgba(15, 23, 42, 0.93)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            padding: '12px 14px',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: '#E2E8F0',
          }}
        >
          {/* Name + rank */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n.name}</span>
            <span style={{
              background: getRankColor(n.rank),
              color: '#0F172A',
              borderRadius: 99,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 800,
            }}>
              #{n.rank}
            </span>
          </div>

          {/* Score + property count */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: '#94A3B8' }}>
            <span>⭐ {n.score?.toFixed(1) ?? '—'}/10</span>
            <span>·</span>
            <span>{n.property_count ?? 0} listings</span>
          </div>

          {/* Highlights */}
          {n.highlights?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {n.highlights.slice(0, 3).map((h, i) => (
                <span key={i} style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  borderRadius: 6,
                  padding: '2px 7px',
                  fontSize: 11,
                  color: '#A5B4FC',
                }}>
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Insight */}
          {n.insight && (
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 8px 0', lineHeight: 1.4 }}>
              {n.insight}
            </p>
          )}

          {/* Save CTA */}
          {userId && (
            <button
              onClick={() => saveNeighborhood(n)}
              disabled={savedNames.has(n.name) || savingName === n.name}
              style={{
                width: '100%',
                padding: '6px 0',
                borderRadius: 8,
                border: 'none',
                cursor: savedNames.has(n.name) ? 'default' : 'pointer',
                background: savedNames.has(n.name)
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(99, 102, 241, 0.2)',
                color: savedNames.has(n.name) ? '#4ADE80' : '#A5B4FC',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {savingName === n.name
                ? 'Saving…'
                : savedNames.has(n.name)
                  ? '✓ Saved to Profile'
                  : 'Save to Profile'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * useDataFreshness — Returns whether the last scan for this market+type is stale.
 * Used by MapDataHeader to show a refresh banner.
 */
export function useDataFreshness(marketSlug: string | null, analysisType?: string) {
  const [isStale, setIsStale] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!marketSlug) return;

    async function checkFreshness() {
      try {
        let query = supabase
          .from('research_jobs')
          .select('completed_at')
          .eq('market_slug', marketSlug!)
          .in('status', ['completed', 'partial_success'])
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(1);

        if (analysisType) {
          query = query.eq('mode', analysisType);
        }

        const res = await query;
        const data = res.data as { completed_at: string }[] | null | undefined;
        if (!data || data.length === 0) {
          setIsStale(true);
          return;
        }

        const completedAt = new Date(data[0].completed_at);
        setLastScanAt(completedAt);

        const ttl = FRESHNESS_TTL[analysisType ?? 'for_sale'] ?? 24 * 60 * 60 * 1000;
        const age = Date.now() - completedAt.getTime();
        setIsStale(age > ttl);
      } catch {
        setIsStale(false);
      }
    }

    checkFreshness();
  }, [marketSlug, analysisType]);

  return { isStale, lastScanAt };
}
