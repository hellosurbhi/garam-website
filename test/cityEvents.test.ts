import { describe, it, expect } from "vitest";
import {
  isUpcomingEvent,
  citySlugsWithUpcomingEvents,
} from "../src/utils/cityEvents";
import type { EventEntry } from "../src/data/events";

const TODAY = "2026-07-13";

const baseEvent: EventEntry = {
  date: "Aug 28",
  city: "Philadelphia",
  state: "Pennsylvania",
  stateAbbr: "PA",
  citySlug: "philadelphia",
  url: "https://www.eventbrite.com/e/example",
  isoDate: "2026-08-28",
};

describe("isUpcomingEvent", () => {
  it("returns true for a future dated event with a real url and city slug", () => {
    expect(isUpcomingEvent(baseEvent, TODAY)).toBe(true);
  });

  it("returns false once the event date has passed", () => {
    expect(
      isUpcomingEvent({ ...baseEvent, isoDate: "2026-05-03" }, TODAY),
    ).toBe(false);
  });

  it("returns false for hidden events", () => {
    expect(isUpcomingEvent({ ...baseEvent, hidden: true }, TODAY)).toBe(false);
  });

  it("returns false without a real ticket url", () => {
    expect(isUpcomingEvent({ ...baseEvent, url: "#" }, TODAY)).toBe(false);
    expect(isUpcomingEvent({ ...baseEvent, url: "" }, TODAY)).toBe(false);
  });

  it("returns false without a city slug", () => {
    expect(isUpcomingEvent({ ...baseEvent, citySlug: undefined }, TODAY)).toBe(
      false,
    );
  });
});

describe("citySlugsWithUpcomingEvents", () => {
  const fixture: EventEntry[] = [
    { ...baseEvent },
    {
      ...baseEvent,
      city: "Washington",
      citySlug: "washington-dc",
      isoDate: "2026-08-30",
    },
    {
      ...baseEvent,
      city: "Jersey City",
      citySlug: "jersey-city",
      isoDate: "2026-05-03",
    },
    {
      ...baseEvent,
      city: "Los Angeles",
      citySlug: "los-angeles",
      isoDate: "2026-07-19",
    },
    {
      ...baseEvent,
      city: "Manhattan",
      citySlug: "manhattan",
      isoDate: "2026-07-26",
    },
    {
      ...baseEvent,
      city: "Manhattan",
      citySlug: "manhattan",
      isoDate: "2026-08-16",
    },
    {
      ...baseEvent,
      city: "Chicago",
      citySlug: "chicago",
      isoDate: "2026-08-01",
      hidden: true,
    },
  ];

  it("orders cities by soonest upcoming show, once each", () => {
    expect(citySlugsWithUpcomingEvents(TODAY, fixture)).toEqual([
      "los-angeles",
      "manhattan",
      "philadelphia",
      "washington-dc",
    ]);
  });

  it("drops cities whose only shows have passed", () => {
    expect(citySlugsWithUpcomingEvents(TODAY, fixture)).not.toContain(
      "jersey-city",
    );
  });

  it("drops hidden events", () => {
    expect(citySlugsWithUpcomingEvents(TODAY, fixture)).not.toContain(
      "chicago",
    );
  });

  it("returns an empty list when everything has passed", () => {
    expect(citySlugsWithUpcomingEvents("2027-01-01", fixture)).toEqual([]);
  });
});
