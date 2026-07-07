import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PIXEL_ID = "1469248418329402";

describe("Meta Pixel script (public/js/meta-pixel.js)", () => {
  const source = readFileSync(
    resolve(__dirname, "../public/js/meta-pixel.js"),
    "utf-8",
  );

  it("initializes fbq with the correct pixel ID", () => {
    expect(source).toContain(`fbq("init", "${PIXEL_ID}")`);
  });

  it("tracks PageView event", () => {
    expect(source).toContain('fbq("track", "PageView")');
  });

  it("loads fbevents.js from connect.facebook.net", () => {
    expect(source).toContain("https://connect.facebook.net/en_US/fbevents.js");
  });
});

describe("Meta Pixel component (meta-pixel.astro)", () => {
  const source = readFileSync(
    resolve(__dirname, "../src/components/meta-pixel.astro"),
    "utf-8",
  );

  it("includes noscript image beacon with correct pixel ID", () => {
    expect(source).toContain(
      `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`,
    );
  });

  it("loads external script via is:inline src to avoid bundling", () => {
    expect(source).toContain('<script is:inline src="/js/meta-pixel.js"');
  });
});

describe("BaseLayout includes MetaPixel", () => {
  const layout = readFileSync(
    resolve(__dirname, "../src/layouts/BaseLayout.astro"),
    "utf-8",
  );

  it("imports meta-pixel.astro", () => {
    expect(layout).toContain(
      'import MetaPixel from "../components/meta-pixel.astro"',
    );
  });

  it("renders <MetaPixel /> in the document", () => {
    expect(layout).toContain("<MetaPixel />");
  });
});
