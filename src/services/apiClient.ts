/**
 * REMI API Client
 * 
 * Centralized service for making calls to the FastAPI backend (localhost:8000).
 * This establishes a clear boundary between direct Supabase queries (for standard CRUD)
 * and heavy backend processes (analytics, LLM completions, real-time voice context).
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function fetchApi<T>(endpoint: string, method: HttpMethod = 'GET', body?: Record<string, unknown>, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export const apiClient = {
  /**
   * Fetches the Deal Scout triple-intersection rationale given a geographic cascade.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDealScoutOpportunities: (cascade: any, token: string) => 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchApi<any>('/api/deal-scout/evaluate', 'POST', cascade, token),

  /**
   * Updates the voice agent's context whenever the user navigates or interacts.
   * This ensures the voice LLM always knows what the user is looking at.
   */
  updateVoiceContext: (contextUpdate: Record<string, unknown>) => 
    fetchApi<{status: string, context_keys: string[]}>('/v1/context', 'POST', contextUpdate),

  /**
   * Fetches health status from the Python backend
   */
  getHealth: () => fetchApi<Record<string, unknown>>('/api/health'),

  /**
   * Fetches complex ontology nodal graphing data
   */
  getOntologyNodes: () => fetchApi<Record<string, unknown>[]>('/api/ontology/nodes'),
  getOntologyEdges: () => fetchApi<Record<string, unknown>[]>('/api/ontology/edges'),

  /**
   * Triggers AI agents for a single For Rent listing.
   * MANUAL TRIGGER ONLY — called exclusively from the "✦ Run AI" button.
   * Never called from data ingest, background workers, or bulk operations.
   * Model: claude-haiku-4-5-20251001 (all 6 agents)
   */
  runRentalAgents: (payload: {
    listing_id: string;
    market_context: string;
    listing_type: 'for_rent';
  }, token?: string) =>
    fetchApi<{
      listing_id: string;
      market_context: string;
      agents_status: Record<string, string>;
      listing: Record<string, unknown>;
    }>('/api/properties/run-agents', 'POST', payload, token),

  /**
   * Logs a user behavior event to Supabase and Pinecone (Semantic Memory)
   */
  logTelemetry: (event: {
    user_id: string;
    action_type: string;
    target_type?: string;
    target_id?: string;
    target_description?: string;
    page_context?: string;
    action_count?: number;
    metadata?: Record<string, unknown>;
  }) => fetchApi<{status: string}>('/api/telemetry', 'POST', event),
};
