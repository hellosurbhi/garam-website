import { describe, it, expect, afterEach, vi } from "vitest";
import { isEventPast, msUntilMidnight } from "../src/utils/eventDate";

describe("isEventPast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for 'TBA'", () => {
    expect(isEventPast("TBA")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEventPast("")).toBe(false);
  });

  it("returns false for string with wrong number of parts", () => {
    expect(isEventPast("Jan")).toBe(false);
    expect(isEventPast("Jan 1 2026")).toBe(false);
  });

  it("returns false for invalid month abbreviation", () => {
    expect(isEventPast("Janu 15")).toBe(false);
    expect(isEventPast("January 15")).toBe(false);
  });

  it("returns false for non-numeric day", () => {
    expect(isEventPast("Jan abc")).toBe(false);
  });

  it("returns false for day out of range (year parsed as day)", () => {
    expect(isEventPast("Dec 2026")).toBe(false);
  });

  it("returns false for day zero", () => {
    expect(isEventPast("Jan 0")).toBe(false);
  });

  it("returns false for day exceeding 31", () => {
    expect(isEventPast("Feb 32")).toBe(false);
  });

  it("returns true for a date clearly in the past (yesterday)", () => {
    // Fix time to 2026-06-15 noon
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    // "Jun 14" is yesterday
    expect(isEventPast("Jun 14")).toBe(true);
  });

  it("returns false for today (event is not yet past)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    expect(isEventPast("Jun 15")).toBe(false);
  });

  it("returns false for tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    expect(isEventPast("Jun 16")).toBe(false);
  });

  it("returns true for first day of same month when current date is later", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    expect(isEventPast("Jun 1")).toBe(true);
  });

  it("returns false for last day of same month when current date is earlier", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    expect(isEventPast("Jun 30")).toBe(false);
  });

  it("handles Dec->Jan wrap-around: Jan event in December uses previous year logic", () => {
    // On Dec 15, "Jan 5" is ~21 days ago or ~350 days in future
    // 350 days > 6 months → assumes previous year → it's in the past
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-15T12:00:00"));
    expect(isEventPast("Jan 5")).toBe(true);
  });

  it("handles Jan->Dec wrap-around: Dec event in January is not past (within 6 months in past)", () => {
    // On Jan 15, "Dec 25" was 21 days ago - within 6 months, should be past
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00"));
    // Dec 25 in current year (2026) would be ~11 months in future → > 6 months → assumes 2025 → past
    expect(isEventPast("Dec 25")).toBe(true);
  });

  it("does not assign previous year if event is exactly on today's date boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T00:00:00"));
    // "Mar 7" should not be past (eventDate === today, and today is not < today)
    expect(isEventPast("Mar 7")).toBe(false);
  });

  it("correctly identifies a future event within 6 months as upcoming", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00"));
    // "Apr 15" is ~3.5 months away, well within 6 months → current year → not past
    expect(isEventPast("Apr 15")).toBe(false);
  });

  it("accepts all 12 valid month abbreviations", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00"));
    // All months in the first half of year should be past when current date is July
    expect(isEventPast("Jan 1")).toBe(true);
    expect(isEventPast("Feb 1")).toBe(true);
    expect(isEventPast("Mar 1")).toBe(true);
    expect(isEventPast("Apr 1")).toBe(true);
    expect(isEventPast("May 1")).toBe(true);
    expect(isEventPast("Jun 1")).toBe(true);
    // July 14 is in the past, Jul 16 is in the future
    expect(isEventPast("Jul 14")).toBe(true);
    expect(isEventPast("Jul 16")).toBe(false);
    // Months in the second half should be upcoming
    expect(isEventPast("Aug 1")).toBe(false);
    expect(isEventPast("Sep 1")).toBe(false);
    expect(isEventPast("Oct 1")).toBe(false);
    expect(isEventPast("Nov 1")).toBe(false);
    expect(isEventPast("Dec 1")).toBe(false);
  });

  it("handles extra whitespace in input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    expect(isEventPast("  Jun 14  ")).toBe(true);
  });
});

describe("msUntilMidnight", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a positive number", () => {
    expect(msUntilMidnight()).toBeGreaterThan(0);
  });

  it("returns at most 86400000 ms (one full day)", () => {
    expect(msUntilMidnight()).toBeLessThanOrEqual(86400000);
  });

  it("returns close to 86400000 ms just after midnight", () => {
    vi.useFakeTimers();
    // 1 second after midnight
    vi.setSystemTime(new Date("2026-06-15T00:00:01"));
    const ms = msUntilMidnight();
    // Should be approximately 86399 seconds
    expect(ms).toBeCloseTo(86399000, -3); // within 1000ms
  });

  it("returns close to 0 ms just before midnight", () => {
    vi.useFakeTimers();
    // 1 second before midnight
    vi.setSystemTime(new Date("2026-06-15T23:59:59"));
    const ms = msUntilMidnight();
    // Should be approximately 1 second
    expect(ms).toBeCloseTo(1000, -3); // within 1000ms
  });

  it("returns exactly 43200000 ms at noon", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000"));
    const ms = msUntilMidnight();
    expect(ms).toBe(43200000); // exactly 12 hours
  });
});