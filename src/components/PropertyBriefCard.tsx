/* ═══════════════════════════════════════════════════════════
   PropertyBriefCard — Shareable AI property summary card

   Two uses:
     1. In-app (DealScout / CalibrationResultPanel) — agent reviews
        before sending to a buyer
     2. Public share page (/brief/:id) — buyer opens the link,
        no login required

   Design principle: reads as a professional document, not an app UI.
   ═══════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp,
  Share2, Check, ExternalLink,
} from 'lucide-react';

export interface PropertyBrief {
  property_id: string;
  address: string;
  list_price: number | null;
  deal_score: number | null;
  deal_category: string | null;
  market_position: string | null;
  percent_above_market: number | null;
  price_per_sqft: number | null;
  market_baseline_ppsf: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  neighborhood: string | null;
  property_type: string | null;
  market_slug: string | null;
  days_on_market: number | null;
  year_built: number | null;
  image_url: string | null;
  listing_url: string | null;
  investment_analysis: string | null;
  risk_assessment: string | null;
  competitive_position: string | null;
  negotiation_strategy: string | null;
  neighborhood_insights: string | null;
  rationale: string | null;
  share_url: string;
  _ai_disclosure?: string;
}

interface PropertyBriefCardProps {
  brief: PropertyBrief;
  /** When true, shows full sections + share button (public page mode) */
  expanded?: boolean;
  /** When true, renders without REMI shell chrome (for share page) */
  standalone?: boolean;
}

function DealScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tier =
    score >= 8.5 ? { label: 'Exceptional Deal', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' } :
    score >= 7   ? { label: 'Good Deal',         bg: 'bg-blue-500/15   border-blue-500/30   text-blue-400'    } :
    score >= 5   ? { label: 'Fair Deal',          bg: 'bg-amber-500/15  border-amber-500/30  text-amber-400'   } :
                   { label: 'Below Market',       bg: 'bg-red-500/15    border-red-500/30    text-red-400'     };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tier.bg}`}>
      {score >= 7 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {score.toFixed(1)} · {tier.label}
    </span>
  );
}

function Section({
  title,
  content,
  icon,
  defaultOpen = false,
}: {
  title: string;
  content: string | null;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-primary hover:bg-bg-surface transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-text-primary">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-text-tertiary" /> : <ChevronDown size={14} className="text-text-tertiary" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-bg-surface border-t border-border/30">
          <p className="text-xs text-text-secondary leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}

export function PropertyBriefCard({ brief, expanded = false, standalone = false }: PropertyBriefCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${brief.share_url}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Property Brief: ${brief.address}`,
          text: `Deal Score ${brief.deal_score?.toFixed(1)} · ${brief.deal_category} — ${brief.address}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share — no action needed
    }
  };

  const price = brief.list_price
    ? `$${brief.list_price.toLocaleString()}`
    : 'Price unlisted';

  const specs = [
    brief.bedrooms != null && `${brief.bedrooms} bd`,
    brief.bathrooms != null && `${brief.bathrooms} ba`,
    brief.sqft && `${brief.sqft.toLocaleString()} sqft`,
    brief.year_built && `Built ${brief.year_built}`,
    brief.days_on_market != null && `${brief.days_on_market} DOM`,
  ].filter(Boolean).join(' · ');

  const hasAnalysis = !!(
    brief.investment_analysis ||
    brief.risk_assessment ||
    brief.competitive_position ||
    brief.negotiation_strategy ||
    brief.neighborhood_insights
  );

  return (
    <div className={`space-y-4 ${standalone ? 'max-w-lg mx-auto' : ''}`}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {brief.image_url && (
          <div className="w-full h-40 rounded-xl overflow-hidden bg-bg-primary">
            <img
              src={brief.image_url}
              alt={brief.address}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-text-primary leading-snug">{brief.address}</p>
            {brief.neighborhood && (
              <p className="text-xs text-text-tertiary mt-0.5">{brief.neighborhood}</p>
            )}
          </div>
          <button
            onClick={handleShare}
            title="Share this brief"
            className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-hover transition-all cursor-pointer"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>

        {/* Price + Deal Score */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-bold text-text-primary">{price}</span>
          <DealScoreBadge score={brief.deal_score} />
        </div>

        {/* Market position */}
        {brief.market_position && (
          <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
            {(brief.percent_above_market ?? 0) <= 0
              ? <TrendingDown size={12} className="text-emerald-400" />
              : <TrendingUp size={12} className="text-red-400" />
            }
            <span>{brief.market_position}</span>
          </div>
        )}

        {/* Property specs */}
        {specs && (
          <p className="text-[11px] text-text-tertiary">{specs}</p>
        )}

        {/* Short rationale (1–2 sentences, always shown) */}
        {brief.rationale && (
          <p className="text-xs text-text-secondary italic leading-relaxed border-l-2 border-accent/40 pl-3">
            {brief.rationale}
          </p>
        )}
      </div>

      {/* ── AI Analysis Sections ────────────────────────────── */}
      {hasAnalysis && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            AI Analysis
          </p>
          <Section
            title="Investment Analysis"
            content={brief.investment_analysis}
            defaultOpen={expanded}
          />
          <Section
            title="Risk Assessment"
            content={brief.risk_assessment}
            icon={<AlertTriangle size={12} className="text-amber-400" />}
            defaultOpen={false}
          />
          <Section
            title="Competitive Position"
            content={brief.competitive_position}
            defaultOpen={false}
          />
          <Section
            title="Negotiation Angle"
            content={brief.negotiation_strategy}
            defaultOpen={false}
          />
          <Section
            title="Neighborhood Insights"
            content={brief.neighborhood_insights}
            defaultOpen={false}
          />
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          {/* REMI wordmark */}
          <span className="text-[10px] font-bold tracking-widest text-text-tertiary">REMI</span>
          <span className="text-[10px] text-text-tertiary/60">· Powered by OMERION</span>
        </div>
        {brief.listing_url && (
          <a
            href={brief.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-accent hover:underline"
          >
            View listing <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* AI disclosure */}
      {standalone && brief._ai_disclosure && (
        <p className="text-[9px] text-text-tertiary/60 leading-relaxed text-center">
          {brief._ai_disclosure}
        </p>
      )}
    </div>
  );
}
