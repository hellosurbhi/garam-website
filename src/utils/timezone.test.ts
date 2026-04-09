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

  it("summer offset hours are 04 and minutes are 00", () => {
    const result = nyOffset("2026-07-01", "12:00");
    expect(result).toBe("-04:00");
    expect(result).toContain(":");
    expect(result.startsWith("-")).toBe(true);
  });

  it("winter offset hours are 05 and minutes are 00", () => {
    const result = nyOffset("2026-01-15", "12:00");
    expect(result).toBe("-05:00");
    expect(result.startsWith("-")).toBe(true);
  });

  it("offset contains colon separator between hours and minutes", () => {
    const result = nyOffset("2026-06-15", "14:00");
    expect(result.indexOf(":")).toBe(3); // +/-HH:MM → colon at index 3
  });

  it("m-1 month adjustment: March vs April DST boundary", () => {
    // March 8 at 01:00 is EST. If m-1 mutation changes to m or m+1,
    // the computed date shifts to April (EDT) → wrong offset.
    expect(nyOffset("2026-03-07", "01:00")).toBe("-05:00");
  });

  it("spring forward boundary: March 8 at 01:00 is EST (-05:00)", () => {
    expect(nyOffset("2026-03-08", "01:00")).toBe("-05:00");
  });

  it("spring forward boundary: March 8 at 03:00 is EDT (-04:00)", () => {
    expect(nyOffset("2026-03-08", "03:00")).toBe("-04:00");
  });

  it("fall back boundary: Nov 1 at 03:00 is EST (-05:00)", () => {
    // Nov 1, 2026 DST ends at 2:00 AM → 3:00 AM is definitely EST
    expect(nyOffset("2026-11-01", "03:00")).toBe("-05:00");
  });

  it("returns exact value '-05:00' for Jan 1 at noon", () => {
    expect(nyOffset("2026-01-01", "12:00")).toBe("-05:00");
  });

  it("returns exact value '-04:00' for Aug 1 at noon", () => {
    expect(nyOffset("2026-08-01", "12:00")).toBe("-04:00");
  });

  it("sign is '-' for all NY offsets", () => {
    const summer = nyOffset("2026-07-01", "12:00");
    const winter = nyOffset("2026-01-01", "12:00");
    expect(summer[0]).toBe("-");
    expect(winter[0]).toBe("-");
  });

  it("hours part is exactly 2 digits", () => {
    const result = nyOffset("2026-07-01", "12:00");
    const hours = result.slice(1, 3);
    expect(hours).toMatch(/^\d{2}$/);
  });

  it("minutes part is '00' for NY timezone", () => {
    const result = nyOffset("2026-07-01", "12:00");
    const minutes = result.slice(4, 6);
    expect(minutes).toBe("00");
  });

  it("handles time with non-zero minutes correctly", () => {
    const result = nyOffset("2026-07-01", "14:30");
    expect(result).toBe("-04:00");
  });
});
