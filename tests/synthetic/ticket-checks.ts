import { expect, type Page, type APIRequestContext } from "@playwright/test";
import type { EventEntry } from "../../src/data/events";
import { getTicketPageUpcoming } from "../../src/utils/eventFilters";
import { applyUtmsToUrl } from "../../src/utils/utmForwarding";

const MONITOR_HEADERS = { "User-Agent": "GaramMasalaMonitor/1.0" };

export interface TicketCheckOptions {
  /**
   * Request each /api/go link and check where it sends buyers. Off only for
   * the local static preview, which serves no API routes.
   */
  followRedirects?: boolean;
  /**
   * Fetch each checkout page and require its own schema.org Event start to
   * match the show. This is the independent check: a wrong url typed into
   * events.ts passes every redirect assertion, because the redirect reads the
   * same data. Off for the frequent synthetic monitor so a vendor hiccup
   * can't page anyone; on for the weekly and preview smoke runs.
   */
  verifyListings?: boolean;
}

/** Every schema.org *Event startDate in a page's JSON-LD blocks. */
export function extractEventStartDates(html: string): string[] {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const types = [obj["@type"]].flat();
    if (
      types.some((t) => typeof t === "string" && t.endsWith("Event")) &&
      typeof obj.startDate === "string"
    ) {
      found.push(obj.startDate);
    }
    Object.values(obj).forEach(visit);
  };
  for (const [, body] of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(body));
    } catch {
      // One malformed block doesn't hide the others.
    }
  }
  return found;
}

/** "YYYY-MM-DD HH:MM" of an instant in the show's own timezone. */
function localStart(iso: string, timeZone: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

async function expectListingStart(
  request: APIRequestContext,
  url: string,
  event: EventEntry,
) {
  const response = await request.get(url, {
    timeout: 15_000,
    headers: MONITOR_HEADERS,
  });
  expect(
    response.ok(),
    `${event.slug}: ${url} returned ${response.status()}`,
  ).toBe(true);
  const starts = extractEventStartDates(await response.text())
    .map((iso) => localStart(iso, event.timezone ?? "America/New_York"))
    .filter((start): start is string => !!start);
  const matches = starts.some((start) =>
    event.startTime
      ? start === `${event.isoDate} ${event.startTime}`
      : start.startsWith(`${event.isoDate} `),
  );
  expect(
    matches,
    `${event.slug}: ${url} lists ${starts.join(", ") || "no start"}, show is ${event.isoDate} ${event.startTime ?? ""}`,
  ).toBe(true);
}

// WHY: wireTicketCtaTracking (src/lib/ticketCtaTracking.ts) rewrites every
// checkout href after load into an absolute URL carrying ?eid= and forwarded
// UTMs, so matching the raw href attribute finds nothing on a live page (the
// monitor failed this way from 2026-11-11). Only the path names the show.
async function visibleCheckoutPaths(page: Page): Promise<string[]> {
  return page
    .locator('a[href*="/api/go/"]:visible')
    .evaluateAll((links) =>
      links.map(
        (link) =>
          new URL(link.getAttribute("href") ?? "", "https://monitor.invalid")
            .pathname,
      ),
    );
}

export async function checkTicketListings(
  page: Page,
  request: APIRequestContext,
  events: EventEntry[],
  now = new Date(),
  { followRedirects = true, verifyListings = false }: TicketCheckOptions = {},
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
    const hrefs = await visibleCheckoutPaths(page);
    // Static cards can outlive their show between deployments. Their runtime
    // redirects must return to /tickets, never to an expired vendor checkout.
    for (const href of hrefs) {
      const event = past.find((item) => href === `/api/go/${item.slug}`);
      expect(
        event,
        `Unexpected checkout in waitlist-only state: ${href}`,
      ).toBeDefined();
      if (!followRedirects) continue;
      const response = await request.get(href, {
        maxRedirects: 0,
        timeout: 10_000,
        headers: MONITOR_HEADERS,
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
    await expect
      .poll(() => visibleCheckoutPaths(page), { message: event.slug })
      .toContain(`/api/go/${event.slug}`);
    if (!followRedirects) continue;
    const response = await request.get(`/api/go/${event.slug}`, {
      maxRedirects: 0,
      timeout: 10_000,
      headers: MONITOR_HEADERS,
    });
    expect(response.status(), event.slug).toBe(302);
    const location = response.headers().location;
    expect(location, event.slug).toBe(
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
    if (verifyListings) await expectListingStart(request, location, event);
  }
}
