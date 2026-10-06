/* ═══════════════════════════════════════════════════════════
   DEAL SCOUT CARD — Top opportunities widget
   Shows in chat landing state + after deal queries

   Uses the shared useDealScout hook so Chat and Dashboard
   display the same data from the same source.

   Palantir Blueprint Phase 4
   ═══════════════════════════════════════════════════════════ */

import { TrendingUp, ChevronRight, Bot } from 'lucide-react';
import { DealScoreBadge } from '../ui';
import { useDealScout } from '../../hooks/useDealScout';
import type { DealOpportunity } from '../../hooks/useDealScout';

interface DealScoutCardProps {
  onPropertyClick?: (propertyId: string) => void;
  onViewAll?: () => void;
  limit?: number;
}

export default function DealScoutCard({ onPropertyClick, onViewAll, limit = 5 }: DealScoutCardProps) {
  const { data: dealScout, isLoading } = useDealScout();

  const topDeals = (dealScout?.opportunities ?? []).slice(0, limit);

  return (
    <div className="bg-bg-elevated rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot
              size={15}
              strokeWidth={1.5}
              className="text-foreground"
            />
            <span className="font-semibold text-sm text-foreground">Deal Scout</span>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 text-[10px] font-semibold text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              View All <ChevronRight size={10} />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top opportunities ranked by AI
        </p>
      </div>

      {/* Deal list */}
      <div className="divide-y divide-border">
        {isLoading ? (
          <div className="px-4 py-8 text-center bg-bg-surface/30">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[11px] text-text-tertiary">Scanning local market...</p>
          </div>
        ) : topDeals.length === 0 ? (
          <div className="px-4 py-8 text-center bg-bg-surface/30">
            <p className="text-[11px] text-text-tertiary">No deals found yet. Configure your profile to start scouting.</p>
          </div>
        ) : (
          topDeals.map((deal: DealOpportunity, idx: number) => (
            <button
              key={deal.property_id}
              onClick={() => onPropertyClick?.(deal.property_id)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-surface transition-colors text-left cursor-pointer group"
            >
              {/* Rank */}
              <div className="w-5 h-5 rounded-full bg-bg-surface text-text-tertiary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-border/50">
                {idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold text-text-primary leading-tight truncate">{deal.address}</p>

                  {/* Score */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DealScoreBadge score={deal.deal_score} size="sm" />
                    <TrendingUp size={11} className="text-text-tertiary group-hover:text-accent transition-colors shrink-0" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-text-secondary mt-1">
                  <span className="font-bold text-accent">${deal.price.toLocaleString()}</span>
                  <span className="opacity-30">·</span>
                  <span>{deal.beds}bd/{deal.baths}ba</span>
                  {deal.sqft > 0 && (
                    <>
                      <span className="opacity-30">·</span>
                      <span>{deal.sqft.toLocaleString()} sqft</span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
