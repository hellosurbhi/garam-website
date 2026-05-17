import { describe, it, expect } from "vitest";
import {
  YOUTUBE_THUMBNAIL_SRC,
  YOUTUBE_VIDEO_ID,
  YOUTUBE_VIDEO_URL,
  INSTAGRAM_REEL_URLS,
} from "./constants";

describe("constants", () => {
  it("YOUTUBE_VIDEO_ID has the correct value", () => {
    expect(YOUTUBE_VIDEO_ID).toBe("aNpdJVOOczk");
  });

  it("YOUTUBE_VIDEO_URL points to the homepage episode", () => {
    expect(YOUTUBE_VIDEO_URL).toBe(
      "https://www.youtube.com/watch?v=aNpdJVOOczk",
    );
  });

  it("YOUTUBE_THUMBNAIL_SRC points to the local thumbnail", () => {
    expect(YOUTUBE_THUMBNAIL_SRC).toBe("/images/promo/youtube-thumbnail.jpg");
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
