/* ═══════════════════════════════════════════════════════════
   REMI Voice Avatar — ElevenLabs Convai Widget
   ═══════════════════════════════════════════════════════════
   Renders the ElevenLabs <elevenlabs-convai> web component and
   keeps it fed with live user context from two sources:

   1. dynamicVariables attribute — injected at session start:
      marketName, activePage, userName, budgetMin/Max,
      neighborhoods, propertyTypes, minDealScore
      (pulled live from Supabase user_profiles + marketStore)

   2. pushContext() → POST /v1/context — fires on every:
      - Page navigation
      - Property focus (remi:focus-property event)
      - Map viewport change (remi:map-context-update)
      - Dashboard pulse update (remi:dashboard-context-update)
      This keeps REMI's voice_llm_bridge.py (Claude backend)
      in sync with what the user is looking at in real time.

   The widget handles its own floating UI, button, and transcript.
   ═══════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMarket } from '../stores/marketStore';
import { useVoiceVariables } from '../hooks/useVoiceVariables';
import { useVoiceBiometricGate } from '../hooks/useVoiceBiometricGate';

// Web component typings skipped via ts-ignore to prevent TS/eslint namespace conflicts

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || '';
const CONTEXT_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Fire-and-forget context update to the voice LLM bridge. */
function pushContext(payload: Record<string, unknown>) {
  fetch(`${CONTEXT_URL}/v1/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Best-effort — never throw
}

export default function VoiceAvatar() {
  const widgetRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { currentMarket } = useMarket();
  const { variables: voiceVariables } = useVoiceVariables();
  const {
    isAllowed,
    requiresConsent,
    jurisdiction,
    applicableLaw,
    grantConsent,
  } = useVoiceBiometricGate();
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  // ── Sync dynamic variables to widget whenever user data changes ──
  // This updates the widget's session config so the next conversation
  // started by the user always has fresh, live account context.
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    widget.setAttribute('dynamic-variables', JSON.stringify({
      marketName:    voiceVariables.marketName,
      activePage:    voiceVariables.activePage,
      userName:      voiceVariables.userName,
      budgetMin:     voiceVariables.budgetMin,
      budgetMax:     voiceVariables.budgetMax,
      neighborhoods: voiceVariables.neighborhoods,
      propertyTypes: voiceVariables.propertyTypes,
      minDealScore:  voiceVariables.minDealScore,
      _neighborhoods: voiceVariables.neighborhoods,
    }));
  }, [voiceVariables]);

  // ── Push page + market context to REMI backend on every navigation ──
  useEffect(() => {
    pushContext({
      activePage:  voiceVariables.activePage,
      marketName:  voiceVariables.marketName,
      cityName:    currentMarket?.city || null,
      userName:    voiceVariables.userName,
      userPreferences: {
        budgetMin:     voiceVariables.budgetMin,
        budgetMax:     voiceVariables.budgetMax,
        neighborhoods: voiceVariables.neighborhoods.split(', ').filter(Boolean),
        propertyTypes: voiceVariables.propertyTypes.split(', ').filter(Boolean),
        minDealScore:  voiceVariables.minDealScore,
      },
    });
  }, [location.pathname, currentMarket, voiceVariables]);

  // ── Property focus: inject detail when user clicks a listing ──
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const p = e.detail;
      if (!p) return;
      pushContext({
        focusedProperty: {
          address:       p.address,
          price:         p.price,
          dealScore:     p.deal_score    || p.dealScore,
          neighborhood:  p.neighborhood,
          type:          p.property_type || p.propertyType,
          beds:          p.bedrooms      || p.beds,
          baths:         p.bathrooms     || p.baths,
          sqft:          p.sqft,
          daysOnMarket:  p.days_on_market || p.daysOnMarket,
          priceTier:     p.price_tier    || p.priceTier,
          listingStatus: p.tenure        || p.listingStatus,
        },
      });
    };
    window.addEventListener('remi:focus-property', handler as EventListener);
    return () => window.removeEventListener('remi:focus-property', handler as EventListener);
  }, []);

  // ── Map context: visible listing count + view area ──
  useEffect(() => {
    const handler = (e: CustomEvent) => pushContext({ mapContext: e.detail });
    window.addEventListener('remi:map-context-update', handler as EventListener);
    return () => window.removeEventListener('remi:map-context-update', handler as EventListener);
  }, []);

  // ── Dashboard context: pulse metrics ──
  useEffect(() => {
    const handler = (e: CustomEvent) => pushContext({ dashboardContext: e.detail });
    window.addEventListener('remi:dashboard-context-update', handler as EventListener);
    return () => window.removeEventListener('remi:dashboard-context-update', handler as EventListener);
  }, []);

  if (!AGENT_ID) return null;

  // ── Biometric Consent Dialog (BIPA / CUBI / HB 1493 / PIPEDA) ─────────────
  // Users in Illinois, Texas, Washington, or Canada must explicitly consent
  // before any voice processing begins. This satisfies the "written notice,
  // disclosure of purpose, and written release" requirements under applicable law.
  if (requiresConsent || showConsentDialog) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'rgba(15, 15, 20, 0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '20px 24px',
          maxWidth: '360px',
          color: '#fff',
          fontSize: '13px',
          lineHeight: '1.6',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
          Voice AI — Biometric Notice
        </p>
        <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '12px' }}>
          Your region ({jurisdiction}) has biometric privacy laws
          ({applicableLaw}). REMI's voice assistant may process audio to
          identify you. By enabling voice, you consent to this processing for
          the purpose of real estate market queries within this session.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', marginBottom: '16px' }}>
          Audio is processed by ElevenLabs and Deepgram. No voiceprints are
          retained beyond your session. You may disable voice at any time in
          your account settings.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={grantConsent}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            I Consent — Enable Voice
          </button>
          <button
            onClick={() => setShowConsentDialog(false)}
            style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ── Not yet allowed in this jurisdiction — show prompt to enable ───────────
  if (!isAllowed) return null;

  // ── Voice AI widget — only rendered after consent is confirmed ────────────
  return (
    <div style={{
      position: 'fixed',
      left: '24px',
      bottom: '24px',
      zIndex: 999999,
      width: '400px', // Contains the expanded widget
      height: '600px',
      pointerEvents: 'none', // Prevents blocking the background app UI
      transform: 'translate(0, 0)' // Traps the shadow DOM fixed positioning
    }}>
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      {/* @ts-ignore */}
      <elevenlabs-convai
        className="elevenlabs-widget"
        style={{ pointerEvents: 'auto' }}
        ref={widgetRef as React.RefObject<HTMLElement>}
        agent-id={AGENT_ID}
      dynamic-variables={JSON.stringify({
        marketName:     voiceVariables.marketName,
        activePage:     voiceVariables.activePage,
        userName:       voiceVariables.userName,
        budgetMin:      voiceVariables.budgetMin,
        budgetMax:      voiceVariables.budgetMax,
        neighborhoods:  voiceVariables.neighborhoods,
        propertyTypes:  voiceVariables.propertyTypes,
        minDealScore:   voiceVariables.minDealScore,
        _neighborhoods: voiceVariables.neighborhoods,
      })}
      />
    </div>
  );
}
