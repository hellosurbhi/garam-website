import { describe, it, expect } from "vitest";
import { events, comingSoonEvents, allEvents } from "../src/data/events";
import type { EventEntry } from "../src/data/events";
import {
  isBuyableNow,
  isShowOver,
  sortUpcoming,
  ticketTier,
} from "../src/data/eventAvailability";
import {
  buildEventRedirectMap,
  getAnyEventBySlug,
  needsRedirect,
  resolveEventRedirect,
} from "../src/data/eventRedirects";
import { cities } from "../src/data/cities";
import { getUpcomingOrdered } from "../src/utils/eventFilters";

const NOW = Date.parse("2026-10-26T16:00:00Z");
const TODAY = "2026-10-26";

function ev(o: Partial<EventEntry>): EventEntry {
  return {
    date: "Dec 6",
    city: "Philadelphia",
    state: "Pennsylvania",
    stateAbbr: "PA",
    citySlug: "philadelphia",
    slug: "philadelphia-x",
    description: "",
    lineup: [],
    ticketSource: "our-eventbrite",
    url: "https://example.com/t",
    isoDate: "2026-12-06",
    ...o,
  } as EventEntry;
}

describe("isShowOver", () => {
  it("uses the show's timezone and endTime, not the UTC date", () => {
    const sf = ev({
      isoDate: "2026-12-26",
      endTime: "22:00",
      timezone: "America/Los_Angeles",
    });
    // 2026-12-27T01:00Z is Dec 26 5pm in SF: the show has not even started.
    expect(isShowOver(sf, Date.parse("2026-12-27T01:00:00Z"))).toBe(false);
    // 2026-12-27T06:30Z is Dec 26 10:30pm in SF: over.
    expect(isShowOver(sf, Date.parse("2026-12-27T06:30:00Z"))).toBe(true);
  });

  it("never treats an undated TBA card as over", () => {
    expect(isShowOver(ev({ isoDate: undefined }), NOW)).toBe(false);
  });
});

describe("buyable-first ordering", () => {
  it("puts a later buyable show above an earlier coming-soon show", () => {
    const comingSoon = ev({ slug: "a", isoDate: "2026-11-19", url: "" });
    const buyable = ev({ slug: "b", isoDate: "2026-12-26" });
    const sorted = sortUpcoming([comingSoon, buyable], NOW);
    expect(sorted.map((e) => e.slug)).toEqual(["b", "a"]);
  });

  it("orders buyable, then sold out or presale, then coming soon, undated last", () => {
    const tba = ev({ slug: "tba", isoDate: undefined, url: "" });
    const soon = ev({ slug: "soon", isoDate: "2026-11-01", url: "" });
    const soldOut = ev({ slug: "sold", isoDate: "2026-11-05", soldOut: true });
    const presale = ev({
      slug: "pre",
      isoDate: "2026-11-06",
      onSaleAt: "2026-11-01T00:00:00Z",
    });
    const buy = ev({ slug: "buy", isoDate: "2026-12-31" });
    expect(
      sortUpcoming([tba, soon, soldOut, presale, buy], NOW).map((e) => e.slug),
    ).toEqual(["buy", "sold", "pre", "soon", "tba"]);
  });

  it("ranks a presale show below buyable until its on-sale moment", () => {
    const e = ev({ onSaleAt: "2026-11-01T00:00:00Z" });
    expect(ticketTier(e, NOW)).toBe(1);
    expect(isBuyableNow(e, Date.parse("2026-11-01T00:00:01Z"))).toBe(true);
  });

  it("real data: no coming-soon card ever precedes a buyable show", () => {
    const list = getUpcomingOrdered(allEvents, TODAY, NOW);
    const tiers = list.map((e) => ticketTier(e, NOW));
    // Guard against passing vacuously if the data stops containing either kind.
    expect(tiers).toContain(0);
    expect(tiers).toContain(2);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });
});

