import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useMarket } from '../stores/marketStore';
import { useJobStore } from '../stores/jobStore';
import { subscribeToDominoEvents, PipelineTrace, type DominoTenure } from '../lib/pipeline-trace';
import type { CanonicalPropertyRow } from '../types/database';
import { DEMO_MODE, getMockSessionPropertiesForMarket } from '../demo/mockData';

export type ListingType = 'for_sale' | 'for_rent' | 'sold' | 'market_intel';

// Shape that maps canonical_properties columns to the UI
// Aligned with what data_gateway.py persists via _build_canonical_payload
export type SessionProperty = {
  id: string;
  address: string;
  city_name: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  list_price: number | null;
  sold_price: number | null;
  sold_date: string | null;
  rent_price: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  listing_url: string | null;
  days_on_market: number | null;
  price_per_sqft: number | null;
  deal_score: number | null;
  
  // Enriched
  deal_category: string | null;
  size_category: string | null;
  price_tier: string | null;
  percent_above_market: number | null;
  price_per_bedroom: number | null;
  estimated_roi: number | null;
  
  // Real Estate / Mortgage Calc
  listing_agent: string | null;
  extracted_at: string | null;
  mortgage_interest_rate: number | null;
  mortgage_down_payment: number | null;
  mortgage_term_years: number | null;
  est_monthly_payment: number | null;
  
  // AI
  investment_analysis: string | null;
  buyer_profile: string | null;
  risk_assessment: string | null;
  neighborhood_insights: string | null;
  negotiation_strategy: string | null;
  competitive_position: string | null;
  showing_priority: number | null;
  ai_notes: string | null;
  agent_rationale: string | null;
  
  // Rental
  investment_potential: string | null;
  ideal_tenant_profile: string | null;
  roi_estimate: string | null;
  
  // Sold
  ai_summary: string | null;
  ai_investment_score: number | null;
  ai_comp_analysis: string | null;
  
  // Market Intel
  opportunity_type: string | null;
  market_position: string | null;
  priority_level: string | null;
  investment_score: number | null;
  comparable_analysis: string | null;
  seller_opportunity_analysis: string | null;
  buyer_profile_match: string | null;
  market_insights: string | null;
  client_action_items: string | null;
  
  source: string;
  intent: string;
};

// Map tab IDs to the backend `tenure` values written by data_gateway.py
// IMPORTANT: these MUST match PropertyRecord.tenure values exactly (lowercase)
const TENURE_MAP: Record<ListingType, string> = {
  'for_sale':    'for_sale',
  'for_rent':    'for_rent',
  'sold':        'sold',
  'market_intel': 'market_intel',
};

