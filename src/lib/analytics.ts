type AnalyticsProps = Record<string, string | number | boolean | undefined>;

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
