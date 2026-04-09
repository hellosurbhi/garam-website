type AnalyticsProps = Record<string, string | number | boolean | undefined>;

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
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

  window.posthog?.capture?.(name, cleanProps);
  window.dataLayer?.push({ event: name, ...cleanProps });
}

export function identifyLead(email: string, properties: AnalyticsProps = {}) {
  if (!email.trim()) return;

  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

  window.posthog?.identify?.(email, { email, ...cleanProps });
}
