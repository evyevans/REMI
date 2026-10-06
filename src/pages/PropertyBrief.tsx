/* ═══════════════════════════════════════════════════════════
   PropertyBrief — Public share page at /brief/:id

   Fully unauthenticated. Works when texted to a buyer with no
   REMI account. Fetches the brief from the backend and renders
   PropertyBriefCard in standalone + expanded mode.
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PropertyBriefCard } from '../components/PropertyBriefCard';
import type { PropertyBrief } from '../components/PropertyBriefCard';

type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

export default function PropertyBriefPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<PropertyBrief | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!id) {
      setState('not_found');
      return;
    }

    const controller = new AbortController();

    async function fetchBrief() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/properties/${id}/brief`, {
          signal: controller.signal,
        });

        if (res.status === 404) {
          setState('not_found');
          return;
        }

        if (!res.ok) {
          setState('error');
          return;
        }

        const data = await res.json();
        setBrief(data as PropertyBrief);
        setState('loaded');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState('error');
      }
    }

    fetchBrief();
    return () => controller.abort();
  }, [id]);

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* REMI header bar — minimal branding */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-bold tracking-widest text-text-tertiary">REMI</span>
          <span className="text-[10px] text-text-tertiary/60">Property Intelligence</span>
        </div>

        {state === 'loading' && (
          <div className="space-y-4 animate-pulse">
            <div className="h-40 rounded-xl bg-bg-surface" />
            <div className="h-6 w-3/4 rounded bg-bg-surface" />
            <div className="h-4 w-1/2 rounded bg-bg-surface" />
            <div className="h-4 w-2/3 rounded bg-bg-surface" />
            <div className="h-24 rounded-lg bg-bg-surface" />
            <div className="h-24 rounded-lg bg-bg-surface" />
          </div>
        )}

        {state === 'not_found' && (
          <div className="text-center py-16 space-y-3">
            <p className="text-text-primary font-semibold">Brief not found</p>
            <p className="text-xs text-text-tertiary">
              This property brief may have been removed or the link is invalid.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-16 space-y-3">
            <p className="text-text-primary font-semibold">Unable to load brief</p>
            <p className="text-xs text-text-tertiary">
              Something went wrong. Please try again in a moment.
            </p>
          </div>
        )}

        {state === 'loaded' && brief && (
          <PropertyBriefCard brief={brief} expanded standalone />
        )}
      </div>
    </div>
  );
}
