import { getStoredUtms } from "@/lib/leadAttribution";
import { applyUtmsToUrl } from "@/utils/utmForwarding";

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
  if (!baseUrl) return baseUrl;

  const stored = typeof window !== "undefined" ? getStoredUtms() : {};

  // `aff` param keeps per-section Eventbrite affiliate tracking.
  const affSuffix = campaign === "home" ? content : "";

  try {
    const u = new URL(baseUrl);
    u.searchParams.set("aff", `garamsite${campaign}${affSuffix}`);
    return applyUtmsToUrl(u.toString(), stored, {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: campaign,
      utmContent: content,
    });
  } catch {
    return baseUrl;
  }
}
