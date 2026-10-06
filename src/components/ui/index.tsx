/* ═══════════════════════════════════════════════════════════
   SHARED UI COMPONENTS — Button, Card, Chip, Badge, Input,
   EmptyState, Skeleton, Toast, DealScoreBadge
   ═══════════════════════════════════════════════════════════ */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import { useTilt } from '../../hooks/useTilt';
import { NoiseBackground } from './noise-background';
import { GlowingEffect } from './glowing-effect';
export { Portal } from './Portal';

/* ─── BUTTON ────────────────────────────────────────────── */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none';
  
  const variants = {
    primary: 'bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-hover shadow-sm',
    secondary: 'bg-transparent border border-border text-text-primary hover:border-border-hover hover:bg-bg-surface',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface',
    danger: 'bg-error text-text-on-accent hover:opacity-90',
  };
  
  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
    md: 'text-sm px-4 py-2 gap-2 rounded-lg',
    lg: 'text-base px-6 py-3 gap-2.5 rounded-lg',
  };
  
  const iconSizes = { sm: 14, md: 16, lg: 18 };
  
  const buttonClasses = `${base} ${variants[variant]} ${sizes[size]} ${disabled || loading ? 'opacity-50 pointer-events-none' : ''} ${className}`;
  const buttonContent = (
    <>
      {loading ? <Loader2 size={iconSizes[size]} className="animate-spin" /> : Icon && <Icon size={iconSizes[size]} />}
      {children}
      {IconRight && !loading && <IconRight size={iconSizes[size]} />}
    </>
  );

  if (variant === 'primary') {
    return (
      <NoiseBackground
        containerClassName={`inline-block p-1 rounded-lg ${className.includes('w-full') ? 'w-full block' : 'w-fit'}`}
        gradientColors={[
          "rgb(222, 169, 133)", // Champagne/copper
          "rgb(193, 114, 70)",  // Deeper copper
          "rgb(232, 115, 58)",  // Accent orange
        ]}
      >
        <button
          className={`${buttonClasses} relative z-10 w-full h-full bg-linear-to-r from-accent/80 via-accent/60 to-accent/90 backdrop-blur-md `}
          disabled={disabled || loading}
          {...props}
        >
          {buttonContent}
        </button>
      </NoiseBackground>
    );
  }

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {buttonContent}
    </button>
  );
}

/* ─── CARD ──────────────────────────────────────────────── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  selected?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ hover = false, selected = false, padding = 'md', children, className = '', ...props }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };
  return (
    <div
      className={`relative group rounded-2xl md:rounded-3xl p-1.5 md:p-2 border border-border ${hover ? 'hover:shadow-sm transition-all duration-150 cursor-pointer' : ''} ${selected ? 'border-accent shadow-[0_0_12px_rgba(255,255,255,0.05)]' : ''} ${className}`}
      {...props}
    >
      <GlowingEffect
        blur={0}
        borderWidth={2}
        spread={60}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
      />
      <div className={`relative h-full flex flex-col bg-bg-surface rounded-xl ${paddings[padding]}`}>
        {children}
      </div>
    </div>
  );
}

/* ─── CHIP ──────────────────────────────────────────────── */

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  count?: number;
}

export function Chip({ label, selected = false, onClick, icon: Icon, count }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none border
        ${selected
          ? 'bg-accent text-text-on-accent border-accent'
          : 'bg-transparent text-text-secondary border-border hover:border-accent hover:text-accent'
        }`}
    >
      {Icon && <Icon size={14} />}
      {label}
      {count !== undefined && (
        <span className={`ml-0.5 text-[10px] ${selected ? 'opacity-80' : 'opacity-60'}`}>
          ({count})
        </span>
      )}
    </button>
  );
}

/* ─── BADGE ─────────────────────────────────────────────── */

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'default', size = 'sm' }: BadgeProps) {
  const variants = {
    default: 'bg-bg-surface text-text-secondary border-border',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-error/10 text-error border-error/20',
    info: 'bg-info/10 text-info border-info/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
  };
  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };
  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${variants[variant]} ${sizes[size]}`}>
      {label}
    </span>
  );
}

/* ─── DEAL SCORE BADGE ──────────────────────────────────── */

interface DealScoreBadgeProps {
  score: number | null;  // P2-3: Allow NULL for "Not Scored"
  size?: 'sm' | 'md' | 'lg';
}

