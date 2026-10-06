/* ═══════════════════════════════════════════════════════════
   RentalIntelPanel — PM pricing recommendation card

   Two modes:
     renewal  — "What should I charge on renewal?"
     vacancy  — "Unit vacant N days — what price adjustment?"

   Each mode fetches its own endpoint and renders a compact
   recommendation card with market context.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';

/* ── Renewal Price ───────────────────────────────────────── */

interface RenewalData {
  comp_count: number;
  median_asking_rent: number | null;
  suggested_renewal_price: number | null;
  avg_days_to_lease: number | null;
  price_range: { min: number; max: number } | null;
  message?: string;
}

interface RenewalPanelProps {
  marketSlug: string;
  bedrooms: number;
  bathrooms?: number;
}

export function RenewalPricePanel({ marketSlug, bedrooms, bathrooms }: RenewalPanelProps) {
  const [data, setData] = useState<RenewalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetch_() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const params = new URLSearchParams({
          market_slug: marketSlug,
          bedrooms: String(bedrooms),
          ...(bathrooms != null ? { bathrooms: String(bathrooms) } : {}),
        });
        const res = await fetch(`${apiUrl}/api/rental-intel/renewal-price?${params}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        // silently fail — panel just won't show data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  }, [marketSlug, bedrooms, bathrooms]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-4 animate-pulse">
        <div className="h-3 w-1/2 rounded bg-bg-primary mb-2" />
        <div className="h-6 w-1/3 rounded bg-bg-primary" />
      </div>
    );
  }

  if (!data || data.comp_count === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
        <p className="text-xs text-text-tertiary">
          {data?.message ?? 'No comparable rental data available for this configuration.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-surface px-4 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Renewal Pricing · {bedrooms}BR{bathrooms != null ? ` / ${bathrooms}BA` : ''} · {data.comp_count} comps
      </p>

      <div className="flex items-end gap-4">
        <div>
          <p className="text-[10px] text-text-tertiary">Market median</p>
          <p className="text-xl font-bold text-text-primary">
            ${data.median_asking_rent?.toLocaleString()}<span className="text-xs font-normal text-text-tertiary">/mo</span>
          </p>
        </div>
        <div className="pb-0.5">
          <p className="text-[10px] text-text-tertiary">Suggested renewal</p>
          <p className="text-lg font-semibold text-emerald-400">
            ${data.suggested_renewal_price?.toLocaleString()}<span className="text-xs font-normal text-text-tertiary">/mo</span>
          </p>
        </div>
      </div>

      <div className="flex gap-4 text-[11px] text-text-secondary">
        {data.avg_days_to_lease != null && (
          <span>Avg <strong className="text-text-primary">{data.avg_days_to_lease}d</strong> to lease</span>
        )}
        {data.price_range && (
          <span>Range <strong className="text-text-primary">${data.price_range.min.toLocaleString()}–${data.price_range.max.toLocaleString()}</strong></span>
        )}
      </div>

      <p className="text-[10px] text-text-tertiary/70 leading-relaxed">
        Renewal priced 2% below median — retention incentive vs new-lease rate.
      </p>
    </div>
  );
}


/* ── Vacancy Gap ─────────────────────────────────────────── */

interface VacancyData {
  current_price: number | null;
  comp_count: number;
  median_comp_rent: number | null;
  pct_above_median: number;
  suggested_price: number | null;
  price_adjustment: number;
  carrying_cost_signal: 'low' | 'moderate' | 'high';
  absorption_zone: { min: number; median: number | null; max: number } | null;
  message?: string;
}

interface VacancyGapPanelProps {
  marketSlug: string;
  propertyId: string;
  daysVacant: number;
  onDaysChange?: (days: number) => void;
}

export function VacancyGapPanel({ marketSlug, propertyId, daysVacant, onDaysChange }: VacancyGapPanelProps) {
  const [data, setData] = useState<VacancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localDays, setLocalDays] = useState(daysVacant);

  useEffect(() => { setLocalDays(daysVacant); }, [daysVacant]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetch_() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const params = new URLSearchParams({
          market_slug: marketSlug,
          property_id: propertyId,
          days_vacant: String(localDays),
        });
        const res = await fetch(`${apiUrl}/api/rental-intel/vacancy-gap?${params}`);
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  }, [marketSlug, propertyId, localDays]);

  const urgencyColor =
    data?.carrying_cost_signal === 'high' ? 'text-red-400 border-red-500/20 bg-red-500/5' :
    data?.carrying_cost_signal === 'moderate' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
    'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-4 animate-pulse">
        <div className="h-3 w-1/2 rounded bg-bg-primary mb-2" />
        <div className="h-6 w-2/3 rounded bg-bg-primary" />
      </div>
    );
  }

  if (!data || data.comp_count === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
        <p className="text-xs text-text-tertiary">
          {data?.message ?? 'No comparable rental data for this vacancy analysis.'}
        </p>
      </div>
    );
  }

  const priceAbove = (data.pct_above_median ?? 0) > 2;

  return (
    <div className="rounded-xl border border-border bg-bg-surface px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Vacancy Gap · {data.comp_count} active comps
        </p>
        {/* Days vacant adjuster */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-tertiary">Vacant:</span>
          <input
            type="number"
            min={0}
            max={365}
            value={localDays}
            onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setLocalDays(v);
              onDaysChange?.(v);
            }}
            className="w-14 rounded border border-border bg-bg-primary px-2 py-0.5 text-xs text-text-primary text-center focus:outline-none focus:border-accent"
          />
          <span className="text-[10px] text-text-tertiary">days</span>
        </div>
      </div>

      {/* Urgency badge */}
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${urgencyColor}`}>
        {data.carrying_cost_signal === 'high'
          ? <AlertTriangle size={11} />
          : data.carrying_cost_signal === 'moderate'
          ? <RefreshCw size={11} />
          : null
        }
        Carrying cost: {data.carrying_cost_signal}
      </div>

      {/* Price position */}
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[10px] text-text-tertiary">Your price</p>
          <p className="text-xl font-bold text-text-primary">
            ${data.current_price?.toLocaleString()}<span className="text-xs font-normal text-text-tertiary">/mo</span>
          </p>
        </div>
        <div className="flex items-center gap-1 pb-1">
          {priceAbove
            ? <TrendingUp size={13} className="text-red-400" />
            : <TrendingDown size={13} className="text-emerald-400" />
          }
          <span className={`text-xs font-semibold ${priceAbove ? 'text-red-400' : 'text-emerald-400'}`}>
            {priceAbove ? '+' : ''}{data.pct_above_median.toFixed(1)}% vs median
          </span>
        </div>
      </div>

      {/* Recommendation */}
      {data.price_adjustment !== 0 && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
          <p className="text-xs font-semibold text-text-primary">
            Suggested: ${data.suggested_price?.toLocaleString()}/mo
            <span className={`ml-2 text-[11px] font-normal ${data.price_adjustment < 0 ? 'text-emerald-400' : 'text-text-tertiary'}`}>
              ({data.price_adjustment < 0 ? '' : '+'}{data.price_adjustment.toLocaleString()} vs current)
            </span>
          </p>
          {data.carrying_cost_signal === 'high' && (
            <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">
              Pricing slightly below median after 21+ days typically reduces time-to-lease by 30–50%.
            </p>
          )}
        </div>
      )}

      {/* Absorption zone */}
      {data.absorption_zone && (
        <p className="text-[10px] text-text-tertiary">
          Market range: ${data.absorption_zone.min.toLocaleString()} — ${data.absorption_zone.max.toLocaleString()}/mo
          {data.absorption_zone.median && ` · Median $${data.absorption_zone.median.toLocaleString()}`}
        </p>
      )}
    </div>
  );
}
