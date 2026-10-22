import { describe, it, expect } from "vitest";
import { isUpcomingByIso } from "../src/utils/eventDate";
import {
  isDatedUpcoming,
  getUpcomingDated,
  getSchemaDated,
} from "../src/utils/eventFilters";
import { isDisplayable, computeAllEvents } from "../src/data/events";
import type { EventEntry } from "../src/data/events";

const TODAY = "2026-07-01";

describe("isUpcomingByIso", () => {
  it("returns false for hidden events regardless of date", () => {
    expect(
      isUpcomingByIso({ isoDate: "2026-07-15", hidden: true }, TODAY),
    ).toBe(false);
  });

  it("returns false for canceled events regardless of date", () => {
    expect(
      isUpcomingByIso({ isoDate: "2026-07-15", status: "canceled" }, TODAY),
    ).toBe(false);
  });

  it("returns false for past May 2026 events", () => {
    expect(isUpcomingByIso({ isoDate: "2026-05-03" }, TODAY)).toBe(false);
    expect(isUpcomingByIso({ isoDate: "2026-05-10" }, TODAY)).toBe(false);
    expect(isUpcomingByIso({ isoDate: "2026-05-31" }, TODAY)).toBe(false);
  });

  it("returns false for past June 2026 events", () => {
    expect(isUpcomingByIso({ isoDate: "2026-06-07" }, TODAY)).toBe(false);
    expect(isUpcomingByIso({ isoDate: "2026-06-21" }, TODAY)).toBe(false);
    expect(isUpcomingByIso({ isoDate: "2026-06-25" }, TODAY)).toBe(false);
  });

  it("returns true for July 11 (Edison NJ)", () => {
    expect(isUpcomingByIso({ isoDate: "2026-07-11" }, TODAY)).toBe(true);
  });

  it("returns true for July 12 (Philadelphia)", () => {
    expect(isUpcomingByIso({ isoDate: "2026-07-12" }, TODAY)).toBe(true);
  });

  it("returns true for July 19 (Los Angeles)", () => {
    expect(isUpcomingByIso({ isoDate: "2026-07-19" }, TODAY)).toBe(true);
  });

  it("returns true for July 26 (Manhattan)", () => {
    expect(isUpcomingByIso({ isoDate: "2026-07-26" }, TODAY)).toBe(true);
  });

  it("returns true for August 2026 events", () => {
    expect(isUpcomingByIso({ isoDate: "2026-08-02" }, TODAY)).toBe(true);
    expect(isUpcomingByIso({ isoDate: "2026-08-16" }, TODAY)).toBe(true);
    expect(isUpcomingByIso({ isoDate: "2026-08-30" }, TODAY)).toBe(true);
  });

  it("returns true for TBA events (no isoDate) — shown at bottom of list", () => {
    expect(isUpcomingByIso({}, TODAY)).toBe(true);
    expect(isUpcomingByIso({ isoDate: undefined }, TODAY)).toBe(true);
  });

  it("returns false for TBA if hidden", () => {
    expect(isUpcomingByIso({ hidden: true }, TODAY)).toBe(false);
  });

  it("returns false for the exact date of today (today is not upcoming)", () => {
    expect(isUpcomingByIso({ isoDate: "2026-07-01" }, TODAY)).toBe(true);
  });

  it("uses current date as default when today argument is omitted", () => {
    const futureEvent = { isoDate: "2030-01-01" };
    expect(isUpcomingByIso(futureEvent)).toBe(true);
  });
});

const makeEvent = (overrides: Partial<EventEntry>): EventEntry => ({
  date: "Jul 12",
  city: "Philadelphia",
  state: "Pennsylvania",
  stateAbbr: "PA",
  citySlug: "philadelphia",
  url: "https://www.eventbrite.com/e/123",
  isoDate: "2026-07-12",
  startTime: "19:30",
  endTime: "21:30",
  venue: {
    name: "Next In Line Comedy",
    addressLocality: "Philadelphia",
    addressRegion: "PA",
    addressCountry: "US",
  },
  price: "15",
  ...overrides,
});

describe("isDatedUpcoming", () => {
  it("returns true for a future dated event", () => {
    expect(
      isDatedUpcoming(makeEvent({ isoDate: "2030-01-01" }), "2026-07-01"),
    ).toBe(true);
  });

  it("returns true for today's event", () => {
    expect(
      isDatedUpcoming(makeEvent({ isoDate: "2026-07-01" }), "2026-07-01"),
    ).toBe(true);
  });

  it("returns false for a past dated event", () => {
    expect(
      isDatedUpcoming(makeEvent({ isoDate: "2026-05-03" }), "2026-07-01"),
    ).toBe(false);
  });

  it("returns false for a hidden event", () => {
    expect(isDatedUpcoming(makeEvent({ hidden: true }), "2026-07-01")).toBe(
      false,
    );
  });

  it("returns false for a canceled event", () => {
    expect(
      isDatedUpcoming(makeEvent({ status: "canceled" }), "2026-07-01"),
    ).toBe(false);
  });

  it("returns false for an event with no isoDate (TBA)", () => {
    expect(
      isDatedUpcoming(makeEvent({ isoDate: undefined }), "2026-07-01"),
    ).toBe(false);
  });
});

