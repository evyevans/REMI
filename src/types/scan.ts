/**
 * scan.ts — Single source of truth for Scan tenure values.
 *
 * These strings MUST exactly match the backend Pydantic Literal:
 *   tenure: Literal["for_sale", "for_rent", "sold"]
 *
 * Usage:
 *   import { SCAN_TENURE, type ScanTenure } from '@/types/scan';
 */

export const SCAN_TENURE = {
  FOR_SALE: 'for_sale',
  FOR_RENT: 'for_rent',
  SOLD:     'sold',
} as const;

export type ScanTenure = typeof SCAN_TENURE[keyof typeof SCAN_TENURE];
// Result: ScanTenure = "for_sale" | "for_rent" | "sold"

export interface ScanFilters {
  price_min?: number;
  price_max?: number;
  beds_min?: number;
  baths_min?: number;
  property_type?: string;
}

export interface ScanResult {
  status: 'completed' | 'partial' | 'failed';
  market_slug: string;
  tenure: string;
  properties_found: number;
  job_id: string;
  started_at: string;
  completed_at: string;
  errors: string[];
}
