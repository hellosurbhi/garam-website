import { getStoredUtms, type StoredUtms } from "@/lib/leadAttribution";
import { applyUtmsToUrl } from "@/utils/utmForwarding";

/**
 * Core "add aff + apply UTM defaults" logic for a tracked ticket URL,
 * environment-agnostic: takes `incomingUtms` as a parameter instead of
 * reading it itself, so browser call sites (via `buildTicketUrl` below) and
 * the server redirect (`/api/go/[slug].ts`, which has no `window` to read
 * sessionStorage from) share one implementation. Before this, the server
 * route rebuilt its own UTM defaults and never set `aff`, silently dropping
 * Eventbrite affiliate tracking and per-surface attribution for the live
 * ticket-purchase traffic.
 */
export function applyTicketAttribution(
  baseUrl: string,
  campaign: string,
  content: string,
  incomingUtms: StoredUtms,
): string {
  if (!baseUrl) return baseUrl;

  // `aff` param keeps per-section Eventbrite affiliate tracking.
  const affSuffix = campaign === "home" ? content : "";

  try {
    const u = new URL(baseUrl);
    u.searchParams.set("aff", `garamsite${campaign}${affSuffix}`);
    return applyUtmsToUrl(u.toString(), incomingUtms, {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: campaign,
      utmContent: content,
    });
  } catch {
    return baseUrl;
  }
}

/**
 * Build a tracked ticket URL for an outbound vendor link (Eventbrite, City Winery, etc).
 *
 * Visitor UTMs stored by `bootstrapLeadAttribution` are forwarded to the vendor
 * so that the visitor's original attribution (Instagram bio, ManyChat, etc.) is
 * preserved through to the checkout page. When the visitor arrived without UTMs
 * the defaults (utm_source=garamsite) are applied as before.
 *
 * The `aff` param and `utm_medium` mobile-upgrade (via BaseLayout) are preserved.
 */
export function buildTicketUrl(
  baseUrl: string,
  campaign: string,
  content: string,
): string {
  const stored = typeof window !== "undefined" ? getStoredUtms() : {};
  return applyTicketAttribution(baseUrl, campaign, content, stored);
}
