/**
 * backgroundScrape.ts — Fire-and-forget scrape trigger
 *
 * Called when a user selects a new market (neighborhood or city).
 * Fires POST /api/scrape/trigger which returns 202 immediately.
 * The backend scrapes in the background and caches data in session_properties.
 *
 * By the time the user clicks an analysis card (typically 3-10 seconds later),
 * the cached data is already available → sub-5-second analysis responses.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface MarketForScrape {
  id: string;
  city?: string;
  state_province?: string;
  country: string;
  displayName: string;
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
  resolution?: string;
}

interface ScrapeTriggerResponse {
  job_id: string;
  status: 'queued' | 'already_cached';
  estimated_seconds: number;
}

/**
 * Trigger a background scrape for the given market.
 * Non-blocking — scrape failure never affects user flow.
 */
export async function triggerBackgroundScrape(market: MarketForScrape): Promise<ScrapeTriggerResponse | null> {
  try {
    // Extract neighborhood name from display name (first part before comma)
    const parts = market.displayName.split(', ');
    const neighborhoodName = market.resolution === 'neighborhood' ? parts[0] : '';

    // Build bounding box from bounds array
    const boundingBox = market.bounds ? {
      sw_lat: market.bounds[0][0],
      sw_lng: market.bounds[0][1],
      ne_lat: market.bounds[1][0],
      ne_lng: market.bounds[1][1],
    } : undefined;

    const response = await fetch(`${API_BASE}/api/scrape/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market_slug: market.id,
        country: market.country,
        state_province: market.state_province || '',
        city_name: market.city || '',
        neighborhood_name: neighborhoodName,
        bounding_box: boundingBox,
        listing_types: ['for_sale', 'sold', 'rental'],
      }),
    });

    if (response.status === 202) {
      const data: ScrapeTriggerResponse = await response.json();
      console.log(
        `[backgroundScrape] ${data.status === 'already_cached' ? '✓ Cached' : '⏳ Queued'}: ` +
        `${market.displayName} (job: ${data.job_id.slice(0, 8)}..., ETA: ${data.estimated_seconds}s)`
      );
      return data;
    }

    console.warn('[backgroundScrape] Unexpected status:', response.status);
    return null;
  } catch (err) {
    // Non-blocking — scrape failure doesn't affect user flow
    console.warn('[backgroundScrape] Trigger failed (non-fatal):', err);
    return null;
  }
}
