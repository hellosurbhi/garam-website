import { describe, it, expect } from "vitest";
import { pressItems } from "./press";

describe("pressItems", () => {
  it("is a non-empty array", () => {
    expect(pressItems.length).toBeGreaterThan(0);
  });

  it("every item has a non-empty title", () => {
    for (const item of pressItems) {
      expect(item.title.trim()).not.toBe("");
    }
  });

  it("every item has a non-empty source", () => {
    for (const item of pressItems) {
      expect(item.source.trim()).not.toBe("");
    }
  });

  it("every item has a valid URL", () => {
    for (const item of pressItems) {
      expect(() => new URL(item.url)).not.toThrow();
    }
  });

  it("every item type is podcast, article, or press", () => {
    const validTypes = new Set(["podcast", "article", "press"]);
    for (const item of pressItems) {
      expect(validTypes.has(item.type)).toBe(true);
    }
  });

  it("no two items share the same URL", () => {
    const urls = pressItems.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
