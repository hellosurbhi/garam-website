import { describe, it, expect } from "vitest";
import { buildCityJsonLd } from "../src/utils/cityJsonLd";
import type { CityData } from "../src/data/cities/types";

const BASE_CITY: CityData = {
  slug: "austin",
  displayName: "Austin",
  titleTag: "Garam Masala Dating in Austin, TX",
  metaDescription: "South Asian dating show coming to Austin.",
  h1: "Desi Dating is Coming to Austin",
  bodyParagraphs: ["We are coming to Austin soon."],
  ctas: [{ label: "Join the Waitlist", href: "#waitlist" }],
  status: "coming-soon",
  badgeLabel: "Coming Soon",
  areaServed: "Austin, TX",
  addressLocality: "Austin",
  addressRegion: "TX",
  addressCountry: "US",
  region: "US South & Texas",
  nearbyCities: [],
};

const ACTIVE_CITY: CityData = {
  ...BASE_CITY,
  slug: "manhattan",
  displayName: "Manhattan",
  titleTag: "Garam Masala Dating NYC",
  metaDescription: "Live desi dating show in Manhattan.",
  h1: "Desi Dating in NYC",
  status: "active",
  badgeLabel: "Weekly Shows",
  areaServed: "New York City",
  addressLocality: "New York",
  addressRegion: "NY",
  addressCountry: "US",
};

const CITY_WITH_FAQS: CityData = {
  ...BASE_CITY,
  faqItems: [
    { q: "When is the next show?", a: "Check the tickets page." },
    { q: "How do I apply?", a: "Visit the apply page." },
  ],
};

describe("buildCityJsonLd", () => {
  describe("waitlist/TBA city (no events)", () => {
    it("returns valid JSON", () => {
      expect(() => JSON.parse(buildCityJsonLd(BASE_CITY))).not.toThrow();
    });

    it("@graph contains LocalBusiness", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(BASE_CITY));
      const lb = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "LocalBusiness",
      );
      expect(lb).toBeDefined();
    });

    it("@graph contains WebPage with correct url and name", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(BASE_CITY));
      const wp = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "WebPage",
      );
      expect(wp).toBeDefined();
      expect(wp!["url"]).toBe("https://garammasaladating.com/cities/austin");
      expect(wp!["name"]).toBe(BASE_CITY.titleTag);
    });

    it("does NOT contain any Event or ComedyEvent block", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(BASE_CITY));
      const hasEvent = (graph as Record<string, unknown>[]).some(
        (n) => n["@type"] === "Event" || n["@type"] === "ComedyEvent",
      );
      expect(hasEvent).toBe(false);
    });

    it("does NOT contain AggregateRating or Review", () => {
      const raw = buildCityJsonLd(BASE_CITY);
      expect(raw).not.toContain("AggregateRating");
      expect(raw).not.toContain('"Review"');
    });
  });

  describe("FAQ items", () => {
    it("includes FAQPage block when faqItems is non-empty", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(CITY_WITH_FAQS));
      const faq = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "FAQPage",
      );
      expect(faq).toBeDefined();
      expect((faq!["mainEntity"] as unknown[]).length).toBe(2);
    });

    it("omits FAQPage block when faqItems is absent", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(BASE_CITY));
      const faq = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "FAQPage",
      );
      expect(faq).toBeUndefined();
    });
  });

  describe("WebPage schema", () => {
    it("isPartOf points to site root", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(ACTIVE_CITY));
      const wp = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "WebPage",
      ) as Record<string, Record<string, string>> | undefined;
      expect(wp!["isPartOf"]["@id"]).toBe("https://garammasaladating.com");
    });

    it("inLanguage is en-US", () => {
      const { "@graph": graph } = JSON.parse(buildCityJsonLd(BASE_CITY));
      const wp = (graph as Record<string, unknown>[]).find(
        (n) => n["@type"] === "WebPage",
      );
      expect(wp!["inLanguage"]).toBe("en-US");
    });
  });
});
