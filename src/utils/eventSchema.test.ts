import { describe, it, expect, vi } from "vitest";
import type { EventEntry, EventVenue } from "@/data/events";

vi.mock("@/utils/timezone", () => ({
  nyOffset: vi.fn(() => "-04:00"),
}));

import { buildEventSchemas } from "./eventSchema";

const TEST_VENUE: EventVenue = {
  name: "Top Secret Comedy Club",
  streetAddress: "44 Avenue A",
  addressLocality: "New York",
  addressRegion: "NY",
  postalCode: "10009",
  addressCountry: "US",
};

const TEST_VENUE_MINIMAL: EventVenue = {
  name: "The Venue",
  addressLocality: "New York",
  addressRegion: "NY",
  addressCountry: "US",
};

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "May 10",
    city: "Manhattan",
    url: "https://eventbrite.com/e/123",
    isoDate: "2026-05-10",
    venue: TEST_VENUE,
    ...overrides,
  };
}

describe("buildEventSchemas", () => {
  it("returns an array of JSON strings for valid events", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    expect(schemas).toHaveLength(1);
    expect(() => JSON.parse(schemas[0])).not.toThrow();
  });

  it("returns empty array for empty event list", () => {
    expect(buildEventSchemas([])).toEqual([]);
  });

  it("filters out hidden events", () => {
    const events = [makeEvent({ hidden: true }), makeEvent({ hidden: false })];
    const schemas = buildEventSchemas(events);
    expect(schemas).toHaveLength(1);
  });

  it("filters out events without isoDate", () => {
    const events = [makeEvent({ isoDate: undefined })];
    expect(buildEventSchemas(events)).toEqual([]);
  });

  it("filters out events without venue", () => {
    const events = [makeEvent({ venue: undefined })];
    expect(buildEventSchemas(events)).toEqual([]);
  });

  it("uses default startTime 20:00 when not specified", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.startDate).toContain("T20:00:00");
  });

  it("uses default endTime 22:00 when not specified", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.endDate).toContain("T22:00:00");
  });

  it("uses custom startTime when specified", () => {
    const schemas = buildEventSchemas([makeEvent({ startTime: "19:30" })]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.startDate).toContain("T19:30:00");
  });

  it("uses custom endTime when specified", () => {
    const schemas = buildEventSchemas([makeEvent({ endTime: "23:00" })]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.endDate).toContain("T23:00:00");
  });

  it("includes streetAddress in address when venue has it", () => {
    const schemas = buildEventSchemas([makeEvent({ venue: TEST_VENUE })]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.location.address.streetAddress).toBe("44 Avenue A");
  });

  it("omits streetAddress when venue lacks it", () => {
    const schemas = buildEventSchemas([
      makeEvent({ venue: TEST_VENUE_MINIMAL }),
    ]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.location.address).not.toHaveProperty("streetAddress");
  });

  it("includes postalCode in address when venue has it", () => {
    const schemas = buildEventSchemas([makeEvent({ venue: TEST_VENUE })]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.location.address.postalCode).toBe("10009");
  });

  it("omits postalCode when venue lacks it", () => {
    const schemas = buildEventSchemas([
      makeEvent({ venue: TEST_VENUE_MINIMAL }),
    ]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.location.address).not.toHaveProperty("postalCode");
  });

  it("uses default price '15' when not specified", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.offers.price).toBe("15");
  });

  it("uses custom price when specified", () => {
    const schemas = buildEventSchemas([makeEvent({ price: "25" })]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.offers.price).toBe("25");
  });

  it("includes correct JSON-LD @type and @context", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Event");
  });

  it("includes venue name in location", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.location.name).toBe("Top Secret Comedy Club");
  });

  it("includes event URL in offers", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.offers.url).toBe("https://eventbrite.com/e/123");
  });

  it("appends NY timezone offset to start and end dates", () => {
    const schemas = buildEventSchemas([makeEvent()]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.startDate).toContain("-04:00");
    expect(parsed.endDate).toContain("-04:00");
  });

  it("returns 0 schemas for a list of only hidden events", () => {
    const events = [makeEvent({ hidden: true })];
    expect(buildEventSchemas(events)).toHaveLength(0);
  });

  it("startDate and endDate contain different times when custom", () => {
    const schemas = buildEventSchemas([
      makeEvent({ startTime: "19:00", endTime: "23:00" }),
    ]);
    const parsed = JSON.parse(schemas[0]);
    expect(parsed.startDate).toContain("T19:00:00");
    expect(parsed.endDate).toContain("T23:00:00");
    expect(parsed.startDate).not.toContain("T23:00:00");
  });

  it("address always includes required fields", () => {
    const schemas = buildEventSchemas([
      makeEvent({ venue: TEST_VENUE_MINIMAL }),
    ]);
    const parsed = JSON.parse(schemas[0]);
    const addr = parsed.location.address;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.addressLocality).toBe("New York");
    expect(addr.addressRegion).toBe("NY");
    expect(addr.addressCountry).toBe("US");
  });

  it("filters event without isoDate even when not hidden", () => {
    const events = [makeEvent({ hidden: false, isoDate: undefined })];
    expect(buildEventSchemas(events)).toHaveLength(0);
  });
});
