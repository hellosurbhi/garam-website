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

/** A live card's link without the data-go-ticket marker. */
function unmarkedCard(href: string, slug?: string): string {
  const identity = slug ? ` data-event-slug="${slug}"` : "";
  return `<div class="ticket-card ticket-card--live"><a class="ticket-card__inner"${identity} href="${href}">Grab My Spot</a></div>`;
}

/** A sold-out card as TicketCard.astro renders it: straight to the vendor. */
function soldOutCard(slug: string, href: string): string {
  return `<div class="ticket-card ticket-card--live ticket-card--soldout"><a class="ticket-card__inner" data-event-slug="${slug}" href="${href}">Sold Out</a></div>`;
}

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
    // WHY: WebKit preconnects to this origin even though /tickets is routed,
    // and holds that socket (no request on it, so Node never counts it idle)
    // until the page fixture closes after this test body returns. close()
    // alone waits on it, so every WebKit fixture test hit its timeout. The
    // server lives only for this test, so dropping its sockets is safe.
    server.closeAllConnections();
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
    "an unmarked ticket card linking off-site",
    card(chicago.slug) +
      card(nyc.slug) +
      unmarkedCard("https://evil.example/tickets", chicago.slug),
  ],
  [
    "an unmarked ticket card with a javascript: link",
    card(chicago.slug) + card(nyc.slug) + unmarkedCard("javascript:void(0)"),
  ],
  [
    "a sold-out card for a show that is still on sale",
    card(chicago.slug) +
      soldOutCard(nyc.slug, `${nyc.url}?aff=garamsitetickets`),
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

const ownListing = `${nyc.url}?aff=garamsitetickets&utm_medium=mobile`;
for (const [name, href, show, passes] of [
  ["linking to its own listing with tracking params", ownListing, {}, true],
  ["linking to another show's listing", chicago.url, {}, false],
  ["linking to an http listing", nyc.url.replace("https:", "http:"), {}, false],
  ["for a canceled show", ownListing, { status: "canceled" }, false],
  ["for a hidden show", ownListing, { hidden: true }, false],
  // Prerendered until the daily rebuild; see soldOutProblem.
  ["for a past show", ownListing, { isoDate: "2026-11-10" }, true],
] as const) {
  test(`ticket monitor: sold-out card ${name}`, async ({ page, request }) => {
    test.setTimeout(10000);
    await showTicketPage(
      page,
      card(chicago.slug) + soldOutCard(nyc.slug, href),
    );
    const check = checkTicketListings(
      page,
      request,
      [chicago, { ...nyc, soldOut: true, ...show }],
      now,
      { followRedirects: false },
    );
    if (passes) await check;
    else await expect(check).rejects.toThrow();
  });
}

// The vendor's own listing is the independent oracle: a wrong url typed into
// events.ts redirects "correctly" because the redirect reads the same data.
const venue = {
  name: "Top Secret Comedy Club",
  addressLocality: "Chicago",
  addressRegion: "IL",
  addressCountry: "US",
};
const atVenue = {
  name: venue.name,
  address: { addressLocality: "Chicago, IL" },
};
/** Serves one vendor listing page and checks our Chicago show against it. */
async function checkListing(
  page: Page,
  status: number,
  ldJson: unknown,
  passes: boolean,
) {
  let show: EventEntry = {
    ...event,
    startTime: "19:30",
    timezone: "America/Chicago",
    venue,
  };
  await withSite(
    (req, res) => {
      if (req.url?.startsWith("/api/go/")) return goRoute([show])(req, res);
      res.writeHead(status, { "content-type": "text/html" });
      res.end(
        `<script type="application/ld+json">${JSON.stringify(ldJson)}</script>`,
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
}

for (const [name, status, startDate, location, passes] of [
  [
    "listing published in the show's timezone",
    200,
    "2026-12-04T19:30:00-06:00",
    atVenue,
    true,
  ],
  ["listing published in UTC", 200, "2026-12-05T01:30:00.000Z", atVenue, true],
  [
    "listing that names only the city",
    200,
    "2026-12-04T19:30:00-06:00",
    { address: { addressLocality: "Chicago, IL" } },
    true,
  ],
  [
    "listing for another date",
    200,
    "2026-12-05T19:30:00-06:00",
    atVenue,
    false,
  ],
  ["listing at another time", 200, "2026-12-04T21:00:00-06:00", atVenue, false],
  [
    "listing for another venue at the same time",
    200,
    "2026-12-04T19:30:00-06:00",
    { name: "Laugh Factory", address: { addressLocality: "Chicago, IL" } },
    false,
  ],
  [
    "listing in another city at the same time",
    200,
    "2026-12-04T19:30:00-06:00",
    { address: { addressLocality: "Chicagoland Heights" } },
    false,
  ],
  [
    "listing at our venue name in another city",
    200,
    "2026-12-04T19:30:00-06:00",
    { name: venue.name, address: { addressLocality: "Detroit, MI" } },
    false,
  ],
  [
    "listing in a room whose name contains our venue",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: `${venue.name} Annex`,
      address: { addressLocality: "Chicago, IL" },
    },
    false,
  ],
  [
    "listing whose venue name is only punctuation",
    200,
    "2026-12-04T19:30:00-06:00",
    { name: "--", address: { addressLocality: "Detroit" } },
    false,
  ],
  [
    "listing in a city whose name starts with ours",
    200,
    "2026-12-04T19:30:00-06:00",
    { address: { addressLocality: "Chicago Heights, IL" } },
    false,
  ],
  [
    "listing in our city name in another state",
    200,
    "2026-12-04T19:30:00-06:00",
    { name: venue.name, address: { addressLocality: "Chicago, OH" } },
    false,
  ],
  [
    "listing in our city with another state field",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: { addressLocality: "Chicago", addressRegion: "OH" },
    },
    false,
  ],
  [
    "listing with our city and state fields",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: { addressLocality: "Chicago", addressRegion: "IL" },
    },
    true,
  ],
  [
    "listing whose state field repeats the city",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: { addressLocality: "Chicago, IL", addressRegion: "Chicago, IL" },
    },
    true,
  ],
  [
    "listing whose state field names our city in another state",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: { addressLocality: "Chicago", addressRegion: "Chicago, OH" },
    },
    false,
  ],
  [
    "listing that names only our state",
    200,
    "2026-12-04T19:30:00-06:00",
    { address: { addressRegion: "IL" } },
    false,
  ],
  [
    "listing whose second address is plain text",
    200,
    "2026-12-04T19:30:00-06:00",
    [atVenue, { address: "Detroit, MI" }],
    false,
  ],
  [
    "listing whose address list names another city",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: [{ addressLocality: "Detroit", addressRegion: "MI" }],
    },
    false,
  ],
  [
    "listing whose second location has an empty address list",
    200,
    "2026-12-04T19:30:00-06:00",
    [atVenue, { name: "Laugh Factory", address: [] }],
    false,
  ],
  [
    "listing whose city and state are given as lists",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: venue.name,
      address: { addressLocality: ["Detroit"], addressRegion: ["MI"] },
    },
    false,
  ],
  [
    "listing whose venue name is given as a list",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      name: ["Laugh Factory"],
      address: { addressLocality: "Chicago", addressRegion: "IL" },
    },
    false,
  ],
  [
    "listing whose location is a postal address in another city",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      "@type": "PostalAddress",
      name: venue.name,
      addressLocality: "Detroit",
      addressRegion: "MI",
    },
    false,
  ],
  [
    "listing whose location is a postal address in our city",
    200,
    "2026-12-04T19:30:00-06:00",
    {
      "@type": "PostalAddress",
      name: venue.name,
      addressLocality: "Chicago",
      addressRegion: "IL",
    },
    true,
  ],
  [
    "listing whose location is online under our venue name",
    200,
    "2026-12-04T19:30:00-06:00",
    { "@type": "VirtualLocation", name: venue.name },
    false,
  ],
  [
    "listing whose address list names our city",
    200,
    "2026-12-04T19:30:00-06:00",
    { name: venue.name, address: [{ addressLocality: "Chicago, IL" }] },
    true,
  ],
  [
    "listing whose second location is plain text",
    200,
    "2026-12-04T19:30:00-06:00",
    [atVenue, "Laugh Factory, Detroit, MI"],
    false,
  ],
  [
    "listing whose second location is another venue",
    200,
    "2026-12-04T19:30:00-06:00",
    [
      atVenue,
      { name: "Laugh Factory", address: { addressLocality: "Detroit, MI" } },
    ],
    false,
  ],
  [
    "listing that names our venue twice",
    200,
    "2026-12-04T19:30:00-06:00",
    [atVenue, atVenue],
    true,
  ],
  [
    "listing that names no place",
    200,
    "2026-12-04T19:30:00-06:00",
    undefined,
    false,
  ],
  [
    "listing the vendor won't serve",
    403,
    "2026-12-04T19:30:00-06:00",
    atVenue,
    false,
  ],
] as const) {
  test(`ticket monitor: ${name}`, async ({ page }) => {
    test.setTimeout(10000);
    await checkListing(
      page,
      status,
      { "@type": "Event", startDate, location },
      passes,
    );
  });
}