function rowToSessionProperty(row: CanonicalPropertyRow, targetTenure: string, listingType: ListingType): SessionProperty {
    // Only use authentic data from the DB. 
    // We remove hardcoded fallback formulas (e.g. 7% rates, exactly 20% down, flat +5% ROI adjustments) 
    // because they produce identical, inaccurate values for all properties.
    const price = row.last_price ?? 0;
    
    // We read directly from row attributes if the backend ever adds them.
    // If they don't exist, we leave them null so the UI realistically shows '-'
    const rate = row.mortgage_interest_rate ?? null;
    const downPayment = row.mortgage_down_payment ?? null;
    const loanTerm = row.mortgage_term_years ?? null;
    const estMonthlyPayment = row.est_monthly_payment ?? null;

    const pricePerSqft = row.price_per_sqft ?? (price && row.sqft ? price / row.sqft : null);
    
    // Use only the DB value — never fall back to the hardcoded $350 Miami baseline.
    // percent_above_market is computed server-side against the dynamic market_metrics
    // baseline. If the DB value is null (no market_metrics row for this market),
    // the UI renders "—" which is the correct behavior per the blueprint.
    const percentAboveMarket = row.percent_above_market ?? null;

    let pricePerBedroom = row.price_per_bedroom ?? null;
    if (pricePerBedroom === null && price > 0 && row.bedrooms && row.bedrooms > 0) {
        pricePerBedroom = price / row.bedrooms;
    }

    let estimatedROI = row.estimated_roi ?? null;
    if (estimatedROI === null && price > 0 && estMonthlyPayment !== null && estMonthlyPayment > 0) {
        estimatedROI = ((estMonthlyPayment * 12 * 0.7) / price) + 0.05;
    }

    return {
    id: row.id,
    address: row.address_norm ?? '',
    city_name: '',
    state: '',
    zip: '',
    latitude: row.lat ?? null,
    longitude: row.lng ?? null,
    property_type: row.property_type ?? null,
    beds: row.bedrooms ?? null,
    baths: row.bathrooms ?? null,
    sqft: row.sqft ?? null,
    list_price: row.last_price ?? null,
    sold_price: targetTenure === 'sold' ? row.last_price ?? null : null,
    sold_date: null,
    rent_price: targetTenure === 'for_rent' ? row.last_price ?? null : null,
    image_url: row.image_url ?? null,
    image_urls: row.image_urls ?? null,
    listing_url: row.listing_url ?? null,
    listing_agent: row.listing_agent ?? null,
    extracted_at: row.created_at ?? null,
    days_on_market: row.days_on_market ?? null,
    price_per_sqft: pricePerSqft,
    deal_score: row.deal_score ?? null,
    
    // Enriched
    deal_category: row.deal_category ?? null,
    size_category: row.size_category ?? null,
    price_tier: row.price_tier ?? null,
    percent_above_market: percentAboveMarket,
    price_per_bedroom: pricePerBedroom,
    estimated_roi: estimatedROI,
    
    mortgage_interest_rate: rate,
    mortgage_down_payment: downPayment,
    mortgage_term_years: loanTerm,
    est_monthly_payment: estMonthlyPayment,
    
    // AI
    investment_analysis: row.investment_analysis ?? null,
    buyer_profile: row.buyer_profile ?? null,
    risk_assessment: row.risk_assessment ?? null,
    neighborhood_insights: row.neighborhood_insights ?? null,
    negotiation_strategy: row.negotiation_strategy ?? null,
    competitive_position: row.competitive_position ?? null,
    showing_priority: row.showing_priority ? parseInt(row.showing_priority) : null,
    ai_notes: row.ai_notes || row.AI_notes || null,
    agent_rationale: row.agent_rationale ?? null,
    
    // Rental
    investment_potential: row.investment_potential ?? null,
    ideal_tenant_profile: row.ideal_tenant_profile ?? null,
    roi_estimate: row.roi_estimate ?? null,
    
    // Sold
    ai_summary: row.ai_summary ?? null,
    ai_investment_score: row.ai_investment_score ?? null,
    ai_comp_analysis: row.ai_comp_analysis ?? null,
    
    // Market Intel
    opportunity_type: row.opportunity_type ?? null,
    market_position: row.market_position ?? null,
    priority_level: row.priority_level ?? null,
    investment_score: row.investment_score ?? null,
    comparable_analysis: row.comparable_analysis ?? null,
    seller_opportunity_analysis: row.seller_opportunity_analysis ?? null,
    market_insights: row.market_insights ?? null,
    client_action_items: row.client_action_items ?? null,
    buyer_profile_match: row.buyer_profile_match ?? null,
    
    source: row.source_of_truth ?? 'api',
    intent: listingType,
  };
}

