export interface LeadAttribution {
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
}

const LANDING_PAGE_KEY = "gmd-landing-page";
const REFERRER_HOST_KEY = "gmd-referrer-host";
const UTM_SOURCE_KEY = "gmd-utm-source";
const UTM_MEDIUM_KEY = "gmd-utm-medium";
const UTM_CAMPAIGN_KEY = "gmd-utm-campaign";
const UTM_CONTENT_KEY = "gmd-utm-content";
const UTM_TERM_KEY = "gmd-utm-term";

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

export function bootstrapLeadAttribution() {
  setIfMissing(LANDING_PAGE_KEY, getPathname());
  setIfMissing(REFERRER_HOST_KEY, getReferrerHost());

  const utms = getCurrentUtms();
  setIfMissing(UTM_SOURCE_KEY, utms.utmSource);
  setIfMissing(UTM_MEDIUM_KEY, utms.utmMedium);
  setIfMissing(UTM_CAMPAIGN_KEY, utms.utmCampaign);
  setIfMissing(UTM_CONTENT_KEY, utms.utmContent);
  setIfMissing(UTM_TERM_KEY, utms.utmTerm);
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

  return attribution;
}
