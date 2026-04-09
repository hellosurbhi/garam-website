import { describe, it, expect } from "vitest";
import { YOUTUBE_VIDEO_ID, INSTAGRAM_REEL_URLS } from "./constants";

describe("constants", () => {
  it("YOUTUBE_VIDEO_ID has the correct value", () => {
    expect(YOUTUBE_VIDEO_ID).toBe("AXDhphHBUj4");
  });

  it("INSTAGRAM_REEL_URLS has exactly 3 entries", () => {
    expect(INSTAGRAM_REEL_URLS).toHaveLength(3);
  });

  it("each INSTAGRAM_REEL_URLS entry is a valid Instagram URL", () => {
    for (const url of INSTAGRAM_REEL_URLS) {
      expect(url).toMatch(/^https:\/\/www\.instagram\.com\//);
    }
  });
});
