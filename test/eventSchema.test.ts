import { describe, it, expect } from "vitest";
import { buildEventSchemas } from "../src/utils/eventSchema";
import { events } from "../src/data/events";
import type { EventEntry } from "../src/data/events";

const BASE_VENUE = {
  name: "Top Secret Comedy Club",
  streetAddress: "44 Avenue A",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10009",
  addressCountry: "US",
};

const VALID_EVENT: EventEntry = {
  date: "Jul 26",
  city: "Manhattan",
  state: "New York",
  stateAbbr: "NY",
  citySlug: "manhattan",
  url: "https://www.eventbrite.com/e/123",
  isoDate: "2026-07-26",
  startTime: "20:00",
  endTime: "22:00",
  venue: BASE_VENUE,
  price: "25",
};

describe("buildEventSchemas", () => {
  it("returns an empty array for a TBA event (no isoDate)", () => {
    const tba: EventEntry = { ...VALID_EVENT, isoDate: undefined };
    expect(buildEventSchemas([tba])).toHaveLength(0);
  });

  it("returns an empty array for a hidden event", () => {
    const hidden: EventEntry = { ...VALID_EVENT, hidden: true };
    expect(buildEventSchemas([hidden])).toHaveLength(0);
  });

  it("returns an empty array when url is empty", () => {
    const noUrl: EventEntry = { ...VALID_EVENT, url: "" };
    expect(buildEventSchemas([noUrl])).toHaveLength(0);
  });

  it("returns an empty array when url is '#'", () => {
    const hashUrl: EventEntry = { ...VALID_EVENT, url: "#" };
    expect(buildEventSchemas([hashUrl])).toHaveLength(0);
  });

  it("returns an empty array when venue is missing", () => {
    const noVenue: EventEntry = { ...VALID_EVENT, venue: undefined };
    expect(buildEventSchemas([noVenue])).toHaveLength(0);
  });

  it("returns one schema string per valid event", () => {
    const result = buildEventSchemas([VALID_EVENT]);
    expect(result).toHaveLength(1);
  });

  it("returns valid JSON for each event", () => {
    const result = buildEventSchemas([VALID_EVENT]);
    expect(() => JSON.parse(result[0])).not.toThrow();
  });

  it("emits @type ComedyEvent", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema["@type"]).toBe("ComedyEvent");
  });

  it("startDate includes ISO date with NY timezone offset", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.startDate).toMatch(/^2026-07-26T20:00:00[+-]\d{2}:\d{2}$/);
  });

  it("endDate is present and later than startDate", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.endDate).toMatch(/^2026-07-26T22:00:00[+-]\d{2}:\d{2}$/);
    expect(schema.endDate > schema.startDate).toBe(true);
  });

  it("offers.availability is InStock for a normal event", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.offers.availability).toBe("https://schema.org/InStock");
  });

  it("offers.availability is SoldOut when soldOut is true", () => {
    const soldOut: EventEntry = { ...VALID_EVENT, soldOut: true };
    const schema = JSON.parse(buildEventSchemas([soldOut])[0]);
    expect(schema.offers.availability).toBe("https://schema.org/SoldOut");
  });

  it("includes offers.validFrom when onSaleAt is set", () => {
    const presale: EventEntry = {
      ...VALID_EVENT,
      onSaleAt: "2026-06-01T12:00:00Z",
    };
    const schema = JSON.parse(buildEventSchemas([presale])[0]);
    expect(schema.offers.validFrom).toBe("2026-06-01T12:00:00Z");
  });

  it("does not include offers.validFrom when onSaleAt is not set", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.offers.validFrom).toBeUndefined();
  });

  it("location.address includes locality, region, country", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.location.address.addressLocality).toBe("New York");
    expect(schema.location.address.addressRegion).toBe("NY");
    expect(schema.location.address.addressCountry).toBe("US");
  });

  it("includes organizer with name and url", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.organizer["@type"]).toBe("Organization");
    expect(schema.organizer.name).toBe("Garam Masala Dating");
    expect(schema.organizer.url).toBe("https://garammasaladating.com");
  });

  it("includes two performers", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.performer).toHaveLength(2);
    expect(schema.performer[0]["@type"]).toBe("Person");
  });

  it("includes eventStatus EventScheduled", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.eventStatus).toBe("https://schema.org/EventScheduled");
  });

  it("includes eventAttendanceMode OfflineEventAttendanceMode", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.eventAttendanceMode).toBe(
      "https://schema.org/OfflineEventAttendanceMode",
    );
  });

  it("includes superEvent reference to EventSeries", () => {
    const schema = JSON.parse(buildEventSchemas([VALID_EVENT])[0]);
    expect(schema.superEvent["@type"]).toBe("EventSeries");
    expect(schema.superEvent["@id"]).toBe(
      "https://garammasaladating.com/#event-series",
    );
  });

  it("handles multiple events and filters out invalid ones", () => {
    const events: EventEntry[] = [
      VALID_EVENT,
      { ...VALID_EVENT, isoDate: undefined },
      { ...VALID_EVENT, hidden: true },
      { ...VALID_EVENT, url: "" },
    ];
    expect(buildEventSchemas(events)).toHaveLength(1);
  });

  it("throws at build time when a valid event is missing price", () => {
    const noPrice: EventEntry = { ...VALID_EVENT, price: undefined };
    expect(() => buildEventSchemas([noPrice])).toThrow(/missing price/);
  });

  it("throws at build time when a valid event is missing startTime", () => {
    const noStart: EventEntry = { ...VALID_EVENT, startTime: undefined };
    expect(() => buildEventSchemas([noStart])).toThrow(/missing startTime/);
  });

  it("throws at build time when a valid event is missing endTime", () => {
    const noEnd: EventEntry = { ...VALID_EVENT, endTime: undefined };
    expect(() => buildEventSchemas([noEnd])).toThrow(/missing endTime/);
  });

  it("emits schema for all real upcoming events without missing startDate", () => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events.filter(
      (e) =>
        !e.hidden &&
        e.isoDate &&
        e.isoDate >= today &&
        e.venue &&
        e.url &&
        e.url !== "#",
    );
    const schemas = buildEventSchemas(upcoming);
    for (const raw of schemas) {
      const schema = JSON.parse(raw);
      expect(schema.startDate).toBeTruthy();
      expect(schema.startDate).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      );
    }
  });
});
