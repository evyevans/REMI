/* ═══════════════════════════════════════════════════════════
   REMI SHOWCASE — Hyper-Realistic Austin, TX Mock Data
   ───────────────────────────────────────────────────────────
   This module powers the frontend-only showcase deploy. Because
   there is no Supabase / FastAPI backend, each data hook returns
   the mocks below via a `if (DEMO_MODE) return ...` early branch.

   Everything is Austin, TX (the guest market). All timestamps are
   computed relative to `new Date()` so the UI never looks stale.
   Single source of truth: MOCK_PROPERTIES — the session list,
   deal-scout opportunities and market-intel records are derived
   from it so ids / addresses / prices stay consistent everywhere.
   ═══════════════════════════════════════════════════════════ */

import type { Property, ChatResponse, Alert } from '../types';
import type { SessionProperty } from '../hooks/useProperties';
import type { DealOpportunity, DealScoutResponse } from '../hooks/useDealScout';
import type { AgentTask } from '../hooks/useAgentActivity';
import type { FullMarketIntelRecord } from '../hooks/useFullMarketIntel';
import type { ScoutStatus } from '../hooks/useDealScoutStatus';
import type { SimulationJob } from '../stores/simulationStore';
import type { Market } from '../stores/marketStore';

/** Master demo flag. Hooks short-circuit to mock data when true. */
export const DEMO_MODE = true;

/* ── Time helpers (relative → never stale) ─────────────────── */
const NOW = () => new Date();
const daysAgoISO = (d: number) => new Date(NOW().getTime() - d * 86_400_000).toISOString();
const minsAgoISO = (m: number) => new Date(NOW().getTime() - m * 60_000).toISOString();
const minsFromNowISO = (m: number) => new Date(NOW().getTime() + m * 60_000).toISOString();

/* ═══════════════════════════════════════════════════════════
   1. PROPERTIES — 20 Austin listings (12 for_sale, 4 sold, 4 for_rent)
   ═══════════════════════════════════════════════════════════ */

interface PropSeed {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  propertyType: Property['propertyType'];
  neighborhood: string;
  listingStatus: Property['listingStatus'];
  dealScore: number | null;
  investmentScore: number;
  lat: number;
  lng: number;
  daysOnMarket: number;
  priceTier: string;
  dealCategory: string;
  listingAgent: string;
  yearBuilt: number;
  /** City + state. Optional — defaults to Austin, TX for the original seed set. */
  city?: string;
  state?: string;
  investmentAnalysis: string;
  buyerProfile: string;
  riskAssessment: string;
  neighborhoodInsights: string;
  negotiationStrategy: string;
}

const sizeCategoryFor = (sqft: number): string =>
  sqft < 900 ? 'Compact' : sqft < 1600 ? 'Mid-Size' : sqft < 2600 ? 'Spacious' : 'Estate';

function mkProp(s: PropSeed): Property {
  const isRent = s.listingStatus === 'for_rent';
  return {
    id: s.id,
    address: s.address,
    price: s.price,
    bedrooms: s.bedrooms,
    bathrooms: s.bathrooms,
    sqft: s.sqft,
    propertyType: s.propertyType,
    neighborhood: s.neighborhood,
    listingAgent: s.listingAgent,
    listingStatus: s.listingStatus,
    city: s.city ?? 'Austin',
    state_province: s.state ?? 'TX',
    dealScore: s.dealScore,
    investmentScore: s.investmentScore,
    lat: s.lat,
    lng: s.lng,
    zillowUrl: `https://www.zillow.com/homedetails/${s.id}_zpid/`,
    mlsId: `ABOR-${s.id.slice(0, 7).toUpperCase()}`,
    listedAt: daysAgoISO(s.daysOnMarket),
    updatedAt: minsAgoISO(120 + s.daysOnMarket * 3),
    daysOnMarket: s.daysOnMarket,
    lotSize: s.propertyType === 'condo' ? undefined : Math.round(s.sqft * (2.2 + (s.bedrooms % 3))),
    yearBuilt: s.yearBuilt,
    description: `${s.neighborhood} ${s.propertyType} — ${s.bedrooms}BD/${s.bathrooms}BA, ${s.sqft.toLocaleString()} sqft. ${isRent ? 'Available now.' : 'Move-in ready.'}`,
    imageUrls: [],
    priceHistory: isRent
      ? undefined
      : [
          { date: daysAgoISO(s.daysOnMarket), price: s.price, event: 'Listed' },
          ...(s.dealCategory === 'Hot Deal'
            ? [{ date: daysAgoISO(Math.max(1, Math.floor(s.daysOnMarket / 2))), price: Math.round(s.price * 1.04), event: 'Price reduced' }]
            : []),
        ],
    priceTier: s.priceTier,
    sizeCategory: sizeCategoryFor(s.sqft),
    dealCategory: s.dealCategory,
    pricePerSqft: isRent ? Math.round((s.price * 12) / s.sqft) : Math.round(s.price / s.sqft),
    investmentAnalysis: s.investmentAnalysis,
    buyerProfile: s.buyerProfile,
    riskAssessment: s.riskAssessment,
    showingPriority: s.dealScore && s.dealScore >= 8 ? 'High' : s.dealScore && s.dealScore >= 7 ? 'Medium' : 'Standard',
    neighborhoodInsights: s.neighborhoodInsights,
    negotiationStrategy: s.negotiationStrategy,
    competitivePosition: s.dealCategory === 'Hot Deal' ? 'Strong — priced below comparable inventory' : 'Balanced with the submarket',
    roiEstimate: isRent ? '6.4% gross yield' : `${(5.8 + (s.investmentScore - 6) * 0.4).toFixed(1)}% projected`,
    aiSummary: s.investmentAnalysis,
    aiInvestmentScore: s.investmentScore,
    opportunityType: s.dealCategory === 'Hot Deal' ? 'Value Add' : isRent ? 'Cash Flow' : 'Appreciation',
    marketPosition: s.dealCategory === 'Hot Deal' || s.dealCategory === 'Good Value' ? 'Undervalued' : 'At Market',
    priorityLevel: s.dealScore && s.dealScore >= 8 ? 'High' : s.dealScore && s.dealScore >= 7 ? 'Medium' : 'Low',
  };
}