export function DealScoreBadge({ score, size = 'md' }: DealScoreBadgeProps) {
  // P2-3: Handle NULL/Undefined or "null" strings gracefully
  if (score === null || score === undefined || (typeof score === 'string' && (score === 'null' || score === ''))) {
    const notScoredColor = 'bg-text-tertiary/10 text-text-tertiary border-text-tertiary/20';
    const sizes = {
      sm: 'text-[9px] px-1.5 py-0.5',
      md: 'text-[11px] px-2 py-0.5',
      lg: 'text-xs px-3 py-1',
    };
    return (
      <span className={`inline-flex items-center font-bold rounded-md border ${notScoredColor} ${sizes[size]} uppercase tracking-tight`}>
        Not Scored
      </span>
    );
  }

  // Handle strings (e.g. from Supabase Numeric column)
  const numericScore = typeof score === 'string' ? parseFloat(score) : score;

  if (isNaN(numericScore)) {
    return (
      <span className="inline-flex items-center font-bold rounded-md border bg-text-tertiary/10 text-text-tertiary border-text-tertiary/20 text-[11px] px-2 py-0.5 uppercase tracking-tight">
        Err
      </span>
    );
  }

  const getColor = (s: number) => {
    if (s >= 9) return 'bg-deal-hot/10 text-deal-hot border-deal-hot/20';
    if (s >= 7) return 'bg-deal-excellent/10 text-deal-excellent border-deal-excellent/20';
    if (s >= 4) return 'bg-deal-good/10 text-deal-good border-deal-good/20';
    return 'bg-deal-poor/10 text-deal-poor border-deal-poor/20';
  };
  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11px] px-2 py-0.5',
    lg: 'text-xs px-3 py-1',
  };
  return (
    <span className={`inline-flex items-center font-black rounded-md border ${getColor(numericScore)} ${sizes[size]} tracking-tight`}>
      {numericScore.toFixed(1)}
    </span>
  );
}

/* ─── INPUT ─────────────────────────────────────────────── */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefix?: string;
  suffix?: string;
  error?: string;
  helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, prefix, suffix, error, helpText, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-xs font-medium text-text-secondary">{label}</label>}
        <div className={`flex items-center border rounded-lg px-3 py-2 bg-bg-elevated transition-all duration-150 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 ${error ? 'border-error' : 'border-border'} ${className}`}>
          {prefix && <span className="text-text-tertiary text-sm mr-1 select-none">{prefix}</span>}
          <input
            ref={ref}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary min-w-0"
            {...props}
          />
          {suffix && <span className="text-text-tertiary text-sm ml-1 select-none">{suffix}</span>}
        </div>
        {error && <span className="text-xs text-error">{error}</span>}
        {helpText && !error && <span className="text-xs text-text-tertiary">{helpText}</span>}
      </div>
    );
  }
);

/* ─── EMPTY STATE ───────────────────────────────────────── */

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon = AlertCircle, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center max-w-sm mx-auto">
      <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
        <Icon size={24} className="text-text-tertiary" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed mb-6">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

/* ─── SKELETON ──────────────────────────────────────────── */

interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export function Skeleton({ width, height = '16px', rounded = 'md', className = '' }: SkeletonProps) {
  const radii = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' };
  return (
    <div
      className={`skeleton ${radii[rounded]} ${className}`}
      style={{ width: width || '100%', height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-3">
      <Skeleton height="140px" rounded="md" />
      <Skeleton width="70%" height="14px" />
      <Skeleton width="40%" height="20px" />
      <div className="flex gap-3">
        <Skeleton width="60px" height="12px" />
        <Skeleton width="60px" height="12px" />
        <Skeleton width="60px" height="12px" />
      </div>
    </div>
  );
}

/* ─── METRIC TILE ───────────────────────────────────────── */

interface MetricTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  tilt?: boolean;
}

export function MetricTile({ icon: Icon, label, value, sublabel, trend, onClick, tilt }: MetricTileProps) {
  const trendColors = { up: 'text-success', down: 'text-error', neutral: 'text-text-tertiary' };
  const animatedCount = useCountUp(typeof value === 'number' ? value : 0, 1000);
  const animatedValue = typeof value === 'number' ? animatedCount : value;
  
  const tiltProps = useTilt(5);

  return (
    <div
      {...(tilt ? { ref: tiltProps.ref, onMouseMove: tiltProps.onMouseMove, onMouseLeave: tiltProps.onMouseLeave } : {})}
      className={`relative h-full rounded-2xl border border-border p-2 md:rounded-3xl md:p-3 group ${onClick ? 'cursor-pointer hover:border-accent/40 transition-all' : ''} ${tilt ? 'pulse-card remi-card' : ''}`}
      onClick={onClick}
    >
      <GlowingEffect
        blur={0}
        borderWidth={2}
        spread={60}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
      />
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-xl bg-bg-surface p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Icon size={16} className="text-accent" />
            </div>
            <span className="text-xs font-medium text-text-secondary">{label}</span>
          </div>
          <div className="text-2xl font-bold text-text-primary">{animatedValue}</div>
          {sublabel && (
            <div className={`text-xs mt-1 ${trend ? trendColors[trend] : 'text-text-tertiary'}`}>
              {trend === 'up' && '+'}{sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── HELP ICON ─────────────────────────────────────────── */

import { HelpCircle } from 'lucide-react';

interface HelpIconProps {
  tooltip: string;
}

export function HelpIcon({ tooltip }: HelpIconProps) {
  return (
    <span className="relative group/help inline-flex items-center ml-1 cursor-help">
      <HelpCircle size={14} className="text-text-tertiary group-hover/help:text-text-secondary transition-colors" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-dark text-text-on-accent text-xs rounded-lg shadow-lg opacity-0 group-hover/help:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 max-w-[250px] text-wrap">
        {tooltip}
      </span>
    </span>
  );
}

/* ─── SOURCE LABEL ──────────────────────────────────────── */

interface SourceLabelProps {
  source: string;
  timestamp: string;
  sampleSize?: number;
}

export function SourceLabel({ timestamp, sampleSize }: Omit<SourceLabelProps, 'source'>) {
  // User requested to hide "Supabase: table_name" labels for a cleaner aesthetic.
  return (
    <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-2">
      <span>{timestamp}</span>
      {sampleSize !== undefined && (
        <>
          <span>·</span>
          <span>{sampleSize.toLocaleString()} listings</span>
        </>
      )}
    </div>
  );
}

/* ─── AIRTABLE BADGE ──────────────────────────────────────── */

export type AirtableColor = 
  | 'gray' | 'blue' | 'cyan' | 'teal' | 'green' | 'darkgreen' 
  | 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'deepblue' | 'ultraluxury';

interface AirtableBadgeProps {
  label: string;
  color: AirtableColor;
}

export function AirtableBadge({ label, color }: AirtableBadgeProps) {
  const colorStyles: Record<AirtableColor, string> = {
    gray: 'bg-[var(--color-air-gray-bg)] text-[var(--color-air-gray-text)]',
    blue: 'bg-[var(--color-air-blue-bg)] text-[var(--color-air-blue-text)]',
    cyan: 'bg-[var(--color-air-cyan-bg)] text-[var(--color-air-cyan-text)]',
    teal: 'bg-[var(--color-air-teal-bg)] text-[var(--color-air-teal-text)]',
    green: 'bg-[var(--color-air-green-bg)] text-[var(--color-air-green-text)]',
    darkgreen: 'bg-[var(--color-air-darkgreen-bg)] text-[var(--color-air-darkgreen-text)]',
    yellow: 'bg-[var(--color-air-yellow-bg)] text-[var(--color-air-yellow-text)]',
    orange: 'bg-[var(--color-air-orange-bg)] text-[var(--color-air-orange-text)]',
    red: 'bg-[var(--color-air-red-bg)] text-[var(--color-air-red-text)]',
    pink: 'bg-[var(--color-air-pink-bg)] text-[var(--color-air-pink-text)]',
    purple: 'bg-[var(--color-air-purple-bg)] text-[var(--color-air-purple-text)]',
    deepblue: 'bg-[var(--color-air-deepblue-bg)] text-[var(--color-air-deepblue-text)]',
    ultraluxury: 'bg-[var(--color-air-ultraluxury-bg)] text-[var(--color-air-ultraluxury-text)]',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${colorStyles[color]}`}>
      {label}
    </span>
  );
}
