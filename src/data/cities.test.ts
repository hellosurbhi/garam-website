import { describe, it, expect } from "vitest";
import { cities, citiesIndex, getCityBySlug, citiesByRegion } from "./cities";

const VALID_STATUSES = new Set(["active", "coming-soon", "past"]);

describe("cities", () => {
  const allCities = Object.values(cities);

  it("contains the original active cities", () => {
    expect(cities).toHaveProperty("manhattan");
    expect(cities).toHaveProperty("san-diego");
    expect(cities).toHaveProperty("jersey-city");
    expect(cities).toHaveProperty("los-angeles");
    expect(cities).toHaveProperty("san-francisco");
    expect(cities).toHaveProperty("salt-lake-city");
    expect(cities).toHaveProperty("denver");
  });

  it("contains expansion cities", () => {
    expect(allCities.length).toBeGreaterThan(50);
  });

  it("every city slug matches its object key", () => {
    for (const [key, city] of Object.entries(cities)) {
      expect(city.slug).toBe(key);
    }
  });

  it("every city has a non-empty displayName", () => {
    for (const city of allCities) {
      expect(city.displayName.trim()).not.toBe("");
    }
  });

  it("every city has a non-empty titleTag", () => {
    for (const city of allCities) {
      expect(city.titleTag.trim()).not.toBe("");
    }
  });

  it("every city has a non-empty metaDescription", () => {
    for (const city of allCities) {
      expect(city.metaDescription.trim()).not.toBe("");
    }
  });

  it("every city has a non-empty h1", () => {
    for (const city of allCities) {
      expect(city.h1.trim()).not.toBe("");
    }
  });

  it("every city has a valid status", () => {
    for (const city of allCities) {
      expect(VALID_STATUSES.has(city.status)).toBe(true);
    }
  });

  it("every city has at least one body paragraph", () => {
    for (const city of allCities) {
      expect(city.bodyParagraphs.length).toBeGreaterThan(0);
    }
  });

  it("every city has at least one CTA", () => {
    for (const city of allCities) {
      expect(city.ctas.length).toBeGreaterThan(0);
    }
  });

  it("every CTA has a non-empty label and href", () => {
    for (const city of allCities) {
      for (const cta of city.ctas) {
        expect(cta.label.trim()).not.toBe("");
        expect(cta.href.trim()).not.toBe("");
      }
    }
  });

  it("every city has a non-empty addressLocality", () => {
    for (const city of allCities) {
      expect(city.addressLocality.trim()).not.toBe("");
    }
  });

  it("every city has an addressCountry", () => {
    for (const city of allCities) {
      expect(city.addressCountry.trim()).not.toBe("");
    }
  });

  it("every city has a region", () => {
    for (const city of allCities) {
      expect(city.region.trim()).not.toBe("");
    }
  });

  it("sections, when present, have non-empty headings and paragraphs", () => {
    for (const city of allCities) {
      if (!city.sections) continue;
      expect(
        city.sections.length,
        `${city.slug} has an empty sections array`,
      ).toBeGreaterThan(0);
      for (const section of city.sections) {
        expect(section.heading.trim(), `${city.slug} section heading`).not.toBe(
          "",
        );
        expect(
          section.paragraphs.length,
          `${city.slug} section "${section.heading}" has no paragraphs`,
        ).toBeGreaterThan(0);
        for (const para of section.paragraphs) {
          expect(para.trim(), `${city.slug} section paragraph`).not.toBe("");
        }
      }
    }
  });

  it("enriched priority cities carry deep content (2+ sections, 6+ FAQs)", () => {
    const enriched = [
      "manhattan",
      "jersey-city",
      "los-angeles",
      "san-francisco",
      "philadelphia",
      "edison",
      "boston",
      "toronto",
      "london",
      "austin",
      "chicago",
      "houston",
      "dallas",
      "atlanta",
      "washington-dc",
      "seattle",
      "vancouver",
      "sydney",
      "melbourne",
      "leicester",
      "san-jose",
    ];
    for (const slug of enriched) {
      const city = cities[slug];
      expect(city, `${slug} missing from cities`).toBeDefined();
      expect(
        city.sections?.length ?? 0,
        `${slug} should have at least 2 sections`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        city.faqItems?.length ?? 0,
        `${slug} should have at least 6 FAQ items`,
      ).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("citiesIndex", () => {
  it("is a non-empty array", () => {
    expect(citiesIndex.length).toBeGreaterThan(0);
  });

  it("active cities come first", () => {
    const firstInactive = citiesIndex.findIndex((c) => c.status !== "active");
    const lastActive = citiesIndex.reduce(
      (acc, c, i) => (c.status === "active" ? i : acc),
      -1,
    );
    if (lastActive >= 0 && firstInactive >= 0) {
      expect(lastActive).toBeLessThan(firstInactive);
    }
  });
});

describe("citiesByRegion", () => {
  it("returns non-empty region groups", () => {
    const regions = citiesByRegion();
    expect(regions.length).toBeGreaterThan(0);
    for (const group of regions) {
      expect(group.cities.length).toBeGreaterThan(0);
    }
  });
});

describe("getCityBySlug", () => {
  it("returns the correct city for a valid slug", () => {
    expect(getCityBySlug("manhattan")?.displayName).toBe("Manhattan");
  });

  it("returns undefined for a non-existent slug", () => {
    expect(getCityBySlug("nonexistent-city-abc")).toBeUndefined();
  });
});
