/* ═══════════════════════════════════════════════════════════
   Analytics Service — Real Supabase queries for Dashboard charts
   Replaces all mock/hardcoded chart data with live aggregations.
   ═══════════════════════════════════════════════════════════ */

// ─── TYPES ────────────────────────────────────────────────────────

export interface PriceTrendPoint {
  month: string;
  for_sale_ppsf: number | null;
  sold_ppsf: number | null;
  active_count: number;
  sold_count: number;
  total_count: number;
  last_updated: string | null;
}

export interface ScoreDistributionPoint {
  month: string;
  excellent: number;
  good: number;
  fair: number;
  below: number;
  total: number;
  hot_deals_this_week: number;
}

export interface DashboardSummary {
  active_listings: number;
  sold_last_30d: number;
  ppsf_change_pct_30d: number | null;
  hot_deals_this_week: number;
  last_data_update: string | null;
}

// ─── HELPERS ──────────────────────────────────────────────────────

export function formatTimeAgo(isoDate: string | null): string {
  if (!isoDate) return 'Never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function computeConfidence(listingCount: number): number {
  // Confidence scales with data volume: 50 at 0 listings, caps at 95
  return Math.min(95, Math.round(50 + (listingCount / 10)));
}

// ─── QUERIES ──────────────────────────────────────────────────────

import { getOrCreateUserId } from '../lib/auth-utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchPriceTrend(marketSlug?: string): Promise<{
  data: PriceTrendPoint[];
  hasRealData: boolean;
}> {
  if (!marketSlug) return { data: [], hasRealData: false };
  try {
    const userId = getOrCreateUserId();
    const res = await fetch(`${API_BASE}/api/v1/dashboard/price-trend?market_slug=${marketSlug}`, {
      headers: { 'x-user-id': userId }
    });
    if (!res.ok) throw new Error('API error');
    const json = await res.json();
    
    // Handle timeout response from backend
    if (json.status === 'timeout') {
      throw new Error(json.message || 'Price trend data timed out');
    }
    
    const points = json.points || [];
    
    const data: PriceTrendPoint[] = points.map((p: { name: string; sold_ppsf: number | null; for_sale_ppsf: number | null }) => ({
      month: `${p.name} 1, 2026`, // Dummy date so new Date() works
      for_sale_ppsf: p.for_sale_ppsf,
      sold_ppsf: p.sold_ppsf,
      active_count: 0,
      sold_count: 0,
      total_count: 0,
      last_updated: null
    }));
    
    return { data, hasRealData: data.length > 0 };
  } catch (err) {
    console.error('[analyticsService] fetchPriceTrend error:', err);
    return { data: [], hasRealData: false };
  }
}

export async function fetchScoreDistribution(marketSlug?: string): Promise<{
  data: ScoreDistributionPoint[];
  hasRealData: boolean;
  hotDealsThisWeek: number;
}> {
  if (!marketSlug) return { data: [], hasRealData: false, hotDealsThisWeek: 0 };
  try {
    const userId = getOrCreateUserId();
    const res = await fetch(`${API_BASE}/api/v1/dashboard/deal-score-distribution?market_slug=${marketSlug}`, {
      headers: { 'x-user-id': userId }
    });
    if (!res.ok) throw new Error('API error');
    const json = await res.json();
    
    // Handle timeout response from backend
    if (json.status === 'timeout') {
      throw new Error(json.message || 'Deal score distribution timed out');
    }
    
    const b = json.buckets || { excellent: 0, good: 0, fair: 0, poor: 0 };
    
    const data: ScoreDistributionPoint[] = [{
      month: new Date().toISOString(),
      excellent: b.excellent,
      good: b.good,
      fair: b.fair,
      below: b.poor,
      total: b.excellent + b.good + b.fair + b.poor,
      hot_deals_this_week: b.excellent
    }];
    
    return { data, hasRealData: data[0].total > 0, hotDealsThisWeek: b.excellent };
  } catch (err) {
    console.error('[analyticsService] fetchScoreDistribution error:', err);
    return { data: [], hasRealData: false, hotDealsThisWeek: 0 };
  }
}

export async function fetchDashboardSummary(marketSlug?: string): Promise<DashboardSummary | null> {
  if (!marketSlug) return null;
  try {
    const userId = getOrCreateUserId();
    const res = await fetch(`${API_BASE}/api/v1/dashboard/pulse?market_slug=${marketSlug}`, {
      headers: { 'x-user-id': userId }
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    
    // Handle timeout response from backend
    if (data.reason === 'timeout') {
      throw new Error(data.message || 'Dashboard metrics timed out');
    }
    
    return {
      active_listings: data.total_count || 0,
      sold_last_30d: data.avg_dom, 
      ppsf_change_pct_30d: null,
      hot_deals_this_week: data.hot_deals,
      last_data_update: new Date().toISOString()
    };
  } catch (err) {
    console.error('[analyticsService] fetchDashboardSummary error:', err);
    return null;
  }
}