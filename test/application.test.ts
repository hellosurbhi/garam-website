import { describe, it, expect } from "vitest";
import {
  STATUS_COLORS,
  COMMUNITY_OPTIONS,
  INCOME_OPTIONS,
} from "../src/types/application";
import type { Application } from "../src/types/application";

describe("STATUS_COLORS", () => {
  it("has entries for the core casting statuses", () => {
    expect(STATUS_COLORS).toHaveProperty("New");
    expect(STATUS_COLORS).toHaveProperty("Contacted");
    expect(STATUS_COLORS).toHaveProperty("Cast");
    expect(STATUS_COLORS).toHaveProperty("Rejected");
  });

  it("has entries for every current pipeline status", () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(11);
    expect(STATUS_COLORS).toHaveProperty("Responded");
    expect(STATUS_COLORS).toHaveProperty("Said Not Now");
    expect(STATUS_COLORS).toHaveProperty("No Response");
    expect(STATUS_COLORS).toHaveProperty("Not Interested Anymore");
    expect(STATUS_COLORS).toHaveProperty("Not Interested");
    expect(STATUS_COLORS).toHaveProperty("Bailed");
    expect(STATUS_COLORS).toHaveProperty("Participated");
  });

  it("maps New to the gold color", () => {
    expect(STATUS_COLORS["New"]).toBe("#D4A843");
  });

  it("maps Contacted to the blue color", () => {
    expect(STATUS_COLORS["Contacted"]).toBe("#3B82F6");
  });

  it("maps Cast to the green color", () => {
    expect(STATUS_COLORS["Cast"]).toBe("#22C55E");
  });

  it("maps Rejected to the grey color", () => {
    expect(STATUS_COLORS["Rejected"]).toBe("#9CA3AF");
  });

  it("all color values are valid hex strings", () => {
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(hexRe);
    }
  });
});

describe("COMMUNITY_OPTIONS", () => {
  it("has exactly 10 options", () => {
    expect(COMMUNITY_OPTIONS).toHaveLength(10);
  });

  it("includes major South Asian communities", () => {
    expect(COMMUNITY_OPTIONS).toContain("Hindu");
    expect(COMMUNITY_OPTIONS).toContain("Muslim");
    expect(COMMUNITY_OPTIONS).toContain("Sikh");
    expect(COMMUNITY_OPTIONS).toContain("Jain");
    expect(COMMUNITY_OPTIONS).toContain("Buddhist");
    expect(COMMUNITY_OPTIONS).toContain("Christian");
    expect(COMMUNITY_OPTIONS).toContain("Parsi");
  });

  it("includes non-religious options", () => {
    expect(COMMUNITY_OPTIONS).toContain("Atheist/Agnostic");
    expect(COMMUNITY_OPTIONS).toContain("Other South Asian");
    expect(COMMUNITY_OPTIONS).toContain("Other");
  });

  it("contains only strings", () => {
    for (const option of COMMUNITY_OPTIONS) {
      expect(typeof option).toBe("string");
    }
  });

  it("contains no duplicate entries", () => {
    const unique = new Set(COMMUNITY_OPTIONS);
    expect(unique.size).toBe(COMMUNITY_OPTIONS.length);
  });

  it("contains no empty strings", () => {
    for (const option of COMMUNITY_OPTIONS) {
      expect(option.trim()).not.toBe("");
    }
  });
});

describe("INCOME_OPTIONS", () => {
  it("has exactly 6 options", () => {
    expect(INCOME_OPTIONS).toHaveLength(6);
  });

  it("includes expected bracket options", () => {
    expect(INCOME_OPTIONS).toContain("Under $50k");
    expect(INCOME_OPTIONS).toContain("$50k to $100k");
    expect(INCOME_OPTIONS).toContain("$100k to $150k");
    expect(INCOME_OPTIONS).toContain("$150k to $200k");
    expect(INCOME_OPTIONS).toContain("Over $200k");
    expect(INCOME_OPTIONS).toContain("Prefer not to say");
  });

  it("contains only strings", () => {
    for (const option of INCOME_OPTIONS) {
      expect(typeof option).toBe("string");
    }
  });

  it("contains no duplicate entries", () => {
    const unique = new Set(INCOME_OPTIONS);
    expect(unique.size).toBe(INCOME_OPTIONS.length);
  });

  it("contains no empty strings", () => {
    for (const option of INCOME_OPTIONS) {
      expect(option.trim()).not.toBe("");
    }
  });
});

describe("Application status type", () => {
  it("accepts all current valid status values", () => {
    const validStatuses: Application["status"][] = [
      "New",
      "Contacted",
      "Responded",
      "Said Not Now",
      "Cast",
      "No Response",
      "Not Interested Anymore",
      "Not Interested",
      "Rejected",
      "Bailed",
      "Participated",
    ];
    // All STATUS_COLORS keys should match valid statuses
    for (const s of validStatuses) {
      expect(STATUS_COLORS).toHaveProperty(s);
    }
  });
});
