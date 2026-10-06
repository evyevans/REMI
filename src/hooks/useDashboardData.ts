import { useState, useEffect, useCallback } from 'react';
import { useMarket } from '../stores/marketStore';
import { 
  fetchPriceTrend, 
  fetchScoreDistribution, 
  fetchDashboardSummary
} from '../services/analyticsService';
import type {
  PriceTrendPoint,
  ScoreDistributionPoint,
  DashboardSummary
} from '../services/analyticsService';

interface DashboardDataState {
  trendData: PriceTrendPoint[];
  scoreData: ScoreDistributionPoint[];
  summary: DashboardSummary | null;
  hotDealsCount: number;
  chartsLoading: boolean;
  trendLoading: boolean;
  scoreLoading: boolean;
  summaryLoading: boolean;
  analyticsError: string | null;
  trendError: string | null;
  scoreError: string | null;
  summaryError: string | null;
  hasTrendData: boolean;
  hasScoreData: boolean;
}

const CACHE_TTL = 60000; // 60 seconds

// Simple in-memory cache
const cache: Record<string, { data: unknown; timestamp: number }> = {};

export function useDashboardData() {
  const { currentMarket, isMarketSelected } = useMarket();
  const [data, setData] = useState<DashboardDataState>({
    trendData: [],
    scoreData: [],
    summary: null,
    hotDealsCount: 0,
    chartsLoading: true,
    trendLoading: false,
    scoreLoading: false,
    summaryLoading: false,
    analyticsError: null,
    trendError: null,
    scoreError: null,
    summaryError: null,
    hasTrendData: false,
    hasScoreData: false,
  });

  const updateData = useCallback((updates: Partial<DashboardDataState>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  // Individual fetch functions with caching and error handling
  const fetchTrendData = useCallback(async () => {
    if (!isMarketSelected || !currentMarket?.id) return;

    // Defer ALL state updates to microtask queue — prevents synchronous setState inside useEffect
    await Promise.resolve();

    const cacheKey = `trend-${currentMarket.id}`;
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const trendResult = (cached.data as { data: Awaited<ReturnType<typeof fetchPriceTrend>> }).data;
      updateData({
        trendData: trendResult.data,
        hasTrendData: trendResult.hasRealData,
        trendLoading: false,
      });
      return;
    }

    updateData({ trendLoading: true, trendError: null });

    try {
      const trendResult = await fetchPriceTrend(currentMarket.id);
      cache[cacheKey] = { data: { data: trendResult }, timestamp: Date.now() };
      
      updateData({
        trendData: trendResult.data,
        hasTrendData: trendResult.hasRealData,
        trendLoading: false,
      });
    } catch (err) {
      updateData({
        trendError: err instanceof Error ? err.message : 'Failed to load trend data',
        trendLoading: false,
      });
    }
  }, [currentMarket, isMarketSelected, updateData]);

  const fetchScoreData = useCallback(async () => {
    if (!isMarketSelected || !currentMarket?.id) return;

    // Defer ALL state updates to microtask queue
    await Promise.resolve();

    const cacheKey = `score-${currentMarket.id}`;
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const scoreResult = (cached.data as { data: Awaited<ReturnType<typeof fetchScoreDistribution>> }).data;
      updateData({
        scoreData: scoreResult.data,
        hotDealsCount: scoreResult.hotDealsThisWeek,
        hasScoreData: scoreResult.hasRealData,
        scoreLoading: false,
      });
      return;
    }

    updateData({ scoreLoading: true, scoreError: null });

    try {
      const scoreResult = await fetchScoreDistribution(currentMarket.id);
      cache[cacheKey] = { data: { data: scoreResult }, timestamp: Date.now() };
      
      updateData({
        scoreData: scoreResult.data,
        hotDealsCount: scoreResult.hotDealsThisWeek,
        hasScoreData: scoreResult.hasRealData,
        scoreLoading: false,
      });
    } catch (err) {
      updateData({
        scoreError: err instanceof Error ? err.message : 'Failed to load score data',
        scoreLoading: false,
      });
    }
  }, [currentMarket, isMarketSelected, updateData]);

  const fetchSummaryData = useCallback(async () => {
    if (!isMarketSelected || !currentMarket?.id) return;

    // Defer ALL state updates to microtask queue
    await Promise.resolve();

    const cacheKey = `summary-${currentMarket.id}`;
    const cached = cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const summaryResult = (cached.data as { data: Awaited<ReturnType<typeof fetchDashboardSummary>> }).data;
      updateData({
        summary: summaryResult,
        summaryLoading: false,
      });
      return;
    }

    updateData({ summaryLoading: true, summaryError: null });

    try {
      const summaryResult = await fetchDashboardSummary(currentMarket.id);
      cache[cacheKey] = { data: { data: summaryResult }, timestamp: Date.now() };
      
      updateData({
        summary: summaryResult,
        summaryLoading: false,
      });
    } catch (err) {
      updateData({
        summaryError: err instanceof Error ? err.message : 'Failed to load summary data',
        summaryLoading: false,
      });
    }
  }, [currentMarket, isMarketSelected, updateData]);

  // Fetch all data when market changes
  useEffect(() => {
    if (!isMarketSelected) return;
    // Async IIFE — effect itself stays synchronous, satisfying the ESLint rule.
    // Each fetch defers setState via await Promise.resolve() at function start.
    void (async () => {
      await fetchTrendData();
      void fetchScoreData();
      void fetchSummaryData();
    })();
  }, [isMarketSelected, currentMarket, fetchTrendData, fetchScoreData, fetchSummaryData]);

  // Overall loading state - true only when all are loading
  const overallLoading = data.trendLoading && data.scoreLoading && data.summaryLoading;

  return {
    ...data,
    overallLoading,
    fetchTrendData,
    fetchScoreData,
    fetchSummaryData,
  };
}