/* ═══════════════════════════════════════════════════════════
   CalibrationResultPanel — Shows dry-run Deal Scout results
   before the user activates AI Scouting for the first time.

   Three states:
     A — No matches (count == 0): suggest lowering threshold
     B — High volume (count > 14): warn, offer raise-threshold shortcut
     C — Sweet spot (count 3–14): show property cards, primary Go Live CTA
   ═══════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { AlertTriangle, CheckCircle, TrendingDown, Rocket, ArrowUp, SlidersHorizontal, Share2, Check } from 'lucide-react';
import { Button } from './ui';
import { NoiseBackground } from './ui/noise-background';

interface CalibrationProperty {
  id: string;
  address: string;
  list_price: number | null;
  deal_score: number | null;
  deal_category: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  neighborhood: string | null;
  property_type: string | null;
  price_per_sqft: number | null;
  percent_above_market: number | null;
  market_baseline_ppsf: number | null;
  claude_rationale: string | null;
  investor_score?: number | null;
}

interface CalibrationResult {
  dry_run: boolean;
  lookback_days: number;
  match_count: number;
  properties: CalibrationProperty[];
  suggestion: string | null;
}

interface CalibrationResultPanelProps {
  result: CalibrationResult;
  minDealScore: number;
  onAdjust: () => void;
  onRaiseThreshold: () => void;
  onGoLive: () => void;
  saving: boolean;
}

function DealScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 8 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
    score >= 6 ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
    'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function PropertyCard({ prop }: { prop: CalibrationProperty }) {
  const [copied, setCopied] = useState(false);

  const price = prop.list_price
    ? `$${prop.list_price.toLocaleString()}`
    : 'Price unlisted';

  const rationale = prop.claude_rationale
    ? prop.claude_rationale.slice(0, 120) + (prop.claude_rationale.length > 120 ? '…' : '')
    : null;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/brief/${prop.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled — no action needed
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-primary leading-snug">
          {prop.address || 'Address unavailable'}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleShare}
            title="Share property brief"
            className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            {copied
              ? <Check size={10} className="text-emerald-400" />
              : <Share2 size={10} />
            }
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <DealScoreBadge score={prop.deal_score} />
          {prop.investor_score != null && prop.investor_score > 0 && (
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              INV {prop.investor_score.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-accent">{price}</span>
        {prop.neighborhood && (
          <span className="text-[10px] text-text-tertiary">{prop.neighborhood}</span>
        )}
        {prop.deal_category && (
          <span className="text-[10px] text-text-tertiary">{prop.deal_category}</span>
        )}
      </div>
      {rationale && (
        <p className="text-[10px] text-text-secondary italic">{rationale}</p>
      )}
    </div>
  );
}

export function CalibrationResultPanel({
  result,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  minDealScore,
  onAdjust,
  onRaiseThreshold,
  onGoLive,
  saving,
}: CalibrationResultPanelProps) {
  const { match_count, properties, suggestion, lookback_days } = result;

  const weeklyRate = Math.round((match_count / lookback_days) * 7);

  // ── State A — No matches ──────────────────────────────────────────────────
  if (match_count === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-text-tertiary/10 p-2">
            <TrendingDown size={18} className="text-text-tertiary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              No matches in the last {lookback_days} days
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Your current criteria didn't match any properties ingested recently.
            </p>
          </div>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-text-secondary">{suggestion}</p>
            </div>
          </div>
        )}

        <Button variant="ghost" icon={SlidersHorizontal} onClick={onAdjust} size="sm">
          Adjust Criteria
        </Button>
      </div>
    );
  }

  // ── State B — High volume ─────────────────────────────────────────────────
  if (match_count > 14) {
    return (
      <div className="rounded-xl border border-border bg-bg-surface p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-amber-500/10 p-2">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {match_count} alerts over {lookback_days} days — ~{weeklyRate}/week
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              High volume can reduce signal quality. Consider tightening your threshold.
            </p>
          </div>
        </div>

        {suggestion && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-text-secondary">{suggestion}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" icon={ArrowUp} onClick={onRaiseThreshold} size="sm">
            Raise My Threshold (+0.5)
          </Button>
          <NoiseBackground
            containerClassName="w-fit p-[2px] rounded-full"
            gradientColors={[
              "rgb(255, 100, 150)",
              "rgb(100, 150, 255)",
              "rgb(255, 200, 100)",
            ]}
          >
            <button
              onClick={onGoLive}
              disabled={saving}
              className="flex items-center gap-2 h-8 cursor-pointer rounded-full bg-linear-to-r from-black via-black to-neutral-900 px-4 text-white transition-all duration-100 active:scale-98 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Rocket size={12} />
              {saving ? 'Activating...' : 'Proceed Anyway — Go Live'}
            </button>
          </NoiseBackground>
        </div>
      </div>
    );
  }

  // ── State C — Sweet spot (3–14) ───────────────────────────────────────────
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-bg-surface p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 rounded-full bg-emerald-500/10 p-2">
          <CheckCircle size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {match_count} {match_count === 1 ? 'alert' : 'alerts'} in the last {lookback_days} days
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Great signal quality. These are the deals you would have received.
          </p>
        </div>
      </div>

      {properties.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {properties.map(prop => (
            <PropertyCard key={prop.id} prop={prop} />
          ))}
        </div>
      )}

      <NoiseBackground
        containerClassName="w-fit p-[2px] rounded-full"
        gradientColors={[
          "rgb(100, 220, 130)",
          "rgb(100, 180, 255)",
          "rgb(200, 255, 160)",
        ]}
      >
        <button
          onClick={onGoLive}
          disabled={saving}
          className="flex items-center gap-2 h-9 cursor-pointer rounded-full bg-linear-to-r from-black via-black to-neutral-900 px-5 text-white transition-all duration-100 active:scale-98 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Rocket size={14} />
          {saving ? 'Activating...' : 'Go Live'}
        </button>
      </NoiseBackground>
    </div>
  );
}
