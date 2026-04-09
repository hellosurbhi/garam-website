import { describe, it, expect } from "vitest";
import { nyOffset } from "./timezone";

describe("nyOffset", () => {
  it("returns -04:00 for a summer date (EDT)", () => {
    expect(nyOffset("2026-07-01", "20:00")).toBe("-04:00");
  });

  it("returns -05:00 for a winter date (EST)", () => {
    expect(nyOffset("2026-01-15", "20:00")).toBe("-05:00");
  });

  it("returns -04:00 after spring forward (March 8, 2026 is DST start)", () => {
    // March 9 is after spring forward
    expect(nyOffset("2026-03-09", "20:00")).toBe("-04:00");
  });

  it("returns -05:00 before spring forward", () => {
    expect(nyOffset("2026-03-07", "20:00")).toBe("-05:00");
  });

  it("returns -05:00 after fall back (Nov 1, 2026 is after DST end)", () => {
    expect(nyOffset("2026-11-02", "20:00")).toBe("-05:00");
  });

  it("returns consistent offset for different times on same non-boundary date", () => {
    const offset1 = nyOffset("2026-06-15", "08:00");
    const offset2 = nyOffset("2026-06-15", "20:00");
    expect(offset1).toBe(offset2);
  });

  it("output matches expected format ±HH:MM", () => {
    const result = nyOffset("2026-04-08", "19:00");
    expect(result).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it("handles midnight time", () => {
    const result = nyOffset("2026-06-15", "00:00");
    expect(result).toBe("-04:00");
  });
});
