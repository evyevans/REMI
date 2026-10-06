/* ═══════════════════════════════════════════════════════════
   CHAT PROPERTY CARD — Compact inline card in chat responses
   Shows when AI mentions specific properties

   Palantir Blueprint Phase 4
   ═══════════════════════════════════════════════════════════ */

import { MapPin, Bed, Bath, Ruler, ExternalLink } from 'lucide-react';
import { DealScoreBadge } from '../ui';

interface ChatPropertyCardProps {
  address: string;
  price: number;
  dealScore?: number;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  onViewOnMap?: () => void;
}

export default function ChatPropertyCard({
  address,
  price,
  dealScore,
  neighborhood,
  bedrooms,
  bathrooms,
  sqft,
  onViewOnMap,
}: ChatPropertyCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-bg-elevated rounded-lg border border-border p-2.5 hover:border-accent/40 transition-colors cursor-pointer group"
      onClick={onViewOnMap}
    >
      {/* Property info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-text-primary truncate">{address}</p>
        <div className="flex items-center gap-2 text-[10px] text-text-secondary mt-0.5">
          <span className="font-semibold text-text-primary">${price.toLocaleString()}</span>
          {neighborhood && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MapPin size={8} /> {neighborhood}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2.5 mt-0.5 text-[9px] text-text-tertiary">
          {bedrooms !== undefined && (
            <span className="flex items-center gap-0.5"><Bed size={8} />{bedrooms}</span>
          )}
          {bathrooms !== undefined && (
            <span className="flex items-center gap-0.5"><Bath size={8} />{bathrooms}</span>
          )}
          {sqft !== undefined && (
            <span className="flex items-center gap-0.5"><Ruler size={8} />{sqft.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Score + action */}
      <div className="flex items-center gap-2 shrink-0">
        {dealScore !== undefined && <DealScoreBadge score={dealScore} size="sm" />}
        <ExternalLink size={12} className="text-text-tertiary group-hover:text-accent transition-colors" />
      </div>
    </div>
  );
}
