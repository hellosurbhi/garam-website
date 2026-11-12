import { test, expect } from "@playwright/test";
import { checkTicketListings } from "../synthetic/ticket-checks";
import type { EventEntry } from "../../src/data/events";
import { applyUtmsToUrl } from "../../src/utils/utmForwarding";

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
    await page.setContent(
      '<button data-notify-city="Chicago">Notify Me</button>',
    );
    await checkTicketListings(page, request, [entry], now);
  });
}
test("ticket monitor rejects a missing checkout link for a purchasable show", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await page.setContent(
    '<button data-notify-city="Chicago">Notify Me</button>',
  );
  await expect(
    checkTicketListings(page, request, [event], now),
  ).rejects.toThrow();
});
test("ticket monitor rejects a blank page when only waitlists are expected", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await page.setContent("<h1>Upcoming Shows</h1>");
  await expect(checkTicketListings(page, request, [], now)).rejects.toThrow();
});
test("ticket monitor finds a checkout link that carries the ?eid= the site adds", async ({
  page,
}) => {
  await page.setContent(
    '<a href="https://garammasaladating.com/api/go/fixture-show?eid=1b57f1fa">Buy Tickets</a><a href="/api/go/fixture-show-late">Other</a>',
  );
  const destination = applyUtmsToUrl(
    event.url!,
    {},
    {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: "chicago",
      utmContent: event.slug,
    },
  );
  const { createServer } = await import("node:http");
  const { request: api } = await import("@playwright/test");
  const server = createServer((_req, res) => {
    res.writeHead(302, { location: destination });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture server port");
  const client = await api.newContext({
    baseURL: `http://127.0.0.1:${address.port}`,
  });
  try {
    await checkTicketListings(page, client, [event], now);
  } finally {
    await client.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
test("ticket monitor does not match a longer slug that shares the prefix", async ({
  page,
  request,
}) => {
  test.setTimeout(10000);
  await page.setContent(
    '<a href="/api/go/fixture-show-late">Other</a><button data-notify-city="Chicago">Notify Me</button>',
  );
  await expect(
    checkTicketListings(page, request, [event], now),
  ).rejects.toThrow();
});
test("ticket monitor checks the exact checkout destination", async ({
  page,
}) => {
  await page.setContent('<a href="/api/go/fixture-show">Buy Tickets</a>');
  const destination = applyUtmsToUrl(
    event.url!,
    {},
    {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: "chicago",
      utmContent: event.slug,
    },
  );
  // A local server supplies HTTP responses to the real API request client.
  const { createServer } = await import("node:http");
  const { request: api } = await import("@playwright/test");
  const server = createServer((_req, res) => {
    res.writeHead(302, { location: destination });
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture server port");
  const client = await api.newContext({
    baseURL: `http://127.0.0.1:${address.port}`,
  });
  try {
    await checkTicketListings(page, client, [event], now);
  } finally {
    await client.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});

test("ticket monitor accepts the city-request fallback when no ranked cities exist", async ({
  page,
  request,
}) => {
  await page.setContent(
    '<button data-open-modal="tickets-city-modal">Request your city</button>',
  );
  await checkTicketListings(page, request, [], now);
});
test("ticket monitor rejects an unexpected checkout link in a waitlist-only state", async ({
  page,
  request,
}) => {
  await page.setContent(
    '<a href="/api/go/unknown">Buy Tickets</a><button data-notify-city="Chicago">Notify Me</button>',
  );
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
    await page.setContent(
      '<a href="/api/go/fixture-show">Buy Tickets</a><button data-notify-city="Chicago">Notify Me</button>',
    );
    const { createServer } = await import("node:http");
    const { request: api } = await import("@playwright/test");
    const server = createServer((_req, res) => {
      res.writeHead(status, { location: destination });
      res.end();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing fixture server port");
    const client = await api.newContext({
      baseURL: `http://127.0.0.1:${address.port}`,
    });
    try {
      const check = checkTicketListings(
        page,
        client,
        [{ ...event, ...(past ? { isoDate: "2026-10-01" } : {}) }],
        now,
      );
      if (passes) await check;
      else await expect(check).rejects.toThrow();
    } finally {
      await client.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
}
