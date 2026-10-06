/* ═══════════════════════════════════════════════════════════
   REMI/OMERION — TypeScript Type Definitions
   ═══════════════════════════════════════════════════════════ */

export interface Property {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: 'house' | 'condo' | 'townhouse' | 'apartment' | 'multi-family' | 'other';
  neighborhood: string;
  listingAgent: string;
  listingStatus: 'for_sale' | 'for_rent' | 'sold' | 'pending';
  city?: string;
  state_province?: string;
  dealScore: number | null;
  investmentScore: number;
  lat: number;
  lng: number;
  zillowUrl: string;
  mlsId?: string;
  listedAt: string;
  updatedAt: string;
  daysOnMarket: number;
  lotSize?: number;
  yearBuilt?: number;
  description?: string;
  imageUrls: string[];
  priceHistory?: Array<{ date: string; price: number; event: string }>;
  priceTier: string;
  sizeCategory: string;
  dealCategory: string;
  pricePerSqft: number;
  /** Which job wrote this property — used for Realtime event correlation */
  sourceJobId?: string | null;

  // AI-Enhanced Narrative
  investmentAnalysis?: string;
  buyerProfile?: string;
  riskAssessment?: string;
  showingPriority?: string;
  neighborhoodInsights?: string;
  negotiationStrategy?: string;
  competitivePosition?: string;

  // Rental AI
  investmentPotential?: string;
  idealTenantProfile?: string;
  roiEstimate?: string;

  // Sold AI
  aiSummary?: string;
  aiInvestmentScore?: number;
  aiCompAnalysis?: string;

  // Market Intel AI
  opportunityType?: string;
  marketPosition?: string;
  priorityLevel?: string;
  comparableAnalysis?: string;
  sellerOpportunityAnalysis?: string;
  marketInsights?: string;
  clientActionItems?: string;
  aiNotes?: string;
}

// Deal Scout Status Type
export interface DealScoutStatus {
  id?: string;
  user_id?: string;
  is_active: boolean;
  last_scan_at?: string | null;
  next_scan_at?: string | null;
  matches_since?: number;
  matches_since_date?: string | null;
  scan_regions?: string[];
  scan_types?: string[];
  price_min?: number;
  price_max?: number;
  score_min?: number;
  created_at?: string;
  updated_at?: string;
}

// User Profile Type
export interface UserProfile {
  userId?: string;
  goals?: InvestmentGoal[];
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive' | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  propertyTypes?: string[];
  neighborhoods?: string[];
  minDealScore?: number;
  aiScoutingEnabled?: boolean;
  market_slug?: string;
  created_at?: string;
  updated_at?: string;
  // Database fields mapping
  user_id?: string;
  investment_goals?: InvestmentGoal[];
  risk_tolerance?: 'conservative' | 'moderate' | 'aggressive' | null;
  budget_min?: number | null;
  budget_max?: number | null;
  property_types?: string[];
  min_deal_score?: number;
  ai_scouting_enabled?: boolean;
  // Investor parameters (Sprint 3)
  capRateTarget?: number | null;
  ltvTarget?: number | null;
  preferredPropertyClasses?: string[] | null;
  targetIrr?: number | null;
  cap_rate_target?: number | null;
  ltv_target?: number | null;
  preferred_property_classes?: string[] | null;
  target_irr?: number | null;
}

export type InvestmentGoal =
  | 'cash_flow'
  | 'appreciation'
  | 'fix_and_flip'
  | 'rental_income'
  | 'primary_residence'
  | 'portfolio_diversification';

export interface MarketPulse {
  hotDeals: number;
  newListings: number;
  priceDrops: number;
  trendingArea: string;
  lastSynced: string;
  source: string;
}

