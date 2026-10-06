/**
 * Global 402 / subscription interceptor.
 *
 * Patches window.fetch to intercept HTTP 402 responses from the REMI
 * backend. When a 402 is detected it:
 *   1. Dispatches a custom `remi:subscription-expired` DOM event carrying
 *      the error payload (agent_name, deals_at_risk, offline_since).
 *   2. Lets the original response propagate so callers can handle it too.
 *
 * Call `installSubscriptionInterceptor()` once at app startup (main.tsx).
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SubscriptionExpiredDetail {
  agent_name?: string;
  deals_at_risk?: number;
  offline_since?: string;
  error?: string;
}

export function installSubscriptionInterceptor(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await originalFetch(input, init);

    // Only intercept calls to our own backend
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API_BASE) && !url.startsWith('/api/')) {
      return response;
    }

    if (response.status === 402) {
      // Clone so the original response body can still be consumed by the caller
      const clone = response.clone();
      try {
        const detail: SubscriptionExpiredDetail = await clone.json();
        window.dispatchEvent(
          new CustomEvent<SubscriptionExpiredDetail>('remi:subscription-expired', {
            detail,
            bubbles: true,
          }),
        );
      } catch {
        window.dispatchEvent(
          new CustomEvent<SubscriptionExpiredDetail>('remi:subscription-expired', {
            detail: {},
            bubbles: true,
          }),
        );
      }
    }

    return response;
  };
}
