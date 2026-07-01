import { describe, it, expect } from "vitest";
import { VIDEO_METADATA } from "../src/lib/constants";

describe("VIDEO_METADATA.uploadDate", () => {
  it("is a full ISO 8601 datetime with timezone offset", () => {
    expect(VIDEO_METADATA.uploadDate).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
    );
  });

  it("is not a bare date string", () => {
    expect(VIDEO_METADATA.uploadDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
