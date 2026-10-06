/* ═══════════════════════════════════════════════════════════
   MapFilterBar — Property filter controls for the Map tab.
   Simple approach: button always visible, dropdown uses z-[9999].
   ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';
import { Portal } from '../ui';

const formatPrice = (val: number, isMax?: boolean): string => {
  if (!val || (isMax && val >= 1_000_000_000_000)) return '';
  return val.toLocaleString('en-US');
};

function FormattedPriceInput({
  value, onChange, placeholder, isMax,
}: {
  value: number; onChange: (v: number) => void; placeholder: string; isMax?: boolean;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={formatPrice(value, isMax)}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, '');
        onChange(raw ? parseInt(raw, 10) : 0);
      }}
      className="w-1/2 bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent transition-colors"
    />
  );
}

export function MapFilterBar() {
  const { filters, updateFilter, clearFilters: resetFilters } = useFilters();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const updatePos = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
      });
    }
  };

  const hasActiveFilters =
    filters.minDealScore > 0 ||
    filters.priceMin > 0 ||
    filters.priceMax < 1_000_000_000_000 ||
    filters.bedsMin > 0 ||
    filters.propertyTypes.length > 0;

  /* Close when clicking outside */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative">
      {/* Button always visible */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) updatePos();
        }}
        className={`relative z-[9999] pointer-events-auto h-8 px-2.5 rounded-lg border shadow-sm flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
          open 
            ? 'bg-accent text-white border-accent' 
            : 'bg-bg-elevated text-text-primary border-border hover:border-border-hover hover:bg-bg-surface-hover'
        }`}
      >
        <div className="relative flex items-center justify-center w-4 h-4 rounded-md">
          <SlidersHorizontal size={12} className="relative z-10" />
          {hasActiveFilters && !open && (
            <div className="absolute inset-0 rounded-full bg-accent opacity-20 animate-ping" />
          )}
        </div>
        <span>Filters</span>
        {hasActiveFilters && (
          <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold ${
            open ? 'bg-white/20 text-white' : 'bg-accent/10 text-accent'
          }`}>ON</span>
        )}
      </button>

      {/* Dropdown with ultra-high z-index */}
      {open && (
        <Portal>
        <div
          ref={dropdownRef}
          className="fixed mt-2 bg-bg-elevated/95 backdrop-blur-md rounded-xl border border-border shadow-2xl p-3 w-64 animate-in fade-in slide-in-from-top-2 duration-150 z-[9999]"
          style={{ 
            top: `${dropdownPos.top}px`, 
            left: `${dropdownPos.left}px` 
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Filters</p>
            <div className="flex items-center gap-1">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-text-tertiary hover:text-text-primary cursor-pointer p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Deal Score */}
          <div className="mb-3">
            <label className="text-[10px] text-text-secondary block mb-1">
              Min Deal Score: <span className="text-text-primary font-semibold">{filters.minDealScore || 'Any'}</span>
            </label>
            <input
              type="range"
              min={0} max={10} step={1}
              value={filters.minDealScore}
              onChange={(e) => updateFilter('minDealScore', Number(e.target.value))}
              className="w-full h-1.5 accent-[#E8733A] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-text-tertiary mt-0.5">
              <span>Any</span><span>5</span><span>10</span>
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-3">
            <label className="text-[10px] text-text-secondary block mb-1">Price Range</label>
            <div className="flex gap-1.5">
              <FormattedPriceInput
                value={filters.priceMin}
                onChange={(val) => updateFilter('priceMin', val || 0)}
                placeholder="Min"
              />
              <FormattedPriceInput
                value={filters.priceMax}
                onChange={(val) => updateFilter('priceMax', val || 1_000_000_000_000)}
                placeholder="Max"
                isMax
              />
            </div>
          </div>

          {/* Min Bedrooms */}
          <div className="mb-3">
            <label className="text-[10px] text-text-secondary block mb-1">
              Min Beds: <span className="text-text-primary font-semibold">{filters.bedsMin || 'Any'}</span>
            </label>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => updateFilter('bedsMin', n)}
                  className={`flex-1 py-1 text-[10px] rounded border transition-colors cursor-pointer ${
                    filters.bedsMin === n
                      ? 'bg-[#E8733A] text-white border-[#E8733A]'
                      : 'bg-bg-surface border-border text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {n === 0 ? 'Any' : `${n}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Property Type */}
          <div>
            <label className="text-[10px] text-text-secondary block mb-1">Property Type</label>
            <div className="flex flex-wrap gap-1">
              {['house', 'condo', 'townhouse', 'multi_family', 'land'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    const next = filters.propertyTypes.includes(type)
                      ? filters.propertyTypes.filter((t) => t !== type)
                      : [...filters.propertyTypes, type];
                    updateFilter('propertyTypes', next);
                  }}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors cursor-pointer ${
                    filters.propertyTypes.includes(type)
                      ? 'bg-[#E8733A] text-white border-[#E8733A]'
                      : 'bg-bg-surface border-border text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
