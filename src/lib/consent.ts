export type ConsentRecord = {
  v: 1;
  analytics: boolean;
  marketing: boolean;
  ts: number;
};

const CONSENT_KEY = "gmd-cookie-consent";
const CONSENT_VERSION = 1 as const;
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.v !== CONSENT_VERSION) return null;

    const age = Date.now() - parsed.ts;
    if (age > CONSENT_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(prefs: {
  analytics: boolean;
  marketing: boolean;
}): ConsentRecord {
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    ts: Date.now(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  return record;
}

export function hasConsented(): boolean {
  return readConsent() !== null;
}
