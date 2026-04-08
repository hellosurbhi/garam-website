type AnalyticsValue = string | number | boolean | undefined;
type AnalyticsProps = object;

function isAnalyticsValue(value: unknown): value is Exclude<AnalyticsValue, undefined> {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

interface ErrorProperties {
  error_message: string;
  error_stack?: string;
  error_type:
    | "uncaught"
    | "unhandled_rejection"
    | "react_boundary"
    | "form_submission"
    | "api_error";
  component?: string;
  page_url?: string;
  [key: string]: string | number | boolean | undefined;
}

export function trackError(properties: ErrorProperties) {
  const enriched = {
    ...properties,
    page_url:
      properties.page_url ??
      (typeof window !== "undefined" ? window.location.href : undefined),
  };

  if (window.posthog?.capture) {
    window.posthog.capture("client_error", enriched);
  } else {
    window.__garamErrorQueue = window.__garamErrorQueue || [];
    window.__garamErrorQueue.push({
      event: "client_error",
      properties: enriched,
    });
  }
}

export function trackLeadEvent(name: string, properties: AnalyticsProps = {}) {
  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => isAnalyticsValue(value)),
  );

  window.posthog?.capture?.(name, cleanProps);
  window.dataLayer?.push({ event: name, ...cleanProps });
}

export function identifyLead(email: string, properties: AnalyticsProps = {}) {
  if (!email.trim()) return;

  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => isAnalyticsValue(value)),
  );

  // identify() merges the current anonymous session into the email-keyed profile.
  // PostHog automatically aliases the anonymous distinct_id to the email so all
  // prior anonymous events are attributed to this person.
  window.posthog?.identify?.(email, { email, ...cleanProps });

  // Mirror identification to GTM dataLayer for GA4 / downstream tools
  window.dataLayer?.push({ event: "identify", email, ...cleanProps });
}
