import {
  expect,
  test,
  type Page,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { isDisplayable, type EventEntry } from "../../src/data/events";
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
   * same data. "required" fails when a vendor won't serve the page, so the
   * weekly and preview smoke runs surface a lasting block. "whenServed" notes
   * a page the vendor would not serve (403, 429, 5xx, a timeout, a dropped
   * connection or a recognized bot challenge) and checks the rest, so the frequent monitor pages only for
   * a page that loads without naming this show, or for a dead link.
   */
  verifyListings?: false | "required" | "whenServed";
}

/** One place a listing names: its venue and its city, when given. */
export interface ListedPlace {
  venue: string | null;
  locality: string | null;
  region: string | null;
  /** A location or address given as bare text instead of an object. */
  text: string | null;
}

/** One schema.org *Event a vendor page publishes about itself. */
export interface ListedEvent {
  startDate: string;
  /** Every location the event names, in order. */
  places: ListedPlace[];
}

/** Every top-level schema.org *Event with a startDate in a page's JSON-LD. */
export function extractListedEvents(html: string): ListedEvent[] {
  type Node = Record<string, unknown>;
  const isNode = (value: unknown): value is Node =>
    !!value && typeof value === "object" && !Array.isArray(value);
  const typesOf = (node: Node) =>
    [node["@type"]].flat().filter((t): t is string => typeof t === "string");
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const unreadable = (raw: unknown): ListedPlace[] => [
    { venue: null, locality: null, region: null, text: JSON.stringify(raw) },
  ];

  const blocks: unknown[] = [];
  for (const [, body] of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // One malformed block doesn't hide the others.
    }
  }

  // A node may be described in pieces across the page and pointed at by
  // "@id" (an address kept once in @graph and linked from the venue), so
  // every piece with the same id is merged. A field two pieces disagree on
  // becomes a list, which the place check then can't read and fails.
  const byId = new Map<string, Node>();
  const index = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(index);
    if (!isNode(value)) return;
    const id = value["@id"];
    if (typeof id === "string") {
      const merged = byId.get(id) ?? {};
      for (const [key, field] of Object.entries(value)) {
        const known = merged[key];
        merged[key] =
          known === undefined || JSON.stringify(known) === JSON.stringify(field)
            ? field
            : [known, field].flat();
      }
      byId.set(id, merged);
    }
    Object.values(value).forEach(index);
  };
  blocks.forEach(index);
  // A node with an id stands for everything the page says about that id; a
  // bare reference to an id never described is undefined, which callers
  // treat as unreadable.
  const resolve = (value: unknown): unknown => {
    if (!isNode(value) || typeof value["@id"] !== "string") return value;
    const node = byId.get(value["@id"]);
    return node && Object.keys(node).length > 1 ? node : undefined;
  };
  const isEventTyped = (node: unknown): node is Node =>
    isNode(node) && typesOf(node).some((t) => t.endsWith("Event"));
  const isEvent = (node: unknown): node is Node & { startDate: string } =>
    isEventTyped(node) && typeof node.startDate === "string";

  const placesOf = (location: unknown): ListedPlace[] =>
    [location].flat().flatMap((raw): ListedPlace[] => {
      if (raw === undefined || raw === null) return [];
      const place = resolve(raw);
      if (!isNode(place)) return unreadable(raw);
      // schema.org's location is a Place, PostalAddress, text or
      // VirtualLocation. An online location under our venue's name is not
      // the room the show is in, so it can't confirm the listing.
      const types = typesOf(place);
      if (types.some((t) => t.endsWith("VirtualLocation")))
        return unreadable(raw);
      // Address fields are read wherever they sit: on a nested address, or
      // on the location itself when it is a PostalAddress (reading only the
      // nested one let a Detroit PostalAddress location pass for Chicago).
      const listed = place.address === undefined ? [] : [place.address].flat();
      const ownAddress =
        types.some((t) => t.endsWith("PostalAddress")) ||
        "addressLocality" in place ||
        "addressRegion" in place;
      const addresses = [...listed, ...(ownAddress ? [place] : [])];
      // An empty list names no address, so the venue is still checked
      // (dropping the place let "Laugh Factory" with address [] pass).
      return (addresses.length ? addresses : [{}]).flatMap(
        (rawAddress): ListedPlace[] => {
          const address = resolve(rawAddress);
          if (!isNode(address)) return unreadable(rawAddress);
          // A name, city or state given as anything but text can't be
          // compared, so the place fails rather than the field being skipped
          // (skipping let addressLocality ["Detroit"] pass for Chicago).
          const identity = [
            place.name,
            address.addressLocality,
            address.addressRegion,
          ];
          if (
            identity.some(
              (v) => v !== undefined && v !== null && typeof v !== "string",
            )
          )
            return unreadable(identity);
          return [
            {
              venue: text(place.name),
              locality: text(address.addressLocality),
              region: text(address.addressRegion),
              text: null,
            },
          ];
        },
      );
    });

  // WHY: only the page's own top-level events describe what it sells: a
  // block's root, the items of a root list, or @graph members. Walking every
  // nested node let a wrong show's page pass because it recommended ours in
  // an ItemList, and DC Comedy Loft's show page nests its whole 287-show
  // venue calendar under a Place. A page like that can't prove which show
  // the link opens, so it fails the check rather than matching any listing.
  const topLevel = blocks
    .flat()
    .flatMap((root) =>
      isNode(root) && root["@graph"] !== undefined
        ? [root, ...[root["@graph"]].flat()]
        : [root],
    );
  // A page that names an event as its mainEntity has said which show it
  // sells; any other event beside it is a recommendation (a graph whose
  // WebPage pointed at the wrong show passed on a separate event of ours).
  // Other main entities, like an FAQPage's questions, don't decide this.
  // WHY page nodes only: an Article's or other block's mainEntity is what
  // that block is about, not what the page sells. Reading every top-level
  // node rejected our correct show page because an Article beside it named
  // another event. WebPage and its subtypes (ItemPage, FAQPage...) all end
  // in "Page".
  // WHY fail closed below: a page naming two different main events, or a
  // main event with no readable start, can't prove which show it sells.
  // Taking the union passed a wrong show's page that also had a WebPage
  // pointing at ours, and falling back to the other events let a
  // recommendation of ours stand in for a main event with conflicting dates.
  const mainEvents = [
    ...new Map(
      topLevel
        .map(resolve)
        .filter(
          (node): node is Node =>
            isNode(node) && typesOf(node).some((t) => t.endsWith("Page")),
        )
        .flatMap((node) => [node.mainEntity].flat())
        .map(resolve)
        .filter(isEventTyped)
        .map((node) => [JSON.stringify(node), node] as const),
    ).values(),
  ];
  if (mainEvents.length > 1) return [];
  const sold = mainEvents.length
    ? mainEvents.filter(isEvent)
    : topLevel.map(resolve).filter(isEvent);
  return sold.map((node) => ({
    startDate: node.startDate,
    places: placesOf(node.location),
  }));
}

