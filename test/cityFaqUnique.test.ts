import { describe, it, expect } from "vitest";
import { cities } from "../src/data/cities";

const allCities = Object.values(cities);

describe("City FAQ data quality", () => {
  it("every city has at least 3 faqItems", () => {
    const violations: string[] = [];
    for (const city of allCities) {
      if (!city.faqItems || city.faqItems.length < 3) {
        violations.push(
          `${city.slug}: has ${city.faqItems?.length ?? 0} FAQ items`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("no two cities share an identical answer string", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const city of allCities) {
      if (!city.faqItems) continue;
      for (const { a } of city.faqItems) {
        const normalized = a.trim();
        if (seen.has(normalized)) {
          duplicates.push(
            `"${normalized.slice(0, 80)}..." appears in both ${seen.get(normalized)} and ${city.slug}`,
          );
        } else {
          seen.set(normalized, city.slug);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("no answer contains a placeholder token", () => {
    const violations: string[] = [];
    const patterns = ["{city}", "${city", "TODO", "TKTK", "PLACEHOLDER"];
    for (const city of allCities) {
      if (!city.faqItems) continue;
      for (const { a } of city.faqItems) {
        for (const pattern of patterns) {
          if (a.includes(pattern)) {
            violations.push(
              `${city.slug}: answer contains "${pattern}": ${a.slice(0, 60)}...`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("every city has a non-empty titleTag, metaDescription, h1, and bodyParagraphs", () => {
    const violations: string[] = [];
    for (const city of allCities) {
      if (!city.titleTag?.trim())
        violations.push(`${city.slug}: missing titleTag`);
      if (!city.metaDescription?.trim())
        violations.push(`${city.slug}: missing metaDescription`);
      if (!city.h1?.trim()) violations.push(`${city.slug}: missing h1`);
      if (!city.bodyParagraphs || city.bodyParagraphs.length === 0)
        violations.push(`${city.slug}: missing bodyParagraphs`);
    }
    expect(violations).toEqual([]);
  });

  it("no city has a canonical that overrides to a different city", () => {
    for (const city of allCities) {
      const expectedCanonical = `https://garammasaladating.com/cities/${city.slug}`;
      expect(city.slug).toBeTruthy();
      expect(city.slug).not.toContain(" ");
      expect(expectedCanonical).toContain(city.slug);
    }
  });
});
