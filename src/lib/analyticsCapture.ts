/**
 * Central analytics capture spine.
 *
 * `capture(event, properties)` is the single callsite for all event tracking.
 * It enriches every event with page context + UTM params, pushes to PostHog,
 * mirrors to GTM dataLayer, and translates to Meta Pixel via META_EVENT_MAP.
 *
 * Replaces direct `window.posthog.capture` calls across the codebase so that
 * enrichment, safe-navigation, and dataLayer forwarding are always applied.
 */

export type CaptureProps = Record<string, unknown>;

const META_EVENT_MAP: Record<string, string> = {
  lead_email_submitted: "Lead",
  email_signup: "Lead",
  waitlist_submit: "Lead",
  apply_submitted: "CompleteRegistration",
  checkout_opened: "InitiateCheckout",
  // order_complete and Purchase are handled directly in EventbriteWidgetInit / ApplySuccessPanel
  // with proper ecommerce fields (value, currency, content_ids) to avoid double-firing.
};

function safeReferrer(): string {
  try {
    return document.referrer || "";
  } catch {
    return "";
  }
}

function safePageType(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/links")) return "links";
  if (pathname.startsWith("/apply")) return "apply";
  if (pathname.startsWith("/cities/")) return "city";
  if (pathname.startsWith("/journal/")) return "journal";
  if (pathname.startsWith("/corporate")) return "corporate";
  if (pathname.startsWith("/sponsorship")) return "sponsorship";
  return "other";
}

/** Merge page-context and UTM params into `properties`. */
export function enrichEvent(properties: CaptureProps = {}): CaptureProps {
  if (typeof window === "undefined") return { ...properties };

  const url = window.location.href;
  const pathname = window.location.pathname;

  // Read UTMs from the current URL first; fall back to sessionStorage first-touch.
  const params = new URLSearchParams(window.location.search);
  function getUtm(key: string): string | null {
    const fromUrl = params.get(key);
    if (fromUrl) return fromUrl;
    try {
      const stored = sessionStorage.getItem(`gmd-${key.replace("_", "-")}`);
      return stored || null;
    } catch {
      return null;
    }
  }

  return {
    current_url: url,
    pathname,
    source_page: pathname,
    page_type: safePageType(pathname),
    referrer: safeReferrer(),
    utm_source: getUtm("utm_source"),
    utm_medium: getUtm("utm_medium"),
    utm_campaign: getUtm("utm_campaign"),
    utm_content: getUtm("utm_content"),
    utm_term: getUtm("utm_term"),
    ...properties,
  };
}

/**
 * Fire a named event to PostHog, GTM dataLayer, and (via META_EVENT_MAP) Meta Pixel.
 * Always enriches with page context. Safe to call before PostHog loads (queued internally).
 */
export function capture(event: string, properties: CaptureProps = {}): void {
  if (typeof window === "undefined") return;

  const enriched = enrichEvent(properties);

  try {
    if (window.posthog?.capture) {
      window.posthog.capture(event, enriched);
    } else {
      window.__garamEventQueue = window.__garamEventQueue ?? [];
      window.__garamEventQueue.push({ event, properties: enriched });
    }
  } catch {
    /* PostHog capture failures must never break the page */
  }

  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...enriched });
  } catch {
    /* dataLayer failures must never break the page */
  }

  const metaName = META_EVENT_MAP[event];
  if (metaName) {
    try {
      window.fbq?.("track", metaName, enriched);
    } catch {
      /* fbq failures must never break the page */
    }
  }
}

/**
 * Fire `outbound_link_clicked` (and optionally a second named event) for an
 * anchor that navigates away from the site.
 *
 * For same-tab clicks the browser may cancel the network request before PostHog
 * flushes. We prevent default and delay navigation by ~100ms so the XHR fires.
 * Modifier-key clicks (cmd/ctrl/shift) are never intercepted.
 */
export function trackOutbound(
  anchor: HTMLAnchorElement,
  extra: CaptureProps = {},
  eventName = "outbound_link_clicked",
): void {
  const href = anchor.href;
  let domain = "";
  try {
    domain = new URL(href).hostname;
  } catch {
    /* invalid URL */
  }

  capture(eventName, {
    destination_url: href,
    link_url: href,
    link_domain: domain,
    link_text: (anchor.textContent || "").trim().slice(0, 120),
    ...extra,
  });
}
