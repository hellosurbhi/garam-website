import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PIXEL_ID = "1469248418329402";

describe("Meta Pixel component", () => {
  const source = readFileSync(
    resolve(__dirname, "../src/components/meta-pixel.astro"),
    "utf-8"
  );

  it("initializes fbq with the correct pixel ID", () => {
    expect(source).toContain(`fbq('init', '${PIXEL_ID}')`);
  });

  it("tracks PageView event", () => {
    expect(source).toContain("fbq('track', 'PageView')");
  });

  it("loads fbevents.js from connect.facebook.net", () => {
    expect(source).toContain(
      "https://connect.facebook.net/en_US/fbevents.js"
    );
  });

  it("includes noscript image beacon with correct pixel ID", () => {
    expect(source).toContain(
      `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`
    );
  });

  it("uses is:inline directive so script is not bundled", () => {
    expect(source).toContain("<script is:inline>");
  });
});

describe("BaseLayout includes MetaPixel", () => {
  const layout = readFileSync(
    resolve(__dirname, "../src/layouts/BaseLayout.astro"),
    "utf-8"
  );

  it("imports meta-pixel.astro", () => {
    expect(layout).toContain(
      "import MetaPixel from '../components/meta-pixel.astro'"
    );
  });

  it("renders <MetaPixel /> in the document", () => {
    expect(layout).toContain("<MetaPixel />");
  });
});

describe("CSP allows Meta Pixel origins", () => {
  const vercelConfig = JSON.parse(
    readFileSync(resolve(__dirname, "../vercel.json"), "utf-8")
  );

  const globalHeaders = vercelConfig.headers.find(
    (h: { source: string }) => h.source === "/(.*)"
  );
  const cspHeader = globalHeaders.headers.find(
    (h: { key: string }) => h.key === "Content-Security-Policy"
  );
  const csp: string = cspHeader.value;

  // Parse CSP into directive map
  const directives = new Map<string, string>();
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx > 0) {
      directives.set(trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1));
    }
  }

  it("script-src includes connect.facebook.net", () => {
    expect(directives.get("script-src")).toContain(
      "https://connect.facebook.net"
    );
  });

  it("img-src includes www.facebook.com for noscript beacon", () => {
    expect(directives.get("img-src")).toContain("https://www.facebook.com");
  });

  it("connect-src includes www.facebook.com for event beacons", () => {
    expect(directives.get("connect-src")).toContain("https://www.facebook.com");
  });
});
