type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProps = object;

const META_EVENT_MAP: Record<string, string> = {
  lead_email_submitted: "Lead",
  apply_submitted: "CompleteRegistration",
  checkout_opened: "InitiateCheckout",
  order_complete: "Purchase",
};

function isAnalyticsValue(
  value: unknown,
): value is Exclude<AnalyticsValue, undefined> {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
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
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Fire a `client_error` event to PostHog (or queue it if PostHog has not loaded yet).
 * Automatically enriches the event with the current page URL if not supplied.
 */
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

/**
 * Send a named lead event to PostHog and the GTM dataLayer.
 * Strips any properties with non-serialisable values before forwarding.
 */
export function trackLeadEvent(name: string, properties: AnalyticsProps = {}) {
  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => isAnalyticsValue(value)),
  );

  window.posthog?.capture?.(name, cleanProps);
  window.dataLayer?.push({ event: name, ...cleanProps });

  const metaEvent = META_EVENT_MAP[name];
  if (metaEvent) window.fbq?.("track", metaEvent, cleanProps);
}

/**
 * Merge the current anonymous session into an email-keyed profile in PostHog and GTM.
 * PostHog aliases the anonymous `distinct_id` to the email so prior events are attributed.
 */
export function identifyLead(email: string, properties: AnalyticsProps = {}) {
  if (!email.trim()) return;

  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => isAnalyticsValue(value)),
  );

  // identify() merges the current anonymous session into the email-keyed profile.
  // PostHog automatically aliases the anonymous distinct_id to the email so all
  // prior anonymous events are attributed to this person.
  // $set: email always stays current. $set_once: attribution data locked to first-touch.
  window.posthog?.identify?.(email, { email }, cleanProps);

  // Mirror identification to GTM dataLayer for GA4 / downstream tools
  window.dataLayer?.push({ event: "identify", email, ...cleanProps });
}
