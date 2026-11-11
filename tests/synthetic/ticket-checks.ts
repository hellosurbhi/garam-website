import { expect, type Page, type APIRequestContext } from "@playwright/test";
import type { EventEntry } from "../../src/data/events";
import { getTicketPageUpcoming } from "../../src/utils/eventFilters";
import { goRedirectDestination } from "../../src/utils/utmForwarding";

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

/** One schema.org *Event a vendor page publishes about itself. */
export interface ListedEvent {
  startDate: string;
  venue: string | null;
  locality: string | null;
}

/** Every schema.org *Event with a startDate in a page's JSON-LD blocks. */
export function extractListedEvents(html: string): ListedEvent[] {
  const found: ListedEvent[] = [];
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const types = [obj["@type"]].flat();
    if (
      types.some((t) => typeof t === "string" && t.endsWith("Event")) &&
      typeof obj.startDate === "string"
    ) {
      const place = [obj.location].flat()[0] as
        Record<string, unknown> | undefined;
      const address = place?.address as Record<string, unknown> | undefined;
      found.push({
        startDate: obj.startDate,
        venue: text(place?.name),
        locality: text(address?.addressLocality),
      });
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

const comparable = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// WHY: a start time alone doesn't prove the listing is this show; an
// unrelated event at the same hour (another act at the venue's sister room,
// or our show in another city) passed the first version of this check. The
// listing must also name our venue, or when it names none, our city. Vendors
// append a region ("New York, NY"), so the city is a prefix match on words.
export function isSameShow(listed: ListedEvent, event: EventEntry): boolean {
  const venue = event.venue?.name;
  if (listed.venue && venue) {
    const a = comparable(listed.venue);
    const b = comparable(venue);
    return a.includes(b) || b.includes(a);
  }
  const city = comparable(event.venue?.addressLocality ?? event.city);
  const locality = listed.locality ? comparable(listed.locality) : "";
  return locality === city || locality.startsWith(`${city} `);
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
  const listed = extractListedEvents(await response.text());
  const expectedStart = event.startTime
    ? `${event.isoDate} ${event.startTime}`
    : `${event.isoDate} `;
  const matches = listed.some((candidate) => {
    const start = localStart(
      candidate.startDate,
      event.timezone ?? "America/New_York",
    );
    return (
      !!start &&
      (event.startTime
        ? start === expectedStart
        : start.startsWith(expectedStart)) &&
      isSameShow(candidate, event)
    );
  });
  const seen = listed
    .map((c) => `${c.startDate} at ${c.venue ?? c.locality ?? "no place"}`)
    .join(", ");
  expect(
    matches,
    `${event.slug}: ${url} lists ${seen || "no event"}, show is ${expectedStart.trim()} at ${event.venue?.name ?? event.city}`,
  ).toBe(true);
}

/** One visible ticket link as the page renders it. */
export interface RenderedCheckout {
  /** The card's own identity (`data-event-slug`), independent of its href. */
  slug: string | null;
  href: string | null;
  /** Inside a sold-out card, which links straight to the vendor listing. */
  soldOut?: boolean;
}

export type CheckoutVerdict =
  { ok: true; slug: string; target: string } | { ok: false; problem: string };

// WHY: the link is judged by its actual rendered href, never by a path
// rebuilt from the slug. wireTicketCtaTracking (src/lib/ticketCtaTracking.ts)
// rewrites each href after load into an absolute URL carrying ?eid= and
// UTMs, so comparing only the pathname (the first version of this checker)
// let a right-slug link on a foreign host or a javascript: link pass. Pairing
// the card's data-event-slug with its own href is what catches two cards
// whose links were swapped.
export function checkoutVerdict(
  link: RenderedCheckout,
  pageOrigin: string,
): CheckoutVerdict {
  const label = `${link.slug ?? "card without data-event-slug"} -> ${link.href ?? "no href"}`;
  if (!link.slug || !link.href) return { ok: false, problem: label };
  let url: URL;
  try {
    url = new URL(link.href, pageOrigin);
  } catch {
    return { ok: false, problem: `${label} (unparseable)` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, problem: `${label} (not an http link)` };
  }
  if (url.origin !== pageOrigin) {
    return { ok: false, problem: `${label} (leaves ${pageOrigin})` };
  }
  if (url.pathname !== `/api/go/${link.slug}`) {
    return { ok: false, problem: `${label} (points at another show)` };
  }
  return { ok: true, slug: link.slug, target: url.pathname + url.search };
}

// WHY: links are found by every way a ticket link can be recognized, not
// only by the data-go-ticket marker or an /api/go/ href. The first version
// selected on those two alone, so a broken card that lost its marker and
// pointed off-site (or at javascript:) was never inspected at all. Sold-out
// cards drop data-go-ticket by design and are judged separately below.
const TICKET_LINKS = [
  "a[data-go-ticket]",
  'a[href*="/api/go/"]',
  "a[data-event-slug]",
  "a.ticket-card",
  ".ticket-card a",
]
  .map((selector) => `${selector}:visible`)
  .join(", ");

async function renderedCheckouts(page: Page): Promise<RenderedCheckout[]> {
  return page.locator(TICKET_LINKS).evaluateAll((links) =>
    links.map((link) => ({
      slug: link.getAttribute("data-event-slug"),
      href: link.getAttribute("href"),
      soldOut: link.closest(".ticket-card--soldout") !== null,
    })),
  );
}

// WHY: a sold-out card links straight to the vendor (TicketCard.astro uses
// buildTicketUrl, which only adds aff and UTM query params, and BaseLayout
// rewrites utm_medium on mobile), so it is compared on origin and path, not
// the full URL. It must belong to a show that really is sold out: a sold-out
// card for an on-sale show would hide the checkout.
function soldOutProblem(
  link: RenderedCheckout,
  events: EventEntry[],
): string | null {
  const label = `${link.slug ?? "sold-out card without data-event-slug"} -> ${link.href ?? "no href"}`;
  const event = events.find((e) => e.slug === link.slug);
  if (!event?.soldOut || !event.url) {
    return `${label} (sold-out card for a show that isn't sold out)`;
  }
  try {
    const shown = new URL(link.href ?? "");
    const listing = new URL(event.url);
    if (shown.protocol !== "https:") return `${label} (not an https link)`;
    if (shown.origin !== listing.origin || shown.pathname !== listing.pathname)
      return `${label} (not the show's listing)`;
  } catch {
    return `${label} (unparseable)`;
  }
  return null;
}

/**
 * Checks the visible ticket links on a ticket page against the show list.
 *
 * Every on-sale show must have a card whose own href is a same-origin
 * `/api/go/<its slug>` link, and that link must 302 to the show's checkout.
 * A sold-out card must belong to a sold-out show and link to its listing.
 * Stale-card policy: the page is prerendered at deploy time, so a card for a
 * show whose date has passed may still be on it; it is allowed only if its
 * redirect returns buyers to /tickets. Any other card (unknown show,
 * canceled, ticketless, not yet on sale) fails the check.
 */
export async function checkTicketListings(
  page: Page,
  request: APIRequestContext,
  events: EventEntry[],
  now = new Date(),
  { followRedirects = true, verifyListings = false }: TicketCheckOptions = {},
) {
  const today = now.toISOString().slice(0, 10);
  const available = getTicketPageUpcoming(events, today).filter(
    (event) =>
      event.url &&
      event.url !== "#" &&
      !event.soldOut &&
      (!event.onSaleAt || Date.parse(event.onSaleAt) <= now.getTime()),
  );
  const expected = new Map(available.map((event) => [event.slug, event]));
  const stale = new Set(
    events
      .filter((event) => event.isoDate && event.isoDate < today)
      .map((event) => event.slug),
  );
  const pageOrigin = new URL(page.url()).origin;
  expect(pageOrigin, "ticket page must be served over http").toMatch(
    /^https?:\/\//,
  );

  let verdicts: CheckoutVerdict[] = [];
  // Polled: cards hydrate and presale cards reveal themselves after load.
  await expect
    .poll(
      async () => {
        const links = await renderedCheckouts(page);
        const problems = links.flatMap((link) => {
          const problem = link.soldOut ? soldOutProblem(link, events) : null;
          return problem ? [problem] : [];
        });
        verdicts = links
          .filter((link) => !link.soldOut)
          .map((link) => checkoutVerdict(link, pageOrigin));
        problems.push(...verdicts.flatMap((v) => (v.ok ? [] : [v.problem])));
        const shown = new Set(verdicts.flatMap((v) => (v.ok ? [v.slug] : [])));
        for (const slug of expected.keys()) {
          if (!shown.has(slug)) problems.push(`${slug}: no checkout link`);
        }
        for (const slug of shown) {
          if (!expected.has(slug) && !stale.has(slug)) {
            problems.push(`${slug}: checkout link for a show not on sale`);
          }
        }
        return problems;
      },
      { message: "ticket page checkout links" },
    )
    .toEqual([]);

  if (!available.length) {
    await expect(
      page
        .locator(
          '[data-notify-city]:visible, button[data-open-modal="tickets-city-modal"]:visible',
        )
        .first(),
    ).toBeVisible();
  }
  if (!followRedirects) return;

  for (const verdict of verdicts) {
    if (!verdict.ok) continue;
    const response = await request.get(verdict.target, {
      maxRedirects: 0,
      timeout: 10_000,
      headers: MONITOR_HEADERS,
    });
    expect(response.status(), verdict.target).toBe(302);
    const location = response.headers().location;
    const event = expected.get(verdict.slug);
    if (!event) {
      // A stale card: it must never lead to an expired checkout.
      expect(location, verdict.target).toBe("/tickets");
      continue;
    }
    expect(location, verdict.target).toBe(
      goRedirectDestination(
        event.url!,
        event,
        new URL(verdict.target, pageOrigin).searchParams,
      ),
    );
    if (verifyListings) await expectListingStart(request, location, event);
  }
}
