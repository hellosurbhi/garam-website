/**
 * The static pages (homepage, /tickets, /events/[slug]) render whatever
 * snapshot the build pulled into events.published.json (issue 337). This
 * swaps that file for a fixture "published" by the admin and proves every
 * build-time consumer picks up the fixture show's date, venue and ticket
 * link, with no code change.
 */
import { describe, expect, it, vi } from "vitest";
import type { EventEntry, PublishedEnvelope } from "@/data/eventsSnapshot";

// WHY vi.hoisted: vi.mock below is hoisted above every other statement.
const FIXTURE_SHOW: EventEntry = vi.hoisted(() => ({
  date: "Dec 30",
  city: "Manhattan",
  state: "New York",
  stateAbbr: "NY",
  citySlug: "manhattan",
  slug: "manhattan-2099-12-29",
  description: "Fixture show published from the admin.",
  lineup: ["surbhi", "wyatt"],
  ticketSource: "other-platform",
  url: "https://tickets.citywinery.com/fixture-published-show",
  isoDate: "2099-12-30",
  previousDate: "2099-12-29",
  startTime: "19:30",
  endTime: "21:30",
  timezone: "America/New_York",
  price: "35",
  updatedAt: "2099-01-15T10:00:00.000Z",
  venue: {
    name: "Fixture Published Venue",
    streetAddress: "1 Fixture St",
    addressLocality: "New York",
    addressRegion: "NY",
    postalCode: "10001",
    addressCountry: "US",
  },
}));

vi.mock("@/data/events.published.json", async (importOriginal) => {
  const original = await importOriginal<{ default: PublishedEnvelope }>();
  const envelope: PublishedEnvelope = {
    ...original.default,
    version: 2,
    snapshot: {
      ...original.default.snapshot,
      events: [...original.default.snapshot.events, FIXTURE_SHOW],
    },
  };
  return { default: envelope };
});

const {
  allEvents,
  events,
  getEventBySlug,
  eventLastmodDates,
  comingSoonEvents,
} = await import("@/data/events");
const { getTicketPageUpcoming, getListingInventory } =
  await import("@/utils/eventFilters");
const { buildEventSchemas } = await import("@/utils/eventSchema");
const { buildEventRedirects } = await import("@/utils/eventRedirects");

const today = new Date().toISOString().slice(0, 10);
// The homepage's ticketed show list, built the way src/pages/index.astro
// builds it; its JSON-LD blocks come from this same list.
const homeUpcoming = getTicketPageUpcoming(
  getListingInventory(allEvents, "home"),
  today,
);

describe("build-time consumers read the published snapshot", () => {
  it("guards the fixture: the committed baseline does not have the show", async () => {
    const baked = await vi.importActual<{ default: PublishedEnvelope }>(
      "@/data/events.published.json",
    );
    const bakedSlugs = baked.default.snapshot.events.map((e) => e.slug);
    expect(bakedSlugs).not.toContain(FIXTURE_SHOW.slug);
  });

  it("lists the show on /tickets", () => {
    expect(getTicketPageUpcoming(allEvents, today)).toContainEqual(
      FIXTURE_SHOW,
    );
  });

  it("lists the show on the homepage", () => {
    // The homepage's two lists (src/pages/index.astro): upcoming cards and
    // the hero's next shows.
    expect(homeUpcoming).toContainEqual(FIXTURE_SHOW);
    expect(getTicketPageUpcoming(events, today)).toContainEqual(FIXTURE_SHOW);
  });

  it("builds an /events/[slug] page for the show", () => {
    // getStaticPaths in src/pages/events/[slug].astro maps allEvents.
    expect(allEvents.map((e) => e.slug)).toContain(FIXTURE_SHOW.slug);
    // The page's ticket button links to this url through /api/go.
    expect(getEventBySlug(FIXTURE_SHOW.slug)?.url).toBe(FIXTURE_SHOW.url);
  });

  it("emits the show's date and venue in its JSON-LD", () => {
    const schemas = buildEventSchemas(homeUpcoming).map(
      (json) => JSON.parse(json) as Record<string, unknown>,
    );
    const schema = schemas.find(
      (s) =>
        (s.offers as { url?: string } | undefined)?.url ===
        `https://garammasaladating.com/events/${FIXTURE_SHOW.slug}`,
    );
    expect(schema).toMatchObject({
      startDate: expect.stringContaining("2099-12-30T19:30"),
      previousStartDate: "2099-12-29",
      location: { name: "Fixture Published Venue" },
      offers: { price: "35" },
    });
  });

  it("redirects the show's new date to its permanent page", () => {
    expect(buildEventRedirects(allEvents)).toHaveProperty(
      "/events/manhattan-2099-12-30",
    );
  });

  it("dates the show's sitemap entry by its own edit, TBA cards by the publish", () => {
    const publishedAt = "2099-02-01T08:00:00.000Z";
    const lastmod = eventLastmodDates(allEvents, publishedAt);
    expect(lastmod[FIXTURE_SHOW.slug]).toBe("2099-01-15");
    // A TBA notify card never carries updatedAt; it falls back to the
    // publish. (Cities with an upcoming show hide their card from allEvents,
    // so take the card straight from the snapshot.)
    const [tba] = comingSoonEvents;
    expect(tba.updatedAt).toBeUndefined();
    expect(eventLastmodDates([tba], publishedAt)).toEqual({
      [tba.slug]: "2099-02-01",
    });
    // Every page astro builds gets a date (no sitemap warning branch).
    expect(Object.keys(lastmod).sort()).toEqual(
      allEvents.map((e) => e.slug).sort(),
    );
  });
});