describe("resolveEventRedirect", () => {
  const pastPhilly = ev({
    slug: "philadelphia-2026-10-04",
    isoDate: "2026-10-04",
  });
  const nextPhilly = ev({ slug: "philadelphia-2026-12-06" });

  it("sends a past show to the next buyable show in the same city", () => {
    expect(
      resolveEventRedirect(pastPhilly, NOW, [pastPhilly, nextPhilly]),
    ).toBe("/events/philadelphia-2026-12-06");
  });

  it("sends a past show to the city waitlist page when nothing is buyable", () => {
    const soldOut = ev({ slug: "p2", soldOut: true });
    expect(resolveEventRedirect(pastPhilly, NOW, [pastPhilly, soldOut])).toBe(
      "/cities/philadelphia",
    );
  });

  it("falls back to /tickets when the event has no city", () => {
    expect(resolveEventRedirect(ev({ citySlug: undefined }), NOW, [])).toBe(
      "/tickets",
    );
  });

  it("never returns the event's own page", () => {
    const self = ev({ slug: "self" });
    expect(resolveEventRedirect(self, NOW, [self])).toBe(
      "/cities/philadelphia",
    );
  });
});

describe("needsRedirect", () => {
  it("flags canceled and over shows, not live ones", () => {
    expect(needsRedirect(ev({ status: "canceled" }), NOW)).toBe(true);
    expect(needsRedirect(ev({ isoDate: "2026-10-04" }), NOW)).toBe(true);
    expect(needsRedirect(ev({}), NOW)).toBe(false);
  });

  it("flags a coming-soon card once its city has a dated upcoming show", () => {
    const tba = ev({ slug: "philadelphia-tba", isoDate: undefined, url: "" });
    expect(needsRedirect(tba, NOW, [tba])).toBe(false);
    expect(needsRedirect(tba, NOW, [tba, ev({})])).toBe(true);
  });
});

describe("real data", () => {
  it("redirects the past Philadelphia show to the next Philadelphia show", () => {
    const map = buildEventRedirectMap(NOW);
    expect(map["/events/philadelphia-2026-10-04"]).toBe(
      "/events/philadelphia-2026-12-06",
    );
  });

  it("redirects Chicago Oct 24 (no later live show) to the Chicago city page", () => {
    expect(buildEventRedirectMap(NOW)["/events/chicago-2026-10-24"]).toBe(
      "/cities/chicago",
    );
  });

  it("resolves suppressed *-tba slugs instead of losing them", () => {
    const suppressed = comingSoonEvents.filter(
      (c) => !allEvents.some((a) => a.slug === c.slug),
    );
    expect(suppressed.length).toBeGreaterThan(0);
    for (const s of suppressed) expect(getAnyEventBySlug(s.slug)).toBeDefined();
  });

  it("every redirect target is a real event page or city page, never itself", () => {
    const map = buildEventRedirectMap(NOW);
    const pages = new Set(allEvents.map((e) => `/events/${e.slug}`));
    for (const [from, to] of Object.entries(map)) {
      expect(to).not.toBe(from);
      if (to.startsWith("/events/")) expect(pages.has(to)).toBe(true);
      else if (to.startsWith("/cities/"))
        expect(cities[to.replace("/cities/", "")]).toBeDefined();
      else expect(to).toBe("/tickets");
    }
  });

  it("no page is generated for a slug that redirects", () => {
    const map = buildEventRedirectMap(NOW);
    const generated = allEvents.filter((e) => !needsRedirect(e, NOW));
    for (const e of generated) expect(map[`/events/${e.slug}`]).toBeUndefined();
  });

  it("every event slug is either a page or a redirect", () => {
    const map = buildEventRedirectMap(NOW);
    const generated = new Set(
      allEvents.filter((e) => !needsRedirect(e, NOW)).map((e) => e.slug),
    );
    for (const e of [...events, ...comingSoonEvents])
      expect(generated.has(e.slug) || map[`/events/${e.slug}`]).toBeTruthy();
  });
});
