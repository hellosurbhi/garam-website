/** Attribution data collected from the visitor's session and stored on each lead submission. */
export interface LeadAttribution {
  [key: string]: string | number | undefined;
  source: string;
  sourcePage: string;
  landingPage: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  posthogDistinctId?: string;
  sourceCitySlug?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoTimezone?: string;
}

const LANDING_PAGE_KEY = "gmd-landing-page";
const REFERRER_HOST_KEY = "gmd-referrer-host";
const UTM_SOURCE_KEY = "gmd-utm-source";
const UTM_MEDIUM_KEY = "gmd-utm-medium";
const UTM_CAMPAIGN_KEY = "gmd-utm-campaign";
const UTM_CONTENT_KEY = "gmd-utm-content";
const UTM_TERM_KEY = "gmd-utm-term";
const GEO_CITY_KEY = "gmd-geo-city";
const GEO_REGION_KEY = "gmd-geo-region";
const GEO_COUNTRY_KEY = "gmd-geo-country";
const GEO_TIMEZONE_KEY = "gmd-geo-timezone";
const GEO_FETCHED_KEY = "gmd-geo-fetched";
const FBCLID_KEY = "gmd-fbclid";
const GCLID_KEY = "gmd-gclid";

function getPathname(): string {
  return window.location.pathname || "/";
}

function setIfMissing(key: string, value?: string | null) {
  if (!value) return;
  if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, value);
}

function getReferrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname || undefined;
  } catch {
    return undefined;
  }
}

function getCurrentUtms() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    fbclid: params.get("fbclid") ?? undefined,
    gclid: params.get("gclid") ?? undefined,
  };
}

