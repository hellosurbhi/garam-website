import { describe, it, expect } from "vitest";
import { cleanPhone } from "./phone";

describe("cleanPhone", () => {
  it("returns null for empty string", () => {
    expect(cleanPhone("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(cleanPhone("   ")).toBeNull();
  });

  it("returns +1 prefix for exactly 10 US digits", () => {
    expect(cleanPhone("2125551234")).toBe("+12125551234");
  });

  it("returns +1 prefix for 10 digits with formatting", () => {
    expect(cleanPhone("(212) 555-1234")).toBe("+12125551234");
  });

  it("returns +1 prefix for 10 digits with dashes", () => {
    expect(cleanPhone("212-555-1234")).toBe("+12125551234");
  });

  it("returns +digits for 9 digits (falls to >=7 branch, not 10-digit US)", () => {
    expect(cleanPhone("212555123")).toBe("+212555123");
  });

  it("returns +prefix for 11 digits starting with 1 (US with country code)", () => {
    expect(cleanPhone("12125551234")).toBe("+12125551234");
  });

  it("returns +prefix for 11 digits starting with 1 formatted", () => {
    expect(cleanPhone("1 (212) 555-1234")).toBe("+12125551234");
  });

  it("returns +digits for 11 digits NOT starting with 1 (falls to >=7 branch)", () => {
    expect(cleanPhone("92125551234")).toBe("+92125551234");
  });

  it("returns +digits for international number with + prefix", () => {
    expect(cleanPhone("+44 7911 123456")).toBe("+447911123456");
  });

  it("returns +digits for + prefix with exactly 7 digits", () => {
    expect(cleanPhone("+1234567")).toBe("+1234567");
  });

  it("returns null for + prefix with only 6 digits (boundary below 7)", () => {
    expect(cleanPhone("+123456")).toBeNull();
  });

  it("returns +digits for 7 bare digits without + prefix", () => {
    expect(cleanPhone("1234567")).toBe("+1234567");
  });

  it("returns null for 6 bare digits (boundary below 7)", () => {
    expect(cleanPhone("123456")).toBeNull();
  });

  it("returns +digits for 12 digits without + prefix", () => {
    expect(cleanPhone("123456789012")).toBe("+123456789012");
  });

  it("handles leading and trailing whitespace", () => {
    expect(cleanPhone("  2125551234  ")).toBe("+12125551234");
  });

  it("returns +digits for international with + and spaces", () => {
    expect(cleanPhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("returns +digits for 8 digits (between 7 and 10, >=7 branch)", () => {
    expect(cleanPhone("12345678")).toBe("+12345678");
  });

  it("international +prefix with 10 digits: digits strip to 10, US branch wins", () => {
    // +1234567890 → digits "1234567890" (10 digits) → US branch: "+11234567890"
    expect(cleanPhone("+1234567890")).toBe("+11234567890");
  });

  it("11 digits starting with 2 falls to >=7 branch, not US branch", () => {
    expect(cleanPhone("21234567890")).toBe("+21234567890");
  });

  it("returns null for single digit", () => {
    expect(cleanPhone("1")).toBeNull();
  });
});
