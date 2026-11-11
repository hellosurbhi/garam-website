import { expect, type Page, type APIRequestContext } from "@playwright/test";
import type { EventEntry } from "../../src/data/events";
import { getTicketPageUpcoming } from "../../src/utils/eventFilters";
import { applyUtmsToUrl } from "../../src/utils/utmForwarding";

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
  const checkoutLinks = page.locator('a[href^="/api/go/"]:visible');
  if (!available.length) {
    const hrefs = await checkoutLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );
    // Static cards can outlive their show between deployments. Their runtime
    // redirects must return to /tickets, never to an expired vendor checkout.
    for (const href of hrefs) {
      const event = past.find((item) => href === `/api/go/${item.slug}`);
      expect(
        event,
        `Unexpected checkout in waitlist-only state: ${href}`,
      ).toBeDefined();
      const response = await request.get(href!, {
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
    await expect(
      page.locator(`a[href="/api/go/${event.slug}"]:visible`).first(),
    ).toBeVisible();
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