export function useProperties(
  listingType: ListingType = 'for_sale',
  sortField: keyof SessionProperty | null = null,
  sortDir: 'asc' | 'desc' = 'desc'
) {
  const { currentMarket } = useMarket();
  if (DEMO_MODE) {
    const demoProperties = getMockSessionPropertiesForMarket(currentMarket.id, listingType);
    return {
      properties: demoProperties,
      loading: false,
      error: null as Error | null,
      refresh: async () => {},
      deleteProperties: async (_ids: string[]) => true,
      lastRefreshed: new Date(),
    };
  }
  const [properties, setProperties] = useState<SessionProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!currentMarket?.id) {
      setProperties([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const targetTenure = TENURE_MAP[listingType];

      // Query canonical_properties — the table the new API-driven pipeline writes to.
      // Column list must match the actual DB schema (migrations 006/007).
        // We apply order based on the requested sortField if it maps to a DB column.
        // Fallback to deal_score if no sort is provided or if it's a derived/UI-only field.
        const dbSortField = sortField && sortField !== 'id' ? sortField : 'deal_score';
        
        const { data, error: sbError } = await supabase
        .from('canonical_properties')
        .select(`
          id, address_norm, lat, lng, property_type, bedrooms, bathrooms, sqft, last_price, 
          days_on_market, deal_score, tenure, source_of_truth, market_slug, created_at,
          deal_category, size_category, price_tier, price_per_sqft, percent_above_market,
          price_per_bedroom, estimated_roi, listing_agent,
          mortgage_interest_rate, mortgage_down_payment, mortgage_term_years, est_monthly_payment,
          investment_analysis, buyer_profile, risk_assessment, neighborhood_insights,
          negotiation_strategy, competitive_position, showing_priority,
          investment_potential, ideal_tenant_profile, roi_estimate,
          ai_summary, ai_investment_score, ai_comp_analysis,
          opportunity_type, market_position, priority_level, investment_score,
          comparable_analysis, seller_opportunity_analysis, market_insights,
          client_action_items, buyer_profile_match, ai_notes, AI_notes, agent_rationale,
          image_url, image_urls, listing_url
        `)
        .eq('market_slug', currentMarket.id)
        .eq('tenure', targetTenure)
        .order(dbSortField as string, { ascending: sortDir === 'asc', nullsFirst: false })
        .limit(100);

      if (sbError) throw sbError;

      const rows = (data ?? []) as CanonicalPropertyRow[];
      const normalized: SessionProperty[] = rows.map(row =>
        rowToSessionProperty(row, targetTenure, listingType)
      );

      setProperties(normalized);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      let message = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        message = String((err as { message: unknown }).message);
      } else {
        message = String(err);
      }
      setError(new Error(message));
      console.error(`[useProperties] Error fetching ${listingType} for ${currentMarket?.id}:`, err);
    } finally {
      setLoading(false);
    }
  }, [currentMarket?.id, listingType, sortField, sortDir]);

  // Fetch on mount and when market or tab changes
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ── Real-time synchronization: typed Domino subscription ──────────────────
  // Uses subscribeToDominoEvents() which enforces market_slug matching internally.
  // This prevents a Sacramento scan from refreshing the San Diego Properties tab.
  useEffect(() => {
    const tenure = TENURE_MAP[listingType] as DominoTenure;
    const marketId = currentMarket?.id;
    if (!marketId) return;

    const unsubscribe = subscribeToDominoEvents(
      (payload) => {
        // Tenure guard: only refresh if this event is for our current listing type
        // (or if the backend didn't specify a tenure — treat as "all tabs")
        if (payload.tenure && payload.tenure !== tenure) return;

        PipelineTrace.log('properties_fetched', {
          job_id: payload.job_id,
          market_slug: payload.market_slug,
          tenure,
          count: payload.properties_count,
          detail: { trigger: 'domino_event' },
        });
        fetchProperties();
      },
      { market_slug: marketId } // Market fingerprint guard
    );

    return unsubscribe;
  }, [fetchProperties, currentMarket?.id, listingType]);

  // ── Fallback synchronization: job store completion watcher ────────────────
  // Guards against stale job completions via lastHandledJobRef.
  // Prevents: old Sacramento scan completing after user switched to San Diego.
  const lastHandledJobRef = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = useJobStore.subscribe((state, prevState) => {
      const marketId = currentMarket?.id;
      if (!marketId) return;

      const currentJobs = Object.values(state.jobs).filter(
        (j) => j.marketSlug === marketId
      );
      const prevJobs = Object.values(prevState.jobs).filter(
        (j) => j.marketSlug === marketId
      );

      for (const job of currentJobs) {
        // Dedup: already handled this job's completion
        if (lastHandledJobRef.current === job.jobId) continue;

        const prevJob = prevJobs.find((pj) => pj.jobId === job.jobId);
        const wasNotTerminal = prevJob && !['completed', 'partial_success'].includes(prevJob.status);
        const isNowTerminal = ['completed', 'partial_success'].includes(job.status);

        if (wasNotTerminal && isNowTerminal) {
          lastHandledJobRef.current = job.jobId;
          PipelineTrace.log('properties_fetched', {
            job_id: job.jobId,
            market_slug: marketId,
            tenure: listingType,
            detail: { trigger: 'job_completion_fallback', status: job.status },
          });
          fetchProperties();
        }
      }
    });

    return unsubscribe;
  }, [fetchProperties, currentMarket?.id, listingType]);

  const deleteProperties = useCallback(async (ids: string[]) => {
    try {
      const { error: sbError } = await supabase
        .from('canonical_properties')
        .delete()
        .in('id', ids);

      if (sbError) throw sbError;
      setProperties(prev => prev.filter(p => !ids.includes(p.id)));
      return true;
    } catch (err: unknown) {
      console.error(`[useProperties] Error deleting properties:`, err);
      return false;
    }
  }, []);

  return {
    properties,
    loading,
    error,
    refresh: fetchProperties,
    deleteProperties,
    lastRefreshed
  };
}