interface GeoResponse {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

async function readGeoResponse(res: Response): Promise<GeoResponse | null> {
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return null;

  try {
    return (await res.json()) as GeoResponse;
  } catch {
    return null;
  }
}

function bootstrapGeoData() {
  if (sessionStorage.getItem(GEO_FETCHED_KEY)) return;

  fetch("/api/geo")
    .then(readGeoResponse)
    .then((geo) => {
      if (!geo) return;
      if (geo.city) sessionStorage.setItem(GEO_CITY_KEY, geo.city);
      if (geo.region) sessionStorage.setItem(GEO_REGION_KEY, geo.region);
      if (geo.country) sessionStorage.setItem(GEO_COUNTRY_KEY, geo.country);
      if (geo.timezone) sessionStorage.setItem(GEO_TIMEZONE_KEY, geo.timezone);
    })
    .catch(() => {
      // Geo attribution is best-effort; lead capture should never surface it.
    })
    .finally(() => {
      sessionStorage.setItem(GEO_FETCHED_KEY, "1");
    });
}

/**
 * Capture the visitor's landing page, referrer, UTM params, and geo data into sessionStorage.
 * Safe to call multiple times; each value is written only once per session (first-touch).
 */
export function bootstrapLeadAttribution() {
  setIfMissing(LANDING_PAGE_KEY, getPathname());
  setIfMissing(REFERRER_HOST_KEY, getReferrerHost());

  const utms = getCurrentUtms();
  setIfMissing(UTM_SOURCE_KEY, utms.utmSource);
  setIfMissing(UTM_MEDIUM_KEY, utms.utmMedium);
  setIfMissing(UTM_CAMPAIGN_KEY, utms.utmCampaign);
  setIfMissing(UTM_CONTENT_KEY, utms.utmContent);
  setIfMissing(UTM_TERM_KEY, utms.utmTerm);
  setIfMissing(FBCLID_KEY, utms.fbclid);
  setIfMissing(GCLID_KEY, utms.gclid);

  bootstrapGeoData();
}

/** Stored UTMs from first-touch `bootstrapLeadAttribution()` call. */
export interface StoredUtms {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

/**
 * Read the first-touch UTM params written by `bootstrapLeadAttribution` from sessionStorage.
 * Used by `buildTicketUrl` to forward visitor attribution to Eventbrite.
 */
export function getStoredUtms(): StoredUtms {
  if (typeof window === "undefined") return {};
  try {
    const read = (key: string): string | undefined => {
      const v = sessionStorage.getItem(key);
      return v && v.length > 0 ? v : undefined;
    };
    const out: StoredUtms = {};
    const src = read(UTM_SOURCE_KEY);
    if (src) out.utmSource = src;
    const med = read(UTM_MEDIUM_KEY);
    if (med) out.utmMedium = med;
    const camp = read(UTM_CAMPAIGN_KEY);
    if (camp) out.utmCampaign = camp;
    const cont = read(UTM_CONTENT_KEY);
    if (cont) out.utmContent = cont;
    const term = read(UTM_TERM_KEY);
    if (term) out.utmTerm = term;
    return out;
  } catch {
    return {};
  }
}

/**
 * Assemble a full `LeadAttribution` object from sessionStorage for attachment to a Firestore submission.
 * Calls `bootstrapLeadAttribution` internally so it is safe to call without a prior bootstrap.
 *
 * @param params.source Identifies which form or CTA triggered the lead (e.g. "apply-page").
 * @param params.sourceCitySlug Optional city slug when the lead originated from a city landing page.
 */
export function buildLeadAttribution(params: {
  source: string;
  sourceCitySlug?: string;
}): LeadAttribution {
  bootstrapLeadAttribution();

  const posthogDistinctId = window.posthog?.get_distinct_id?.();
  const attribution: LeadAttribution = {
    source: params.source,
    sourcePage: getPathname(),
    landingPage: sessionStorage.getItem(LANDING_PAGE_KEY) ?? getPathname(),
  };

  const referrerHost = sessionStorage.getItem(REFERRER_HOST_KEY) ?? undefined;
  if (referrerHost) attribution.referrerHost = referrerHost;

  const utmSource = sessionStorage.getItem(UTM_SOURCE_KEY) ?? undefined;
  if (utmSource) attribution.utmSource = utmSource;

  const utmMedium = sessionStorage.getItem(UTM_MEDIUM_KEY) ?? undefined;
  if (utmMedium) attribution.utmMedium = utmMedium;

  const utmCampaign = sessionStorage.getItem(UTM_CAMPAIGN_KEY) ?? undefined;
  if (utmCampaign) attribution.utmCampaign = utmCampaign;

  const utmContent = sessionStorage.getItem(UTM_CONTENT_KEY) ?? undefined;
  if (utmContent) attribution.utmContent = utmContent;

  const utmTerm = sessionStorage.getItem(UTM_TERM_KEY) ?? undefined;
  if (utmTerm) attribution.utmTerm = utmTerm;

  const fbclid = sessionStorage.getItem(FBCLID_KEY) ?? undefined;
  if (fbclid) attribution.fbclid = fbclid;

  const gclid = sessionStorage.getItem(GCLID_KEY) ?? undefined;
  if (gclid) attribution.gclid = gclid;

  if (typeof posthogDistinctId === "string" && posthogDistinctId.trim()) {
    attribution.posthogDistinctId = posthogDistinctId;
  }

  if (params.sourceCitySlug) {
    attribution.sourceCitySlug = params.sourceCitySlug;
  }

  // Geo data from /api/geo (cached in sessionStorage)
  const geoCity = sessionStorage.getItem(GEO_CITY_KEY) ?? undefined;
  if (geoCity) attribution.geoCity = geoCity;

  const geoRegion = sessionStorage.getItem(GEO_REGION_KEY) ?? undefined;
  if (geoRegion) attribution.geoRegion = geoRegion;

  const geoCountry = sessionStorage.getItem(GEO_COUNTRY_KEY) ?? undefined;
  if (geoCountry) attribution.geoCountry = geoCountry;

  const geoTimezone = sessionStorage.getItem(GEO_TIMEZONE_KEY) ?? undefined;
  if (geoTimezone) attribution.geoTimezone = geoTimezone;

  return attribution;
}
