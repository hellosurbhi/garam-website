import { describe, it, expect } from "vitest";
import { isUpcomingEvent } from "./cityEvents";
import type { EventEntry } from "@/data/events";

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Aug 30",
    city: "Washington, DC",
    citySlug: "washington-dc",
    url: "https://www.dccomedyloft.com/shows/378527",
    isoDate: "2026-08-30",
    price: "20",
    ...overrides,
  } as EventEntry;
}

const TODAY = "2026-08-30";

describe("isUpcomingEvent date boundary (drives the CTA state machine)", () => {
  it("includes an event dated today", () => {
    expect(isUpcomingEvent(makeEvent({ isoDate: "2026-08-30" }), TODAY)).toBe(
      true,
    );
  });

  it("includes an event dated tomorrow", () => {
    expect(isUpcomingEvent(makeEvent({ isoDate: "2026-08-31" }), TODAY)).toBe(
      true,
    );
  });

  it("excludes an event dated yesterday (page reverts to no-event state)", () => {
    expect(isUpcomingEvent(makeEvent({ isoDate: "2026-08-29" }), TODAY)).toBe(
      false,
    );
  });

  it("excludes hidden events", () => {
    expect(isUpcomingEvent(makeEvent({ hidden: true }), TODAY)).toBe(false);
  });

  it("excludes events without an isoDate", () => {
    expect(isUpcomingEvent(makeEvent({ isoDate: undefined }), TODAY)).toBe(
      false,
    );
  });

  it("excludes placeholder and empty ticket URLs", () => {
    expect(isUpcomingEvent(makeEvent({ url: "#" }), TODAY)).toBe(false);
    expect(isUpcomingEvent(makeEvent({ url: "" }), TODAY)).toBe(false);
  });

  it("excludes events without a city slug", () => {
    expect(isUpcomingEvent(makeEvent({ citySlug: undefined }), TODAY)).toBe(
      false,
    );
  });

  it("accepts a non-Eventbrite vendor URL (State B still counts as upcoming)", () => {
    expect(
      isUpcomingEvent(
        makeEvent({ url: "https://www.dccomedyloft.com/shows/378527" }),
        TODAY,
      ),
    ).toBe(true);
  });
});
