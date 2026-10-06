/**
 * Matches the canonical_properties table written by the backend's DataGateway.
 * Columns from migrations 006, 007, 016, 018.
 */
export type CanonicalPropertyRow = {
  id: string;
  canonical_place_id: string | null;
  market_slug: string;
  address_norm: string;
  unit_norm: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  property_type: string | null;
  tenure: string | null;
  last_price: number | null;
  currency: string | null;
  days_on_market: number | null;
  deal_score: number | null;
  deal_score_computed_at: string | null;
  deal_score_rationale: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  source_of_truth: string | null;
  source_payload_ref: Record<string, unknown> | null;
  source_job_id: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  listing_url: string | null;
  listing_agent?: string | null;
  
  // Enriched Metrics
  deal_category: string | null;
  size_category: string | null;
  price_tier: string | null;
  price_per_sqft: number | null;
  percent_above_market: number | null;
  price_per_bedroom: number | null;
  estimated_roi: number | null;
  est_monthly_payment: number | null;
  mortgage_interest_rate: number | null;
  mortgage_down_payment: number | null;
  mortgage_term_years: number | null;
  
  // AI Fields
  ai_fields: Record<string, any> | null;
  buyer_profile: string | null;
  risk_assessment: string | null;
  investment_analysis: string | null;
  neighborhood_insights: string | null;
  negotiation_strategy: string | null;
  competitive_position: string | null;
  showing_priority: string | null;
  ai_notes: string | null;
  agent_rationale: string | null;
  
  // Rental AI Fields
  investment_potential: string | null;
  ideal_tenant_profile: string | null;
  roi_estimate: string | null;
  
  // Sold AI Fields
  ai_summary: string | null;
  ai_investment_score: number | null;
  ai_comp_analysis: string | null;
  
  // Market Intel AI Fields
  opportunity_type: string | null;
  market_position: string | null;
  priority_level: string | null;
  investment_score: number | null;
  comparable_analysis: string | null;
  seller_opportunity_analysis: string | null;
  buyer_profile_match: string | null;
  market_insights: string | null;
  client_action_items: string | null;
  AI_notes: string | null;
  
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      listings: {
        Row: {
          id: string;
          tenant_id: string;
          listing_type: string;
          address: string;
          price: number;
          bedrooms: number;
          bathrooms: number;
          sqft: number;
          property_type: string;
          listing_url: string | null;
          // Geo coords (populated by backend geocoder)
          lat: number | null;
          lng: number | null;
          // Scraped/enriched extra data stored as jsonb
          raw_data: {
            listing_url?: string;
            listing_agent?: string;
            image_urls?: string[];
            neighborhood?: string;
            days_on_market?: number;
            year_built?: number;
            description?: string;
            zillow_url?: string;
            [key: string]: unknown;
          } | null;
          // Computed by backend agents
          calculated_fields: {
            deal_score?: number;
            deal_category?: string;
            price_tier?: string;
            size_category?: string;
            price_per_sqft?: number;
            est_monthly_payment?: number;
            percent_above_market?: number;
            price_per_bedroom?: number;
            estimated_roi?: number;
            mortgage_interest_rate?: number;
            mortgage_down_payment?: number;
            mortgage_term_years?: number;
            [key: string]: unknown;
          } | null;
          // AI-generated narrative fields
          ai_fields: {
            investment_analysis?: string;
            buyer_profile?: string;
            competitive_position?: string;
            risk_assessment?: string;
            showing_priority?: number;
            neighborhood_insights?: string;
            negotiation_strategy?: string;
            // Rental tab
            investment_potential?: string;
            ideal_tenant_profile?: string;
            roi_estimate?: string;
            // Sold tab
            ai_summary?: string;
            ai_investment_score?: string;
            ai_comp_analysis?: string;
            // Market Intel tab
            opportunity_type?: string;
            market_position?: string;
            priority_level?: string;
            investment_score?: number;
            client_action_items?: string;
            seller_opportunity_analysis?: string;
            buyer_profile_match?: string;
            ai_notes?: string;
            [key: string]: unknown;
          } | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      deal_scout_status: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          is_active: boolean;
          scan_regions: string[];
          scan_types: string[] | null;
          price_min: number | null;
          price_max: number | null;
          score_min: number | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          session_id?: string;
          is_active: boolean;
          scan_regions?: string[];
          scan_types?: string[] | null;
          price_min?: number | null;
          price_max?: number | null;
          score_min?: number | null;
        };
        Update: Partial<Database['public']['Tables']['deal_scout_status']['Insert']>;
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          market_slug: string;
          investment_goals: string[] | null;
          risk_tolerance: 'conservative' | 'moderate' | 'aggressive' | null;
          budget_min: number | null;
          budget_max: number | null;
          property_types: string[] | null;
          neighborhoods: string[] | null;
          min_deal_score: number | null;
          ai_scouting_enabled: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          market_slug: string;
          investment_goals?: string[] | null;
          risk_tolerance?: 'conservative' | 'moderate' | 'aggressive' | null;
          budget_min?: number | null;
          budget_max?: number | null;
          property_types?: string[] | null;
          neighborhoods?: string[] | null;
          min_deal_score?: number | null;
          ai_scouting_enabled?: boolean;
        };
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          last_message_at: string | null;
          message_count: number;
          is_archived: boolean;
          market_context: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          last_message_at?: string | null;
          message_count?: number;
          is_archived?: boolean;
          market_context?: Record<string, unknown> | null;
        };
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>;
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          created_at: string;
          token_count: number | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          created_at?: string;
          token_count?: number | null;
        };
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>;
      };
    };
  };
}