export const MOCK_PROPERTIES: Property[] = [
  // ── Top deals (for_sale, dealScore ≥ 8.0) ──────────────────
  mkProp({
    id: 'a1b2c3d4-0001-4a1a-9b01-austin000001',
    address: '2847 S Congress Ave, Austin, TX 78704',
    price: 485000, bedrooms: 2, bathrooms: 2, sqft: 1180, propertyType: 'condo',
    neighborhood: 'South Congress', listingStatus: 'for_sale', dealScore: 9.1, investmentScore: 9,
    lat: 30.2489, lng: -97.7501, daysOnMarket: 6, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Marcus Bell · Compass', yearBuilt: 2019,
    investmentAnalysis: 'Priced ~14% below comparable SoCo condos with strong short-term rental demand and walkability to South Congress retail.',
    buyerProfile: 'Cash-flow investor or owner-occupant seeking SoCo walkability',
    riskAssessment: 'Low — stabilized HOA, no deferred maintenance, high-demand submarket.',
    neighborhoodInsights: 'South Congress leads Austin in foot traffic; inventory turns in under 3 weeks.',
    negotiationStrategy: 'Move quickly with a clean offer; limited contingencies win here.',
  }),
  mkProp({
    id: 'a1b2c3d4-0002-4a1a-9b02-austin000002',
    address: '1614 E 12th St, Austin, TX 78702',
    price: 619000, bedrooms: 3, bathrooms: 2, sqft: 1540, propertyType: 'house',
    neighborhood: 'East Austin', listingStatus: 'for_sale', dealScore: 8.7, investmentScore: 9,
    lat: 30.2731, lng: -97.7204, daysOnMarket: 9, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Priya Nandakumar · Realty Austin', yearBuilt: 2016,
    investmentAnalysis: 'East Austin bungalow priced under recent comps; rapid appreciation corridor with new mixed-use nearby.',
    buyerProfile: 'Appreciation-focused buyer comfortable with an evolving block',
    riskAssessment: 'Moderate — gentrifying corridor, some construction noise near MLK.',
    neighborhoodInsights: 'East Austin posted the highest YoY price growth of any Austin submarket.',
    negotiationStrategy: 'Offer at ask with a short option period to stand out.',
  }),
  mkProp({
    id: 'a1b2c3d4-0003-4a1a-9b03-austin000003',
    address: '4203 Berkman Dr, Austin, TX 78723',
    price: 712000, bedrooms: 4, bathrooms: 3, sqft: 2240, propertyType: 'house',
    neighborhood: 'Mueller', listingStatus: 'for_sale', dealScore: 8.3, investmentScore: 8,
    lat: 30.2998, lng: -97.7045, daysOnMarket: 12, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'David Okafor · Keller Williams', yearBuilt: 2018,
    investmentAnalysis: 'Mueller new-urbanist home near the greenway; energy-efficient build keeps carrying costs low.',
    buyerProfile: 'Family owner-occupant wanting walkable master-planned living',
    riskAssessment: 'Low — HOA-maintained district, consistent resale demand.',
    neighborhoodInsights: 'Mueller commands a premium for its parks, Saturday market, and walkability.',
    negotiationStrategy: 'Comp-backed full-price offer; sellers rarely budge in Mueller.',
  }),
  // ── Remaining for_sale ─────────────────────────────────────
  mkProp({
    id: 'a1b2c3d4-0004-4a1a-9b04-austin000004',
    address: '906 Barton Blvd, Austin, TX 78704',
    price: 845000, bedrooms: 3, bathrooms: 2, sqft: 1860, propertyType: 'house',
    neighborhood: 'Barton Hills', listingStatus: 'for_sale', dealScore: 7.8, investmentScore: 8,
    lat: 30.2547, lng: -97.7896, daysOnMarket: 15, priceTier: 'Luxury', dealCategory: 'Good Value',
    listingAgent: 'Sofia Reyes · Moreland Properties', yearBuilt: 1972,
    investmentAnalysis: 'Barton Hills ranch near Zilker; lot value alone supports the price with renovation upside.',
    buyerProfile: 'Owner-occupant or light-renovation flipper',
    riskAssessment: 'Moderate — original systems may need updating within 5 years.',
    neighborhoodInsights: 'Barton Hills offers Zilker/Greenbelt access with top-rated schools.',
    negotiationStrategy: 'Request seller credits for HVAC/roof in lieu of price cut.',
  }),
  mkProp({
    id: 'a1b2c3d4-0005-4a1a-9b05-austin000005',
    address: '4501 Speedway, Austin, TX 78751',
    price: 568000, bedrooms: 2, bathrooms: 1, sqft: 1120, propertyType: 'house',
    neighborhood: 'Hyde Park', listingStatus: 'for_sale', dealScore: 7.5, investmentScore: 7,
    lat: 30.3072, lng: -97.7287, daysOnMarket: 18, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Aaron Whitfield · Compass', yearBuilt: 1939,
    investmentAnalysis: 'Classic Hyde Park cottage near UT; steady rental demand from faculty and grad students.',
    buyerProfile: 'Long-term hold investor targeting university-adjacent rentals',
    riskAssessment: 'Moderate — 1930s build, verify foundation and electrical.',
    neighborhoodInsights: 'Hyde Park is a historic district with low vacancy and walk-to-campus appeal.',
    negotiationStrategy: 'Use inspection findings on the older systems as leverage.',
  }),
  mkProp({
    id: 'a1b2c3d4-0006-4a1a-9b06-austin000006',
    address: '11801 Domain Dr #312, Austin, TX 78758',
    price: 432000, bedrooms: 1, bathrooms: 1, sqft: 760, propertyType: 'condo',
    neighborhood: 'Domain', listingStatus: 'for_sale', dealScore: 7.2, investmentScore: 8,
    lat: 30.4012, lng: -97.7256, daysOnMarket: 21, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Lena Park · Urban Space', yearBuilt: 2021,
    investmentAnalysis: 'The Domain’s live-work-play core drives premium rents; turnkey condo with low maintenance.',
    buyerProfile: 'Cash-flow investor seeking tech-corridor tenants',
    riskAssessment: 'Low — newer build, strong corporate rental pipeline.',
    neighborhoodInsights: 'The Domain is north Austin’s “second downtown” with major tech employers.',
    negotiationStrategy: 'Negotiate HOA transfer fees and a rate buydown vs. price.',
  }),
  mkProp({
    id: 'a1b2c3d4-0007-4a1a-9b07-austin000007',
    address: '1209 Bouldin Ave, Austin, TX 78704',
    price: 1185000, bedrooms: 4, bathrooms: 3, sqft: 2680, propertyType: 'house',
    neighborhood: 'Bouldin Creek', listingStatus: 'for_sale', dealScore: 7.0, investmentScore: 7,
    lat: 30.2521, lng: -97.7589, daysOnMarket: 24, priceTier: 'Luxury', dealCategory: 'Fair Price',
    listingAgent: 'Marcus Bell · Compass', yearBuilt: 2015,
    investmentAnalysis: 'Modern Bouldin build walkable to downtown; premium finishes priced in line with the block.',
    buyerProfile: 'Luxury owner-occupant prioritizing location',
    riskAssessment: 'Low — recent construction, premium but liquid market.',
    neighborhoodInsights: 'Bouldin Creek blends bungalows and modern infill steps from Lady Bird Lake.',
    negotiationStrategy: 'Limited room; focus on closing terms and a quick close.',
  }),
  mkProp({
    id: 'a1b2c3d4-0008-4a1a-9b08-austin000008',
    address: '3401 Westlake Dr, Austin, TX 78746',
    price: 1395000, bedrooms: 4, bathrooms: 4, sqft: 3380, propertyType: 'house',
    neighborhood: 'Westlake', listingStatus: 'for_sale', dealScore: 6.6, investmentScore: 6,
    lat: 30.2876, lng: -97.8021, daysOnMarket: 31, priceTier: 'Luxury', dealCategory: 'Fair Price',
    listingAgent: 'Catherine Hollis · Moreland Properties', yearBuilt: 2010,
    investmentAnalysis: 'Eanes ISD estate with hill-country views; pricing reflects the school premium.',
    buyerProfile: 'Move-up family buyer prioritizing top schools',
    riskAssessment: 'Low — blue-chip district, slower but resilient resale.',
    neighborhoodInsights: 'Westlake’s Eanes ISD is consistently Texas’ top-ranked district.',
    negotiationStrategy: 'Longer DOM gives room — open below ask with comps.',
  }),
  mkProp({
    id: 'a1b2c3d4-0009-4a1a-9b09-austin000009',
    address: '2105 E Cesar Chavez St, Austin, TX 78702',
    price: 539000, bedrooms: 2, bathrooms: 2, sqft: 1290, propertyType: 'townhouse',
    neighborhood: 'East Austin', listingStatus: 'for_sale', dealScore: 8.0, investmentScore: 8,
    lat: 30.2558, lng: -97.7178, daysOnMarket: 8, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Priya Nandakumar · Realty Austin', yearBuilt: 2020,
    investmentAnalysis: 'New townhome on a hot E. Cesar Chavez block; strong STR and long-term rental comps.',
    buyerProfile: 'Investor or first-time buyer wanting low-maintenance East Austin',
    riskAssessment: 'Low — modern build, walkable to entertainment district.',
    neighborhoodInsights: 'E. Cesar Chavez is among Austin’s fastest-appreciating corridors.',
    negotiationStrategy: 'Clean, fast offer; these list low and escalate.',
  }),
  mkProp({
    id: 'a1b2c3d4-0010-4a1a-9b10-austin000010',
    address: '5508 Avenue F, Austin, TX 78751',
    price: 655000, bedrooms: 3, bathrooms: 2, sqft: 1610, propertyType: 'house',
    neighborhood: 'Hyde Park', listingStatus: 'for_sale', dealScore: 7.6, investmentScore: 7,
    lat: 30.3148, lng: -97.7231, daysOnMarket: 14, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Aaron Whitfield · Compass', yearBuilt: 1948,
    investmentAnalysis: 'Renovated Hyde Park home retaining period charm; turnkey with updated systems.',
    buyerProfile: 'Owner-occupant wanting character plus modern updates',
    riskAssessment: 'Low — recently updated mechanicals and roof.',
    neighborhoodInsights: 'Hyde Park’s tree-lined streets and low turnover protect value.',
    negotiationStrategy: 'Match ask; emphasize financing strength.',
  }),
  mkProp({
    id: 'a1b2c3d4-0011-4a1a-9b11-austin000011',
    address: '1900 Barton Springs Rd #114, Austin, TX 78704',
    price: 398000, bedrooms: 1, bathrooms: 1, sqft: 690, propertyType: 'condo',
    neighborhood: 'Barton Hills', listingStatus: 'for_sale', dealScore: 7.4, investmentScore: 8,
    lat: 30.2632, lng: -97.7711, daysOnMarket: 19, priceTier: 'Entry-Level', dealCategory: 'Good Value',
    listingAgent: 'Sofia Reyes · Moreland Properties', yearBuilt: 2017,
    investmentAnalysis: 'Entry-price condo steps from Barton Springs; magnet for renters wanting Zilker access.',
    buyerProfile: 'First-time buyer or yield-focused investor',
    riskAssessment: 'Low — high-demand location, modest HOA.',
    neighborhoodInsights: 'Barton Springs Rd offers year-round recreation demand.',
    negotiationStrategy: 'Ask for a closing-cost credit; price is already tight.',
  }),
  mkProp({
    id: 'a1b2c3d4-0012-4a1a-9b12-austin000012',
    address: '8712 N Lamar Blvd, Austin, TX 78753',
    price: 462000, bedrooms: 3, bathrooms: 2, sqft: 1440, propertyType: 'house',
    neighborhood: 'North Lamar', listingStatus: 'for_sale', dealScore: null, investmentScore: 6,
    lat: 30.3589, lng: -97.7012, daysOnMarket: 27, priceTier: 'Mid-Range', dealCategory: 'Fair Price',
    listingAgent: 'David Okafor · Keller Williams', yearBuilt: 1985,
    investmentAnalysis: 'Affordable single-family with value-add potential on a deep lot near transit.',
    buyerProfile: 'Value-add investor or budget owner-occupant',
    riskAssessment: 'Moderate — dated interior, score pending fresh comps.',
    neighborhoodInsights: 'North Lamar offers some of central Austin’s last affordable detached homes.',
    negotiationStrategy: 'Lead with inspection-based concessions.',
  }),
  // ── Sold (4) ───────────────────────────────────────────────
  mkProp({
    id: 'a1b2c3d4-0013-4a1a-9b13-austin000013',
    address: '1305 Newning Ave, Austin, TX 78704',
    price: 925000, bedrooms: 3, bathrooms: 2, sqft: 1720, propertyType: 'house',
    neighborhood: 'Travis Heights', listingStatus: 'sold', dealScore: 8.1, investmentScore: 8,
    lat: 30.2467, lng: -97.7423, daysOnMarket: 11, priceTier: 'Luxury', dealCategory: 'Good Value',
    listingAgent: 'Catherine Hollis · Moreland Properties', yearBuilt: 1995,
    investmentAnalysis: 'Closed above ask after 11 days — Travis Heights remains supply-constrained.',
    buyerProfile: 'Owner-occupant comp reference',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Travis Heights commands premiums for its proximity to SoCo and the lake.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'a1b2c3d4-0014-4a1a-9b14-austin000014',
    address: '3100 Funston St, Austin, TX 78703',
    price: 1080000, bedrooms: 3, bathrooms: 3, sqft: 2010, propertyType: 'house',
    neighborhood: 'Tarrytown', listingStatus: 'sold', dealScore: 7.7, investmentScore: 7,
    lat: 30.2934, lng: -97.7712, daysOnMarket: 16, priceTier: 'Luxury', dealCategory: 'Fair Price',
    listingAgent: 'Sofia Reyes · Moreland Properties', yearBuilt: 2008,
    investmentAnalysis: 'Tarrytown sale confirms steady luxury demand west of MoPac.',
    buyerProfile: 'Luxury comp reference',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Tarrytown’s established lots and schools anchor pricing.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'a1b2c3d4-0015-4a1a-9b15-austin000015',
    address: '2400 E 6th St, Austin, TX 78702',
    price: 575000, bedrooms: 2, bathrooms: 2, sqft: 1210, propertyType: 'townhouse',
    neighborhood: 'East Austin', listingStatus: 'sold', dealScore: 8.4, investmentScore: 8,
    lat: 30.2602, lng: -97.7156, daysOnMarket: 7, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Priya Nandakumar · Realty Austin', yearBuilt: 2019,
    investmentAnalysis: 'Multiple offers in a week; validates East 6th rental and STR thesis.',
    buyerProfile: 'Investor comp reference',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'East 6th entertainment district sustains strong tenant demand.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'a1b2c3d4-0016-4a1a-9b16-austin000016',
    address: '6402 Mesa Dr, Austin, TX 78731',
    price: 788000, bedrooms: 4, bathrooms: 3, sqft: 2380, propertyType: 'house',
    neighborhood: 'Northwest Hills', listingStatus: 'sold', dealScore: 7.3, investmentScore: 7,
    lat: 30.3471, lng: -97.7634, daysOnMarket: 22, priceTier: 'Upper-Mid', dealCategory: 'Fair Price',
    listingAgent: 'David Okafor · Keller Williams', yearBuilt: 1989,
    investmentAnalysis: 'Northwest Hills closing supports stable family-home demand near MoPac.',
    buyerProfile: 'Family comp reference',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Northwest Hills draws relocating tech families for schools and access.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  // ── For rent (4) — price = monthly rent ────────────────────
  mkProp({
    id: 'a1b2c3d4-0017-4a1a-9b17-austin000017',
    address: '1801 S 1st St #205, Austin, TX 78704',
    price: 2450, bedrooms: 1, bathrooms: 1, sqft: 720, propertyType: 'apartment',
    neighborhood: 'Bouldin Creek', listingStatus: 'for_rent', dealScore: 7.9, investmentScore: 8,
    lat: 30.2486, lng: -97.7553, daysOnMarket: 4, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Lena Park · Urban Space', yearBuilt: 2021,
    investmentAnalysis: 'Rent sits below S. 1st comps; quick lease-up expected given walkability.',
    buyerProfile: 'Tenant: young professional wanting SoCo-adjacent living',
    riskAssessment: 'Low — newer building, low vacancy corridor.',
    neighborhoodInsights: 'S. 1st St offers SoCo energy at a slight discount.',
    negotiationStrategy: 'Offer 12-month term for a small concession.',
  }),
  mkProp({
    id: 'a1b2c3d4-0018-4a1a-9b18-austin000018',
    address: '4400 Avenue A, Austin, TX 78751',
    price: 3200, bedrooms: 3, bathrooms: 2, sqft: 1480, propertyType: 'house',
    neighborhood: 'Hyde Park', listingStatus: 'for_rent', dealScore: 7.1, investmentScore: 7,
    lat: 30.3066, lng: -97.7254, daysOnMarket: 9, priceTier: 'Upper-Mid', dealCategory: 'Fair Price',
    listingAgent: 'Aaron Whitfield · Compass', yearBuilt: 1952,
    investmentAnalysis: 'Family rental near UT shuttle; consistent demand from faculty households.',
    buyerProfile: 'Tenant: family or faculty wanting Hyde Park schools',
    riskAssessment: 'Low — high-retention rental submarket.',
    neighborhoodInsights: 'Hyde Park single-family rentals rarely sit vacant.',
    negotiationStrategy: 'Standard 12-month lease; minimal concessions needed.',
  }),
  mkProp({
    id: 'a1b2c3d4-0019-4a1a-9b19-austin000019',
    address: '1000 E 5th St #408, Austin, TX 78702',
    price: 2890, bedrooms: 2, bathrooms: 2, sqft: 980, propertyType: 'apartment',
    neighborhood: 'East Austin', listingStatus: 'for_rent', dealScore: 8.2, investmentScore: 8,
    lat: 30.2611, lng: -97.7335, daysOnMarket: 3, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Priya Nandakumar · Realty Austin', yearBuilt: 2022,
    investmentAnalysis: 'New East 5th unit priced under market; premium amenities drive demand.',
    buyerProfile: 'Tenant: tech professional wanting downtown-adjacent walkability',
    riskAssessment: 'Low — brand-new building, strong absorption.',
    neighborhoodInsights: 'East 5th/6th corridor blends nightlife with new multifamily.',
    negotiationStrategy: 'Move fast — under-market units lease within days.',
  }),
  mkProp({
    id: 'a1b2c3d4-0020-4a1a-9b20-austin000020',
    address: '3300 Palm Way #1120, Austin, TX 78758',
    price: 4350, bedrooms: 2, bathrooms: 2, sqft: 1340, propertyType: 'condo',
    neighborhood: 'Domain', listingStatus: 'for_rent', dealScore: 6.8, investmentScore: 7,
    lat: 30.4025, lng: -97.7229, daysOnMarket: 11, priceTier: 'Luxury', dealCategory: 'Fair Price',
    listingAgent: 'Lena Park · Urban Space', yearBuilt: 2020,
    investmentAnalysis: 'Luxury Domain rental targeting relocating tech staff with corporate-housing budgets.',
    buyerProfile: 'Tenant: relocating tech employee on corporate housing',
    riskAssessment: 'Low — amenity-rich tower, steady corporate demand.',
    neighborhoodInsights: 'The Domain’s employer base supports premium rents year-round.',
    negotiationStrategy: 'Bundle parking and a move-in concession for longer terms.',
  }),

  // ═══ Miami, FL ═══════════════════════════════════════════════
  mkProp({
    id: 'b2c3d4e5-0001-4a1a-9c01-miami000001',
    address: '1100 Brickell Bay Dr, Miami, FL 33131',
    price: 1185000, bedrooms: 2, bathrooms: 2, sqft: 1240, propertyType: 'condo',
    neighborhood: 'Brickell', listingStatus: 'for_sale', dealScore: 8.6, investmentScore: 9,
    lat: 25.7617, lng: -80.1918, daysOnMarket: 12, priceTier: 'Luxury', dealCategory: 'Hot Deal',
    listingAgent: 'Sofia Mendez · Cervera Real Estate', yearBuilt: 2018, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Brickell high-rise condos command premium rents from finance-sector tenants and short-term demand stays elevated year-round.',
    buyerProfile: 'Cash-flow investor',
    riskAssessment: 'HOA fee escalation and assessment exposure are the main downside risks here.',
    neighborhoodInsights: 'Brickell is Miami’s dense financial core with walkable dining, transit, and waterfront towers.',
    negotiationStrategy: 'Push on closing-cost credits given the active new-construction supply nearby.',
  }),
  mkProp({
    id: 'b2c3d4e5-0002-4a1a-9c02-miami000002',
    address: '250 NW 24th St, Miami, FL 33127',
    price: 745000, bedrooms: 2, bathrooms: 2, sqft: 1080, propertyType: 'condo',
    neighborhood: 'Wynwood', listingStatus: 'for_sale', dealScore: 7.4, investmentScore: 8,
    lat: 25.8010, lng: -80.1990, daysOnMarket: 21, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Marcus Reyes · Fortune International Realty', yearBuilt: 2021, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Wynwood’s arts-district foot traffic supports strong short-term rental yields near the gallery walk.',
    buyerProfile: 'Lifestyle buyer',
    riskAssessment: 'Rapid new supply could soften appreciation over the next few years.',
    neighborhoodInsights: 'Wynwood blends street art, breweries, and creative offices into a high-energy walkable grid.',
    negotiationStrategy: 'Request developer incentives or rate buydowns on remaining sponsor units.',
  }),
  mkProp({
    id: 'b2c3d4e5-0003-4a1a-9c03-miami000003',
    address: '1234 Coral Way, Coral Gables, FL 33134',
    price: 1650000, bedrooms: 4, bathrooms: 3, sqft: 2950, propertyType: 'house',
    neighborhood: 'Coral Gables', listingStatus: 'for_sale', dealScore: 8.1, investmentScore: 8,
    lat: 25.7215, lng: -80.2684, daysOnMarket: 9, priceTier: 'Luxury', dealCategory: 'Hot Deal',
    listingAgent: 'Isabella Cruz · EWM Realty International', yearBuilt: 1939, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Coral Gables’ Mediterranean-revival homes hold value through cycles thanks to strict architectural zoning.',
    buyerProfile: 'Move-up family',
    riskAssessment: 'Older mechanical systems may require near-term capital upgrades.',
    neighborhoodInsights: 'Coral Gables offers tree-lined boulevards, top schools, and a historic walkable Miracle Mile.',
    negotiationStrategy: 'Leverage inspection findings on the 1930s systems for price concessions.',
  }),
  mkProp({
    id: 'b2c3d4e5-0004-4a1a-9c04-miami000004',
    address: '1500 SW 8th St, Miami, FL 33135',
    price: 565000, bedrooms: 3, bathrooms: 2, sqft: 1420, propertyType: 'house',
    neighborhood: 'Little Havana', listingStatus: 'for_sale', dealScore: null, investmentScore: 7,
    lat: 25.7651, lng: -80.2197, daysOnMarket: 28, priceTier: 'Mid-Range', dealCategory: 'Fair Price',
    listingAgent: 'Ana Beltran · Avanti Way Realty', yearBuilt: 1951, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Little Havana sees steady gentrification pressure as buyers spill over from pricier Brickell and Coral Gables.',
    buyerProfile: 'Value-seeking owner',
    riskAssessment: 'Flood-zone insurance costs weigh on net carrying expenses.',
    neighborhoodInsights: 'Little Havana is a culturally rich, walkable district anchored by Calle Ocho’s cafes and music.',
    negotiationStrategy: 'Price has room given the extended days on market; open below ask.',
  }),
  mkProp({
    id: 'b2c3d4e5-0005-4a1a-9c05-miami000005',
    address: '2020 N Bayshore Dr, Miami, FL 33137',
    price: 829000, bedrooms: 2, bathrooms: 2, sqft: 1150, propertyType: 'condo',
    neighborhood: 'Edgewater', listingStatus: 'for_sale', dealScore: 7.8, investmentScore: 8,
    lat: 25.7989, lng: -80.1869, daysOnMarket: 16, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'David Okafor · Compass Florida', yearBuilt: 2016, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Edgewater’s bayfront towers benefit from spillover demand and direct skyline-and-water views command rent premiums.',
    buyerProfile: 'Young professional',
    riskAssessment: 'Saltwater exposure raises long-term facade maintenance costs.',
    neighborhoodInsights: 'Edgewater is a fast-rising waterfront strip of glass towers between Wynwood and Downtown.',
    negotiationStrategy: 'Comparable resales support a modest discount on list price.',
  }),
  mkProp({
    id: 'b2c3d4e5-0006-4a1a-9c06-miami000006',
    address: '3400 Main Hwy, Coconut Grove, FL 33133',
    price: 1395000, bedrooms: 3, bathrooms: 3, sqft: 2100, propertyType: 'townhouse',
    neighborhood: 'Coconut Grove', listingStatus: 'sold', dealScore: 8.3, investmentScore: 8,
    lat: 25.7283, lng: -80.2436, daysOnMarket: 7, priceTier: 'Luxury', dealCategory: 'Hot Deal',
    listingAgent: 'Priya Nair · ONE Sotheby’s International Realty', yearBuilt: 2008, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Coconut Grove townhomes near CocoWalk trade quickly given limited inventory and strong school demand.',
    buyerProfile: 'Established family',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Coconut Grove is a lush bayside village with sailing, boutique retail, and canopy streets.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'b2c3d4e5-0007-4a1a-9c07-miami000007',
    address: '60 SW 13th St, Miami, FL 33130',
    price: 690000, bedrooms: 1, bathrooms: 1, sqft: 820, propertyType: 'condo',
    neighborhood: 'Brickell', listingStatus: 'sold', dealScore: 7.6, investmentScore: 8,
    lat: 25.7589, lng: -80.1976, daysOnMarket: 5, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Carlos Vega · Douglas Elliman', yearBuilt: 2014, city: 'Miami', state: 'FL',
    investmentAnalysis: 'One-bedroom Brickell units rent fast to the financial workforce, keeping vacancy minimal.',
    buyerProfile: 'First-time investor',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Brickell pairs dense vertical living with grocery, transit, and riverfront dining.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'b2c3d4e5-0008-4a1a-9c08-miami000008',
    address: '480 NE 31st St, Miami, FL 33137',
    price: 3600, bedrooms: 2, bathrooms: 2, sqft: 1050, propertyType: 'apartment',
    neighborhood: 'Edgewater', listingStatus: 'for_rent', dealScore: 7.2, investmentScore: 7,
    lat: 25.8042, lng: -80.1881, daysOnMarket: 10, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Lauren Mitchell · Coldwell Banker Realty', yearBuilt: 2019, city: 'Miami', state: 'FL',
    investmentAnalysis: 'Edgewater rentals stay tight as bayfront supply lags demand from relocating professionals.',
    buyerProfile: 'Relocating renter',
    riskAssessment: 'Seasonal rate swings can pressure peak-summer occupancy.',
    neighborhoodInsights: 'Edgewater offers waterfront parks and a quick hop to Wynwood and Downtown.',
    negotiationStrategy: 'Negotiate a free move-in month during the slower summer leasing window.',
  }),

  // ═══ Denver, CO ══════════════════════════════════════════════
  mkProp({
    id: 'c3d4e5f6-0001-4b2b-9d01-denver000001',
    address: '2500 W 32nd Ave, Denver, CO 80211',
    price: 875000, bedrooms: 3, bathrooms: 3, sqft: 1980, propertyType: 'townhouse',
    neighborhood: 'LoHi', listingStatus: 'for_sale', dealScore: 8.4, investmentScore: 8,
    lat: 39.7607, lng: -105.0070, daysOnMarket: 11, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Ryan Halvorsen · LIV Sotheby’s International Realty', yearBuilt: 2017, city: 'Denver', state: 'CO',
    investmentAnalysis: 'LoHi rowhomes capture premium rents thanks to downtown skyline views and a dense restaurant scene.',
    buyerProfile: 'Urban professional',
    riskAssessment: 'New townhome supply could temper short-term appreciation.',
    neighborhoodInsights: 'LoHi is a trendy, walkable hill across the river from downtown packed with rooftop bars.',
    negotiationStrategy: 'Ask for a rate buydown given builder inventory still on the market.',
  }),
  mkProp({
    id: 'c3d4e5f6-0002-4b2b-9d02-denver000002',
    address: '2900 Larimer St, Denver, CO 80205',
    price: 620000, bedrooms: 2, bathrooms: 2, sqft: 1240, propertyType: 'condo',
    neighborhood: 'RiNo', listingStatus: 'for_sale', dealScore: 7.9, investmentScore: 8,
    lat: 39.7656, lng: -104.9818, daysOnMarket: 18, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Megan Foster · Kentwood Real Estate', yearBuilt: 2020, city: 'Denver', state: 'CO',
    investmentAnalysis: 'RiNo’s arts-and-brewery corridor draws creative-economy renters, supporting steady lease-up.',
    buyerProfile: 'Creative-class buyer',
    riskAssessment: 'Industrial-adjacent parcels add some redevelopment-noise risk.',
    neighborhoodInsights: 'RiNo is Denver’s mural-covered River North Art District full of galleries and taprooms.',
    negotiationStrategy: 'Comps justify a modest discount; open slightly under ask.',
  }),
  mkProp({
    id: 'c3d4e5f6-0003-4b2b-9d03-denver000003',
    address: '1300 N Pennsylvania St, Denver, CO 80203',
    price: 489000, bedrooms: 2, bathrooms: 1, sqft: 1010, propertyType: 'condo',
    neighborhood: 'Capitol Hill', listingStatus: 'for_sale', dealScore: null, investmentScore: 7,
    lat: 39.7351, lng: -104.9794, daysOnMarket: 30, priceTier: 'Mid-Range', dealCategory: 'Fair Price',
    listingAgent: 'Tyler Brooks · Milehimodern', yearBuilt: 1928, city: 'Denver', state: 'CO',
    investmentAnalysis: 'Capitol Hill’s vintage condos draw reliable young-renter demand near downtown employers.',
    buyerProfile: 'First-time buyer',
    riskAssessment: 'Historic building reserves may be thin, raising assessment odds.',
    neighborhoodInsights: 'Capitol Hill is a dense, eclectic district of historic mansions, music venues, and cafes.',
    negotiationStrategy: 'Long days on market invite an aggressive opening offer.',
  }),
  mkProp({
    id: 'c3d4e5f6-0004-4b2b-9d04-denver000004',
    address: '1050 S Gaylord St, Denver, CO 80209',
    price: 1145000, bedrooms: 4, bathrooms: 3, sqft: 2480, propertyType: 'house',
    neighborhood: 'Wash Park', listingStatus: 'for_sale', dealScore: 8.2, investmentScore: 8,
    lat: 39.7005, lng: -104.9703, daysOnMarket: 8, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Hannah Whitfield · Compass Colorado', yearBuilt: 1925, city: 'Denver', state: 'CO',
    investmentAnalysis: 'Wash Park bungalows hold strong resale value given proximity to one of Denver’s most coveted parks.',
    buyerProfile: 'Move-up family',
    riskAssessment: 'Century-old foundation may need leveling work.',
    neighborhoodInsights: 'Wash Park centers on a beloved lake-and-lawn park ringed by Craftsman homes and the Gaylord shops.',
    negotiationStrategy: 'Use inspection results on the 1920s structure to trim price.',
  }),
  mkProp({
    id: 'c3d4e5f6-0005-4b2b-9d05-denver000005',
    address: '201 Fillmore St, Denver, CO 80206',
    price: 935000, bedrooms: 3, bathrooms: 3, sqft: 1860, propertyType: 'condo',
    neighborhood: 'Cherry Creek', listingStatus: 'for_sale', dealScore: 7.7, investmentScore: 8,
    lat: 39.7178, lng: -104.9536, daysOnMarket: 22, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Olivia Chen · The Agency Denver', yearBuilt: 2015, city: 'Denver', state: 'CO',
    investmentAnalysis: 'Cherry Creek’s luxury-retail district sustains high-end rental and resale demand year-round.',
    buyerProfile: 'Affluent downsizer',
    riskAssessment: 'Premium HOA dues compress net yields.',
    neighborhoodInsights: 'Cherry Creek is Denver’s upscale shopping-and-dining quarter with a riverside bike path.',
    negotiationStrategy: 'Seller flexibility likely after three weeks; counter on price.',
  }),
  mkProp({
    id: 'c3d4e5f6-0006-4b2b-9d06-denver000006',
    address: '4200 Tennyson St, Denver, CO 80212',
    price: 810000, bedrooms: 3, bathrooms: 2, sqft: 1720, propertyType: 'house',
    neighborhood: 'Berkeley', listingStatus: 'sold', dealScore: 8.0, investmentScore: 8,
    lat: 39.7740, lng: -105.0419, daysOnMarket: 6, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Nathan Cole · West + Main Homes', yearBuilt: 1948, city: 'Denver', state: 'CO',
    investmentAnalysis: 'Berkeley’s Tennyson corridor draws steady buyer demand from its walkable indie shops and lakes.',
    buyerProfile: 'Young family',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Berkeley is a laid-back northwest neighborhood with two lakes and the lively Tennyson Street strip.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'c3d4e5f6-0007-4b2b-9d07-denver000007',
    address: '1700 Bassett St, Denver, CO 80202',
    price: 575000, bedrooms: 2, bathrooms: 2, sqft: 1180, propertyType: 'condo',
    neighborhood: 'LoHi', listingStatus: 'sold', dealScore: 7.5, investmentScore: 7,
    lat: 39.7559, lng: -105.0050, daysOnMarket: 9, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Grace Lindqvist · Corcoran Perry & Co.', yearBuilt: 2013, city: 'Denver', state: 'CO',
    investmentAnalysis: 'LoHi condos near Union Station benefit from transit access that keeps rental turnover low.',
    buyerProfile: 'Transit-oriented investor',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Lower Highlands bridges downtown and the Highlands with pedestrian bridges and patios.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'c3d4e5f6-0008-4b2b-9d08-denver000008',
    address: '850 E 13th Ave, Denver, CO 80218',
    price: 2400, bedrooms: 1, bathrooms: 1, sqft: 720, propertyType: 'apartment',
    neighborhood: 'Capitol Hill', listingStatus: 'for_rent', dealScore: 7.1, investmentScore: 7,
    lat: 39.7339, lng: -104.9759, daysOnMarket: 13, priceTier: 'Entry-Level', dealCategory: 'Good Value',
    listingAgent: 'Eric Sandoval · 8z Real Estate', yearBuilt: 1965, city: 'Denver', state: 'CO',
    investmentAnalysis: 'Capitol Hill’s walkability and nightlife keep one-bedroom rentals in constant demand.',
    buyerProfile: 'Young renter',
    riskAssessment: 'Limited on-site parking can deter some tenant pools.',
    neighborhoodInsights: 'Capitol Hill packs coffee shops, venues, and historic walk-ups into a dense core.',
    negotiationStrategy: 'Request a parking spot included at the listed rent.',
  }),

  // ═══ Seattle, WA ═════════════════════════════════════════════
  mkProp({
    id: 'd4e5f6a7-0001-4c3c-9e01-seattle00001',
    address: '5400 Ballard Ave NW, Seattle, WA 98107',
    price: 925000, bedrooms: 3, bathrooms: 2, sqft: 1740, propertyType: 'townhouse',
    neighborhood: 'Ballard', listingStatus: 'for_sale', dealScore: 8.5, investmentScore: 9,
    lat: 47.6677, lng: -122.3838, daysOnMarket: 10, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Brett Sundholm · Windermere Real Estate', yearBuilt: 2019, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Ballard townhomes capture strong tech-worker rents near the locks and a thriving brewery scene.',
    buyerProfile: 'Tech professional',
    riskAssessment: 'Newer townhome density may cap near-term appreciation.',
    neighborhoodInsights: 'Ballard is a former fishing village turned hip district with a famous farmers market and nightlife.',
    negotiationStrategy: 'Press for closing credits amid steady new-build competition.',
  }),
  mkProp({
    id: 'd4e5f6a7-0002-4c3c-9e02-seattle00002',
    address: '1620 Broadway, Seattle, WA 98122',
    price: 685000, bedrooms: 2, bathrooms: 2, sqft: 1090, propertyType: 'condo',
    neighborhood: 'Capitol Hill', listingStatus: 'for_sale', dealScore: 7.8, investmentScore: 8,
    lat: 47.6151, lng: -122.3209, daysOnMarket: 17, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Dana Whitmore · Realogics Sotheby’s International Realty', yearBuilt: 2016, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Capitol Hill condos sit atop a light-rail station, sustaining premium rents and low vacancy.',
    buyerProfile: 'Urban renter-buyer',
    riskAssessment: 'Nightlife-corridor noise may narrow the resale pool.',
    neighborhoodInsights: 'Capitol Hill is Seattle’s densest nightlife-and-culture hub with a light-rail link downtown.',
    negotiationStrategy: 'Comps support a small price reduction off list.',
  }),
  mkProp({
    id: 'd4e5f6a7-0003-4c3c-9e03-seattle00003',
    address: '3500 Fremont Ave N, Seattle, WA 98103',
    price: 1095000, bedrooms: 4, bathrooms: 3, sqft: 2260, propertyType: 'house',
    neighborhood: 'Fremont', listingStatus: 'for_sale', dealScore: 8.1, investmentScore: 8,
    lat: 47.6510, lng: -122.3500, daysOnMarket: 9, priceTier: 'Luxury', dealCategory: 'Hot Deal',
    listingAgent: 'Priscilla Yeung · COMPASS', yearBuilt: 1926, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Fremont’s proximity to major tech campuses anchors durable family-home demand.',
    buyerProfile: 'Move-up family',
    riskAssessment: 'Pre-war home may need seismic and electrical upgrades.',
    neighborhoodInsights: 'Fremont, the self-styled “center of the universe,” mixes quirky art, tech offices, and canal-side trails.',
    negotiationStrategy: 'Use 1920s-systems inspection items to negotiate price down.',
  }),
  mkProp({
    id: 'd4e5f6a7-0004-4c3c-9e04-seattle00004',
    address: '500 W Roy St, Seattle, WA 98119',
    price: 1325000, bedrooms: 3, bathrooms: 3, sqft: 2040, propertyType: 'house',
    neighborhood: 'Queen Anne', listingStatus: 'for_sale', dealScore: null, investmentScore: 8,
    lat: 47.6253, lng: -122.3570, daysOnMarket: 26, priceTier: 'Luxury', dealCategory: 'Fair Price',
    listingAgent: 'Gordon Pike · John L. Scott Real Estate', yearBuilt: 1931, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Queen Anne’s view homes are scarce, but list pricing here reflects current market value.',
    buyerProfile: 'Established family',
    riskAssessment: 'Steep-lot maintenance and view-corridor rules add carrying complexity.',
    neighborhoodInsights: 'Queen Anne crowns a hill above downtown with skyline views, Kerry Park, and stately homes.',
    negotiationStrategy: 'Extended market time supports a measured below-ask offer.',
  }),
  mkProp({
    id: 'd4e5f6a7-0005-4c3c-9e05-seattle00005',
    address: '4900 Rainier Ave S, Seattle, WA 98118',
    price: 720000, bedrooms: 3, bathrooms: 2, sqft: 1560, propertyType: 'house',
    neighborhood: 'Columbia City', listingStatus: 'for_sale', dealScore: 7.6, investmentScore: 8,
    lat: 47.5599, lng: -122.2870, daysOnMarket: 15, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Tasha Bennett · Redfin', yearBuilt: 1942, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Columbia City’s light-rail access and historic main street drive appreciation as the south end densifies.',
    buyerProfile: 'Value-focused family',
    riskAssessment: 'Older bungalow stock can carry deferred maintenance.',
    neighborhoodInsights: 'Columbia City is a diverse, walkable landmark district with a beloved farmers market and theater.',
    negotiationStrategy: 'Comparable sales leave modest room below the asking price.',
  }),
  mkProp({
    id: 'd4e5f6a7-0006-4c3c-9e06-seattle00006',
    address: '7100 E Green Lake Dr N, Seattle, WA 98115',
    price: 980000, bedrooms: 3, bathrooms: 2, sqft: 1680, propertyType: 'house',
    neighborhood: 'Green Lake', listingStatus: 'sold', dealScore: 8.2, investmentScore: 8,
    lat: 47.6816, lng: -122.3284, daysOnMarket: 5, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Wesley Fontaine · Coldwell Banker Bain', yearBuilt: 1938, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Green Lake homes near the waterfront loop trade fast given chronically thin inventory.',
    buyerProfile: 'Active-lifestyle family',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Green Lake circles a popular urban lake with a running path, paddle sports, and family parks.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'd4e5f6a7-0007-4c3c-9e07-seattle00007',
    address: '2200 NW Market St, Seattle, WA 98107',
    price: 615000, bedrooms: 2, bathrooms: 2, sqft: 980, propertyType: 'condo',
    neighborhood: 'Ballard', listingStatus: 'sold', dealScore: 7.4, investmentScore: 7,
    lat: 47.6686, lng: -122.3850, daysOnMarket: 8, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Mona Eriksson · Keller Williams Greater Seattle', yearBuilt: 2012, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Ballard condos along Market Street lease quickly to renters drawn by walkable dining.',
    buyerProfile: 'First-time investor',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Ballard’s Market Street offers a dense restaurant row steps from the waterfront.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'd4e5f6a7-0008-4c3c-9e08-seattle00008',
    address: '321 Mercer St, Seattle, WA 98109',
    price: 2950, bedrooms: 1, bathrooms: 1, sqft: 760, propertyType: 'apartment',
    neighborhood: 'Queen Anne', listingStatus: 'for_rent', dealScore: 7.0, investmentScore: 7,
    lat: 47.6249, lng: -122.3470, daysOnMarket: 12, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Felix Marchetti · Lake & Company Real Estate', yearBuilt: 2008, city: 'Seattle', state: 'WA',
    investmentAnalysis: 'Lower Queen Anne rentals stay full thanks to proximity to Seattle Center and biotech employers.',
    buyerProfile: 'Relocating renter',
    riskAssessment: 'Event-district congestion can affect tenant turnover.',
    neighborhoodInsights: 'Lower Queen Anne surrounds Seattle Center, the Space Needle, and major theaters.',
    negotiationStrategy: 'Ask to waive admin and pet fees on a 12-month lease.',
  }),

  // ═══ Nashville, TN ═══════════════════════════════════════════
  mkProp({
    id: 'e5f6a7b8-0001-4d4d-9f01-nashville001',
    address: '600 12th Ave S, Nashville, TN 37203',
    price: 685000, bedrooms: 2, bathrooms: 2, sqft: 1280, propertyType: 'condo',
    neighborhood: 'The Gulch', listingStatus: 'for_sale', dealScore: 8.4, investmentScore: 8,
    lat: 36.1512, lng: -86.7794, daysOnMarket: 11, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Caroline Tedder · Parks Realty', yearBuilt: 2018, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'The Gulch’s walkable, LEED-certified district commands top short-term rental rates near Broadway.',
    buyerProfile: 'Cash-flow investor',
    riskAssessment: 'Short-term-rental ordinance changes pose regulatory risk.',
    neighborhoodInsights: 'The Gulch is a sleek, walkable enclave of high-rises, murals, and live-music venues.',
    negotiationStrategy: 'Seek HOA-dues credits given competing new units.',
  }),
  mkProp({
    id: 'e5f6a7b8-0002-4d4d-9f02-nashville002',
    address: '1100 Woodland St, Nashville, TN 37206',
    price: 575000, bedrooms: 3, bathrooms: 2, sqft: 1640, propertyType: 'house',
    neighborhood: 'East Nashville', listingStatus: 'for_sale', dealScore: 7.9, investmentScore: 8,
    lat: 36.1782, lng: -86.7434, daysOnMarket: 16, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Jordan Pruitt · Compass Tennessee', yearBuilt: 1945, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'East Nashville bungalows continue appreciating as creatives and remote workers flock to its indie scene.',
    buyerProfile: 'Creative-class buyer',
    riskAssessment: 'Older homes may carry foundation or knob-and-tube issues.',
    neighborhoodInsights: 'East Nashville is an artsy, walkable district of restored bungalows, cafes, and music spots.',
    negotiationStrategy: 'Comps allow a modest opening offer below list.',
  }),
  mkProp({
    id: 'e5f6a7b8-0003-4d4d-9f03-nashville003',
    address: '1200 5th Ave N, Nashville, TN 37208',
    price: 745000, bedrooms: 3, bathrooms: 3, sqft: 1900, propertyType: 'townhouse',
    neighborhood: 'Germantown', listingStatus: 'for_sale', dealScore: 8.1, investmentScore: 8,
    lat: 36.1812, lng: -86.7891, daysOnMarket: 9, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Whitney Boyle · Benchmark Realty', yearBuilt: 2016, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'Germantown’s historic-but-trendy blocks near the ballpark sustain strong resale demand.',
    buyerProfile: 'Move-up professional',
    riskAssessment: 'Historic-overlay rules can slow renovations.',
    neighborhoodInsights: 'Germantown is Nashville’s oldest neighborhood, now a foodie destination by the Sounds’ stadium.',
    negotiationStrategy: 'Limited inventory means lead with a near-ask offer.',
  }),
  mkProp({
    id: 'e5f6a7b8-0004-4d4d-9f04-nashville004',
    address: '2300 12th Ave S, Nashville, TN 37204',
    price: 415000, bedrooms: 2, bathrooms: 2, sqft: 1120, propertyType: 'condo',
    neighborhood: '12 South', listingStatus: 'for_sale', dealScore: null, investmentScore: 7,
    lat: 36.1227, lng: -86.7896, daysOnMarket: 31, priceTier: 'Mid-Range', dealCategory: 'Fair Price',
    listingAgent: 'Derek Aldridge · Village Real Estate', yearBuilt: 2009, city: 'Nashville', state: 'TN',
    investmentAnalysis: '12 South’s boutique-and-cafe corridor keeps rental demand steady, though pricing here is at market.',
    buyerProfile: 'First-time buyer',
    riskAssessment: 'Tourist foot traffic can affect quiet-enjoyment for residents.',
    neighborhoodInsights: '12 South is a photogenic, walkable strip of indie shops, murals, and popular eateries.',
    negotiationStrategy: 'A month on market supports an aggressive below-ask bid.',
  }),
  mkProp({
    id: 'e5f6a7b8-0005-4d4d-9f05-nashville005',
    address: '4400 Murphy Rd, Nashville, TN 37209',
    price: 640000, bedrooms: 3, bathrooms: 2, sqft: 1700, propertyType: 'house',
    neighborhood: 'Sylvan Park', listingStatus: 'for_sale', dealScore: 7.6, investmentScore: 7,
    lat: 36.1493, lng: -86.8413, daysOnMarket: 19, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Brooke Hadley · Zeitlin Sotheby’s International Realty', yearBuilt: 1951, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'Sylvan Park’s leafy streets and quick West End access draw consistent family-buyer interest.',
    buyerProfile: 'Young family',
    riskAssessment: 'Mid-century homes may need HVAC and roof updates.',
    neighborhoodInsights: 'Sylvan Park is a quiet, tree-lined neighborhood with neighborhood cafes and greenway access.',
    negotiationStrategy: 'Comparable sales leave a little room below ask.',
  }),
  mkProp({
    id: 'e5f6a7b8-0006-4d4d-9f06-nashville006',
    address: '2700 Lebanon Pike, Nashville, TN 37214',
    price: 470000, bedrooms: 4, bathrooms: 3, sqft: 2080, propertyType: 'house',
    neighborhood: 'Donelson', listingStatus: 'sold', dealScore: 8.0, investmentScore: 8,
    lat: 36.1745, lng: -86.6705, daysOnMarket: 6, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Cody Ferraro · Keller Williams Realty', yearBuilt: 1972, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'Donelson’s airport-and-downtown access fuels rapid sales as buyers seek relative affordability.',
    buyerProfile: 'Growing family',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'Donelson is a convenient eastern suburb near the airport with a growing dining scene.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'e5f6a7b8-0007-4d4d-9f07-nashville007',
    address: '900 Division St, Nashville, TN 37203',
    price: 525000, bedrooms: 2, bathrooms: 2, sqft: 1180, propertyType: 'condo',
    neighborhood: 'The Gulch', listingStatus: 'sold', dealScore: 7.5, investmentScore: 7,
    lat: 36.1498, lng: -86.7861, daysOnMarket: 8, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Alexis Crowder · Fridrich & Clark Realty', yearBuilt: 2014, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'Gulch condos near the music venues lease fast to professionals wanting a car-free commute.',
    buyerProfile: 'First-time investor',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'The Gulch packs rooftop bars, boutiques, and transit-friendly living into a compact grid.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'e5f6a7b8-0008-4d4d-9f08-nashville008',
    address: '1015 Russell St, Nashville, TN 37206',
    price: 2350, bedrooms: 2, bathrooms: 1, sqft: 900, propertyType: 'apartment',
    neighborhood: 'East Nashville', listingStatus: 'for_rent', dealScore: 7.2, investmentScore: 7,
    lat: 36.1741, lng: -86.7503, daysOnMarket: 14, priceTier: 'Entry-Level', dealCategory: 'Good Value',
    listingAgent: 'Trevor Nash · The Ashton Real Estate Group', yearBuilt: 2005, city: 'Nashville', state: 'TN',
    investmentAnalysis: 'East Nashville rentals stay in demand from the creative workforce priced out of downtown.',
    buyerProfile: 'Young renter',
    riskAssessment: 'On-street parking only may limit tenant appeal.',
    neighborhoodInsights: 'East Nashville offers walkable cafes, music bars, and a tight-knit creative community.',
    negotiationStrategy: 'Negotiate a reduced deposit on a longer lease term.',
  }),

  // ═══ Phoenix, AZ ═════════════════════════════════════════════
  mkProp({
    id: 'f6a7b8c9-0001-4e5e-9a01-phoenix00001',
    address: '4500 N 44th St, Phoenix, AZ 85018',
    price: 765000, bedrooms: 4, bathrooms: 3, sqft: 2340, propertyType: 'house',
    neighborhood: 'Arcadia', listingStatus: 'for_sale', dealScore: 8.3, investmentScore: 8,
    lat: 33.5012, lng: -111.9870, daysOnMarket: 12, priceTier: 'Upper-Mid', dealCategory: 'Hot Deal',
    listingAgent: 'Megan Albright · Russ Lyon Sotheby’s International Realty', yearBuilt: 1958, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Arcadia’s ranch homes with Camelback views appreciate steadily on tightly held lots.',
    buyerProfile: 'Move-up family',
    riskAssessment: 'Mid-century homes may need re-piping and HVAC upgrades.',
    neighborhoodInsights: 'Arcadia is a coveted, leafy district of citrus lots and trendy eateries below Camelback Mountain.',
    negotiationStrategy: 'Use systems-inspection findings to negotiate the price down.',
  }),
  mkProp({
    id: 'f6a7b8c9-0002-4e5e-9a02-phoenix00002',
    address: '900 N 4th Ave, Phoenix, AZ 85003',
    price: 445000, bedrooms: 2, bathrooms: 2, sqft: 1100, propertyType: 'condo',
    neighborhood: 'Roosevelt Row', listingStatus: 'for_sale', dealScore: 7.8, investmentScore: 8,
    lat: 33.4595, lng: -112.0780, daysOnMarket: 18, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Diego Salcedo · HomeSmart', yearBuilt: 2020, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Roosevelt Row’s arts-district energy draws young renters, keeping downtown condos well-leased.',
    buyerProfile: 'Creative-class buyer',
    riskAssessment: 'New downtown supply could slow short-term appreciation.',
    neighborhoodInsights: 'Roosevelt Row (RoRo) is a mural-lined arts district full of galleries, bars, and First Fridays.',
    negotiationStrategy: 'Comps justify a modest below-ask offer.',
  }),
  mkProp({
    id: 'f6a7b8c9-0003-4e5e-9a03-phoenix00003',
    address: '5600 E Camelback Rd, Phoenix, AZ 85018',
    price: 695000, bedrooms: 3, bathrooms: 2, sqft: 1880, propertyType: 'house',
    neighborhood: 'Camelback East', listingStatus: 'for_sale', dealScore: 7.6, investmentScore: 7,
    lat: 33.5092, lng: -111.9620, daysOnMarket: 20, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Rachel Conway · West USA Realty', yearBuilt: 1965, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Camelback East benefits from proximity to the Biltmore corridor’s jobs and retail.',
    buyerProfile: 'Value-focused family',
    riskAssessment: 'Aging roofs and pools add deferred-maintenance exposure.',
    neighborhoodInsights: 'Camelback East stretches along the mountain near the upscale Biltmore shopping district.',
    negotiationStrategy: 'Days on market leave room for a price concession.',
  }),
  mkProp({
    id: 'f6a7b8c9-0004-4e5e-9a04-phoenix00004',
    address: '200 W Jefferson St, Phoenix, AZ 85003',
    price: 385000, bedrooms: 1, bathrooms: 1, sqft: 820, propertyType: 'condo',
    neighborhood: 'Downtown', listingStatus: 'for_sale', dealScore: null, investmentScore: 6,
    lat: 33.4480, lng: -112.0760, daysOnMarket: 29, priceTier: 'Entry-Level', dealCategory: 'Fair Price',
    listingAgent: 'Priya Anand · Realty ONE Group', yearBuilt: 2007, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Downtown Phoenix condos draw ASU and arena-district renters, though pricing here sits at market.',
    buyerProfile: 'First-time buyer',
    riskAssessment: 'Summer cooling costs and HOA dues pressure net returns.',
    neighborhoodInsights: 'Downtown Phoenix anchors sports arenas, the ASU campus, and a growing light-rail spine.',
    negotiationStrategy: 'Extended market time invites a firm below-ask offer.',
  }),
  mkProp({
    id: 'f6a7b8c9-0005-4e5e-9a05-phoenix00005',
    address: '15000 S 50th St, Phoenix, AZ 85044',
    price: 560000, bedrooms: 4, bathrooms: 3, sqft: 2420, propertyType: 'house',
    neighborhood: 'Ahwatukee', listingStatus: 'for_sale', dealScore: 7.9, investmentScore: 8,
    lat: 33.3420, lng: -111.9840, daysOnMarket: 14, priceTier: 'Mid-Range', dealCategory: 'Good Value',
    listingAgent: 'Brandon Cole · My Home Group', yearBuilt: 1998, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Ahwatukee’s top-rated schools and mountain trails sustain dependable family-buyer demand.',
    buyerProfile: 'Suburban family',
    riskAssessment: 'HOA restrictions and aging pools add holding costs.',
    neighborhoodInsights: 'Ahwatukee is a quiet master-planned foothills community ringed by South Mountain trails.',
    negotiationStrategy: 'Comparable listings support a slight discount off ask.',
  }),
  mkProp({
    id: 'f6a7b8c9-0006-4e5e-9a06-phoenix00006',
    address: '1200 E Thunderbird Rd, Phoenix, AZ 85022',
    price: 495000, bedrooms: 3, bathrooms: 2, sqft: 1760, propertyType: 'house',
    neighborhood: 'North Mountain', listingStatus: 'sold', dealScore: 8.1, investmentScore: 8,
    lat: 33.6090, lng: -112.0560, daysOnMarket: 7, priceTier: 'Mid-Range', dealCategory: 'Hot Deal',
    listingAgent: 'Sandra Mireles · DPR Realty', yearBuilt: 1979, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'North Mountain’s affordability and preserve access drive fast sales to entry buyers.',
    buyerProfile: 'Entry-level family',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'North Mountain offers budget-friendly homes beside a large desert hiking preserve.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'f6a7b8c9-0007-4e5e-9a07-phoenix00007',
    address: '4200 N 36th St, Phoenix, AZ 85018',
    price: 720000, bedrooms: 3, bathrooms: 2, sqft: 1820, propertyType: 'house',
    neighborhood: 'Arcadia', listingStatus: 'sold', dealScore: 7.7, investmentScore: 7,
    lat: 33.4960, lng: -111.9950, daysOnMarket: 8, priceTier: 'Upper-Mid', dealCategory: 'Good Value',
    listingAgent: 'Kyle Bennington · Launch Real Estate', yearBuilt: 1960, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Arcadia Lite homes sell quickly as buyers chase the district’s cachet at lower entry prices.',
    buyerProfile: 'Move-up buyer',
    riskAssessment: 'Closed — reference comp.',
    neighborhoodInsights: 'The Arcadia Lite pocket offers walkable access to Arcadia’s restaurants at relative value.',
    negotiationStrategy: 'N/A — closed transaction.',
  }),
  mkProp({
    id: 'f6a7b8c9-0008-4e5e-9a08-phoenix00008',
    address: '333 E Roosevelt St, Phoenix, AZ 85004',
    price: 2200, bedrooms: 1, bathrooms: 1, sqft: 740, propertyType: 'apartment',
    neighborhood: 'Roosevelt Row', listingStatus: 'for_rent', dealScore: 7.0, investmentScore: 7,
    lat: 33.4598, lng: -112.0690, daysOnMarket: 13, priceTier: 'Entry-Level', dealCategory: 'Good Value',
    listingAgent: 'Nora Castillo · Keller Williams Arizona Realty', yearBuilt: 2019, city: 'Phoenix', state: 'AZ',
    investmentAnalysis: 'Roosevelt Row rentals stay leased thanks to walkable nightlife and light-rail commuting.',
    buyerProfile: 'Young renter',
    riskAssessment: 'Peak-summer cooling costs can pressure tenant budgets.',
    neighborhoodInsights: 'Roosevelt Row is downtown’s creative heart, lined with murals, coffee bars, and studios.',
    negotiationStrategy: 'Ask for a free move-in month during the slower summer season.',
  }),
];

/* For_sale subset, ranked by deal score — used by Deal Scout & pipeline. */
const FOR_SALE = MOCK_PROPERTIES.filter(p => p.listingStatus === 'for_sale');

/* ═══════════════════════════════════════════════════════════
   MULTI-CITY MARKETS — switcher seeds + per-market filtering
   ═══════════════════════════════════════════════════════════ */

/** Build the canonical market slug used everywhere (e.g. "austin-tx-us"). */
export function marketSlugFor(city: string, state: string): string {
  const c = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${c}-${state.toLowerCase()}-us`;
}

/** Slug for a given property (defaults to Austin for the original seed set). */
const propSlug = (p: Property) => marketSlugFor(p.city ?? 'Austin', p.state_province ?? 'TX');

/** The six showcase markets — seeded into the store + market switcher. */
export const DEMO_MARKETS: Market[] = [
  { id: marketSlugFor('Austin', 'TX'),    city: 'Austin',    state_province: 'TX', abbr: 'TX', country: 'US', displayName: 'Austin, TX',    lat: 30.2672,  lng: -97.7431,  resolution: 'city' },
  { id: marketSlugFor('Miami', 'FL'),     city: 'Miami',     state_province: 'FL', abbr: 'FL', country: 'US', displayName: 'Miami, FL',     lat: 25.7617,  lng: -80.1918,  resolution: 'city' },
  { id: marketSlugFor('Denver', 'CO'),    city: 'Denver',    state_province: 'CO', abbr: 'CO', country: 'US', displayName: 'Denver, CO',    lat: 39.7392,  lng: -104.9903, resolution: 'city' },
  { id: marketSlugFor('Seattle', 'WA'),   city: 'Seattle',   state_province: 'WA', abbr: 'WA', country: 'US', displayName: 'Seattle, WA',   lat: 47.6062,  lng: -122.3321, resolution: 'city' },
  { id: marketSlugFor('Nashville', 'TN'), city: 'Nashville', state_province: 'TN', abbr: 'TN', country: 'US', displayName: 'Nashville, TN', lat: 36.1627,  lng: -86.7816,  resolution: 'city' },
  { id: marketSlugFor('Phoenix', 'AZ'),   city: 'Phoenix',   state_province: 'AZ', abbr: 'AZ', country: 'US', displayName: 'Phoenix, AZ',   lat: 33.4484,  lng: -112.0740, resolution: 'city' },
];

/** Default market a guest lands on. */
export const DEFAULT_DEMO_MARKET: Market = DEMO_MARKETS[0];

/** Map an analysisType ("rental", "for_sale", "sold"…) to a stored tenure. */
function analysisTypeToTenure(analysisType?: string): Property['listingStatus'] | null {
  if (!analysisType) return null;
  const map: Record<string, Property['listingStatus']> = {
    for_sale: 'for_sale', sale: 'for_sale',
    sold: 'sold',
    rental: 'for_rent', for_rent: 'for_rent', rent: 'for_rent',
  };
  return map[analysisType] ?? null;
}

/** Stable reference cache — prevents infinite re-render loops in demo hooks. */
const propertiesCache = new Map<string, Property[]>();
const sessionPropertiesCache = new Map<string, SessionProperty[]>();
const pulseCache = new Map<string, ReturnType<typeof buildMockPulse>>();
const priceTrendCache = new Map<string, { trend: { name: string; soldAvg: number; forSaleAvg: number }[]; loading: false }>();
const dealScoutCache = new Map<string, DealScoutResponse>();

function marketCacheKey(marketSlug?: string, analysisType?: string) {
  return `${marketSlug ?? 'all'}|${analysisType ?? 'all'}`;
}

/**
 * Properties for a given market slug, optionally filtered by listing type.
 * Falls back to the full set if the slug doesn't match (keeps the map populated).
 */
export function getMockPropertiesForMarket(marketSlug?: string, analysisType?: string): Property[] {
  const key = marketCacheKey(marketSlug, analysisType);
  const cached = propertiesCache.get(key);
  if (cached) return cached;

  let list = marketSlug ? MOCK_PROPERTIES.filter(p => propSlug(p) === marketSlug) : MOCK_PROPERTIES;
  if (list.length === 0) list = MOCK_PROPERTIES.filter(p => propSlug(p) === DEFAULT_DEMO_MARKET.id);
  const tenure = analysisTypeToTenure(analysisType);
  const result = tenure ? list.filter(p => p.listingStatus === tenure) : list;
  propertiesCache.set(key, result);
  return result;
}

/* ═══════════════════════════════════════════════════════════
   2. MARKET PULSE  (useMarketPulse return shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_MARKET_PULSE = {
  hotDeals: 7,
  newListings: 23,
  priceDrops: 11,
  avgDom: 18,
  trendingArea: 'East Austin',
  lastSynced: '2 min ago',
  source: 'MLS + Zillow',
};

/* ═══════════════════════════════════════════════════════════
   3. PRICE TREND  (usePriceTrend return shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_PRICE_TREND = {
  trend: [
    { name: "Jul '24", soldAvg: 298, forSaleAvg: 312 },
    { name: "Aug '24", soldAvg: 304, forSaleAvg: 319 },
    { name: "Sep '24", soldAvg: 301, forSaleAvg: 322 },
    { name: "Oct '24", soldAvg: 309, forSaleAvg: 327 },
    { name: "Nov '24", soldAvg: 314, forSaleAvg: 331 },
    { name: "Dec '24", soldAvg: 311, forSaleAvg: 329 },
    { name: "Jan '25", soldAvg: 318, forSaleAvg: 334 },
    { name: "Feb '25", soldAvg: 323, forSaleAvg: 340 },
    { name: "Mar '25", soldAvg: 329, forSaleAvg: 346 },
    { name: "Apr '25", soldAvg: 334, forSaleAvg: 351 },
    { name: "May '25", soldAvg: 331, forSaleAvg: 349 },
    { name: "Jun '25", soldAvg: 337, forSaleAvg: 354 },
  ],
  loading: false,
};

/* ═══════════════════════════════════════════════════════════
   4. DEAL SCOUT  (useDealScout return shape)
   ═══════════════════════════════════════════════════════════ */

const dealWhy: Record<string, string> = {
  'a1b2c3d4-0001-4a1a-9b01-austin000001': 'Priced ~14% below comparable South Congress condos with strong short-term rental demand.',
  'a1b2c3d4-0002-4a1a-9b02-austin000002': 'East Austin bungalow listed under recent block comps in a fast-appreciating corridor.',
  'a1b2c3d4-0003-4a1a-9b03-austin000003': 'Energy-efficient Mueller home near the greenway with below-market carrying costs.',
  'a1b2c3d4-0009-4a1a-9b09-austin000009': 'New E. Cesar Chavez townhome with rental comps 9% above asking rent.',
  'a1b2c3d4-0011-4a1a-9b11-austin000011': 'Entry-price Barton Springs condo with the highest projected yield in the set.',
};

const MOCK_DEAL_OPPORTUNITIES: DealOpportunity[] = FOR_SALE
  .filter(p => dealWhy[p.id])
  .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
  .map(p => ({
    property_id: p.id,
    address: p.address,
    deal_score: p.dealScore ?? 7.5,
    price: p.price,
    beds: p.bedrooms,
    baths: p.bathrooms,
    sqft: p.sqft,
    dom: p.daysOnMarket,
    why: dealWhy[p.id],
    actions: [
      { label: 'View on Map', action: 'view_map' },
      { label: 'Run Comps', action: 'run_comps' },
    ],
    deal_category: p.dealCategory === 'Hot Deal' ? 'Hot Deal' : 'Good Value',
    price_per_sqft: p.pricePerSqft,
    percent_above_market: p.dealCategory === 'Hot Deal' ? -0.14 : -0.07,
    market_baseline_ppsf: Math.round(p.pricePerSqft / (1 + (p.dealCategory === 'Hot Deal' ? -0.14 : -0.07))),
    investor_score: p.investmentScore,
  }));

export const MOCK_DEAL_SCOUT_RESPONSE: DealScoutResponse = {
  status: 'success',
  opportunities: MOCK_DEAL_OPPORTUNITIES,
  profile_summary: 'Cash-flow investor · $400K–$900K · Austin, TX',
  total: MOCK_DEAL_OPPORTUNITIES.length,
  new_alerts: 2,
};

/* ═══════════════════════════════════════════════════════════
   5. DEAL SCOUT STATUS  (useDealScoutStatus return shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_DEAL_SCOUT_STATUS: ScoutStatus = {
  is_active: true,
  last_scan_at: minsAgoISO(45),
  next_scan_at: minsFromNowISO(15),
  matches_since: 5,
  matches_since_date: daysAgoISO(7),
  scan_regions: ['austin-tx-us'],
  scan_types: ['for_sale'],
  price_min: 350000,
  price_max: 950000,
  score_min: 7.0,
};

/* ═══════════════════════════════════════════════════════════
   6. AGENT ACTIVITY  (useAgentActivity return shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_AGENT_TASKS: AgentTask[] = [
  {
    id: 'task-0001', organization_id: 'org-demo', agent_id: 'agent-scout-alpha',
    task_type: 'market_scan', status: 'completed',
    action_summary: 'Scored 47 new listings in East Austin · 3 flagged as Hot Deals',
    error_message: null, tokens_used: 3120, cost_usd: 0.0072,
    queued_at: minsAgoISO(96), completed_at: minsAgoISO(94), requires_approval: false,
    agent_name: 'Scout Alpha', agent_type: 'scout',
  },
  {
    id: 'task-0002', organization_id: 'org-demo', agent_id: 'agent-deal-scorer',
    task_type: 'deal_score_compute', status: 'completed',
    action_summary: 'Recomputed deal scores for 128 active Austin listings',
    error_message: null, tokens_used: 4180, cost_usd: 0.0094,
    queued_at: minsAgoISO(78), completed_at: minsAgoISO(75), requires_approval: false,
    agent_name: 'Deal Scorer', agent_type: 'analysis',
  },
  {
    id: 'task-0003', organization_id: 'org-demo', agent_id: 'agent-enrichment',
    task_type: 'property_enrichment', status: 'completed',
    action_summary: 'Enriched buyer profiles for 23 Mueller properties',
    error_message: null, tokens_used: 2640, cost_usd: 0.0058,
    queued_at: minsAgoISO(61), completed_at: minsAgoISO(59), requires_approval: false,
    agent_name: 'Enrichment Bot', agent_type: 'enrichment',
  },
  {
    id: 'task-0004', organization_id: 'org-demo', agent_id: 'agent-market-analyst',
    task_type: 'neighborhood_analysis', status: 'completed',
    action_summary: 'Generated submarket report for South Congress & Bouldin Creek',
    error_message: null, tokens_used: 3870, cost_usd: 0.0086,
    queued_at: minsAgoISO(44), completed_at: minsAgoISO(41), requires_approval: false,
    agent_name: 'Market Analyst', agent_type: 'analysis',
  },
  {
    id: 'task-0005', organization_id: 'org-demo', agent_id: 'agent-deal-scorer',
    task_type: 'comps_pull', status: 'completed',
    action_summary: 'Pulled 12 comparable sales for 2847 S Congress Ave',
    error_message: null, tokens_used: 1420, cost_usd: 0.0031,
    queued_at: minsAgoISO(33), completed_at: minsAgoISO(32), requires_approval: false,
    agent_name: 'Deal Scorer', agent_type: 'analysis',
  },
  {
    id: 'task-0006', organization_id: 'org-demo', agent_id: 'agent-scout-alpha',
    task_type: 'market_scan', status: 'completed',
    action_summary: 'Swept Domain & North Lamar for sub-$500K inventory · 8 new matches',
    error_message: null, tokens_used: 2980, cost_usd: 0.0067,
    queued_at: minsAgoISO(21), completed_at: minsAgoISO(19), requires_approval: false,
    agent_name: 'Scout Alpha', agent_type: 'scout',
  },
  {
    id: 'task-0007', organization_id: 'org-demo', agent_id: 'agent-enrichment',
    task_type: 'property_enrichment', status: 'running',
    action_summary: 'Enriching neighborhood insights for 18 Hyde Park listings…',
    error_message: null, tokens_used: 860, cost_usd: 0.0019,
    queued_at: minsAgoISO(3), completed_at: null, requires_approval: false,
    agent_name: 'Enrichment Bot', agent_type: 'enrichment',
  },
  {
    id: 'task-0008', organization_id: 'org-demo', agent_id: 'agent-market-analyst',
    task_type: 'comps_pull', status: 'failed',
    action_summary: 'Comps pull for 8712 N Lamar Blvd — insufficient recent sales nearby',
    error_message: 'Fewer than 3 comparable sales within 0.5mi in the last 90 days',
    tokens_used: 540, cost_usd: 0.0012,
    queued_at: minsAgoISO(12), completed_at: minsAgoISO(11), requires_approval: false,
    agent_name: 'Market Analyst', agent_type: 'analysis',
  },
];

/* ═══════════════════════════════════════════════════════════
   7. SESSION PROPERTIES  (useProperties return shape)
   Derived from MOCK_PROPERTIES (Property → SessionProperty mapping).
   ═══════════════════════════════════════════════════════════ */

const ZIP_BY_NEIGHBORHOOD: Record<string, string> = {
  'South Congress': '78704', 'East Austin': '78702', 'Mueller': '78723',
  'Barton Hills': '78704', 'Hyde Park': '78751', 'Domain': '78758',
  'Bouldin Creek': '78704', 'Westlake': '78746', 'North Lamar': '78753',
  'Travis Heights': '78704', 'Tarrytown': '78703', 'Northwest Hills': '78731',
};

function toSessionProperty(p: Property): SessionProperty {
  const isRent = p.listingStatus === 'for_rent';
  const isSold = p.listingStatus === 'sold';
  // ZIP is parsed straight from the address (works for every city); the
  // neighborhood map is a fallback for the original Austin seeds.
  const zipFromAddress = p.address.match(/\b(\d{5})\b/)?.[1];
  return {
    id: p.id,
    address: p.address,
    city_name: p.city ?? 'Austin',
    state: p.state_province ?? 'TX',
    zip: zipFromAddress ?? ZIP_BY_NEIGHBORHOOD[p.neighborhood] ?? '78701',
    latitude: p.lat,
    longitude: p.lng,
    property_type: p.propertyType,
    beds: p.bedrooms,
    baths: p.bathrooms,
    sqft: p.sqft,
    list_price: isRent ? null : p.price,
    sold_price: isSold ? p.price : null,
    sold_date: isSold ? daysAgoISO(Math.max(1, p.daysOnMarket - 2)) : null,
    rent_price: isRent ? p.price : null,
    image_url: null,
    image_urls: [],
    listing_url: p.zillowUrl,
    days_on_market: p.daysOnMarket,
    price_per_sqft: p.pricePerSqft,
    deal_score: p.dealScore,
    deal_category: p.dealCategory,
    size_category: p.sizeCategory,
    price_tier: p.priceTier,
    percent_above_market: p.dealCategory === 'Hot Deal' ? -0.14 : p.dealCategory === 'Good Value' ? -0.06 : 0.03,
    price_per_bedroom: Math.round(p.price / Math.max(1, p.bedrooms)),
    estimated_roi: isRent ? 0.064 : 0.042 + (p.investmentScore - 6) * 0.006,
    listing_agent: p.listingAgent,
    extracted_at: minsAgoISO(120),
    mortgage_interest_rate: 0.0699,
    mortgage_down_payment: 0.2,
    mortgage_term_years: 30,
    est_monthly_payment: isRent ? null : Math.round(p.price * 0.0055),
    investment_analysis: p.investmentAnalysis ?? null,
    buyer_profile: p.buyerProfile ?? null,
    risk_assessment: p.riskAssessment ?? null,
    neighborhood_insights: p.neighborhoodInsights ?? null,
    negotiation_strategy: p.negotiationStrategy ?? null,
    competitive_position: p.competitivePosition ?? null,
    showing_priority: p.dealScore && p.dealScore >= 8 ? 9 : p.dealScore && p.dealScore >= 7 ? 6 : 3,
    ai_notes: p.aiNotes ?? null,
    agent_rationale: p.investmentAnalysis ?? null,
    investment_potential: p.investmentPotential ?? p.investmentAnalysis ?? null,
    ideal_tenant_profile: isRent ? p.buyerProfile ?? null : null,
    roi_estimate: p.roiEstimate ?? null,
    ai_summary: p.aiSummary ?? null,
    ai_investment_score: p.aiInvestmentScore ?? p.investmentScore,
    ai_comp_analysis: p.aiCompAnalysis ?? null,
    opportunity_type: p.opportunityType ?? null,
    market_position: p.marketPosition ?? null,
    priority_level: p.priorityLevel ?? null,
    investment_score: p.investmentScore,
    comparable_analysis: p.comparableAnalysis ?? null,
    seller_opportunity_analysis: p.sellerOpportunityAnalysis ?? null,
    buyer_profile_match: p.buyerProfile ?? null,
    market_insights: p.neighborhoodInsights ?? null,
    client_action_items: p.negotiationStrategy ?? null,
    source: 'MLS + Zillow',
    intent: p.listingStatus,
  };
}

export const MOCK_SESSION_PROPERTIES: SessionProperty[] = MOCK_PROPERTIES.map(toSessionProperty);

/* ═══════════════════════════════════════════════════════════
   8. FULL MARKET INTEL  (useFullMarketIntel return shape)
   ═══════════════════════════════════════════════════════════ */

const FMI_AGENTS_COMPLETE: Record<string, string> = {
  _status: 'complete',
  market_position: 'complete',
  investment_score: 'complete',
  comparable_analysis: 'complete',
  buyer_profile_match: 'complete',
  seller_opportunity_analysis: 'complete',
  market_insights: 'complete',
  client_action_items: 'complete',
  ai_notes: 'complete',
};

export const MOCK_FULL_MARKET_INTEL: FullMarketIntelRecord[] = FOR_SALE.slice(0, 8).map((p, i) => ({
  id: `fmi-${String(i + 1).padStart(4, '0')}`,
  property_address: p.address,
  city: 'Austin',
  state_province: 'TX',
  market_slug: 'austin-tx-us',
  market_context: 'Austin, TX',
  country: 'US',
  property_price: p.price,
  property_type: p.propertyType,
  bedrooms: p.bedrooms,
  bathrooms: p.bathrooms,
  listing_url: p.zillowUrl,
  market_position: p.marketPosition === 'Undervalued' ? 'Undervalued' : i % 3 === 0 ? 'Premium' : 'At Market',
  investment_score: p.investmentScore + ((p.dealScore ?? 7) - 7) * 0.2,
  priority_level: (p.priorityLevel as string) ?? 'Medium',
  opportunity_type: p.opportunityType ?? 'Appreciation',
  comparable_analysis: `Closest comps in ${p.neighborhood} cleared at $${Math.round(p.pricePerSqft * 1.08)}/sqft vs this listing at $${p.pricePerSqft}/sqft — a ${p.dealCategory === 'Hot Deal' ? 'meaningful' : 'modest'} discount.`,
  buyer_profile_match: p.buyerProfile ?? 'Investor / owner-occupant',
  seller_opportunity_analysis: `Seller has held since ${p.yearBuilt ? p.yearBuilt + 4 : 2018}; ${p.daysOnMarket > 20 ? 'extended DOM suggests negotiability' : 'fresh listing with limited concession appetite'}.`,
  market_insights: p.neighborhoodInsights ?? 'Demand outpaces supply in this submarket.',
  client_action_items: p.negotiationStrategy ?? 'Prepare a comp-backed offer.',
  ai_notes: p.investmentAnalysis ?? null,
  analysis_date: daysAgoISO(i + 1),
  status: 'complete',
  notes: null,
  is_test_record: false,
  agents_status: FMI_AGENTS_COMPLETE,
  created_at: daysAgoISO(i + 2),
  updated_at: daysAgoISO(i),
}));

/* ═══════════════════════════════════════════════════════════
   9. QUOTA  (useQuota return shape — full QuotaState)
   ═══════════════════════════════════════════════════════════ */

const QUOTA_USED = 847;
const QUOTA_LIMIT = 2000;
export const MOCK_QUOTA = {
  tasksUsed: QUOTA_USED,
  taskLimit: QUOTA_LIMIT,
  remaining: QUOTA_LIMIT - QUOTA_USED,
  percentUsed: QUOTA_USED / QUOTA_LIMIT,
  shouldWarn: false,
  shouldAlert: false,
  shouldShowUpsell: false,
  planTier: 'professional',
  subscriptionStatus: 'active',
  loading: false,
  error: null as string | null,
  refetch: () => {},
};

/* ═══════════════════════════════════════════════════════════
   10. PLATFORM HEALTH  (PlatformHealth page HealthData shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_HEALTH = {
  status: 'healthy' as const,
  version: '2.4.1',
  uptime_seconds: 1_728_540, // ~20 days
  services: {
    api: { status: 'up' as const, latency_ms: 42, last_check: minsAgoISO(0) },
    supabase: { status: 'up' as const, latency_ms: 18, last_check: minsAgoISO(0) },
    pinecone: { status: 'up' as const, latency_ms: 67, last_check: minsAgoISO(0) },
    openai: { status: 'up' as const, latency_ms: 210, last_check: minsAgoISO(0) },
  },
  timestamp: NOW().toISOString(),
};

/* ═══════════════════════════════════════════════════════════
   11. ALERTS  (Alerts page — Alert[] shape)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-0001',
    userId: 'guest',
    name: 'East Austin Price Drops',
    conditions: {
      triggerType: 'price_drop',
      neighborhoods: ['East Austin'],
      priceMax: 600000,
    },
    frequency: 'instant',
    channel: 'both',
    status: 'active',
    lastTriggered: minsAgoISO(38),
    createdAt: daysAgoISO(12),
  },
  {
    id: 'alert-0002',
    userId: 'guest',
    name: 'Mueller New Listings (3BD+)',
    conditions: {
      triggerType: 'new_listing',
      neighborhoods: ['Mueller'],
      propertyTypes: ['house', 'townhouse'],
    },
    frequency: 'daily',
    channel: 'email',
    status: 'active',
    lastTriggered: daysAgoISO(1),
    createdAt: daysAgoISO(20),
  },
  {
    id: 'alert-0003',
    userId: 'guest',
    name: 'Austin Hot Deals (Score ≥ 8)',
    conditions: {
      triggerType: 'deal_spike',
      neighborhoods: [],
      minDealScore: 8,
    },
    frequency: 'instant',
    channel: 'in-app',
    status: 'paused',
    lastTriggered: daysAgoISO(4),
    createdAt: daysAgoISO(31),
  },
];

/* ═══════════════════════════════════════════════════════════
   12. MARKET SIMULATOR  (useSimulation — estimate, report, job)
   ═══════════════════════════════════════════════════════════ */

export const MOCK_SIM_ESTIMATE = {
  tier: 'quick_pulse',
  agents: 10,
  rounds: 10,
  estimated_cost_usd: 0.06,
  estimated_minutes: 1,
  description: 'Quick Pulse — 10 agents, 10 rounds',
  token_breakdown: {
    system_prompts: 4200,
    agent_interactions: 38600,
    report_synthesis: 7200,
    total: 50000,
  },
};

export const MOCK_SIM_REPORT = {
  executive_summary:
    'A simulated 50bps interest-rate cut increases Austin buyer activity, with the agent swarm leaning bullish (58%). East Austin and Mueller see the sharpest demand response, while luxury Westlake inventory remains rate-insensitive. Expect a 3–6% lift in entry/mid-tier transaction volume over the following two quarters.',
  scenarios: [
    { name: 'Demand Surge', probability: 0.46, description: 'Lower rates pull fence-sitting buyers into the $400K–$700K band, compressing DOM in East Austin and the Domain.' },
    { name: 'Measured Recovery', probability: 0.38, description: 'Buyers return gradually; sellers test higher asks, keeping price growth in the 3–4% range.' },
    { name: 'Muted Response', probability: 0.16, description: 'Affordability ceilings cap the effect; luxury and far-suburban segments stay flat.' },
  ],
  key_dynamics: [
    'Entry/mid-tier condos are the most rate-elastic segment in Austin.',
    'East Austin and Mueller absorb new demand fastest due to walkability and supply constraints.',
    'Westlake luxury demand is driven by schools, not financing — minimal rate sensitivity.',
    'Inventory remains the binding constraint; price growth outpaces volume growth.',
  ],
  persona_group_analysis: {
    'First-Time Buyers': { sentiment: 'bullish', narrative: 'Improved affordability unlocks the sub-$500K condo segment; urgency rises as competition returns.' },
    'Cash-Flow Investors': { sentiment: 'bullish', narrative: 'Lower borrowing costs improve DSCR on East Austin and Domain rentals, expanding the buy box.' },
    'Move-Up Families': { sentiment: 'neutral', narrative: 'Rate relief helps, but Eanes-district scarcity keeps Westlake competition steady regardless.' },
    'Luxury Sellers': { sentiment: 'bearish', narrative: 'Marginal rate impact; pricing power softens as more mid-tier inventory competes for attention.' },
  },
  actionable_insights: {
    Buyers: ['Lock financing early on sub-$700K East Austin listings', 'Prioritize Hot Deal-flagged condos before competition returns'],
    Investors: ['Target Domain & E. Cesar Chavez rentals for improved cash-on-cash', 'Underwrite to a 6.5–7% rate to preserve margin'],
    Sellers: ['List entry/mid-tier homes now to capture surging demand', 'In Westlake, price to comps — rate moves won’t bail out an aggressive ask'],
  },
  risk_factors: [
    'A reversal in Fed guidance would quickly cool the entry-tier surge.',
    'Persistent low inventory could turn volume gains into pure price inflation.',
    'Property-tax reassessments may offset monthly-payment relief for some buyers.',
  ],
};

/**
 * Build a fully-completed mock simulation job (no network) for demo mode.
 * Sentiment totals the tier's agent count so the % bars render correctly.
 */
export function buildMockSimJob(tier: string, eventText: string): SimulationJob {
  const rounds = tier === 'deep_scenario' ? 20 : tier === 'market_analysis' ? 15 : 10;
  return {
    id: `sim-demo-${tier}`,
    status: 'completed',
    depth_tier: tier,
    scenario_text: eventText,
    progress_pct: 100,
    current_round: rounds,
    total_rounds: rounds,
    sentiment: { bullish: 58, bearish: 17, neutral: 25 },
    result_json: MOCK_SIM_REPORT,
    error_message: null,
    created_at: minsAgoISO(1),
    completed_at: NOW().toISOString(),
    active_run: false,
  };
}

/* ═══════════════════════════════════════════════════════════
   13. CHAT  (useChatApi — keyword-routed canned responses)
   ═══════════════════════════════════════════════════════════ */

const CHAT_SOURCE = 'MLS + Zillow · 847 Austin listings';

const CHAT_RESPONSES: { match: RegExp; res: ChatResponse }[] = [
  {
    match: /\b(price|trend|appreciat|market value|\$\/sqft|per sqft)\b/i,
    res: {
      text: "Austin median $/sqft has climbed from **$298 to $337 (sold)** over the last 12 months — about **+13%**. East Austin and Mueller lead; Westlake is flatter. For-sale asking sits ~$354/sqft, so the bid-ask spread is tightening. Want me to chart a specific neighborhood?",
      actions: [
        { type: 'view_on_map', label: 'Show price heatmap', data: {} },
        { type: 'ask_followup', label: 'Compare neighborhoods', data: { prompt: 'Compare East Austin vs Westlake price trends' } },
      ],
      confidence: 0.92,
      source: CHAT_SOURCE,
    },
  },
  {
    match: /\b(rent|rental|yield|cash ?flow|tenant|lease)\b/i,
    res: {
      text: "On the rental side, the standout is **1000 E 5th St #408** at $2,890/mo — a brand-new East Austin unit priced under market with a projected **6.4% gross yield**. Domain condos rent higher ($4,350/mo) but at thinner cap rates. Cash-flow investors are best served in East Austin and the Domain right now.",
      actions: [
        { type: 'view_property', label: 'View 1000 E 5th St', data: { id: 'a1b2c3d4-0019-4a1a-9b19-austin000019' } },
        { type: 'run_comps', label: 'Run rental comps', data: {} },
      ],
      confidence: 0.89,
      source: CHAT_SOURCE,
    },
  },
  {
    match: /\b(deal|opportunit|undervalu|below market|bargain|hot)\b/i,
    res: {
      text: "Deal Scout has **7 properties scoring above 8.0** this week. The standout is **2847 S Congress Ave** at $485K — priced ~14% below comparable SoCo condos with a projected 6.8% ROI. Close behind: 1614 E 12th St (8.7) and 2105 E Cesar Chavez St (8.0). Want me to run a full comps analysis on the top pick?",
      actions: [
        { type: 'view_property', label: 'View 2847 S Congress Ave', data: { id: 'a1b2c3d4-0001-4a1a-9b01-austin000001' } },
        { type: 'run_comps', label: 'Run Comps Analysis', data: {} },
        { type: 'view_on_map', label: 'Show on Map', data: {} },
      ],
      confidence: 0.94,
      source: CHAT_SOURCE,
    },
  },
  {
    match: /\b(neighborhood|area|where|east austin|mueller|westlake|south congress|hyde park|domain)\b/i,
    res: {
      text: "**East Austin** is the momentum leader — highest YoY price growth, sub-3-week DOM, and the deepest rental demand. **Mueller** commands a walkability premium, **Westlake** is the school-driven luxury anchor (Eanes ISD), and **the Domain** is north Austin’s tech-employment rental engine. For appreciation, I'd weight East Austin and Mueller; for cash flow, East Austin and the Domain.",
      actions: [
        { type: 'view_on_map', label: 'Explore neighborhoods', data: {} },
        { type: 'set_alert', label: 'Alert me on East Austin', data: { neighborhood: 'East Austin' } },
      ],
      confidence: 0.9,
      source: CHAT_SOURCE,
    },
  },
];

const CHAT_DEFAULT: ChatResponse = {
  text: "Based on current Austin conditions, momentum is strongest in **East Austin** and **Mueller**. Deal Scout has flagged **7 properties above 8.0** this week — the standout is **2847 S Congress Ave** at $485K (≈14% below comps, ~6.8% projected ROI). I can pull comps, map the market, or surface rental cash-flow plays — what would you like to dig into?",
  actions: [
    { type: 'view_property', label: 'View top deal', data: { id: 'a1b2c3d4-0001-4a1a-9b01-austin000001' } },
    { type: 'view_on_map', label: 'Show market map', data: {} },
    { type: 'run_comps', label: 'Run comps', data: {} },
  ],
  confidence: 0.88,
  source: CHAT_SOURCE,
};

/** Pick a canned Austin response based on keywords in the user's message. */
export function getMockChatResponse(input: string): ChatResponse {
  const hit = CHAT_RESPONSES.find(r => r.match.test(input));
  return hit ? hit.res : CHAT_DEFAULT;
}

/** Small await-able delay so demo chat/sim feel like real round-trips. */
export const demoDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════════════════
   14. CITY-AWARE ACCESSORS — keep every surface in sync with the
   currently-selected market so switching cities updates the whole app.
   ═══════════════════════════════════════════════════════════ */

/** Session properties for a market (Property → SessionProperty), tenure-filtered. */
export function getMockSessionPropertiesForMarket(marketSlug?: string, analysisType?: string): SessionProperty[] {
  const key = marketCacheKey(marketSlug, analysisType);
  const cached = sessionPropertiesCache.get(key);
  if (cached) return cached;
  const result = getMockPropertiesForMarket(marketSlug, analysisType).map(toSessionProperty);
  sessionPropertiesCache.set(key, result);
  return result;
}

function buildMockPulse(marketSlug?: string) {
  const props = getMockPropertiesForMarket(marketSlug);
  const forSale = props.filter(p => p.listingStatus === 'for_sale');
  const doms = forSale.map(p => p.daysOnMarket);
  const avgDom = doms.length ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : 0;
  const top = [...forSale].sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))[0];
  return {
    hotDeals: props.filter(p => (p.dealScore ?? 0) >= 7).length,
    newListings: forSale.length,
    priceDrops: props.filter(p => p.dealCategory === 'Hot Deal').length,
    avgDom,
    trendingArea: top?.neighborhood ?? 'Multiple Areas',
    lastSynced: minsAgoISO(2),
    source: 'MLS + Zillow',
  };
}

/** Live "market pulse" tiles computed from the selected city's listings. */
export function getMockPulseForMarket(marketSlug?: string) {
  const key = marketSlug ?? 'all';
  const cached = pulseCache.get(key);
  if (cached) return cached;
  const result = buildMockPulse(marketSlug);
  pulseCache.set(key, result);
  return result;
}

/** A gently-rising 12-month $/sqft curve scaled to the city's price level. */
export function getMockPriceTrendForMarket(marketSlug?: string) {
  const key = marketSlug ?? 'all';
  const cached = priceTrendCache.get(key);
  if (cached) return cached;

  const forSale = getMockPropertiesForMarket(marketSlug).filter(p => p.listingStatus === 'for_sale');
  const avgPpsf = forSale.length
    ? Math.round(forSale.reduce((a, p) => a + (p.pricePerSqft || 0), 0) / forSale.length)
    : 340;
  const months = MOCK_PRICE_TREND.trend.map(t => t.name);
  const n = months.length;
  const start = Math.round(avgPpsf * 0.88);
  const trend = months.map((name, i) => {
    const t = n > 1 ? i / (n - 1) : 1;
    const forSaleAvg = Math.round(start + (avgPpsf - start) * t);
    return { name, soldAvg: Math.round(forSaleAvg * 0.95), forSaleAvg };
  });
  const result = { trend, loading: false as const };
  priceTrendCache.set(key, result);
  return result;
}

/** Deal Scout opportunities for the selected city (top for-sale deals). */
export function getMockDealScoutForMarket(marketSlug?: string): DealScoutResponse {
  const key = marketSlug ?? 'all';
  const cached = dealScoutCache.get(key);
  if (cached) return cached;

  const market = DEMO_MARKETS.find(m => m.id === marketSlug) ?? DEFAULT_DEMO_MARKET;
  const picks = getMockPropertiesForMarket(marketSlug)
    .filter(p => p.listingStatus === 'for_sale' && (p.dealScore ?? 0) >= 7.4)
    .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
    .slice(0, 5);
  const opportunities: DealOpportunity[] = picks.map(p => ({
    property_id: p.id,
    address: p.address,
    deal_score: p.dealScore ?? 7.5,
    price: p.price,
    beds: p.bedrooms,
    baths: p.bathrooms,
    sqft: p.sqft,
    dom: p.daysOnMarket,
    why: p.investmentAnalysis ?? p.neighborhoodInsights ?? 'Priced below comparable inventory in a high-demand submarket.',
    actions: [
      { label: 'View on Map', action: 'view_map' },
      { label: 'Run Comps', action: 'run_comps' },
    ],
    deal_category: p.dealCategory === 'Hot Deal' ? 'Hot Deal' : 'Good Value',
    price_per_sqft: p.pricePerSqft,
    percent_above_market: p.dealCategory === 'Hot Deal' ? -0.14 : -0.07,
    market_baseline_ppsf: Math.round(p.pricePerSqft / (1 + (p.dealCategory === 'Hot Deal' ? -0.14 : -0.07))),
    investor_score: p.investmentScore,
  }));
  const result: DealScoutResponse = {
    status: opportunities.length ? 'success' : 'no_matches',
    opportunities,
    profile_summary: `Cash-flow investor · $400K–$1.2M · ${market.displayName}`,
    total: opportunities.length,
    new_alerts: 2,
  };
  dealScoutCache.set(key, result);
  return result;
}