const comparable = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// WHY: a start time alone doesn't prove the listing is this show; an
// unrelated event at the same hour passed the first version of this check.
// Every place the listing names must agree with ours, not just the first: its
// venue must be our venue exactly (ignoring case and punctuation; a substring
// match let "The Loft Annex" pass for "The Loft"). Its city must be our city
// exactly. Vendors may append a region ("New York, NY"); the part before the
// comma is the city (a prefix match let "New York Mills" pass), and a region
// after it must be our state, as must a separate addressRegion. Each place
// must name our venue or our city; a state alone fails. A location or address
// given only as text can't be checked field by field, so it fails rather than
// being skipped (skipping let "Laugh Factory, Detroit, MI" pass beside our
// venue). A listing with no place fails.
export function isSameShow(listed: ListedEvent, event: EventEntry): boolean {
  const ourVenue = comparable(event.venue?.name ?? "");
  const ourCity = comparable(event.venue?.addressLocality ?? event.city);
  const ourRegions = [
    event.venue?.addressRegion,
    event.stateAbbr,
    event.state,
  ].flatMap((region) => (region ? [comparable(region)] : []));
  const checks = listed.places.flatMap((place) => {
    if (place.text !== null) return [false];
    const placeChecks: boolean[] = [];
    const theirVenue = comparable(place.venue ?? "");
    if (theirVenue && ourVenue) placeChecks.push(theirVenue === ourVenue);
    const [city = "", ...rest] = (place.locality ?? "").split(",");
    const theirCity = comparable(city);
    const theirRegion = comparable(rest.join(" "));
    if (theirCity) placeChecks.push(theirCity === ourCity);
    // A state alone fits a whole state's worth of venues, so a place that
    // names neither a venue nor a city we can compare proves nothing.
    if (placeChecks.length === 0) return [false];
    if (theirRegion) placeChecks.push(ourRegions.includes(theirRegion));
    // City Winery fills addressRegion with "New York, NY", so each comma part
    // of the region field must name our city or our state.
    const statedRegion = (place.region ?? "")
      .split(",")
      .map(comparable)
      .filter(Boolean);
    if (statedRegion.length)
      placeChecks.push(
        statedRegion.every(
          (part) => part === ourCity || ourRegions.includes(part),
        ),
      );
    return placeChecks;
  });
  return checks.length > 0 && checks.every(Boolean);
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

/** Request errors that mean the vendor's network failed, not our link. */
// WHY "aborted": Playwright reports a connection dropped after the headers
// arrived as "apiRequestContext.get: aborted" (then a call log), with no
// socket code. Only the first line is matched, because the call log echoes
// response headers: a redirect loop to "location: aborted" would match.
const TRANSIENT_REQUEST_ERROR =
  /Timeout \d+ms exceeded|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|: aborted$/;

/**
 * Cloudflare's challenge config object, defined only on the interstitial it
 * serves with a 200 in place of the page.
 */
// WHY only this marker: Cloudflare's "/cdn-cgi/challenge-platform/" script,
// HUMAN's "px-captcha" and DataDome's "captcha-delivery.com" all appear on
// ordinary pages too (injected scripts and CSP lists), so a login page that
// carried one passed as unserved. Those vendors block with 403, which the
// status check already notes.
const BOT_CHALLENGE = /window\._cf_chl_opt\b/;

/** Fails a listing check that needs the page, or notes it in "whenServed". */
function listingUnavailable(
  mode: "required" | "whenServed",
  problem: string,
): void {
  if (mode === "required") throw new Error(problem);
  test
    .info()
    .annotations.push({ type: "listing unavailable", description: problem });
}

async function expectListingStart(
  request: APIRequestContext,
  url: string,
  event: EventEntry,
  mode: "required" | "whenServed",
) {
  let response: APIResponse;
  try {
    response = await request.get(url, {
      timeout: 15_000,
      headers: MONITOR_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const problem = `${event.slug}: ${url} did not respond (${message})`;
    // WHY only timeouts and dropped or refused connections count as unserved:
    // those are the vendor's network, while a redirect loop or a domain that
    // does not resolve is a broken link we published and must fail.
    if (!TRANSIENT_REQUEST_ERROR.test(message.split("\n")[0]))
      throw new Error(problem, { cause: error });
    return listingUnavailable(mode, problem);
  }
  const status = response.status();
  if (!response.ok()) {
    const problem = `${event.slug}: ${url} returned ${status}`;
    // WHY only 403, 429 and 5xx count as unserved: those are a block, a rate
    // limit or an outage. Any other error (404, 410, 401) says the link we
    // published is wrong or dead.
    if (status !== 403 && status !== 429 && status < 500)
      throw new Error(problem);
    return listingUnavailable(mode, problem);
  }
  // WHY every other 200 must match, even one with no structured data: a
  // homepage, search page, login redirect or script shell also loads fine,
  // so a page the monitor cannot read is a wrong link until it names this
  // show. Only a recognized bot challenge with no event data is unserved.
  const html = await response.text();
  if (BOT_CHALLENGE.test(html) && !/application\/ld\+json/i.test(html))
    return listingUnavailable(
      mode,
      `${event.slug}: ${url} served a bot challenge instead of the page`,
    );
  const listed = extractListedEvents(html);
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
    .map(
      (c) =>
        `${c.startDate} at ${
          c.places
            .map((place) =>
              [place.text, place.venue, place.locality, place.region]
                .filter(Boolean)
                .join(", "),
            )
            .join(" / ") || "no place"
        }`,
    )
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
// the full URL. It must belong to a displayable show that really is sold
// out: a sold-out card for an on-sale show would hide the checkout, and one
// for a canceled or hidden show should not be on the page at all. A past
// sold-out show's card is tolerated, unlike a past /api/go card that must
// redirect to /tickets: the page is prerendered, so yesterday's card stays
// until the 6:00 UTC daily rebuild (.github/workflows/daily-rebuild.yml),
// and a sold-out listing sells nothing, so there is no expired checkout to
// protect buyers from. Failing it would page every night for expected lag.
function soldOutProblem(
  link: RenderedCheckout,
  events: EventEntry[],
): string | null {
  const label = `${link.slug ?? "sold-out card without data-event-slug"} -> ${link.href ?? "no href"}`;
  const event = events.find((e) => e.slug === link.slug);
  if (!event || !isDisplayable(event) || !event.isoDate) {
    return `${label} (sold-out card for a show that isn't listed)`;
  }
  if (!event.soldOut || !event.url) {
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
    if (verifyListings)
      await expectListingStart(request, location, event, verifyListings);
  }
}
