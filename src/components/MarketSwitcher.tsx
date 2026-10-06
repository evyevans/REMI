/* ═══════════════════════════════════════════════════════════
   MARKET SWITCHER — Dropdown to select active market
   Appears in navigation/header area

   Palantir Blueprint Phase 5
   ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Lock } from 'lucide-react';
import { useActiveMarket, type MarketDefinition } from '../config/MarketConfig';

export default function MarketSwitcher() {
  const { market, setMarket, allMarkets } = useActiveMarket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* ── Click outside to close ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(m: MarketDefinition) {
    if (!m.active) return;
    setMarket(m.id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-bg-surface
          hover:border-accent/40 transition-all cursor-pointer text-sm"
      >
        <MapPin size={13} className="text-accent" />
        <span className="font-medium text-text-primary">{market.shortName}</span>
        <span className="text-text-tertiary text-xs">{market.state}</span>
        <ChevronDown size={12} className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-bg-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Select Market</p>
          </div>
          <div className="py-1">
            {allMarkets.map(m => (
              <button
                key={m.id}
                onClick={() => handleSelect(m)}
                disabled={!m.active}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                  m.active
                    ? 'hover:bg-bg-surface cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-text-primary">{m.name}</span>
                    {market.id === m.id && <Check size={12} className="text-accent" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-tertiary mt-0.5">
                    <span>{m.neighborhoods.length} neighborhoods</span>
                    <span>·</span>
                    <span>{m.dataSources.join(', ')}</span>
                  </div>
                </div>
                {!m.active && <Lock size={11} className="text-text-tertiary shrink-0" />}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border bg-bg-surface/50">
            <p className="text-[9px] text-text-tertiary text-center">
              More markets coming soon · Contact us to unlock
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