describe("getUpcomingDated", () => {
  const FIXED_TODAY = "2026-07-01";

  it("excludes past events", () => {
    const events = [makeEvent({ isoDate: "2026-05-03" })];
    expect(getUpcomingDated(events, FIXED_TODAY)).toHaveLength(0);
  });

  it("includes today's event", () => {
    const events = [makeEvent({ isoDate: FIXED_TODAY })];
    expect(getUpcomingDated(events, FIXED_TODAY)).toHaveLength(1);
  });

  it("includes future events", () => {
    const events = [makeEvent({ isoDate: "2030-01-01" })];
    expect(getUpcomingDated(events, FIXED_TODAY)).toHaveLength(1);
  });

  it("excludes hidden events", () => {
    const events = [makeEvent({ hidden: true })];
    expect(getUpcomingDated(events, FIXED_TODAY)).toHaveLength(0);
  });

  it("excludes TBA events (no isoDate)", () => {
    const events = [makeEvent({ isoDate: undefined })];
    expect(getUpcomingDated(events, FIXED_TODAY)).toHaveLength(0);
  });

  it("sorts ascending by isoDate", () => {
    const events = [
      makeEvent({ isoDate: "2026-08-30" }),
      makeEvent({ isoDate: "2026-07-12" }),
      makeEvent({ isoDate: "2026-07-19" }),
    ];
    const result = getUpcomingDated(events, FIXED_TODAY);
    expect(result.map((e) => e.isoDate)).toEqual([
      "2026-07-12",
      "2026-07-19",
      "2026-08-30",
    ]);
  });

  it("returns only dated events even when TBA entries are in the input", () => {
    const events = [
      makeEvent({ isoDate: "2026-07-12" }),
      makeEvent({ isoDate: undefined, date: "TBA", url: "" }),
    ];
    const result = getUpcomingDated(events, FIXED_TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].isoDate).toBe("2026-07-12");
  });

  it("excludes canceled events", () => {
    const events = [
      makeEvent({ isoDate: "2026-07-12", status: "canceled" }),
      makeEvent({ isoDate: "2026-07-19" }),
    ];
    const result = getUpcomingDated(events, FIXED_TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].isoDate).toBe("2026-07-19");
  });
});

describe("isDisplayable", () => {
  it("is true for a plain event", () => {
    expect(isDisplayable(makeEvent({}))).toBe(true);
  });

  it("is false for hidden events", () => {
    expect(isDisplayable(makeEvent({ hidden: true }))).toBe(false);
  });

  it("is false for canceled events", () => {
    expect(isDisplayable(makeEvent({ status: "canceled" }))).toBe(false);
  });
});

describe("getSchemaDated", () => {
  const FIXED_TODAY = "2026-07-01";

  it("excludes canceled, hidden, past and undated events", () => {
    const events = [
      makeEvent({ isoDate: "2026-07-12" }),
      makeEvent({ isoDate: "2026-07-13", status: "canceled" }),
      makeEvent({ isoDate: "2026-07-14", hidden: true }),
      makeEvent({ isoDate: "2026-05-01" }),
      makeEvent({ isoDate: undefined, date: "TBA", url: "" }),
    ];
    const result = getSchemaDated(events, FIXED_TODAY);
    expect(result.map((e) => e.isoDate)).toEqual(["2026-07-12"]);
  });
});

describe("computeAllEvents TBA suppression", () => {
  const FIXED_TODAY = "2026-07-01";
  const tbaManhattan = makeEvent({
    date: "TBA",
    city: "Manhattan",
    citySlug: "manhattan",
    isoDate: undefined,
    url: "",
  });

  it("suppresses a city's TBA card while it has an upcoming show", () => {
    const confirmed = makeEvent({
      citySlug: "manhattan",
      isoDate: "2026-07-20",
    });
    const all = computeAllEvents([confirmed], [tbaManhattan], FIXED_TODAY);
    expect(all).toHaveLength(1);
    expect(all[0].isoDate).toBe("2026-07-20");
  });

  it("does NOT let a canceled show suppress its city's TBA card", () => {
    const canceled = makeEvent({
      citySlug: "manhattan",
      isoDate: "2026-07-20",
      status: "canceled",
    });
    const all = computeAllEvents([canceled], [tbaManhattan], FIXED_TODAY);
    expect(all).toHaveLength(2);
    expect(all[1].date).toBe("TBA");
  });

  it("does not let a past show suppress its city's TBA card", () => {
    const past = makeEvent({ citySlug: "manhattan", isoDate: "2026-05-01" });
    const all = computeAllEvents([past], [tbaManhattan], FIXED_TODAY);
    expect(all).toHaveLength(2);
  });
});
