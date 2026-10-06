/* ═══════════════════════════════════════════════════════════
   TIME SLIDER — Global temporal control for Map OS
   Bottom bar with preset windows + playback

   Palantir Blueprint Phase 3
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Calendar, Activity } from 'lucide-react';

/* ─── Time window presets ─────────────────────────────────── */

type PresetKey = '7d' | '30d' | '90d' | 'ytd' | 'all';

const PRESETS: { key: PresetKey; label: string; days: number | null }[] = [
  { key: '7d',  label: '7D',  days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'ytd', label: 'YTD', days: null },   // computed
  { key: 'all', label: 'All', days: 365 },
];

function getPresetRange(preset: PresetKey): { since: string; until: string } {
  const now = new Date();
  const until = now.toISOString();

  if (preset === 'ytd') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return { since: yearStart.toISOString(), until };
  }

  const presetDef = PRESETS.find(p => p.key === preset);
  const days = presetDef?.days ?? 30;
  const since = new Date(now.getTime() - days * 86400000);
  return { since: since.toISOString(), until };
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══ PROPS ═══════════════════════════════════════════════ */

interface TimeSliderProps {
  onTimeWindowChange: (since: string, until: string) => void;
  eventCount?: number;
  visible?: boolean;
}

/* ═══ MAIN COMPONENT ═════════════════════════════════════ */

export default function TimeSlider({ onTimeWindowChange, eventCount = 0, visible = true }: TimeSliderProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('30d');
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeRange = getPresetRange(activePreset);

  /* ── Preset selection ── */
  const handlePreset = useCallback((key: PresetKey) => {
    setActivePreset(key);
    setIsPlaying(false);
    const range = getPresetRange(key);
    onTimeWindowChange(range.since, range.until);
  }, [onTimeWindowChange]);

  /* ── Initialize ── */
  useEffect(() => {
    onTimeWindowChange(timeRange.since, timeRange.until);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Playback: cycle through presets ── */
  useEffect(() => {
    if (isPlaying) {
      const presetKeys: PresetKey[] = ['7d', '30d', '90d', 'ytd', 'all'];
      let idx = presetKeys.indexOf(activePreset);
      playIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % presetKeys.length;
        setActivePreset(presetKeys[idx]);
        const range = getPresetRange(presetKeys[idx]);
        onTimeWindowChange(range.since, range.until);
      }, 2000);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div className="time-slider-bar absolute bottom-0 left-0 right-0 z-[500] bg-bg-elevated/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center gap-3 px-4 py-2">

        {/* Calendar icon + label */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
          <Calendar size={13} />
          <span className="font-medium">Time Window</span>
        </div>

        {/* Presets */}
        <div className="flex items-center bg-bg-surface rounded-lg border border-border overflow-hidden">
          {PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => handlePreset(preset.key)}
              className={`px-3 py-1.5 text-[10px] font-semibold transition-all cursor-pointer ${
                activePreset === preset.key
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Current window display */}
        <div className="text-[11px] text-text-tertiary shrink-0">
          {formatShortDate(timeRange.since)} — {formatShortDate(timeRange.until)}
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setIsPlaying(v => !v)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isPlaying
                ? 'bg-accent text-white'
                : 'bg-bg-surface border border-border text-text-secondary hover:text-text-primary'
            }`}
            title={isPlaying ? 'Pause playback' : 'Play through time'}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            onClick={() => {
              const keys: PresetKey[] = ['7d', '30d', '90d', 'ytd', 'all'];
              const next = keys[(keys.indexOf(activePreset) + 1) % keys.length];
              handlePreset(next);
            }}
            className="w-7 h-7 rounded-full bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Next time window"
          >
            <SkipForward size={12} />
          </button>
        </div>

        <div className="flex-1" />

        {/* Event count */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <Activity size={12} className="text-accent" />
          <span className="text-text-secondary">
            <span className="font-semibold text-text-primary">{eventCount}</span> events
          </span>
        </div>
      </div>
    </div>
  );
}
