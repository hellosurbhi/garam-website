import {
  test,
  expect,
  request as api,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createServer, type RequestListener } from "node:http";
import { checkTicketListings } from "../synthetic/ticket-checks";
import type { EventEntry } from "../../src/data/events";
import { goRedirectDestination } from "../../src/utils/utmForwarding";

const event: EventEntry = {
  slug: "fixture-show",
  description: "Isolated ticket fixture",
  lineup: [],
  city: "Chicago",
  citySlug: "chicago",
  state: "Illinois",
  stateAbbr: "IL",
  date: "Dec 4",
  isoDate: "2026-12-04",
  url: "https://example.com/tickets",
  ticketSource: "their-eventbrite",
};
const now = new Date("2026-11-11T12:00:00Z");
const SITE = "https://garammasaladating.com";
const chicago = event;
const nyc: EventEntry = {
  ...event,
  slug: "nyc-fixture-show",
  city: "New York",
  citySlug: "nyc",
  url: "https://example.com/nyc-tickets",
};

/** A checkout card as TicketCard.astro renders it. */
function card(slug: string, href = `/api/go/${slug}`): string {
  return `<a data-go-ticket data-event-slug="${slug}" href="${href}">Buy Tickets</a>`;
}
const notifyMe = '<button data-notify-city="Chicago">Notify Me</button>';

/**
 * Serves `html` as /tickets on `origin`. WHY: the checker validates each href
 * against the page's own origin, so fixtures need a real http origin instead
 * of setContent's about:blank.
 */
async function showTicketPage(page: Page, html: string, origin = SITE) {
  await page.route(`${origin}/tickets`, (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto(`${origin}/tickets`);
}

/** A local HTTP server standing in for the deployed site's API routes. */
async function withSite(
  handler: RequestListener,
  run: (origin: string, client: APIRequestContext) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture server port");
  const origin = `http://127.0.0.1:${address.port}`;
  const client = await api.newContext({ baseURL: origin });
  try {
    await run(origin, client);
  } finally {
    await client.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}

/** Answers /api/go/<slug> the way the real route does. */
function goRoute(shows: EventEntry[]): RequestListener {
  return (req, res) => {
    const url = new URL(req.url ?? "/", "http://fixture.invalid");
    const show = shows.find((s) => url.pathname === `/api/go/${s.slug}`);
    if (!show?.url) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(302, {
      location: goRedirectDestination(show.url, show, url.searchParams),
    });
    res.end();
  };
}

for (const [name, entry] of [
  ["past", { ...event, isoDate: "2026-10-01" }],
  ["canceled", { ...event, status: "canceled" }],
  ["ticketless", { ...event, url: "", ticketSource: "none" }],
  ["presale", { ...event, onSaleAt: "2026-12-01T12:00:00Z" }],
] as const) {
  test(`ticket monitor accepts ${name} shows with a real Notify Me-only page`, async ({
    page,
    request,
  }) => {
    await showTicketPage(page, notifyMe);
    await checkTicketListings(page, request, [entry], now);
  });
}
test("ticket monitor rejects a missing checkout link for a purchasable show", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await showTicketPage(page, notifyMe);
  await expect(
    checkTicketListings(page, request, [event], now),
  ).rejects.toThrow();
});
test("ticket monitor rejects a blank page when only waitlists are expected", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await showTicketPage(page, "<h1>Upcoming Shows</h1>");
  await expect(checkTicketListings(page, request, [], now)).rejects.toThrow();
});
test("ticket monitor checks the exact checkout destination", async ({
  page,
}) => {
  await withSite(goRoute([event]), async (origin, client) => {
    await showTicketPage(page, card(event.slug), origin);
    await checkTicketListings(page, client, [event], now);
  });
});

test("ticket monitor accepts the city-request fallback when no ranked cities exist", async ({
  page,
  request,
}) => {
  await showTicketPage(
    page,
    '<button data-open-modal="tickets-city-modal">Request your city</button>',
  );
  await checkTicketListings(page, request, [], now);
});
test("ticket monitor rejects an unexpected checkout link in a waitlist-only state", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await showTicketPage(page, card("unknown") + notifyMe);
  await expect(checkTicketListings(page, request, [], now)).rejects.toThrow();
});
for (const [name, status, destination, past, passes] of [
  ["wrong destination", 302, "https://example.com/wrong", false, false],
  ["wrong status", 200, "https://example.com/tickets", false, false],
  ["stale static card safely returns to tickets", 302, "/tickets", true, true],
  [
    "stale card must not lead to an expired checkout",
    302,
    "https://example.com/tickets",
    true,
    false,
  ],
] as const) {
  test(`ticket monitor: ${name}`, async ({ page }) => {
    test.setTimeout(10000);
    await withSite(
      (_req, res) => {
        res.writeHead(status, { location: destination });
        res.end();
      },
      async (origin, client) => {
        await showTicketPage(page, card(event.slug) + notifyMe, origin);
        const check = checkTicketListings(
          page,
          client,
          [{ ...event, ...(past ? { isoDate: "2026-10-01" } : {}) }],
          now,
        );
        if (passes) await check;
        else await expect(check).rejects.toThrow();
      },
    );
  });
}

