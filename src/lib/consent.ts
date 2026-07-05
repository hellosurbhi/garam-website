export type ConsentRecord = {
  v: 1;
  analytics: boolean;
  marketing: boolean;
  ts: number;
};

const CONSENT_KEY = "gmd-cookie-consent";
const CONSENT_VERSION = 1 as const;

// Consent persists indefinitely. The version field (`v`) is the re-consent
// mechanism: bump CONSENT_VERSION when cookie categories change and every
// stored record with the old version will be treated as missing.
export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.v !== CONSENT_VERSION) return null;

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
