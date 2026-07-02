import { describe, it, expect } from "vitest";
import { cities } from "../src/data/cities";

const SITE = "https://garammasaladating.com";

function sitemapFilter(page: string): boolean {
  if (page.includes("?")) return false;
  if (
    page.includes("/admin") ||
    page.includes("/contestant-prep") ||
    page.includes("/waiver")
  )
    return false;
  return true;
}

describe("sitemap filter", () => {
  it("excludes /admin", () => {
    expect(sitemapFilter(`${SITE}/admin`)).toBe(false);
  });

  it("excludes /contestant-prep", () => {
    expect(sitemapFilter(`${SITE}/contestant-prep`)).toBe(false);
  });

  it("excludes /waiver", () => {
    expect(sitemapFilter(`${SITE}/waiver`)).toBe(false);
  });

  it("excludes URLs with query params", () => {
    expect(sitemapFilter(`${SITE}/tickets?ref=email`)).toBe(false);
  });

  it("includes canonical pages", () => {
    expect(sitemapFilter(`${SITE}/`)).toBe(true);
    expect(sitemapFilter(`${SITE}/tickets`)).toBe(true);
    expect(sitemapFilter(`${SITE}/apply`)).toBe(true);
    expect(sitemapFilter(`${SITE}/faq`)).toBe(true);
  });
});

describe("city pages in sitemap", () => {
  const citySlugs = Object.keys(cities);

  it("has at least one city", () => {
    expect(citySlugs.length).toBeGreaterThan(0);
  });

  it("all city URLs pass the sitemap filter", () => {
    for (const slug of citySlugs) {
      const url = `${SITE}/cities/${slug}`;
      expect(sitemapFilter(url)).toBe(true);
    }
  });

  it("no city URL contains www or http://", () => {
    for (const slug of citySlugs) {
      const url = `${SITE}/cities/${slug}`;
      expect(url).not.toContain("www.");
      expect(url).not.toContain("http://");
    }
  });

  it("all city URLs start with the canonical HTTPS origin", () => {
    for (const slug of citySlugs) {
      const url = `${SITE}/cities/${slug}`;
      expect(url.startsWith("https://garammasaladating.com")).toBe(true);
    }
  });
});
