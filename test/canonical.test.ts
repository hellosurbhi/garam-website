import { describe, it, expect } from "vitest";

const SITE = "https://garammasaladating.com";

function buildCanonical(pathname: string): string {
  return new URL(pathname, SITE).href;
}

describe("canonical URL generation", () => {
  it("homepage canonical is apex root", () => {
    expect(buildCanonical("/")).toBe(`${SITE}/`);
  });

  it("/tickets canonical has no trailing slash", () => {
    const url = buildCanonical("/tickets");
    expect(url).toBe(`${SITE}/tickets`);
    expect(url.endsWith("/")).toBe(false);
  });

  it("/cities/manhattan canonical is correct", () => {
    expect(buildCanonical("/cities/manhattan")).toBe(
      `${SITE}/cities/manhattan`,
    );
  });

  it("/privacy canonical is correct", () => {
    expect(buildCanonical("/privacy")).toBe(`${SITE}/privacy`);
  });

  it("canonical URLs use HTTPS apex domain (no www)", () => {
    const testPaths = ["/", "/tickets", "/cities/london", "/faq"];
    for (const path of testPaths) {
      const url = buildCanonical(path);
      const parsed = new URL(url);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname).toBe("garammasaladating.com");
    }
  });
});

describe("LegalModal removal regression", () => {
  it("LegalModal component no longer exists", async () => {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    const modalPath = join(process.cwd(), "src/components/LegalModal.astro");
    expect(existsSync(modalPath)).toBe(false);
  });

  it("BaseLayout no longer imports LegalModal", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/layouts/BaseLayout.astro"),
      "utf-8",
    );
    expect(content).not.toContain("LegalModal");
    expect(content).not.toContain("legal-tpl");
  });

  it("HomeFooter no longer has data-legal-modal attributes", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(
      join(process.cwd(), "src/components/home/HomeFooter.astro"),
      "utf-8",
    );
    expect(content).not.toContain("data-legal-modal");
  });
});
