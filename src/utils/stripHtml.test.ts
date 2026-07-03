import { describe, it, expect } from "vitest";
import { stripHtml } from "./stripHtml";

describe("stripHtml", () => {
  it("passes through plain text unchanged", () => {
    expect(stripHtml("hello world")).toBe("hello world");
  });

  it("strips a single HTML tag", () => {
    expect(stripHtml("<em>italic</em>")).toBe("italic");
  });

  it("strips nested tags", () => {
    expect(stripHtml("<p><strong>bold</strong></p>")).toBe("bold");
  });

  it("defeats nested injection pattern that single-pass misses", () => {
    expect(stripHtml("<scr<script>ipt>alert(1)</scr</script>ipt>")).toBe(
      "alert(1)",
    );
  });

  it("returns empty string for tag-only input", () => {
    expect(stripHtml("<br/>")).toBe("");
  });
});
