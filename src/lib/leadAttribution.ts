export interface LeadAttribution {
  [key: string]: string | undefined;
  source: string;
  sourcePage: string;
  landingPage: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  posthogDistinctId?: string;
  sourceCitySlug?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoLatitude?: string;
  geoLongitude?: string;
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
const GEO_LATITUDE_KEY = "gmd-geo-latitude";
const GEO_LONGITUDE_KEY = "gmd-geo-longitude";
const GEO_TIMEZONE_KEY = "gmd-geo-timezone";
const GEO_FETCHED_KEY = "gmd-geo-fetched";

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
  };
}

interface GeoResponse {
  city?: string;
  region?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

function bootstrapGeoData() {
  if (sessionStorage.getItem(GEO_FETCHED_KEY)) return;
  sessionStorage.setItem(GEO_FETCHED_KEY, "1");

  fetch("/api/geo")
    .then((res) => (res.ok ? (res.json() as Promise<GeoResponse>) : null))
    .then((geo) => {
      if (!geo) return;
      if (geo.city) sessionStorage.setItem(GEO_CITY_KEY, geo.city);
      if (geo.region) sessionStorage.setItem(GEO_REGION_KEY, geo.region);
      if (geo.country) sessionStorage.setItem(GEO_COUNTRY_KEY, geo.country);
      if (geo.latitude) sessionStorage.setItem(GEO_LATITUDE_KEY, geo.latitude);
      if (geo.longitude)
        sessionStorage.setItem(GEO_LONGITUDE_KEY, geo.longitude);
      if (geo.timezone) sessionStorage.setItem(GEO_TIMEZONE_KEY, geo.timezone);
    })
    .catch(() => {});
}

export function bootstrapLeadAttribution() {
  setIfMissing(LANDING_PAGE_KEY, getPathname());
  setIfMissing(REFERRER_HOST_KEY, getReferrerHost());

  const utms = getCurrentUtms();
  setIfMissing(UTM_SOURCE_KEY, utms.utmSource);
  setIfMissing(UTM_MEDIUM_KEY, utms.utmMedium);
  setIfMissing(UTM_CAMPAIGN_KEY, utms.utmCampaign);
  setIfMissing(UTM_CONTENT_KEY, utms.utmContent);
  setIfMissing(UTM_TERM_KEY, utms.utmTerm);

  bootstrapGeoData();
}

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

  const geoLatitude = sessionStorage.getItem(GEO_LATITUDE_KEY) ?? undefined;
  if (geoLatitude) attribution.geoLatitude = geoLatitude;

  const geoLongitude = sessionStorage.getItem(GEO_LONGITUDE_KEY) ?? undefined;
  if (geoLongitude) attribution.geoLongitude = geoLongitude;

  const geoTimezone = sessionStorage.getItem(GEO_TIMEZONE_KEY) ?? undefined;
  if (geoTimezone) attribution.geoTimezone = geoTimezone;

  return attribution;
}
