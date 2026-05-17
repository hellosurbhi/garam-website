import { describe, it, expect } from "vitest";
import { SOCIAL_URLS, CREATOR_URLS } from "./socials";

describe("SOCIAL_URLS", () => {
  it("has exactly 7 entries", () => {
    expect(Object.keys(SOCIAL_URLS)).toHaveLength(7);
  });

  it("includes an instagram URL", () => {
    expect(SOCIAL_URLS.instagram).toContain("instagram.com");
  });

  it("includes a tiktok URL", () => {
    expect(SOCIAL_URLS.tiktok).toContain("tiktok.com");
  });

  it("includes a youtube URL", () => {
    expect(SOCIAL_URLS.youtube).toContain("youtube.com");
  });

  it("points youtube links to the current episode", () => {
    expect(SOCIAL_URLS.youtube).toBe(
      "https://www.youtube.com/watch?v=aNpdJVOOczk",
    );
  });

  it("includes a mailto email", () => {
    expect(SOCIAL_URLS.email).toMatch(/^mailto:/);
  });

  it("all values are non-empty strings", () => {
    for (const url of Object.values(SOCIAL_URLS)) {
      expect(typeof url).toBe("string");
      expect(url.trim()).not.toBe("");
    }
  });

  it("all non-mailto URLs start with https://", () => {
    for (const [key, url] of Object.entries(SOCIAL_URLS)) {
      if (key !== "email") {
        expect(url.startsWith("https://")).toBe(true);
      }
    }
  });
});

describe("CREATOR_URLS", () => {
  it("has exactly 3 entries", () => {
    expect(Object.keys(CREATOR_URLS)).toHaveLength(3);
  });

  it("includes surbhi, wyatt, and venue keys", () => {
    expect(CREATOR_URLS).toHaveProperty("surbhi");
    expect(CREATOR_URLS).toHaveProperty("wyatt");
    expect(CREATOR_URLS).toHaveProperty("venue");
  });

  it("all values start with https://", () => {
    for (const url of Object.values(CREATOR_URLS)) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });
});
