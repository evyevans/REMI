/**
 * chatService.ts — Chat Payload Construction
 *
 * PHASE 4: Adds explicit analysis_type field and enriched geographic_context
 * with country, state_abbr, city_name, and neighborhood_name.
 *
 * The backend no longer needs to regex-infer the analysis type
 * from the chat message text.
 */

import type { Market } from '../stores/marketStore';

export interface GeographicContext {
  market_slug: string;       // "yorkville-toronto-on-ca"
  display_name: string;      // "Yorkville, Toronto, ON"
  lat: number;               
  lng: number;               
  bounds: {
    sw: { lat: number; lng: number };
    ne: { lat: number; lng: number };
  } | null;
  resolution: 'neighborhood' | 'city' | 'state';
  country?: string;            // "US" | "CA"
  state_abbr?: string;         // "ON", "FL"
  city_name?: string;          // "Toronto", "Miami"
  neighborhood_name?: string | null;  // "Yorkville" | null
}

export interface MapFiltersPayload {
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  beds_max?: number;
  baths_min?: number;
  baths_max?: number;
  home_type?: string;
}

export interface ChatPayload {
  message: string;
  conversation_id: string;
  analysis_type: string | null;  // EXPLICIT — never inferred from text
  geographic_context: GeographicContext;
  filters?: MapFiltersPayload;   // Phase 5: Map UI filters
  timestamp: string;
}

// Derives resolution tier from market data
function deriveResolution(market: Market): GeographicContext['resolution'] {
  if ((market as any).resolution) return (market as any).resolution;
  
  const parts = market.id.split('-');
  if (parts.length >= 4) return 'neighborhood';
  return 'city'; // safe default
}

export function buildChatPayload(
  message: string,
  conversationId: string,
  market: Market,
  analysisType?: string,
  filters?: MapFiltersPayload,
  cascade?: { neighborhood?: { name: string } | null } | null,
): ChatPayload {
  return {
    message,
    conversation_id: conversationId,
    analysis_type: analysisType ?? null,
    geographic_context: {
      market_slug:  market.id,
      display_name: market.displayName,
      lat:          market.lat,
      lng:          market.lng,
      bounds: market.bounds ? {
        sw: { lat: market.bounds[0][0], lng: market.bounds[0][1] },
        ne: { lat: market.bounds[1][0], lng: market.bounds[1][1] },
      } : null,
      resolution: deriveResolution(market),
      country: market.country,
      state_abbr: (market as any).state_province || (market as any).abbr,
      city_name: (market as any).city,
      neighborhood_name: cascade?.neighborhood?.name ?? null,
    },
    ...(filters ? { filters } : {}),
    timestamp: new Date().toISOString(),
  };
}
