import { getStoredUtms, type StoredUtms } from "@/lib/leadAttribution";

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

function hasStoredUtms(stored: StoredUtms): boolean {
  return Boolean(
    stored.utmSource ||
    stored.utmMedium ||
    stored.utmCampaign ||
    stored.utmContent ||
    stored.utmTerm,
  );
}

export function applyStoredUtmsToUrl(url: string, stored: StoredUtms): string {
  if (!hasStoredUtms(stored)) return url;

  try {
    const u = new URL(url, window.location.origin);
    const setIfEmpty = (key: string, value: string | undefined): void => {
      if (!value) return;
      if (u.searchParams.has(key) && u.searchParams.get(key) !== "") return;
      u.searchParams.set(key, value);
    };
    setIfEmpty("utm_source", stored.utmSource);
    setIfEmpty("utm_medium", stored.utmMedium);
    setIfEmpty("utm_campaign", stored.utmCampaign);
    setIfEmpty("utm_content", stored.utmContent);
    setIfEmpty("utm_term", stored.utmTerm);
    return u.toString();
  } catch {
    return url;
  }
}

export function preserveUtmsOnInternalLinks(): void {
  if (typeof window === "undefined") return;

  const stored = getStoredUtms();
  if (!hasStoredUtms(stored)) return;

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    if (anchor.dataset.noUtmForward === "true") return;
    if (anchor.hasAttribute("download")) return;

    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) return;
    if (/^(mailto|tel|sms):/i.test(rawHref)) return;

    try {
      const url = new URL(rawHref, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return;

      anchor.href = applyStoredUtmsToUrl(url.toString(), stored);
    } catch {
      /* invalid href — leave it untouched */
    }
  });
}

export function forceStoredUtmsToUrl(url: string, stored: StoredUtms): string {
  if (!hasStoredUtms(stored)) return url;

  try {
    const u = new URL(url);
    if (stored.utmSource) u.searchParams.set("utm_source", stored.utmSource);
    if (stored.utmMedium) u.searchParams.set("utm_medium", stored.utmMedium);
    if (stored.utmCampaign)
      u.searchParams.set("utm_campaign", stored.utmCampaign);
    if (stored.utmContent) u.searchParams.set("utm_content", stored.utmContent);
    if (stored.utmTerm) u.searchParams.set("utm_term", stored.utmTerm);
    return u.toString();
  } catch {
    return url;
  }
}
