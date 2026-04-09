import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEventPast, msUntilMidnight } from "./eventDate";

describe("isEventPast", () => {
  beforeEach(() => {
    // Fix time to April 8, 2026 at noon
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 8, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Invalid format tests
  it("returns false for 'TBA' (wrong number of parts)", () => {
    expect(isEventPast("TBA")).toBe(false);
  });

  it("returns false for single part string", () => {
    expect(isEventPast("Feb")).toBe(false);
  });

  it("returns false for three part string", () => {
    expect(isEventPast("Feb 22 2026")).toBe(false);
  });

  it("returns false for invalid month abbreviation", () => {
    expect(isEventPast("Xyz 15")).toBe(false);
  });

  it("returns false for non-numeric day", () => {
    expect(isEventPast("Feb abc")).toBe(false);
  });

  it("returns false for day 0 (below minimum)", () => {
    expect(isEventPast("Feb 0")).toBe(false);
  });

  it("returns false for day 32 (above maximum)", () => {
    expect(isEventPast("Feb 32")).toBe(false);
  });

  it("returns false for negative day", () => {
    expect(isEventPast("Feb -1")).toBe(false);
  });

  // Past date tests
  it("returns true for a clearly past date (Jan 15)", () => {
    expect(isEventPast("Jan 15")).toBe(true);
  });

  it("returns true for yesterday (Apr 7)", () => {
    expect(isEventPast("Apr 7")).toBe(true);
  });

  it("returns true for March 1 (past month)", () => {
    expect(isEventPast("Mar 1")).toBe(true);
  });

  // Today and future tests
  it("returns false for today (Apr 8) — not strictly less than", () => {
    expect(isEventPast("Apr 8")).toBe(false);
  });

  it("returns false for tomorrow (Apr 9)", () => {
    expect(isEventPast("Apr 9")).toBe(false);
  });

  it("returns false for future date within 6 months (Oct 1)", () => {
    expect(isEventPast("Oct 1")).toBe(false);
  });

  // Year wrap-around heuristic
  it("returns true for date >6 months in future (wraps to last year)", () => {
    // Nov 15 in 2026 would be ~7 months away from Apr 8 -> wraps to Nov 15, 2025 -> past
    expect(isEventPast("Nov 15")).toBe(true);
  });

  it("returns true for Dec date (wraps to last year in April)", () => {
    expect(isEventPast("Dec 20")).toBe(true);
  });

  // Boundary: day 1 and day 31 are valid
  it("accepts day 1 as valid", () => {
    expect(isEventPast("Jan 1")).toBe(true);
  });

  it("accepts day 31 as valid", () => {
    expect(isEventPast("Jan 31")).toBe(true);
  });

  // Whitespace handling
  it("handles extra whitespace in date string", () => {
    expect(isEventPast("  Jan  15  ")).toBe(true);
  });
});

describe("msUntilMidnight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ~1000ms when time is 23:59:59", () => {
    vi.setSystemTime(new Date(2026, 3, 8, 23, 59, 59));
    const ms = msUntilMidnight();
    expect(ms).toBe(1000);
  });

  it("returns ~86399000ms when time is 00:00:01", () => {
    vi.setSystemTime(new Date(2026, 3, 8, 0, 0, 1));
    const ms = msUntilMidnight();
    expect(ms).toBe(86399000);
  });

  it("returns positive value less than 24 hours", () => {
    vi.setSystemTime(new Date(2026, 3, 8, 12, 30, 0));
    const ms = msUntilMidnight();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(86400000);
  });
});
