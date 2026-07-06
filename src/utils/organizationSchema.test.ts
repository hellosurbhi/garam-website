import { describe, it, expect } from "vitest";
import { buildOrganizationJsonLd } from "./organizationSchema";

describe("buildOrganizationJsonLd (entity signals for AEO)", () => {
  const org = JSON.parse(buildOrganizationJsonLd());

  it("declares the core Organization identity", () => {
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("Organization");
    expect(org["@id"]).toBe("https://garammasaladating.com/#organization");
    expect(org.name).toBe("Garam Masala Dating");
    expect(org.url).toBe("https://garammasaladating.com");
    expect(org.slogan).toBe("America's #1 Live Desi Comedy Dating Show");
    expect(org.foundingDate).toBe("2022");
  });

  it("carries the spice-blend disambiguation for AI systems", () => {
    expect(org.disambiguatingDescription).toContain("not the spice blend");
    expect(org.disambiguatingDescription).toContain("comedy dating show");
  });

  it("lists topical authority subjects in knowsAbout", () => {
    expect(Array.isArray(org.knowsAbout)).toBe(true);
    expect(org.knowsAbout.length).toBeGreaterThanOrEqual(6);
    for (const topic of [
      "South Asian dating",
      "live comedy dating shows",
      "South Asian singles events",
      "dating app alternatives",
    ]) {
      expect(org.knowsAbout).toContain(topic);
    }
  });

  it("names the founder and both members as Person entities with sameAs", () => {
    expect(org.founder["@type"]).toBe("Person");
    expect(org.founder.name).toBe("Surbhi");
    expect(org.founder.sameAs.length).toBeGreaterThan(0);

    expect(org.member).toHaveLength(2);
    const names = org.member.map((m: { name: string }) => m.name);
    expect(names).toContain("Surbhi");
    expect(names).toContain("Wyatt Feegrado");
    for (const m of org.member) {
      expect(m["@type"]).toBe("Person");
      expect(m.sameAs.length).toBeGreaterThan(0);
    }
  });

  it("anchors the entity in place and country", () => {
    expect(org.foundingLocation["@type"]).toBe("Place");
    expect(org.foundingLocation.name).toBe("New York City");
    expect(org.areaServed.name).toBe("United States");
  });

  it("links only to real social profiles via sameAs", () => {
    expect(Array.isArray(org.sameAs)).toBe(true);
    expect(org.sameAs.length).toBeGreaterThanOrEqual(5);
    for (const url of org.sameAs) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});