test("ticket monitor checks only links when redirects can't be followed", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  // The static preview has no /api/go route; following it would 404.
  await showTicketPage(page, card(event.slug));
  await checkTicketListings(page, request, [event], now, {
    followRedirects: false,
  });
  await showTicketPage(page, card(event.slug, "/api/go/other-show"));
  await expect(
    checkTicketListings(page, request, [event], now, {
      followRedirects: false,
    }),
  ).rejects.toThrow();
});

// Each case is a page that the first version of this checker passed.
for (const [name, html] of [
  [
    "a right-slug link on another host",
    card(chicago.slug, `https://evil.example/api/go/${chicago.slug}`) +
      card(nyc.slug),
  ],
  [
    "a javascript: checkout link",
    card(chicago.slug, "javascript:void(0)") + card(nyc.slug),
  ],
  [
    "two cards with swapped links",
    card(chicago.slug, `/api/go/${nyc.slug}`) +
      card(nyc.slug, `/api/go/${chicago.slug}`),
  ],
  [
    "an extra broken checkout beside the expected cards",
    card(chicago.slug) + card(nyc.slug) + card("broken-show"),
  ],
  [
    "a checkout link with no card identity",
    card(chicago.slug) +
      card(nyc.slug) +
      `<a href="/api/go/${nyc.slug}">Buy Tickets</a>`,
  ],
] as const) {
  test(`ticket monitor rejects ${name}`, async ({ page, request }) => {
    test.setTimeout(10000);
    await showTicketPage(page, html);
    await expect(
      checkTicketListings(page, request, [chicago, nyc], now, {
        followRedirects: false,
      }),
    ).rejects.toThrow();
  });
}

// The vendor's own listing is the independent oracle: a wrong url typed into
// events.ts redirects "correctly" because the redirect reads the same data.
for (const [name, status, startDate, passes] of [
  [
    "listing published in the show's timezone",
    200,
    "2026-12-04T19:30:00-06:00",
    true,
  ],
  ["listing published in UTC", 200, "2026-12-05T01:30:00.000Z", true],
  ["listing for another date", 200, "2026-12-05T19:30:00-06:00", false],
  ["listing at another time", 200, "2026-12-04T21:00:00-06:00", false],
  ["listing the vendor won't serve", 403, "2026-12-04T19:30:00-06:00", false],
] as const) {
  test(`ticket monitor: ${name}`, async ({ page }) => {
    test.setTimeout(10000);
    let show: EventEntry = {
      ...event,
      startTime: "19:30",
      timezone: "America/Chicago",
    };
    await withSite(
      (req, res) => {
        if (req.url?.startsWith("/api/go/")) return goRoute([show])(req, res);
        res.writeHead(status, { "content-type": "text/html" });
        res.end(
          `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", startDate })}</script>`,
        );
      },
      async (origin, client) => {
        show = { ...show, url: `${origin}/listing` };
        await showTicketPage(page, card(show.slug), origin);
        const check = checkTicketListings(page, client, [show], now, {
          verifyListings: true,
        });
        if (passes) await check;
        else await expect(check).rejects.toThrow();
      },
    );
  });
}

test("ticket monitor follows the rendered link with its tracking parameters", async ({
  page,
}) => {
  // Live pages carry the shape wireTicketCtaTracking leaves behind: an
  // absolute same-origin href with ?eid= and forwarded UTMs. The route
  // forwards those UTMs, and the checker must expect exactly that.
  await withSite(goRoute([event]), async (origin, client) => {
    await showTicketPage(
      page,
      card(
        event.slug,
        `${origin}/api/go/${event.slug}?eid=abc&utm_source=ig&utm_campaign=story`,
      ),
      origin,
    );
    await checkTicketListings(page, client, [event], now);
  });
});
