import { describe, it, expect } from "vitest";
import {
  HOW_HEARD_OPTIONS,
  COMMUNITY_OPTIONS,
  INCOME_OPTIONS,
} from "./application";

describe("apply form option lists", () => {
  it("HOW_HEARD_OPTIONS covers every acquisition channel we track", () => {
    expect(HOW_HEARD_OPTIONS).toEqual([
      "Instagram",
      "TikTok",
      "YouTube",
      "At a show",
      "Friend or word of mouth",
      "Google search",
      "Other",
    ]);
  });

  it("HOW_HEARD_OPTIONS values fit the firestore.rules 50-char cap", () => {
    for (const option of HOW_HEARD_OPTIONS) {
      expect(option.length).toBeGreaterThan(0);
      expect(option.length).toBeLessThanOrEqual(50);
    }
  });

  it("keeps community and income lists non-empty and unique", () => {
    expect(COMMUNITY_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(COMMUNITY_OPTIONS).size).toBe(COMMUNITY_OPTIONS.length);
    expect(INCOME_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(INCOME_OPTIONS).size).toBe(INCOME_OPTIONS.length);
  });
});
