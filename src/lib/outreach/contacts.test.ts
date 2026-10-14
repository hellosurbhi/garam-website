import { it, expect } from "vitest";
import { isSuppressed } from "./contacts";
it("honors inherited opt-out flags regardless of exported capitalization or padding", () => {
  for (const value of [false, "No", " no ", "FALSE", 0, "0"])
    expect(isSuppressed({ emailable: value })).toBe(true);
  for (const value of [true, "Yes", " yes ", "TRUE", 1, "1"]) {
    expect(isSuppressed({ emailable: value })).toBe(false);
    expect(isSuppressed({ suppressed: value })).toBe(true);
    expect(isSuppressed({ unsubscribed: value })).toBe(true);
  }
  expect(isSuppressed({})).toBe(false);
});