// Listing pages whose JSON-LD isn't one plain Event. Each body is the page's
// whole ld+json block, so references and nesting are exercised as vendors
// publish them.
const ourStart = "2026-12-04T19:30:00-06:00";
for (const [name, body, passes] of [
  [
    "listing whose address points at another city elsewhere in the page",
    {
      "@graph": [
        {
          "@type": "Event",
          startDate: ourStart,
          location: { name: venue.name, address: { "@id": "#addr" } },
        },
        {
          "@id": "#addr",
          "@type": "PostalAddress",
          addressLocality: "Detroit",
          addressRegion: "MI",
        },
      ],
    },
    false,
  ],
  [
    "listing whose address points at our city elsewhere in the page",
    {
      "@graph": [
        {
          "@type": "Event",
          startDate: ourStart,
          location: { name: venue.name, address: { "@id": "#addr" } },
        },
        {
          "@id": "#addr",
          "@type": "PostalAddress",
          addressLocality: "Chicago",
          addressRegion: "IL",
        },
      ],
    },
    true,
  ],
  [
    "listing whose typed address link points at another city",
    {
      "@graph": [
        {
          "@type": "Event",
          startDate: ourStart,
          location: {
            name: venue.name,
            address: { "@id": "#addr", "@type": "PostalAddress" },
          },
        },
        { "@id": "#addr", addressLocality: "Detroit", addressRegion: "MI" },
      ],
    },
    false,
  ],
  [
    "listing whose address is described twice with different cities",
    {
      "@graph": [
        {
          "@type": "Event",
          startDate: ourStart,
          location: {
            name: venue.name,
            address: {
              "@id": "#addr",
              addressLocality: "Chicago",
              addressRegion: "IL",
            },
          },
        },
        { "@id": "#addr", addressLocality: "Detroit", addressRegion: "MI" },
      ],
    },
    false,
  ],
  [
    "page whose main event is another show beside ours",
    {
      "@graph": [
        { "@type": "WebPage", mainEntity: { "@id": "#main" } },
        {
          "@id": "#main",
          "@type": "Event",
          startDate: "2026-12-11T19:30:00-06:00",
          location: atVenue,
        },
        { "@type": "Event", startDate: ourStart, location: atVenue },
      ],
    },
    false,
  ],
  [
    "page whose main event is our show",
    {
      "@graph": [
        { "@type": "WebPage", mainEntity: { "@id": "#main" } },
        {
          "@id": "#main",
          "@type": "Event",
          startDate: ourStart,
          location: atVenue,
        },
      ],
    },
    true,
  ],
  [
    "page whose main event is another show, with a second page naming ours",
    {
      "@graph": [
        { "@type": "WebPage", mainEntity: { "@id": "#main" } },
        {
          "@id": "#main",
          "@type": "Event",
          startDate: "2026-12-11T19:30:00-06:00",
          location: atVenue,
        },
        {
          "@type": "WebPage",
          mainEntity: {
            "@type": "Event",
            startDate: ourStart,
            location: atVenue,
          },
        },
      ],
    },
    false,
  ],
  [
    "page whose main event has conflicting dates, beside ours",
    {
      "@graph": [
        { "@type": "WebPage", mainEntity: { "@id": "#main" } },
        {
          "@id": "#main",
          "@type": "Event",
          startDate: ourStart,
          location: atVenue,
        },
        { "@id": "#main", startDate: "2026-12-11T19:30:00-06:00" },
        { "@type": "Event", startDate: ourStart, location: atVenue },
      ],
    },
    false,
  ],
  [
    "page with an FAQ beside our show, the way Eventbrite publishes it",
    [
      { "@type": "Event", startDate: ourStart, location: atVenue },
      {
        "@type": "FAQPage",
        mainEntity: [{ "@type": "Question", name: "Is there parking?" }],
      },
    ],
    true,
  ],
  [
    "listing whose location points at nothing on the page",
    {
      "@type": "Event",
      startDate: ourStart,
      location: { "@id": "#missing" },
    },
    false,
  ],
  [
    "listing for another show that recommends ours",
    {
      "@type": "Event",
      startDate: "2026-12-11T19:30:00-06:00",
      location: atVenue,
      subjectOf: {
        "@type": "ItemList",
        itemListElement: [
          { "@type": "Event", startDate: ourStart, location: atVenue },
        ],
      },
    },
    false,
  ],
  [
    "venue page that lists our show in its calendar",
    {
      "@type": "Place",
      ...atVenue,
      Events: [{ "@type": "Event", startDate: ourStart, location: atVenue }],
    },
    false,
  ],
] as const) {
  test(`ticket monitor: ${name}`, async ({ page }) => {
    test.setTimeout(10000);
    await checkListing(page, 200, body, passes);
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
