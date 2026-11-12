import { expect, type Page, type APIRequestContext } from "@playwright/test";
import type { EventEntry } from "../../src/data/events";
import { getTicketPageUpcoming } from "../../src/utils/eventFilters";
import { applyUtmsToUrl } from "../../src/utils/utmForwarding";

interface CheckoutLink {
  path: string;
  search: string;
  sameOrigin: boolean;
}

// WHY: the site script rewrites every /api/go/ link after load to an absolute
// URL with a per-link ?eid= (Meta event dedupe), so the live href is never the
// bare relative path. An exact-href selector reported a healthy page as broken
// and paged, and a substring selector would pass `/wrong/api/go/<slug>`. Resolve
// each visible link to a URL and compare its real pathname and origin. A page
// without an http origin (a test fixture) resolves against a placeholder host.
async function visibleCheckoutLinks(page: Page): Promise<CheckoutLink[]> {
  const links = await page.locator("a[href]:visible").evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const web = location.protocol.startsWith("http");
      const base = web ? location.href : "http://placeholder.invalid";
      const url = new URL(anchor.getAttribute("href") ?? "", base);
      return {
        path: url.pathname,
        search: url.search,
        sameOrigin: url.origin === new URL(base).origin,
      };
    }),
  );
  return links.filter((link) => link.path.startsWith("/api/go/"));
}

export async function checkTicketListings(
  page: Page,
  request: APIRequestContext,
  events: EventEntry[],
  now = new Date(),
) {
  const available = getTicketPageUpcoming(
    events,
    now.toISOString().slice(0, 10),
  ).filter(
    (event) =>
      event.url &&
      event.url !== "#" &&
      !event.soldOut &&
      (!event.onSaleAt || Date.parse(event.onSaleAt) <= now.getTime()),
  );
  const past = events.filter(
    (event) => event.isoDate && event.isoDate < now.toISOString().slice(0, 10),
  );
  if (!available.length) {
    // Static cards can outlive their show between deployments. Their runtime
    // redirects must return to /tickets, never to an expired vendor checkout.
    for (const link of await visibleCheckoutLinks(page)) {
      const event = past.find((item) => link.path === `/api/go/${item.slug}`);
      expect(
        link.sameOrigin && event,
        `Unexpected checkout in waitlist-only state: ${link.path}`,
      ).toBeTruthy();
      const response = await request.get(`${link.path}${link.search}`, {
        maxRedirects: 0,
        timeout: 10_000,
        headers: { "User-Agent": "GaramMasalaMonitor/1.0" },
      });
      expect(response.status()).toBe(302);
      expect(response.headers().location).toBe("/tickets");
    }
    await expect(
      page
        .locator(
          '[data-notify-city]:visible, button[data-open-modal="tickets-city-modal"]:visible',
        )
        .first(),
    ).toBeVisible();
    return;
  }
  for (const event of available) {
    const links = await visibleCheckoutLinks(page);
    expect(
      links.some(
        (link) => link.sameOrigin && link.path === `/api/go/${event.slug}`,
      ),
      `No visible checkout link for ${event.slug}`,
    ).toBe(true);
    const response = await request.get(`/api/go/${event.slug}`, {
      maxRedirects: 0,
      timeout: 10_000,
      headers: { "User-Agent": "GaramMasalaMonitor/1.0" },
    });
    expect(response.status(), event.slug).toBe(302);
    expect(response.headers().location, event.slug).toBe(
      applyUtmsToUrl(
        event.url!,
        {},
        {
          utmSource: "garamsite",
          utmMedium: "web",
          utmCampaign: event.citySlug ?? "event",
          utmContent: event.slug,
        },
      ),
    );
  }
}
