import type { StoredUtms } from "@/lib/leadAttribution";

export interface UtmDefaults {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
}

/**
 * Apply UTM params to `url`, forwarding `stored` visitor UTMs when present,
 * falling back to `defaults` when the visitor arrived without UTMs.
 *
 * Never overwrites params that are already set on the base URL.
 */
export function applyUtmsToUrl(
  url: string,
  stored: StoredUtms,
  defaults: UtmDefaults,
): string {
  try {
    const u = new URL(url);
    const setIfEmpty = (key: string, value: string | undefined): void => {
      if (!value) return;
      if (u.searchParams.has(key) && u.searchParams.get(key) !== "") return;
      u.searchParams.set(key, value);
    };
    setIfEmpty("utm_source", stored.utmSource ?? defaults.utmSource);
    setIfEmpty("utm_medium", stored.utmMedium ?? defaults.utmMedium);
    setIfEmpty("utm_campaign", stored.utmCampaign ?? defaults.utmCampaign);
    setIfEmpty("utm_content", stored.utmContent ?? defaults.utmContent);
    if (stored.utmTerm) setIfEmpty("utm_term", stored.utmTerm);
    return u.toString();
  } catch {
    return url;
  }
}
