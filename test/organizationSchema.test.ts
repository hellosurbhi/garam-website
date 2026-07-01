import { describe, it, expect } from "vitest";
import { buildOrganizationJsonLd } from "../src/utils/organizationSchema";

describe("buildOrganizationJsonLd", () => {
  it("returns valid JSON", () => {
    expect(() => JSON.parse(buildOrganizationJsonLd())).not.toThrow();
  });

  it("has @type Organization", () => {
    const schema = JSON.parse(buildOrganizationJsonLd());
    expect(schema["@type"]).toBe("Organization");
  });

  it("has name, url, logo", () => {
    const schema = JSON.parse(buildOrganizationJsonLd());
    expect(schema.name).toBe("Garam Masala Dating");
    expect(schema.url).toBe("https://garammasaladating.com");
    expect(schema.logo).toContain("logo.svg");
  });

  it("has sameAs array with social URLs", () => {
    const schema = JSON.parse(buildOrganizationJsonLd());
    expect(Array.isArray(schema.sameAs)).toBe(true);
    expect(schema.sameAs.length).toBeGreaterThan(0);
  });

  it("has contactPoint", () => {
    const schema = JSON.parse(buildOrganizationJsonLd());
    expect(schema.contactPoint["@type"]).toBe("ContactPoint");
    expect(schema.contactPoint.email).toBe("contact@garammasaladating.com");
  });

  it("does NOT contain aggregateRating", () => {
    const raw = buildOrganizationJsonLd();
    expect(raw).not.toContain("aggregateRating");
    expect(raw).not.toContain("AggregateRating");
  });

  it("does NOT contain review array", () => {
    const raw = buildOrganizationJsonLd();
    expect(raw).not.toContain('"Review"');
    expect(raw).not.toContain("reviewRating");
  });
});
