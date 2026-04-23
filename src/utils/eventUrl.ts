/**
 * Build a tracked Eventbrite ticket URL.
 * Appends aff + UTM params for per-page, per-section attribution.
 * Device type (utm_medium) defaults to "web"; BaseLayout script upgrades to "mobile" at runtime.
 */
export function buildTicketUrl(
  baseUrl: string,
  campaign: string,
  content: string,
): string {
  if (!baseUrl) return baseUrl;
  const url = new URL(baseUrl);
  // "home" has two distinct sections (hero pill vs shows list) worth splitting
  // in Eventbrite tracking links. All other campaigns map 1:1 to a tracking link.
  const affSuffix = campaign === "home" ? content : "";
  url.searchParams.set("aff", `garamsite${campaign}${affSuffix}`);
  url.searchParams.set("utm_source", "garamsite");
  url.searchParams.set("utm_medium", "web");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}
