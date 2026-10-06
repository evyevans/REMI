/**
 * useVoiceBiometricGate
 *
 * Detects whether the current user's timezone maps to a jurisdiction with
 * active biometric privacy laws that restrict voice AI without explicit
 * written consent before any audio processing begins.
 *
 * Regulated jurisdictions (as of 2025):
 *   - Illinois   — BIPA (Biometric Information Privacy Act): private right of action,
 *                  statutory damages per violation, class-action bar
 *   - Texas      — CUBI (Capture or Use of Biometric Identifier Act): AG enforcement
 *   - Washington — HB 1493: notice + consent before enrolling biometric identifiers
 *   - Canada     — PIPEDA + Quebec Law 25: express consent for sensitive/biometric data
 *
 * Strategy: timezone → jurisdiction (intentionally over-inclusive — it is safer to
 * show a consent dialog to a Chicago user who is not in IL than to miss an IL user.
 * False negatives (missing a regulated user) carry legal risk; false positives
 * (showing a consent dialog unnecessarily) only cause minor UX friction.
 *
 * Consent is persisted in localStorage under 'remi_voice_biometric_consent_v1'
 * and should be migrated to the Supabase user profile in a future sprint.
 */

import { useState } from 'react';

const CONSENT_STORAGE_KEY = 'remi_voice_biometric_consent_v1';


// Canadian timezones — all regulated under PIPEDA + Quebec Law 25
const CANADIAN_TIMEZONE_PREFIXES = [
  'America/Toronto',
  'America/Vancouver',
  'America/Winnipeg',
  'America/Edmonton',
  'America/Calgary',
  'America/Halifax',
  'America/Moncton',
  'America/St_Johns',
  'America/Regina',
  'America/Saskatoon',
  'America/Iqaluit',
  'America/Rankin_Inlet',
  'America/Resolute',
  'America/Goose_Bay',
  'America/Blanc-Sablon',
  'America/Glace_Bay',
  'America/Creston',
  'America/Dawson',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Whitehorse',
  'America/Yellowknife',
  'America/Cambridge_Bay',
  'America/Inuvik',
  'America/Swift_Current',
  'America/Nipigon',
  'America/Pangnirtung',
  'America/Thunder_Bay',
  'America/Rainy_River',
];

export interface VoiceBiometricGateResult {
  /** Voice AI is permitted (either not regulated or user has consented) */
  isAllowed: boolean;
  /** User is in a regulated jurisdiction and consent has not yet been given */
  requiresConsent: boolean;
  /** Human-readable jurisdiction name for display */
  jurisdiction: string | null;
  /** Applicable law name for disclosure */
  applicableLaw: string | null;
  /** Record user's explicit consent */
  grantConsent: () => void;
  /** Revoke previously granted consent */
  revokeConsent: () => void;
}

function detectJurisdiction(): { jurisdiction: string | null; law: string | null } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Check Canada first (most specific)
    if (CANADIAN_TIMEZONE_PREFIXES.some(prefix => tz === prefix || tz.startsWith(prefix))) {
      return { jurisdiction: 'Canada', law: 'PIPEDA / Quebec Law 25' };
    }

    // Illinois — BIPA (highest risk: private right of action + class actions)
    if (tz === 'America/Chicago' || tz.startsWith('America/Indiana')) {
      return { jurisdiction: 'Illinois', law: 'BIPA (Biometric Information Privacy Act)' };
    }

    // Washington state
    if (tz === 'America/Los_Angeles') {
      return { jurisdiction: 'Washington', law: 'HB 1493 (Biometric Privacy)' };
    }

    // Texas (America/Chicago covers most of TX; America/Denver covers El Paso)
    if (tz === 'America/Chicago' || tz === 'America/Denver') {
      // Can't distinguish TX from IL/WI/MN via Chicago timezone alone.
      // IL is more restrictive (BIPA) so we already caught it above.
      // We only get here if somehow the IL check was skipped — safety net.
      return { jurisdiction: 'Texas', law: 'CUBI (Capture or Use of Biometric Identifier Act)' };
    }

    return { jurisdiction: null, law: null };
  } catch {
    // If timezone detection fails, be safe — require consent
    return { jurisdiction: 'Unknown (regulatory caution)', law: 'Biometric Privacy Laws' };
  }
}

function loadStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useVoiceBiometricGate(): VoiceBiometricGateResult {
  const { jurisdiction, law } = detectJurisdiction();
  const isRegulated = jurisdiction !== null;

  const [hasConsent, setHasConsent] = useState<boolean>(() => {
    if (!isRegulated) return true; // Not regulated — no consent needed
    return loadStoredConsent();
  });


  const grantConsent = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable — consent held in memory for this session
    }
    setHasConsent(true);
  };

  const revokeConsent = () => {
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setHasConsent(false);
  };

  return {
    isAllowed: !isRegulated || hasConsent,
    requiresConsent: isRegulated && !hasConsent,
    jurisdiction: isRegulated ? jurisdiction : null,
    applicableLaw: isRegulated ? law : null,
    grantConsent,
    revokeConsent,
  };
}
