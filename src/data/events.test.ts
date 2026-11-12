import { describe, expect, it } from "vitest";
import {
  allEvents,
  comingSoonEvents,
  computeAllEvents,
  events,
  isDisplayable,
} from "./events";
import { buildEventSchemas } from "@/utils/eventSchema";
import { buildEventRedirects } from "@/utils/eventRedirects";
import { formatEventLocation } from "@/utils/eventCity";

describe("event location data", () => {
  it("keeps city, full state, and state abbreviation split explicitly", () => {
    for (const event of allEvents) {
      expect(event.city).not.toContain(",");
      expect(event.state).toMatch(/^[A-Za-z ]+$/);
      expect(event.state.length).toBeGreaterThan(2);
      expect(event.stateAbbr).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("renders known public event labels with abbreviated state names", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).toContain("Manhattan, NY");
    expect(labels).toContain("Jersey City, NJ");
    expect(labels).toContain("San Francisco, CA");
    expect(labels).toContain("San Diego, CA");
    expect(labels).toContain("Los Angeles, CA");
    expect(labels).toContain("Washington, DC");
  });

  it("does not duplicate state abbreviations in formatted labels", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).not.toContain("Manhattan, NY, NY");
    expect(labels).not.toContain("San Francisco, CA, CA");
  });
});

describe("dated email-capture placeholders", () => {
  const placeholders = ["2026-12-04", "2026-12-24"];

  it("retains withdrawn Chicago and San Diego dates without displaying them", () => {
    for (const isoDate of placeholders) {
      const event = events.find((e) => e.isoDate === isoDate);
      expect(event, isoDate).toBeDefined();
      expect(isDisplayable(event!)).toBe(false);
      expect(event!.status).toBe("canceled");
      expect(event!.url).toBe("");
      expect(event!.ticketSource).toBe("none");
    }
  });

  it("suppresses the generic TBA card for a city with a dated placeholder", () => {
    const merged = computeAllEvents(events, comingSoonEvents, "2026-10-22");
    for (const slug of ["los-angeles", "san-francisco", "manhattan"]) {
      expect(
        merged.some((e) => e.citySlug === slug && e.date === "TBA"),
        slug,
      ).toBe(false);
    }
  });

  it("lists the San Francisco Dec 26 show as a live 6 PM Eventbrite sale", () => {
    const sf = events.find((e) => e.isoDate === "2026-12-26");
    expect(sf?.url).toContain("eventbrite.com");
    expect(sf?.startTime).toBe("18:00");
    expect(sf?.endTime).toBe("20:00");
  });
});

// Withdrawals must apply to every event-list consumer, not just tickets.
describe("withdrawn Texas placeholders", () => {
  it.each([
    "austin-2026-11-19",
    "houston-2026-11-20",
    "san-antonio-2026-11-21",
    "dallas-2026-11-22",
  ])("keeps %s in history but not displayable", (slug) => {
    const event = events.find((event) => event.slug === slug)!;
    expect(event.status).toBe("canceled");
    expect(isDisplayable(event)).toBe(false);
  });
});

describe("December California ticket sales", () => {
  it.each([
    [
      "los-angeles",
      "2026-12-27",
      "2026-11-13",
      "19:30",
      "21:30",
      "their-eventbrite",
      "2004696892370",
    ],
    [
      "san-francisco",
      "2026-12-26",
      "2026-11-14",
      "18:00",
      "20:00",
      "our-eventbrite",
      "2003672498380",
    ],
  ])(
    "keeps %s tickets, Pacific times and historical URLs consistent",
    (city, date, originalDate, start, end, source, id) => {
      const event = events.find(
        (e) => e.citySlug === city && e.isoDate === date,
      )!;
      expect(event.ticketSource).toBe(source);
      expect(event.eventbriteId).toBe(id);
      expect(new URL(event.url!).pathname).toMatch(
        new RegExp(`tickets-${id}$`),
      );
      expect(event.slug).toBe(`${city}-${originalDate}`);
      expect(event.previousDate).toBe(originalDate);
      expect(event.timezone).toBe("America/Los_Angeles");
      expect(event.onSaleAt).toBeUndefined();
      expect(event.tagline).toBeUndefined();
      const schema = JSON.parse(buildEventSchemas([event])[0]);
      expect(schema.startDate).toBe(`${date}T${start}:00-08:00`);
      expect(schema.endDate).toBe(`${date}T${end}:00-08:00`);
      expect(schema.offers.availability).toBe("https://schema.org/InStock");
      const redirects = buildEventRedirects([event]);
      for (const prefix of ["/events/", "/api/go/"]) {
        expect(redirects[`${prefix}${city}-${date}`]).toEqual({
          destination: `${prefix}${event.slug}`,
          status: 308,
        });
      }
      const merged = computeAllEvents(events, comingSoonEvents, "2026-11-11");
      expect(
        merged.filter((e) => e.citySlug === city && e.date === "TBA"),
      ).toHaveLength(0);
    },
  );
});