export interface MarketTrend {
  date: string;
  forSaleAvg: number;
  soldAvg: number;
  dealCount?: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  imageUrl: string;
  url: string;
  publishedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface Alert {
  id: string;
  userId: string;
  name: string;
  conditions: AlertConditions;
  frequency: 'instant' | 'daily' | 'weekly';
  channel: 'in-app' | 'email' | 'both';
  status: 'active' | 'paused';
  lastTriggered: string | null;
  createdAt: string;
}

export interface AlertConditions {
  minDealScore?: number;
  priceMin?: number;
  priceMax?: number;
  neighborhoods?: string[];
  propertyTypes?: string[];
  triggerType: 'new_listing' | 'price_drop' | 'status_change' | 'deal_spike' | 'market_shift';
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  searchState: Record<string, unknown>;
  boundaryGeometry?: GeoJSON.Geometry;
  createdAt: string;
  alertEnabled: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly';
}

export interface FilterState {
  status: string[];
  priceMin: number;
  priceMax: number;
  bedsMin: number;
  bathsMin: number;
  propertyTypes: string[];
  minDealScore: number;
  sqftMin: number;
  sqftMax: number;
  yearBuiltMin: number;
  yearBuiltMax: number;
  daysOnMarketMax: number;
  neighborhoods: string[];
  sortBy: SortOption;
}

export type SortOption =
  | 'deal_score_desc'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'bedrooms_desc'
  | 'sqft_desc'
  | 'investment_score_desc'
  | 'days_on_market_asc';

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/* ═══════════════════════════════════════════════════════════
   ONTOLOGY TYPES (Phase 2 — Map OS)
   ═══════════════════════════════════════════════════════════ */

export interface OntologyProperty {
  id: string;
  address: string;
  unit?: string;
  city: string;
  state: string;
  zip?: string;
  property_type: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  year_built?: number;
  deal_score?: number | null;
  momentum?: string;
  image_url?: string;
  image_urls?: string[];
  last_sale_price?: number;
  estimated_value?: number;
  lat?: number;
  lng?: number;
  created_at?: string;
  updated_at?: string;
}

export type MarketEventType =
  | 'listing_created' | 'price_reduced' | 'price_increased'
  | 'under_contract' | 'back_on_market' | 'closed_sale'
  | 'withdrawn' | 'expired' | 'permit_filed'
  | 'market_alert' | 'status_changed';

export interface OntologyEvent {
  id: string;
  event_type: MarketEventType;
  severity: 'info' | 'notable' | 'significant' | 'critical';
  occurred_at: string;
  lat?: number;
  lng?: number;
  property_id?: string;
  listing_id?: string;
  region_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface OntologyRegion {
  id: string;
  name: string;
  display_name?: string;
  region_type: string;
  centroid_lat?: number;
  centroid_lng?: number;
  color_hex?: string;
  boundary_geojson?: GeoJSON.Geometry;
  metrics?: Record<string, number>;
}

export interface PropertyDossier {
  property: OntologyProperty;
  active_listing?: {
    id: string;
    list_price: number;
    status: string;
    listed_date: string;
    days_on_market?: number;
    price_per_sqft?: number;
    mls_number?: string;
    description?: string;
    image_urls?: string[];
  };
  listings_history: Array<{
    id: string;
    list_price: number;
    sold_price?: number;
    status: string;
    listed_date: string;
    sold_date?: string;
  }>;
  events: OntologyEvent[];
  region?: OntologyRegion | null;  // Phase 2 — populated by backend in future
  nearby_activity?: {
    active_listings: number;
    recent_sales: number;
    developments: number;
  };
}

export interface MapLayerConfig {
  id: string;
  label: string;
  icon: string;
  available: boolean;
  desc: string;
  category: 'data' | 'boundary' | 'event';
}

/* ═══════════════════════════════════════════════════════════
   CHAT AI TYPES (Phase 4 — Workflows + AI)
   ═══════════════════════════════════════════════════════════ */

export type ActionType = 'view_on_map' | 'set_alert' | 'run_comps' | 'view_property' | 'ask_followup';

export interface SuggestedAction {
  type: ActionType;
  label: string;
  data?: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  actions?: SuggestedAction[];
  propertyIds?: string[];
  regionIds?: string[];
  mapHighlights?: Array<{ lat: number; lng: number; label: string }>;
  confidence?: number;
  source?: string;
  jobId?: string;
  analysisType?: string;
}

