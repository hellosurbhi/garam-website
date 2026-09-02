import { describe, expect, it } from "vitest";
import type { EventEntry } from "@/data/events";
import { DEFAULT_LINEUP } from "@/data/lineup";
import { orderSyncableEvents } from "@/pages/api/sync-orders";

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
});
