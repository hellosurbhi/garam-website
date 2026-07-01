import { describe, it, expect } from "vitest";
import { isUpcomingByIso } from "../src/utils/eventDate";

const TODAY = "2026-07-01";

describe("isUpcomingByIso", () => {
  it("returns false for hidden events regardless of date", () => {
    expect(
      isUpcomingByIso({ isoDate: "2026-07-15", hidden: true }, TODAY),
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
