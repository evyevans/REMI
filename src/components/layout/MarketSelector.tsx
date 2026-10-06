import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Search, Check, ChevronDown, Loader2, Bookmark } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useMarket, SUPPORTED_TERRITORIES } from '../../stores/marketStore';
import { Portal } from '../ui';
import type { StateSelection, CitySelection } from '../../stores/marketStore';
import { useCitySearch, fetchCityDetails } from '../../hooks/useCitySearch';
import type { CitySearchResult } from '../../hooks/useCitySearch';

export default function MarketSelector() {
  const location = useLocation();
  const isMapTab = location.pathname.startsWith('/map') || location.pathname === '/setup';
  const { cascade, setStateSelection, setCitySelection, currentMarket } = useMarket();

  const [activeMenu, setActiveMenu] = useState<'state' | 'city' | 'saved' | null>(null);
  const [stateQuery, setStateQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [isResolvingCity, setIsResolvingCity] = useState(false);

  const stateContainerRef = useRef<HTMLDivElement>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const savedContainerRef = useRef<HTMLDivElement>(null);

  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const savedDropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!activeMenu) return;

      const containerRef = 
        activeMenu === 'state' ? stateContainerRef :
        activeMenu === 'city' ? cityContainerRef :
        savedContainerRef;
      
      const dropdownRef = 
        activeMenu === 'state' ? stateDropdownRef :
        activeMenu === 'city' ? cityDropdownRef :
        savedDropdownRef;

      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [activeMenu]);

  // Filter Logic for states
  const filteredStates = (() => {
    if (!stateQuery.trim()) return SUPPORTED_TERRITORIES;
    const lowerQuery = stateQuery.toLowerCase();
    return SUPPORTED_TERRITORIES.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) || 
      t.abbr.toLowerCase().includes(lowerQuery)
    );
  })();

  // Live city search — merges static seed + Google Places API results
  const { results: cityResults, isSearching } = useCitySearch(
    cityQuery,
    cascade.state?.id ?? null,
    cascade.state?.abbr ?? null,
    cascade.state?.country ?? null
  );

  // Handlers
  const handleStateSelect = (state: StateSelection) => {
    setStateSelection(state);
    setActiveMenu(null);
    setStateQuery('');
    setCityQuery('');
    // Auto-open city dropdown after a slight delay to guide the user
    setTimeout(() => {
      setActiveMenu('city');
      updatePos(cityContainerRef);
    }, 200);
  };

  const handleCitySelect = async (city: CitySearchResult) => {
    if (!cascade.state) return;

    if (city.source === 'api' && city.placeId) {
      // API result — need to resolve coordinates via Place Details
      setIsResolvingCity(true);
      try {
        const details = await fetchCityDetails(city.placeId);
        if (details) {
          const citySelection: CitySelection = {
            id: `${city.name.toLowerCase().replace(/\s+/g, '-')}-${cascade.state.abbr.toLowerCase()}`,
            name: city.name,
            lat: details.lat,
            lng: details.lng,
            bounds: details.bounds,
            placeId: city.placeId,
          };
          setCitySelection(citySelection);
        }
      } catch (err) {
        console.error('[MarketSelector] Failed to resolve city details:', err);
      } finally {
        setIsResolvingCity(false);
      }
    } else {
      // Static result — coordinates already available
      const citySelection: CitySelection = {
        id: `${city.name.toLowerCase().replace(/\s+/g, '-')}-${cascade.state.abbr.toLowerCase()}`,
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        bounds: city.bounds,
        placeId: city.placeId,
      };
      setCitySelection(citySelection);
    }

    setActiveMenu(null);
    setCityQuery('');
  };

  return (
    <div className="flex items-center gap-2">
      {/* 1. STATE SELECTOR */}
      {isMapTab && (
        <div className="relative" ref={stateContainerRef}>
        <button 
          onClick={() => {
            const next = activeMenu === 'state' ? null : 'state';
            setActiveMenu(next);
            if (next) updatePos(stateContainerRef);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs group ${
            activeMenu === 'state' ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border bg-bg-surface hover:border-border-hover'
          }`}
        >
          <MapPin size={14} className="text-accent shrink-0" />
          <span className="text-text-primary font-bold truncate max-w-[140px]">
            {cascade.state ? cascade.state.name : 'Select State'}
          </span>
          <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-200 ${activeMenu === 'state' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'state' && (
          <Portal>
            <div 
              ref={stateDropdownRef}
              className="fixed bg-bg-primary/95 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] z-[9999] overflow-hidden flex flex-col max-h-[400px] rounded-xl w-72 animate-in fade-in zoom-in-95 duration-150"
              style={{ 
                top: `${dropdownPos.top + 8}px`, 
                left: `${dropdownPos.left}px` 
              }}
            >
              <div className="p-2 border-b border-border bg-bg-surface shrink-0">
               <div className="flex flex-row items-center bg-bg-elevated border border-border rounded-lg px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent/20">
                  <Search size={14} className="text-text-tertiary shrink-0 mr-2" />
                  <input
                    type="text"
                    value={stateQuery}
                    onChange={(e) => setStateQuery(e.target.value)}
                    placeholder="Search states..."
                    className="bg-transparent w-full outline-none text-text-primary text-sm placeholder:text-text-secondary"
                    autoFocus
                  />
               </div>
            </div>
            
            <div className="p-1 overflow-y-auto flex-1">
              {filteredStates.map((state) => (
                <button
                  key={state.id}
                  onClick={() => handleStateSelect(state)}
                  className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-xs ${
                    cascade.state?.id === state.id
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-text-primary hover:bg-bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin size={13} className={cascade.state?.id === state.id ? 'text-accent' : 'text-text-tertiary'} />
                    <span>{state.name}</span>
                  </div>
                  {cascade.state?.id === state.id && <Check size={14} className="text-accent" />}
                </button>
              ))}
            </div>
          </div>
          </Portal>
        )}
      </div>
      )}

      {/* 2. CITY SELECTOR */}
      {isMapTab && (
        <div className="relative" ref={cityContainerRef}>
        <button 
          onClick={() => {
            if (cascade.state) {
              const next = activeMenu === 'city' ? null : 'city';
              setActiveMenu(next);
              if (next) updatePos(cityContainerRef);
            }
          }}
          disabled={!cascade.state || isResolvingCity}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs group ${
            !cascade.state ? 'opacity-50 cursor-not-allowed border-border bg-bg-surface' :
            isResolvingCity ? 'border-accent/50 bg-accent/5 cursor-wait' :
            activeMenu === 'city' ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border bg-bg-surface hover:border-border-hover'
          }`}
        >
          {isResolvingCity ? (
            <Loader2 size={14} className="text-accent animate-spin" />
          ) : null}
          <span className={`truncate max-w-[140px] ${cascade.city ? 'text-text-primary font-bold' : 'text-text-tertiary font-semibold'}`}>
            {isResolvingCity ? 'Loading...' : cascade.city ? cascade.city.name : 'Select City'}
          </span>
          {!isResolvingCity && (
            <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-200 ${activeMenu === 'city' ? 'rotate-180' : ''}`} />
          )}
        </button>

        {activeMenu === 'city' && cascade.state && (
          <Portal>
            <div 
              ref={cityDropdownRef}
              className="fixed bg-bg-primary/95 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] z-[9999] overflow-hidden flex flex-col max-h-[400px] rounded-xl w-72 animate-in fade-in zoom-in-95 duration-150"
              style={{ 
                top: `${dropdownPos.top + 8}px`, 
                left: `${dropdownPos.left}px` 
              }}
            >
              <div className="p-2 border-b border-border bg-bg-surface shrink-0">
               <div className="flex flex-row items-center bg-bg-elevated border border-border rounded-lg px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent/20">
                  <Search size={14} className="text-text-tertiary shrink-0 mr-2" />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder={`Search cities in ${cascade.state.abbr}...`}
                    className="bg-transparent w-full outline-none text-text-primary text-sm placeholder:text-text-secondary"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 size={14} className="text-accent animate-spin shrink-0 ml-1" />
                  )}
               </div>
            </div>
            
            <div className="p-1 overflow-y-auto flex-1">
              {cityResults.length === 0 ? (
                <div className="px-3 py-4 text-center text-text-tertiary text-xs">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Searching…</span>
                    </div>
                  ) : cityQuery.length >= 2 ? (
                    `No cities found matching "${cityQuery}"`
                  ) : (
                    <span className="text-text-secondary">Type to search for any city</span>
                  )}
                </div>
              ) : (
                <>
                  {cityResults.map((city) => {
                    const cityIdName = city.name.toLowerCase().replace(/\s+/g, '-');
                    const isActive = cascade.city?.id.startsWith(cityIdName);
                    
                    return (
                      <button
                        key={`${city.source}-${city.name}-${city.placeId || ''}`}
                        onClick={() => handleCitySelect(city)}
                        className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-xs ${
                          isActive
                            ? 'bg-accent/10 text-accent font-semibold'
                            : 'text-text-primary hover:bg-bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <MapPin size={13} className={isActive ? 'text-accent' : 'text-text-tertiary'} />
                          <div className="flex flex-col">
                            <span>{city.name}</span>
                            {city.source === 'api' && city.secondaryText && (
                              <span className="text-[10px] text-text-tertiary">{city.secondaryText}</span>
                            )}
                          </div>
                        </div>
                        {isActive && <Check size={14} className="text-accent" />}
                      </button>
                    );
                  })}
                  {isSearching && (
                    <div className="px-3 py-2 text-center text-text-tertiary text-xs flex items-center justify-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Searching more…</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </Portal>
        )}
      </div>
      )}

      {/* 3. SAVED CITIES SELECTOR */}
      <div className="relative" ref={savedContainerRef}>
        <button 
          onClick={() => {
            const next = activeMenu === 'saved' ? null : 'saved';
            setActiveMenu(next);
            if (next) updatePos(savedContainerRef);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs group ${
            activeMenu === 'saved' ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border bg-bg-surface hover:border-border-hover'
          }`}
        >
          <Bookmark size={14} className="text-accent shrink-0" />
          <span className="text-text-primary font-bold truncate max-w-[140px]">
            {currentMarket && currentMarket.city ? `${currentMarket.city}, ${currentMarket.state_province}` : 'Saved Cities'}
          </span>
          <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-200 ${activeMenu === 'saved' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'saved' && (
          <Portal>
            <div 
              ref={savedDropdownRef}
              className="fixed bg-bg-primary/95 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] z-[9999] overflow-hidden flex flex-col max-h-[400px] rounded-xl w-72 animate-in fade-in zoom-in-95 duration-150"
              style={{ 
                top: `${dropdownPos.top + 8}px`, 
                right: `${window.innerWidth - dropdownPos.left - dropdownPos.width}px` 
              }}
            >
              <div className="p-2 border-b border-border bg-bg-surface shrink-0 text-xs text-text-primary font-bold px-3">
               Cities with downloaded data
            </div>
            <div className="p-1 overflow-y-auto flex-1">
              <RecentMarketsBarDropdown onSelect={() => setActiveMenu(null)} />
            </div>
          </div>
          </Portal>
        )}
      </div>
    </div>
  );
}

interface SavedMarket {
  id: string;
  city: string;
  state_province: string;
  displayName: string;
  bounds?: [[number, number], [number, number]];
  lat: number;
  lng: number;
  country: string;
}

/* ─── RECENT MARKETS BAR DROPDOWN CONTENT ───────────────── */
function RecentMarketsBarDropdown({ onSelect }: { onSelect: () => void }) {
  const { currentMarket, setCurrentMarket } = useMarket();
  const [availableMarkets, setAvailableMarkets] = useState<SavedMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchSavedCities() {
      try {
        // Fetch market slugs with lat/lng so we can correctly center the map on selection
        // We now enforce deal_score is not null so we only show cities where property comps have ACTUALLY been run
        const { data, error } = await supabase
          .from('canonical_properties')
          .select('market_slug, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .not('deal_score', 'is', null);
        if (error) throw error;

        if (data && mounted) {
          // Accumulate lat/lng sums per slug to compute centroid
          const slugData = new Map<string, { latSum: number; lngSum: number; count: number }>();

          (data as Array<{ market_slug: string; lat: number; lng: number }>).forEach((d) => {
            if (!d.market_slug || !d.lat || !d.lng) return;
            const existing = slugData.get(d.market_slug);
            if (existing) {
              existing.latSum += d.lat;
              existing.lngSum += d.lng;
              existing.count += 1;
            } else {
              slugData.set(d.market_slug, { latSum: d.lat, lngSum: d.lng, count: 1 });
            }
          });

          const uniqueMaps = new Map<string, SavedMarket>();
          slugData.forEach(({ latSum, lngSum, count }, slug) => {
            const parts = slug.split('-');
            if (parts.length < 2) return;

            const lastPart = parts.pop()?.toUpperCase() || '';
            let state = '';
            let country = 'US';

            if (lastPart === 'US' || lastPart === 'CA') {
              country = lastPart;
              state = parts.pop()?.toUpperCase() || '';
            } else {
              state = lastPart;
            }

            const cityNames = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1));
            const city = cityNames.join(' ');

            uniqueMaps.set(slug, {
              id: slug,
              city,
              state_province: state,
              displayName: `${city}, ${state}${country !== 'US' ? `, ${country}` : ''}`,
              bounds: undefined,
              lat: latSum / count,
              lng: lngSum / count,
              country,
            });
          });

          const sorted = Array.from(uniqueMaps.values()).sort((a, b) => a.city.localeCompare(b.city));
          setAvailableMarkets(sorted);
        }
      } catch (err) {
        console.error('[SavedCities] Failed to fetch:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchSavedCities();
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="px-3 py-6 flex flex-col items-center text-center text-text-tertiary">
        <Loader2 size={16} className="animate-spin mb-2 opacity-50" />
        <p className="text-xs">Loading saved cities...</p>
      </div>
    );
  }

  if (availableMarkets.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-text-tertiary text-sm">
        No cities with data yet.<br />
        <span className="text-xs">Add properties to a city to save it.</span>
      </div>
    );
  }

  return (
    <>
      {availableMarkets.map(market => {
        const isActive = market.id === currentMarket.id;

        return (
          <button
            key={market.id}
            onClick={() => {
              setCurrentMarket(market);
              onSelect();
            }}
            className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-xs ${
              isActive
                ? 'bg-accent/10 text-accent font-semibold'
                : 'text-text-primary hover:bg-bg-surface'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MapPin size={13} className={isActive ? 'text-accent' : 'text-text-tertiary'} />
              <span>{market.displayName}</span>
            </div>
            {isActive && <Check size={14} className="text-accent" />}
          </button>
        );
      })}
    </>
  );
}
