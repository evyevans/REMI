/* ═══════════════════════════════════════════════════════════
   QuickOfferCard — Wholesaler live-call offer tool

   Public, mobile-first, no auth required.
   Open from a phone bookmark during a seller call.
   Shows: deal score · ARV estimate · MAO offer range · top comps.

   Route: /quick/:id
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface QuickComp {
  address: string;
  sold_price: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  sold_date: string;
}

interface QuickOffer {
  property_id: string;
  address: string;
  deal_score: number | null;
  deal_category: string | null;
  list_price: number | null;
  percent_above_market: number | null;
  price_per_sqft: number | null;
  market_baseline_ppsf: number | null;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  days_on_market: number | null;
  cap_rate: number | null;
  arv_estimate: number | null;
  suggested_offer_min: number | null;
  suggested_offer_max: number | null;
  market_position: string | null;
  comp_count: number;
  top_comps: QuickComp[];
  brief_url: string;
}

type LoadState = 'loading' | 'loaded' | 'not_found' | 'error';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
    : `$${(n / 1000).toFixed(0)}K`;
}

function ScoreTier(score: number) {
  if (score >= 8.5) return { label: 'Exceptional Deal', ring: 'border-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (score >= 7)   return { label: 'Good Deal',        ring: 'border-blue-400',    text: 'text-blue-400',    bg: 'bg-blue-500/10'    };
  if (score >= 5)   return { label: 'Fair Deal',         ring: 'border-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-500/10'   };
  return               { label: 'Below Market',       ring: 'border-red-400',     text: 'text-red-400',     bg: 'bg-red-500/10'     };
}

export default function QuickOfferCard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QuickOffer | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [compsOpen, setCompsOpen] = useState(false);

  useEffect(() => {
    if (!id) { setState('not_found'); return; }
    const controller = new AbortController();

    async function load() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/properties/${id}/quick`, { signal: controller.signal });
        if (res.status === 404) { setState('not_found'); return; }
        if (!res.ok) { setState('error'); return; }
        setData(await res.json());
        setState('loaded');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState('error');
      }
    }

    load();
    return () => controller.abort();
  }, [id]);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border/30">
        <span className="text-xs font-bold tracking-widest text-text-tertiary">REMI</span>
        <span className="text-[10px] text-text-tertiary/60">Quick Offer</span>
      </div>

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-4">

        {/* ── Loading ──────────────────────────────────────────── */}
        {state === 'loading' && (
          <div className="space-y-3 animate-pulse">
            <div className="h-5 w-3/4 rounded bg-bg-surface" />
            <div className="h-28 rounded-2xl bg-bg-surface" />
            <div className="h-20 rounded-2xl bg-bg-surface" />
          </div>
        )}

        {/* ── Not found ────────────────────────────────────────── */}
        {(state === 'not_found' || state === 'error') && (
          <div className="text-center py-16 space-y-2">
            <p className="font-semibold text-text-primary">
              {state === 'not_found' ? 'Property not found' : 'Unable to load'}
            </p>
            <p className="text-xs text-text-tertiary">Check the link and try again.</p>
          </div>
        )}

        {/* ── Loaded ───────────────────────────────────────────── */}
        {state === 'loaded' && data && (() => {
          const tier = data.deal_score != null ? ScoreTier(data.deal_score) : null;

          return (
            <>
              {/* Address */}
              <div>
                <p className="text-sm font-bold text-text-primary leading-snug">{data.address}</p>
                {data.list_price && (
                  <p className="text-xs text-text-tertiary mt-0.5">Listed {fmt(data.list_price)}</p>
                )}
              </div>

              {/* Deal score dial */}
              {tier && data.deal_score != null && (
                <div className={`flex items-center gap-4 rounded-2xl border-2 ${tier.ring} ${tier.bg} px-5 py-4`}>
                  <div className="text-center">
                    <p className={`text-4xl font-black ${tier.text} leading-none`}>
                      {data.deal_score.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-1">Deal Score</p>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${tier.text}`}>{tier.label}</p>
                    {data.market_position && (
                      <div className="flex items-center gap-1 mt-1">
                        {(data.percent_above_market ?? 0) <= 0
                          ? <TrendingDown size={11} className="text-emerald-400 shrink-0" />
                          : <TrendingUp size={11} className="text-red-400 shrink-0" />
                        }
                        <p className="text-[11px] text-text-secondary leading-snug">{data.market_position}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Offer range */}
              {data.arv_estimate && (
                <div className="rounded-2xl border border-border bg-bg-surface px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">ARV Estimate</p>
                    <p className="text-lg font-bold text-text-primary">{fmt(data.arv_estimate)}</p>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">MAO Range</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-center">
                        <p className="text-[10px] text-text-tertiary mb-0.5">Min</p>
                        <p className="text-xl font-black text-emerald-400">{fmt(data.suggested_offer_min)}</p>
                      </div>
                      <span className="text-text-tertiary text-sm">—</span>
                      <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-center">
                        <p className="text-[10px] text-text-tertiary mb-0.5">Max</p>
                        <p className="text-xl font-black text-emerald-400">{fmt(data.suggested_offer_max)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-tertiary text-center mt-2">
                      65%–75% of ARV · standard MAO formula
                    </p>
                  </div>
                </div>
              )}

              {/* Quick specs */}
              <div className="flex flex-wrap gap-2">
                {data.bedrooms != null && (
                  <span className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    {data.bedrooms} bd
                  </span>
                )}
                {data.bathrooms != null && (
                  <span className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    {data.bathrooms} ba
                  </span>
                )}
                {data.sqft && (
                  <span className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    {data.sqft.toLocaleString()} sqft
                  </span>
                )}
                {data.days_on_market != null && (
                  <span className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    {data.days_on_market} DOM
                  </span>
                )}
                {data.cap_rate != null && (
                  <span className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    {data.cap_rate.toFixed(1)}% cap
                  </span>
                )}
              </div>

              {/* Comps */}
              {data.comp_count > 0 && (
                <div className="rounded-2xl border border-border bg-bg-surface overflow-hidden">
                  <button
                    onClick={() => setCompsOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-primary/50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-text-primary">
                      Comparable Sales ({data.comp_count})
                    </span>
                    {compsOpen
                      ? <ChevronUp size={14} className="text-text-tertiary" />
                      : <ChevronDown size={14} className="text-text-tertiary" />
                    }
                  </button>

                  {compsOpen && (
                    <div className="border-t border-border/30 divide-y divide-border/20">
                      {data.top_comps.map((c, i) => (
                        <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-text-primary truncate">{c.address}</p>
                            <p className="text-[10px] text-text-tertiary mt-0.5">
                              {[c.beds && `${c.beds}bd`, c.baths && `${c.baths}ba`, c.sqft && `${c.sqft.toLocaleString()} sqft`].filter(Boolean).join(' · ')}
                              {c.sold_date && ` · ${c.sold_date}`}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-text-primary shrink-0">{fmt(c.sold_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer links */}
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <span className="text-[10px] font-bold tracking-widest text-text-tertiary">REMI</span>
                <a
                  href={data.brief_url}
                  className="flex items-center gap-1 text-[10px] text-accent hover:underline"
                >
                  Full brief <ExternalLink size={10} />
                </a>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
