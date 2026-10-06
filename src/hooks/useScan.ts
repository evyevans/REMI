/**
 * useScan Hook — Trigger property scans from Map tab
 *
 * Connects frontend scan buttons to backend /api/v1/scan endpoint
 *
 * Uses the single source of truth ScanTenure from @/types/scan.ts
 * which is structurally guaranteed to match the backend Pydantic Literal.
 *
 * Usage:
 *   const { triggerScan, scanning, error } = useScan();
 *   await triggerScan(marketSlug, SCAN_TENURE.FOR_SALE, filters);
 */

import { useState } from 'react';
import { parseApiError } from '../utils/parseApiError';
import { getOrCreateUserId } from '../lib/auth-utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Re-export types from the single source of truth
export type { ScanTenure, ScanFilters, ScanResult } from '../types/scan';

export const useScan = () => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerScan = async (
    marketSlug: string,
    tenure: import('../types/scan').ScanTenure,
    filters?: import('../types/scan').ScanFilters
  ): Promise<import('../types/scan').ScanResult> => {
    setScanning(true);
    setError(null);

    try {
      console.log('[useScan] Triggering scan:', { marketSlug, tenure, filters });

      const response = await fetch(`${API_BASE}/api/v1/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': getOrCreateUserId(),
        },
        body: JSON.stringify({
          market_slug: marketSlug,
          tenure: tenure,
          filters: filters || {},
          limit: 50,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const humanMessage = parseApiError(errorData);

        // Log full error for debugging — never show raw JSON to user
        console.error('[useScan] API error:', {
          status: response.status,
          errorData,
        });

        throw new Error(humanMessage);
      }

      const data: import('../types/scan').ScanResult = await response.json();

      console.log('[useScan] Scan completed:', data);

      if (data.status === 'failed') {
        throw new Error(data.errors.join('; ') || 'Scan failed');
      }

      return data;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      console.error('[useScan] Error:', message, err);
      setError(message);
      throw err;
    } finally {
      setScanning(false);
    }
  };

  return { triggerScan, scanning, error };
};
