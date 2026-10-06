/* ═══════════════════════════════════════════════════════════
   PROFILE — Global filter source of truth
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target, Shield, DollarSign, Home, MapPin, Gauge,
  Radar, Save, RotateCcw, Check, AlertTriangle, Brain, Trash2,
  Building2, CreditCard, ChevronRight, Palette, Telescope, TrendingUp, ChevronDown,
  KeyRound, Plus, X,
} from 'lucide-react';
import { RenewalPricePanel, VacancyGapPanel } from '../components/RentalIntelPanel';
import { CalibrationResultPanel } from '../components/CalibrationResultPanel';
import { useBilling } from '../hooks/useBilling';
import { Button, Chip, Input, Badge, HelpIcon } from '../components/ui';
import { GlowingEffect } from '../components/ui/glowing-effect';
import { useFilters } from '../contexts/FilterContext';
import { getOrCreateUserId, getOrCreateSessionId } from '../lib/auth-utils';
import { useMarket } from '../stores/marketStore';
import { useThemeStore } from '../stores/themeStore';
import { useToast } from '../contexts/ToastContext';
import { INVESTMENT_GOALS, EMPTY_PROFILE } from '../data/mockData';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { supabase } from '../lib/supabase';
import { useMemoryManagement } from '../hooks/useMemoryManagement';
import type { InvestmentGoal, UserProfile } from '../types';

const GlowingCard = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={`relative h-full rounded-2xl border border-border p-2 md:rounded-3xl md:p-3 ${className}`}>
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
      />
      <div className="border-0.75 relative flex h-full flex-col gap-4 overflow-hidden rounded-xl bg-bg-surface p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
};

export default function Profile() {
  const { neighborhoods: dynamicNeighborhoods } = useNeighborhoods();
  const { profile, setProfile } = useFilters();
  const { currentMarket } = useMarket();
  const { theme, setTheme } = useThemeStore();
  const { addToast } = useToast();
  const { memories, isLoading: memoryLoading, clearMemory } = useMemoryManagement();
  const { subscription, isActive, isTrialing, isPastDue, openPortal } = useBilling();
  const [draft, setDraft] = useState<UserProfile>({
    goals: profile.goals,
    riskTolerance: profile.riskTolerance,
    budgetMin: profile.budgetMin,
    budgetMax: profile.budgetMax,
    propertyTypes: profile.propertyTypes,
    neighborhoods: profile.neighborhoods,
    minDealScore: profile.minDealScore,
    aiScoutingEnabled: profile.aiScoutingEnabled,
    userId: profile.userId,
    capRateTarget: profile.capRateTarget ?? null,
    ltvTarget: profile.ltvTarget ?? null,
    preferredPropertyClasses: profile.preferredPropertyClasses ?? null,
    targetIrr: profile.targetIrr ?? null,
  });
  const [investorExpanded, setInvestorExpanded] = useState(
    !!(profile.capRateTarget || profile.ltvTarget || profile.preferredPropertyClasses?.length || profile.targetIrr)
  );
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Calibration state
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<any | null>(null);
  const calibrationRef = useRef<HTMLDivElement>(null);

  // Managed Properties (PM persona)
  const [managedProps, setManagedProps] = useState<any[]>([]);
  const [managedLoading, setManagedLoading] = useState(false);
  const [addPropertyId, setAddPropertyId] = useState('');
  const [addingProp, setAddingProp] = useState(false);
  const [managedExpanded, setManagedExpanded] = useState(false);
  const [activePanelPropId, setActivePanelPropId] = useState<string | null>(null);

  const fetchManagedProps = useCallback(async () => {
    setManagedLoading(true);
    try {
      const userId = getOrCreateUserId();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/rental-intel/managed`, {
        headers: { 'x-user-id': userId },
      });
      if (res.ok) setManagedProps(await res.json());
    } catch { /* silent */ } finally {
      setManagedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (managedExpanded) fetchManagedProps();
  }, [managedExpanded, fetchManagedProps]);

  const handleAddManagedProp = async () => {
    if (!addPropertyId.trim()) return;
    setAddingProp(true);
    try {
      const userId = getOrCreateUserId();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/rental-intel/managed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ property_id: addPropertyId.trim() }),
      });
      if (res.ok) {
        setAddPropertyId('');
        await fetchManagedProps();
        addToast('Property added to your portfolio', 'success');
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to add property', 'error');
      }
    } catch { addToast('Failed to add property', 'error'); }
    finally { setAddingProp(false); }
  };

  const handleRemoveManagedProp = async (managedId: string) => {
    try {
      const userId = getOrCreateUserId();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await fetch(`${apiUrl}/api/rental-intel/managed/${managedId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      setManagedProps(prev => prev.filter(p => p.managed_id !== managedId));
      if (activePanelPropId === managedId) setActivePanelPropId(null);
    } catch { addToast('Failed to remove property', 'error'); }
  };

  // Sync draft with profile when profile loads (e.g. from Supabase after market switch)
  useEffect(() => {
    setDraft({
      goals: profile.goals,
      riskTolerance: profile.riskTolerance,
      budgetMin: profile.budgetMin,
      budgetMax: profile.budgetMax,
      propertyTypes: profile.propertyTypes,
      neighborhoods: profile.neighborhoods,
      minDealScore: profile.minDealScore,
      aiScoutingEnabled: profile.aiScoutingEnabled,
      userId: profile.userId,
      capRateTarget: profile.capRateTarget ?? null,
      ltvTarget: profile.ltvTarget ?? null,
      preferredPropertyClasses: profile.preferredPropertyClasses ?? null,
      targetIrr: profile.targetIrr ?? null,
    });
  }, [profile]);

  // Validate draft data against available neighborhoods
  const validateDraft = useCallback(() => {
    const errors: Record<string, string> = {};
    const availableNeighborhoods = dynamicNeighborhoods.map(n => n.name);
    
    // Check if selected neighborhoods are valid for current market
    const invalidNeighborhoods = draft.neighborhoods?.filter(n => !availableNeighborhoods.includes(n)) || [];
    if (invalidNeighborhoods.length > 0) {
      errors.neighborhoods = `Invalid neighborhoods: ${invalidNeighborhoods.join(', ')}`;
    }
    
    // Budget validation
    if (draft.budgetMin != null && draft.budgetMax != null && draft.budgetMin >= draft.budgetMax && draft.budgetMax > 0) {
      errors.budget = 'Minimum must be less than maximum.';
    }
    
    // Min deal score validation
    if (draft.minDealScore != null && (draft.minDealScore < 0 || draft.minDealScore > 10)) {
      errors.minDealScore = 'Deal score must be between 0 and 10.';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [draft, dynamicNeighborhoods]);

  // Run validation whenever draft changes
  useEffect(() => {
    if (saveAttempted) {
      validateDraft();
    }
  }, [draft, dynamicNeighborhoods, saveAttempted, validateDraft]);

  const toggleGoal = (goal: InvestmentGoal) => {
    setDraft(prev => ({
      ...prev,
      goals: prev.goals?.includes(goal) 
        ? prev.goals.filter(g => g !== goal) 
        : [...(prev.goals || []), goal],
    }));
  };

  const togglePropertyType = (type: string) => {
    setDraft(prev => ({
      ...prev,
      propertyTypes: prev.propertyTypes?.includes(type) 
        ? prev.propertyTypes.filter(t => t !== type) 
        : [...(prev.propertyTypes || []), type],
    }));
  };

  const toggleNeighborhood = (n: string) => {
    // Only allow toggling if the neighborhood exists in the current market
    const availableNeighborhoods = dynamicNeighborhoods.map(neigh => neigh.name);
    if (!availableNeighborhoods.includes(n)) {
      addToast(`"${n}" is not available in the current market`, 'error');
      return;
    }
    
    setDraft(prev => ({
      ...prev,
      neighborhoods: prev.neighborhoods?.includes(n) 
        ? prev.neighborhoods.filter(x => x !== n) 
        : [...(prev.neighborhoods || []), n],
    }));
  };

  // Core save logic — shared by handleSave and handleGoLive
  const _persistProfile = async (scoutingEnabled: boolean) => {
    const userId = getOrCreateUserId();

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          market_slug: currentMarket.id,
          investment_goals: draft.goals,
          risk_tolerance: draft.riskTolerance,
          budget_min: draft.budgetMin,
          budget_max: draft.budgetMax,
          property_types: draft.propertyTypes,
          neighborhoods: draft.neighborhoods,
          min_deal_score: draft.minDealScore,
          ai_scouting_enabled: scoutingEnabled,
          cap_rate_target: draft.capRateTarget ?? null,
          ltv_target: draft.ltvTarget ?? null,
          preferred_property_classes: draft.preferredPropertyClasses ?? null,
          target_irr: draft.targetIrr ?? null,
        } as any,
        { onConflict: 'user_id,market_slug' }
      );

    if (error) throw error;

    const sessionId = getOrCreateSessionId();
    const { error: scoutError } = await supabase
      .from('deal_scout_status')
      .upsert(
        {
          user_id: userId,
          session_id: sessionId,
          is_active: scoutingEnabled,
          scan_regions: draft.neighborhoods && draft.neighborhoods.length > 0 ? draft.neighborhoods : [currentMarket.id],
          scan_types: draft.propertyTypes,
          price_min: draft.budgetMin || undefined,
          price_max: draft.budgetMax || undefined,
          score_min: draft.minDealScore,
        } as any,
        { onConflict: 'session_id' }
      );

    if (scoutError) throw scoutError;

    const updatedDraft = { ...draft, aiScoutingEnabled: scoutingEnabled };
    setProfile(updatedDraft);
    setLastSavedAt(new Date());

    window.dispatchEvent(new CustomEvent('remi:profile_update', {
      detail: { profile: updatedDraft, market_id: currentMarket.id }
    }));
    window.dispatchEvent(new CustomEvent('remi:domino_update', {
      detail: { source: 'profile', profile: updatedDraft }
    }));
  };

  const handleSave = async () => {
    setSaveAttempted(true);

    if (!validateDraft()) {
      addToast('Please fix validation errors before saving', 'error');
      return;
    }

    setSaving(true);
    try {
      // Save profile — ai_scouting_enabled keeps its current value.
      // Activation only happens via handleGoLive after calibration review.
      await _persistProfile(draft.aiScoutingEnabled ?? false);
      addToast('Profile saved', 'success');
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      addToast('Failed to save profile: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewAlerts = async () => {
    setSaveAttempted(true);

    if (!validateDraft()) {
      addToast('Please fix validation errors before previewing', 'error');
      return;
    }

    if (!draft.budgetMax || !draft.minDealScore) {
      addToast('Set a budget maximum and deal score threshold first', 'error');
      return;
    }

    setCalibrating(true);
    setCalibrationResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/deal-scout/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_slug: currentMarket.id,
          budget_min: draft.budgetMin ?? undefined,
          budget_max: draft.budgetMax,
          min_deal_score: draft.minDealScore,
          property_types: draft.propertyTypes ?? [],
          neighborhoods: draft.neighborhoods ?? [],
          cap_rate_target: draft.capRateTarget ?? undefined,
          ltv_target: draft.ltvTarget ?? undefined,
          preferred_property_classes: draft.preferredPropertyClasses ?? undefined,
          target_irr: draft.targetIrr ?? undefined,
        }),
      });

      if (!res.ok) throw new Error(`Calibration request failed: ${res.status}`);
      const data = await res.json();
      setCalibrationResult(data);

      // Scroll to the calibration panel
      setTimeout(() => {
        calibrationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error('Calibration failed:', err);
      addToast('Preview failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setCalibrating(false);
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    try {
      await _persistProfile(true);
      setCalibrationResult(null);
      addToast('Profile saved & AI Scouting activated!', 'success');
    } catch (err: any) {
      console.error('Failed to go live:', err);
      addToast('Activation failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...EMPTY_PROFILE });
    setValidationErrors({});
    setSaveAttempted(false);
    addToast('Reverted to empty defaults', 'info');
  };

  const saveDisabled = saving || calibrating || Object.keys(validationErrors).length > 0;
  const SaveProfileButton = ({ className = '' }: { className?: string }) => (
    <button
      onClick={handleSave}
      disabled={saveDisabled}
      className={`flex items-center gap-2 h-8 cursor-pointer rounded-full bg-accent hover:bg-accent-hover px-4 text-text-on-accent transition-all duration-100 active:scale-98 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Save size={14} />
      {saving ? 'Saving...' : 'Save Profile'}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Your Profile</h1>
            <p className="text-sm text-text-secondary mt-0.5">These preferences filter all views across REMI.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={handleReset}>Reset</Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Telescope}
              onClick={handlePreviewAlerts}
              disabled={calibrating || saving}
            >
              {calibrating ? 'Scanning...' : 'Preview My Alerts'}
            </Button>
            <SaveProfileButton />
          </div>
        </div>


        {/* Show validation errors */}
        {saveAttempted && Object.keys(validationErrors).length > 0 && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-error" />
              <p className="text-sm font-medium text-error">Validation Errors:</p>
            </div>
            <ul className="list-disc list-inside text-xs text-error mt-1">
              {Object.entries(validationErrors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ─── UI Layout Customization ─────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Layout Customization</h2>
            <HelpIcon tooltip="Customize the look and feel of REMI." />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['default', 'night', 'colorblind', 'system'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`flex-1 py-2.5 text-xs font-medium transition-all cursor-pointer capitalize
                  ${theme === mode
                    ? 'bg-accent text-text-on-accent'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-primary'
                  }`}
              >
                {mode === 'default' ? 'Default' : mode === 'night' ? 'Night Mode' : mode === 'colorblind' ? 'CBM' : 'System'}
              </button>
            ))}
          </div>
        </GlowingCard>

        {/* ─── Investment Goals ─────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Investment Goals</h2>
            {draft.goals && draft.goals.length > 0 && (
              <Badge label={`${draft.goals.length} selected`} variant="accent" size="sm" />
            )}
            {(!draft.goals || draft.goals.length === 0) && (
              <span className="text-xs text-text-tertiary">Select one or more</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {INVESTMENT_GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGoal(g.id as InvestmentGoal)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  draft.goals?.includes(g.id as InvestmentGoal)
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-bg-surface border-border text-text-primary hover:border-border-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{g.label}</span>
                  {draft.goals?.includes(g.id as InvestmentGoal) && <Check size={14} />}
                </div>
                <p className="text-[10px] text-text-tertiary mt-0.5">{g.description}</p>
              </button>
            ))}
          </div>
        </GlowingCard>

        {/* ─── Risk Tolerance ──────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Risk Tolerance</h2>
            <HelpIcon tooltip="Conservative: stable, low-risk. Moderate: balanced risk/reward. Aggressive: high risk, high return." />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['conservative', 'moderate', 'aggressive'] as const).map(level => (
              <button
                key={level}
                onClick={() => setDraft(prev => ({ ...prev, riskTolerance: level }))}
                className={`flex-1 py-2.5 text-xs font-medium transition-all cursor-pointer capitalize
                  ${draft.riskTolerance === level
                    ? 'bg-accent text-text-on-accent'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-primary'
                  }`}
              >
                {level}
              </button>
            ))}
          </div>
        </GlowingCard>

        {/* ─── Budget Range ────────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Budget Range</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Minimum"
              prefix="$"
              type="text"
              placeholder="200,000"
              value={draft.budgetMin ? draft.budgetMin.toLocaleString() : ''}
              onChange={e => {
                const val = e.target.value.replace(/,/g, '');
                const v = val ? parseInt(val) : null;
                setDraft(prev => ({ ...prev, budgetMin: v }));
              }}
            />
            <Input
              label="Maximum"
              prefix="$"
              type="text"
              placeholder="1,500,000"
              value={draft.budgetMax ? draft.budgetMax.toLocaleString() : ''}
              onChange={e => {
                const val = e.target.value.replace(/,/g, '');
                const v = val ? parseInt(val) : null;
                setDraft(prev => ({ ...prev, budgetMax: v }));
              }}
            />
          </div>
          {(draft.budgetMin != null && draft.budgetMax != null && draft.budgetMin >= draft.budgetMax && draft.budgetMax > 0) && (
            <p className="text-xs text-error mt-2">Minimum must be less than maximum.</p>
          )}
        </GlowingCard>

        {/* ─── Property Types ──────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <Home size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Property Types</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {['house', 'condo', 'townhouse', 'apartment', 'multi-family'].map(type => (
              <Chip
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                selected={draft.propertyTypes?.includes(type)}
                onClick={() => togglePropertyType(type)}
              />
            ))}
          </div>
        </GlowingCard>

        {/* ─── Neighborhoods ───────────────────────────────── */}
        <GlowingCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">Neighborhoods</h2>
              {draft.neighborhoods && draft.neighborhoods.length > 0 && (
                <Badge label={`${draft.neighborhoods.length} selected`} variant="accent" size="sm" />
              )}
              {(!draft.neighborhoods || draft.neighborhoods.length === 0) && (
                <span className="text-xs text-text-tertiary">Select one or more</span>
              )}
            </div>
            {draft.neighborhoods && draft.neighborhoods.length > 0 && (
              <button
                onClick={() => setDraft(prev => ({ ...prev, neighborhoods: [] }))}
                className="text-xs text-text-tertiary hover:text-error cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {dynamicNeighborhoods.map(n => (
              <Chip
                key={n.name}
                label={n.name}
                selected={draft.neighborhoods?.includes(n.name)}
                onClick={() => toggleNeighborhood(n.name)}
              />
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-2">
            {dynamicNeighborhoods.length} neighborhoods available in {currentMarket?.displayName || 'your market'}
          </p>
        </GlowingCard>


        {/* ─── Deal Score + AI Scouting ────────────────────── */}
        <GlowingCard>
          <div className="flex items-center gap-2 mb-3">
            <Gauge size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Minimum Deal Score</h2>
            <HelpIcon tooltip="5–6 = solid deals. 7+ = good deals. 9+ = excellent deals only. Drag left to see more inventory." />
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={draft.minDealScore || 0}
              onChange={e => setDraft(prev => ({ ...prev, minDealScore: parseInt(e.target.value) }))}
              className="flex-1 accent-accent h-1.5"
            />
            <span className="text-lg font-bold text-accent w-8 text-center">{draft.minDealScore || 0}</span>
          </div>
          <div className="flex justify-between text-[10px] text-text-tertiary mt-1 px-0.5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n}>{n}</span>
            ))}
          </div>
          {draft.minDealScore != null && (draft.minDealScore < 0 || draft.minDealScore > 10) && (
            <p className="text-xs text-error mt-2">Deal score must be between 0 and 10.</p>
          )}
        </GlowingCard>

        <GlowingCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radar size={16} className="text-accent" />
              <div>
                <h2 className="text-sm font-semibold">AI Deal Scouting</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  {draft.aiScoutingEnabled
                    ? 'Active — REMI is scanning the market for you.'
                    : 'Set up in 30 seconds → let REMI find deals automatically.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDraft(prev => ({ ...prev, aiScoutingEnabled: !prev.aiScoutingEnabled }))}
              className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${
                draft.aiScoutingEnabled ? 'bg-accent' : 'bg-border'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${
                draft.aiScoutingEnabled ? 'left-5.5' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Active configuration summary — shows what REMI is currently acting on */}
          {profile.aiScoutingEnabled && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">Scout is watching for</p>
              <div className="grid grid-cols-2 gap-2">
                {(profile.budgetMin || profile.budgetMax) && (
                  <div className="bg-bg-primary rounded-md px-2.5 py-1.5 border border-border/40">
                    <p className="text-[10px] text-text-tertiary">Budget</p>
                    <p className="text-xs font-medium text-text-primary">
                      {profile.budgetMin ? `$${(profile.budgetMin / 1000).toFixed(0)}K` : 'Any'} – {profile.budgetMax ? `$${(profile.budgetMax / 1000).toFixed(0)}K` : 'Any'}
                    </p>
                  </div>
                )}
                {(profile.minDealScore ?? 0) > 0 && (
                  <div className="bg-bg-primary rounded-md px-2.5 py-1.5 border border-border/40">
                    <p className="text-[10px] text-text-tertiary">Min Deal Score</p>
                    <p className="text-xs font-medium text-accent">{profile.minDealScore}+</p>
                  </div>
                )}
                {(profile.propertyTypes?.length ?? 0) > 0 && (
                  <div className="bg-bg-primary rounded-md px-2.5 py-1.5 border border-border/40">
                    <p className="text-[10px] text-text-tertiary">Property Types</p>
                    <p className="text-xs font-medium text-text-primary capitalize">{profile.propertyTypes?.join(', ')}</p>
                  </div>
                )}
                {(profile.neighborhoods?.length ?? 0) > 0 && (
                  <div className="bg-bg-primary rounded-md px-2.5 py-1.5 border border-border/40">
                    <p className="text-[10px] text-text-tertiary">Neighborhoods</p>
                    <p className="text-xs font-medium text-text-primary">{profile.neighborhoods?.length} selected</p>
                  </div>
                )}
              </div>
              {lastSavedAt && (
                <p className="text-[10px] text-text-tertiary">
                  Last saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}
        </GlowingCard>

        {/* ─── Investor Parameters ─────────────────────────────── */}
        <GlowingCard>
          <button
            onClick={() => setInvestorExpanded(v => !v)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <div className="text-left">
                <h2 className="text-sm font-semibold">Investor Parameters</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Cap rate, LTV, and property class filters for secondary investor scoring.
                </p>
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`text-text-tertiary transition-transform ${investorExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {investorExpanded && (
            <div className="mt-4 space-y-4 pt-4 border-t border-border/50">
              {/* Cap Rate Target */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Minimum Cap Rate (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    placeholder="e.g. 6.5"
                    value={draft.capRateTarget ?? ''}
                    onChange={e => setDraft(prev => ({
                      ...prev,
                      capRateTarget: e.target.value ? parseFloat(e.target.value) : null,
                    }))}
                    className="w-28 rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
                  />
                  {draft.capRateTarget != null && (
                    <span className="text-xs text-text-tertiary">
                      Properties below {draft.capRateTarget}% cap rate will be scored lower
                    </span>
                  )}
                </div>
              </div>

              {/* LTV Target */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Max LTV — {draft.ltvTarget != null ? `${Math.round((draft.ltvTarget) * 100)}%` : '75%'}
                </label>
                <input
                  type="range"
                  min={50}
                  max={80}
                  step={5}
                  value={draft.ltvTarget != null ? Math.round(draft.ltvTarget * 100) : 75}
                  onChange={e => setDraft(prev => ({
                    ...prev,
                    ltvTarget: parseInt(e.target.value) / 100,
                  }))}
                  className="w-full accent-accent h-1.5"
                />
                <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                  <span>50%</span><span>55%</span><span>60%</span><span>65%</span><span>70%</span><span>75%</span><span>80%</span>
                </div>
              </div>

              {/* Property Classes */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Preferred Property Classes
                  <span className="text-text-tertiary ml-1">(empty = all classes)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['multifamily', 'mixed_use', 'commercial', 'single_family', 'land'] as const).map(cls => {
                    const label = { multifamily: 'Multifamily', mixed_use: 'Mixed Use', commercial: 'Commercial', single_family: 'Single Family', land: 'Land' }[cls];
                    const selected = draft.preferredPropertyClasses?.includes(cls) ?? false;
                    return (
                      <button
                        key={cls}
                        onClick={() => setDraft(prev => {
                          const current = prev.preferredPropertyClasses ?? [];
                          const next = selected ? current.filter(c => c !== cls) : [...current, cls];
                          return { ...prev, preferredPropertyClasses: next.length ? next : null };
                        })}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                          selected
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'bg-bg-surface border-border text-text-secondary hover:border-border-hover'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target IRR */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Target IRR (%) <span className="text-text-tertiary">(optional — informational)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  placeholder="e.g. 15"
                  value={draft.targetIrr ?? ''}
                  onChange={e => setDraft(prev => ({
                    ...prev,
                    targetIrr: e.target.value ? parseFloat(e.target.value) : null,
                  }))}
                  className="w-28 rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
                />
              </div>

              {/* Clear investor params */}
              {(draft.capRateTarget != null || draft.ltvTarget != null || draft.preferredPropertyClasses?.length || draft.targetIrr != null) && (
                <button
                  onClick={() => setDraft(prev => ({
                    ...prev, capRateTarget: null, ltvTarget: null, preferredPropertyClasses: null, targetIrr: null,
                  }))}
                  className="text-xs text-text-tertiary hover:text-error transition-colors cursor-pointer"
                >
                  Clear investor parameters
                </button>
              )}
            </div>
          )}
        </GlowingCard>



        {/* ─── Managed Properties (PM Persona) ────────────────────── */}
        <GlowingCard>
          <button
            onClick={() => setManagedExpanded(v => !v)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-accent" />
              <div className="text-left">
                <h2 className="text-sm font-semibold">Managed Properties</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Track your rental portfolio and get pricing intelligence.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {managedProps.length > 0 && (
                <span className="text-[10px] font-semibold text-accent bg-accent/10 rounded-full px-2 py-0.5">
                  {managedProps.length}
                </span>
              )}
              <ChevronDown
                size={16}
                className={`text-text-tertiary transition-transform ${managedExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {managedExpanded && (
            <div className="mt-4 space-y-4 pt-4 border-t border-border/50">
              {/* Add property by ID */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Add by Property ID
                  <span className="text-text-tertiary ml-1">(UUID from canonical_properties)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={addPropertyId}
                    onChange={e => setAddPropertyId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddManagedProp()}
                    className="flex-1 rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent font-mono"
                  />
                  <button
                    onClick={handleAddManagedProp}
                    disabled={addingProp || !addPropertyId.trim()}
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={13} />
                    {addingProp ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Managed property list */}
              {managedLoading ? (
                <div className="text-xs text-text-tertiary">Loading portfolio…</div>
              ) : managedProps.length === 0 ? (
                <div className="text-xs text-text-tertiary text-center py-4 rounded-lg border border-dashed border-border">
                  No managed properties yet. Add a property ID above.
                </div>
              ) : (
                <div className="space-y-3">
                  {managedProps.map(prop => (
                    <div key={prop.managed_id} className="rounded-lg border border-border bg-bg-primary">
                      {/* Property header */}
                      <div className="flex items-start justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{prop.address}</p>
                          <p className="text-[10px] text-text-tertiary mt-0.5">
                            {[
                              prop.bedrooms != null && `${prop.bedrooms}BR`,
                              prop.bathrooms != null && `${prop.bathrooms}BA`,
                              prop.sqft && `${prop.sqft.toLocaleString()} sqft`,
                              prop.last_price && `$${prop.last_price.toLocaleString()}/mo`,
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setActivePanelPropId(
                              activePanelPropId === prop.property_id ? null : prop.property_id
                            )}
                            className="text-[10px] font-medium text-accent hover:underline cursor-pointer"
                          >
                            {activePanelPropId === prop.property_id ? 'Hide intel' : 'Rental intel'}
                          </button>
                          <button
                            onClick={() => handleRemoveManagedProp(prop.managed_id)}
                            className="text-text-tertiary hover:text-error transition-colors cursor-pointer"
                            title="Remove from portfolio"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Rental Intel Panel — shown inline when expanded */}
                      {activePanelPropId === prop.property_id && prop.market_slug && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                          {prop.bedrooms != null && (
                            <RenewalPricePanel
                              marketSlug={prop.market_slug}
                              bedrooms={prop.bedrooms}
                              bathrooms={prop.bathrooms ?? undefined}
                            />
                          )}
                          <VacancyGapPanel
                            marketSlug={prop.market_slug}
                            propertyId={prop.property_id}
                            daysVacant={prop.days_on_market ?? 0}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </GlowingCard>

        {/* ─── Long-Term Intelligence (Memory) ────────────────────── */}
        <GlowingCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-accent" />
              <div>
                <h2 className="text-sm font-semibold">Oracle Core Memory</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Extracted intelligence from your conversation history.
                </p>
              </div>
            </div>
            {memories.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                icon={Trash2} 
                onClick={() => {
                  if (window.confirm('Are you sure you want to permanently erase all Oracle memory?')) {
                    clearMemory();
                  }
                }}
                className="text-error hover:bg-error/10 hover:text-error"
              >
                Wipe Memory
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            {memoryLoading ? (
              <div className="text-xs text-text-tertiary text-center py-4">Loading core memory...</div>
            ) : memories.length === 0 ? (
              <div className="text-xs text-text-tertiary text-center py-6 bg-bg-primary rounded-lg border border-border/50">
                No long-term memories synthesized yet. The Oracle learns as you chat.
              </div>
            ) : (
              memories.map(block => (
                <div key={block.id} className="bg-bg-primary border border-border/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={block.type === 'lifetime' ? 'accent' : 'info'} label={block.label} size="sm" />
                  </div>
                  <pre className="text-[10px] text-text-secondary whitespace-pre-wrap overflow-x-auto bg-black p-2 rounded border border-border/30">
                    {JSON.stringify(block.memory, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </GlowingCard>

        {/* ─── Calibration Loading State ─────────────────────── */}
        {calibrating && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-accent">
              <Telescope size={16} className="animate-pulse" />
              <span>Scanning the last 14 days of market data...</span>
            </div>
          </div>
        )}

        {/* ─── Calibration Result Panel ─────────────────────── */}
        {calibrationResult && !calibrating && (
          <div ref={calibrationRef}>
            <CalibrationResultPanel
              result={calibrationResult}
              minDealScore={draft.minDealScore ?? 5}
              onAdjust={() => {
                setCalibrationResult(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRaiseThreshold={() => {
                setDraft(prev => ({ ...prev, minDealScore: Math.min(10, (prev.minDealScore ?? 5) + 0.5) }));
                setCalibrationResult(null);
              }}
              onGoLive={handleGoLive}
              saving={saving}
            />
          </div>
        )}

        {/* Save / Reset footer */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="ghost" icon={RotateCcw} onClick={handleReset}>Reset to Defaults</Button>
          <Button
            variant="ghost"
            icon={Telescope}
            onClick={handlePreviewAlerts}
            disabled={calibrating || saving}
          >
            {calibrating ? 'Scanning...' : 'Preview My Alerts'}
          </Button>
          <SaveProfileButton />
        </div>
      </div>
    </div>
  );
}