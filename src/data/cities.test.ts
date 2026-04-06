import { describe, it, expect } from "vitest";
import { cities, citiesIndex, getCityBySlug } from "./cities";

const VALID_STATUSES = new Set(["active", "coming-soon", "past"]);

describe("cities", () => {
  const allCities = Object.values(cities);

  it("contains all expected cities", () => {
    expect(cities).toHaveProperty("manhattan");
    expect(cities).toHaveProperty("san-diego");
    expect(cities).toHaveProperty("jersey-city");
    expect(cities).toHaveProperty("los-angeles");
    expect(cities).toHaveProperty("san-francisco");
    expect(cities).toHaveProperty("salt-lake-city");
    expect(cities).toHaveProperty("denver");
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

  it("every city has a non-empty addressLocality and addressRegion", () => {
    for (const city of allCities) {
      expect(city.addressLocality.trim()).not.toBe("");
      expect(city.addressRegion.trim()).not.toBe("");
    }
  });
});

describe("citiesIndex", () => {
  it("is a non-empty array", () => {
    expect(citiesIndex.length).toBeGreaterThan(0);
  });

  it("does not include past cities", () => {
    for (const city of citiesIndex) {
      expect(city.status).not.toBe("past");
    }
  });

  it("every entry is a valid CityData object with a slug", () => {
    for (const city of citiesIndex) {
      expect(city.slug.trim()).not.toBe("");
      expect(city.displayName.trim()).not.toBe("");
    }
  });
});

describe("getCityBySlug", () => {
  it("returns the correct city for a valid slug", () => {
    expect(getCityBySlug("manhattan")?.displayName).toBe("Manhattan");
  });

  it("returns undefined for a non-existent slug", () => {
    expect(getCityBySlug("chicago")).toBeUndefined();
  });
});
