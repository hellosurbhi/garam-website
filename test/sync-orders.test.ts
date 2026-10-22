import { describe, expect, it } from "vitest";
import type { EventEntry } from "@/data/events";
import { DEFAULT_LINEUP } from "@/data/lineup";
import { orderSyncableEvents, SYNC_WINDOW_DAYS } from "@/pages/api/sync-orders";

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Dec 31",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: "manhattan-2099-12-31",
    description: "Test show",
    lineup: DEFAULT_LINEUP,
    ticketSource: "our-eventbrite",
    url: "https://www.eventbrite.com/e/test-show-tickets-123",
    isoDate: "2099-12-31",
    ...overrides,
  };
}

describe("orderSyncableEvents", () => {
  it("keeps only shows on our own Eventbrite account that have a listing ID", () => {
    const ours = makeEvent({ eventbriteId: "111" });
    const oursWithoutId = makeEvent({ eventbriteId: undefined });

    expect(orderSyncableEvents([ours, oursWithoutId])).toEqual([ours]);
  });

  it("excludes their-eventbrite listings even when they carry a real public ID", () => {
    // The Los Angeles case: a promoter-run listing has a public eventbriteId,
    // but our access token has no orders permission on it.
    const theirs = makeEvent({
      ticketSource: "their-eventbrite",
      eventbriteId: "222",
    });

    expect(orderSyncableEvents([theirs])).toEqual([]);
  });

  it("excludes other-platform and none ticket sources", () => {
    const otherPlatform = makeEvent({
      ticketSource: "other-platform",
      eventbriteId: "333",
    });
    const tba = makeEvent({ ticketSource: "none", url: "" });

    expect(orderSyncableEvents([otherPlatform, tba])).toEqual([]);
  });

  describe("trailing window", () => {
    const now = new Date("2026-08-28T12:00:00Z");

    it("keeps a show inside the window and drops one past it", () => {
      const recent = makeEvent({ eventbriteId: "1", isoDate: "2026-08-26" });
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - (SYNC_WINDOW_DAYS + 1));
      const tooOld = makeEvent({
        eventbriteId: "2",
        isoDate: cutoff.toISOString().slice(0, 10),
      });
      expect(orderSyncableEvents([recent, tooOld], now)).toEqual([recent]);
    });

    it("keeps a TBA show with no isoDate regardless of age", () => {
      const tba = makeEvent({ eventbriteId: "3", isoDate: undefined });
      expect(orderSyncableEvents([tba], now)).toEqual([tba]);
    });

    it("computes the cutoff in the event's own timezone, not UTC", () => {
      // 2026-08-28T01:00:00Z is 2026-08-27 9pm in America/New_York. A naive
      // UTC cutoff lands on 2026-08-25 and would wrongly drop a show dated
      // 2026-08-24, which is only three local days ago.
      const eveningUtc = new Date("2026-08-28T01:00:00Z");
      const stillWithin = makeEvent({
        eventbriteId: "4",
        isoDate: "2026-08-24",
      });
      expect(orderSyncableEvents([stillWithin], eveningUtc)).toEqual([
        stillWithin,
      ]);
    });
  });
});
