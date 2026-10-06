import { useState, useEffect } from 'react';
import { useMarket } from '../stores/marketStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Neighborhood {
  id: string;
  name: string;
  city: string | null;
  state_province: string | null;
}

export function useNeighborhoods() {
  const { currentMarket } = useMarket();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchNeighborhoods() {
      if (!currentMarket?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`${API_BASE}/api/ontology/markets/${currentMarket.id}/neighborhoods`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        
        const data = await res.json();
        
        if (isMounted) {
          if (data.data && data.data.length > 0) {
            setNeighborhoods(data.data);
          } else {
            // Fallback mock data if the database is empty or table doesn't exist
            let mocks: Neighborhood[] = [];
            if (currentMarket.id.includes('san-francisco')) {
              mocks = [
                { id: 'mock-1', name: 'South of Market', city: 'San Francisco', state_province: 'CA' },
                { id: 'mock-2', name: 'Mission District', city: 'San Francisco', state_province: 'CA' },
                { id: 'mock-3', name: 'Marina District', city: 'San Francisco', state_province: 'CA' },
                { id: 'mock-4', name: 'Pacific Heights', city: 'San Francisco', state_province: 'CA' },
                { id: 'mock-5', name: 'Golden Gate Park', city: 'San Francisco', state_province: 'CA' },
              ];
            } else if (currentMarket.id.includes('miami')) {
              mocks = [
                { id: 'mock-1', name: 'Wynwood', city: 'Miami', state_province: 'FL' },
                { id: 'mock-2', name: 'Brickell', city: 'Miami', state_province: 'FL' },
                { id: 'mock-3', name: 'Coconut Grove', city: 'Miami', state_province: 'FL' },
              ];
            } else {
              mocks = [{ id: 'mock-1', name: 'Downtown', city: currentMarket.city || null, state_province: currentMarket.state_province || null }];
            }
            setNeighborhoods(mocks);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[useNeighborhoods] Error fetching neighborhoods:', err);
          setError(err instanceof Error ? err.message : String(err));
          // Fallback if the database is completely empty for this market
          setNeighborhoods([{ id: 'mock-1', name: 'Downtown', city: currentMarket?.city || null, state_province: currentMarket?.state_province || null }]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchNeighborhoods();

    return () => {
      isMounted = false;
    };
  }, [currentMarket?.id, currentMarket?.city, currentMarket?.state_province]);

  return { neighborhoods, loading, error };
}
