import { describe, it, expect } from "vitest";
import { buildBreadcrumbJsonLd, BASE } from "./breadcrumbs";

describe("BASE", () => {
  it("equals the production URL", () => {
    expect(BASE).toBe("https://garammasaladating.com");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("returns valid JSON", () => {
    const result = buildBreadcrumbJsonLd([{ name: "Home", url: "/" }]);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("includes correct @context and @type", () => {
    const parsed = JSON.parse(buildBreadcrumbJsonLd([{ name: "Home" }]));
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("BreadcrumbList");
  });

  it("includes item field when crumb has url", () => {
    const parsed = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "Home", url: "https://example.com" }]),
    );
    expect(parsed.itemListElement[0].item).toBe("https://example.com");
  });

  it("omits item field when crumb has no url", () => {
    const parsed = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "Current Page" }]),
    );
    expect(parsed.itemListElement[0]).not.toHaveProperty("item");
  });

  it("uses 1-based position numbering", () => {
    const crumbs = [
      { name: "Home", url: "/" },
      { name: "About", url: "/about" },
      { name: "Team" },
    ];
    const parsed = JSON.parse(buildBreadcrumbJsonLd(crumbs));
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[1].position).toBe(2);
    expect(parsed.itemListElement[2].position).toBe(3);
  });

  it("sets correct name for each crumb", () => {
    const crumbs = [{ name: "Home", url: "/" }, { name: "FAQ" }];
    const parsed = JSON.parse(buildBreadcrumbJsonLd(crumbs));
    expect(parsed.itemListElement[0].name).toBe("Home");
    expect(parsed.itemListElement[1].name).toBe("FAQ");
  });

  it("returns valid schema with empty crumbs array", () => {
    const parsed = JSON.parse(buildBreadcrumbJsonLd([]));
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toEqual([]);
  });

  it("each item has @type ListItem", () => {
    const parsed = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "Home", url: "/" }]),
    );
    expect(parsed.itemListElement[0]["@type"]).toBe("ListItem");
  });
});
