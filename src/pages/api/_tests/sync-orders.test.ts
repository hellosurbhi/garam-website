import { describe, it, expect } from "vitest";
import { getSyncableEvents, SYNC_WINDOW_DAYS } from "../sync-orders";
import type { EventEntry } from "@/data/events";

function makeEvent(overrides: Partial<EventEntry>): EventEntry {
  return {
    date: "January 1, 2026",
    city: "Test City",
    state: "Test State",
    stateAbbr: "TS",
    slug: "test-city",
    description: "Test show",
    lineup: [],
    ticketSource: "eventbrite-owned",
    url: "https://example.com",
    ...overrides,
  };
}

describe("getSyncableEvents", () => {
  const now = new Date("2026-08-28T12:00:00Z");

  it("includes an eventbrite-owned event within the trailing window", () => {
    const upcoming = makeEvent({
      slug: "upcoming",
      isoDate: "2026-08-30",
      eventbriteId: "123",
    });
    expect(getSyncableEvents([upcoming], now)).toEqual([upcoming]);
  });

  it("excludes events more than SYNC_WINDOW_DAYS past their show date, regardless of ticketSource", () => {
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - (SYNC_WINDOW_DAYS + 1));
    const tooOld = makeEvent({
      slug: "too-old",
      isoDate: cutoff.toISOString().slice(0, 10),
      eventbriteId: "456",
    });
    expect(getSyncableEvents([tooOld], now)).toEqual([]);
  });

  it("excludes events with ticketSource external even if recent", () => {
    const external = makeEvent({
      slug: "external",
      isoDate: "2026-08-30",
      eventbriteId: "789",
      ticketSource: "external",
    });
    expect(getSyncableEvents([external], now)).toEqual([]);
  });

  it("excludes events with no eventbriteId", () => {
    const noId = makeEvent({
      slug: "no-id",
      isoDate: "2026-08-30",
    });
    expect(getSyncableEvents([noId], now)).toEqual([]);
  });

  it("includes a TBA event with no isoDate regardless of age", () => {
    const tba = makeEvent({
      slug: "tba",
      eventbriteId: "999",
    });
    expect(getSyncableEvents([tba], now)).toEqual([tba]);
  });

  it("uses the event's local timezone for the cutoff, not UTC", () => {
    // 2026-08-28T01:00:00Z is 2026-08-27 9pm in America/New_York (EDT). A
    // naive UTC cutoff lands on 2026-08-25, wrongly excluding a show still
    // dated 2026-08-24 in the event's own timezone (only 3 days ago there).
    const eveningUtc = new Date("2026-08-28T01:00:00Z");
    const stillWithinLocalWindow = makeEvent({
      slug: "still-within-local-window",
      isoDate: "2026-08-24",
      eventbriteId: "321",
    });
    expect(getSyncableEvents([stillWithinLocalWindow], eveningUtc)).toEqual([
      stillWithinLocalWindow,
    ]);
  });
});
