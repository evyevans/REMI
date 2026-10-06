/* ═══════════════════════════════════════════════════════════
   CONSTANTS — Empty states and configuration used by Profile
   and FilterContext. All data shown in the app comes from
   live Supabase / backend API calls.
   ═══════════════════════════════════════════════════════════ */

import type { UserProfile } from '../types';

export const EMPTY_PROFILE: UserProfile = {
  userId: '',
  goals: [],
  riskTolerance: null,
  budgetMin: null,
  budgetMax: null,
  propertyTypes: [],
  neighborhoods: [],
  minDealScore: 0,
  aiScoutingEnabled: false,
};

export const INVESTMENT_GOALS = [
  { id: 'cash_flow', label: 'Cash Flow', description: 'Monthly rental income' },
  { id: 'appreciation', label: 'Appreciation', description: 'Long-term value growth' },
  { id: 'fix_and_flip', label: 'Fix & Flip', description: 'Buy, renovate, sell' },
  { id: 'rental_income', label: 'Rental Income', description: 'Passive income stream' },
  { id: 'primary_residence', label: 'Primary Residence', description: 'Live-in property' },
  { id: 'portfolio_diversification', label: 'Portfolio Diversification', description: 'Spread risk' },
] as const;
