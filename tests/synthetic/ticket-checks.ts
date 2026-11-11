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

/** One visible checkout link as the page renders it. */
export interface RenderedCheckout {
  /** The card's own identity (`data-event-slug`), independent of its href. */
  slug: string | null;
  href: string | null;
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

async function renderedCheckouts(page: Page): Promise<RenderedCheckout[]> {
  return page
    .locator('a[data-go-ticket]:visible, a[href*="/api/go/"]:visible')
    .evaluateAll((links) =>
      links.map((link) => ({
        slug: link.getAttribute("data-event-slug"),
        href: link.getAttribute("href"),
      })),
    );
}

/**
 * Checks the visible checkout links on a ticket page against the show list.
 *
 * Every on-sale show must have a card whose own href is a same-origin
 * `/api/go/<its slug>` link, and that link must 302 to the show's checkout.
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
        verdicts = (await renderedCheckouts(page)).map((link) =>
          checkoutVerdict(link, pageOrigin),
        );
        const problems = verdicts.flatMap((v) => (v.ok ? [] : [v.problem]));
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
