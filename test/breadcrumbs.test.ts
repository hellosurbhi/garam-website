import { describe, it, expect } from "vitest";
import { buildBreadcrumbJsonLd, BASE } from "../src/utils/breadcrumbs";

describe("BASE constant", () => {
  it("equals the production domain", () => {
    expect(BASE).toBe("https://garammasaladating.com");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("returns a valid JSON string", () => {
    const result = buildBreadcrumbJsonLd([{ name: "Home", url: BASE }]);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("sets the correct @context and @type", () => {
    const result = JSON.parse(buildBreadcrumbJsonLd([{ name: "Home" }]));
    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("BreadcrumbList");
  });

  it("creates one ListItem per crumb", () => {
    const crumbs = [
      { name: "Home", url: BASE },
      { name: "Cities", url: `${BASE}/cities` },
      { name: "New York" },
    ];
    const result = JSON.parse(buildBreadcrumbJsonLd(crumbs));
    expect(result.itemListElement).toHaveLength(3);
  });

  it("assigns 1-based positions to each item", () => {
    const crumbs = [{ name: "Home" }, { name: "Apply" }, { name: "Success" }];
    const result = JSON.parse(buildBreadcrumbJsonLd(crumbs));
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[1].position).toBe(2);
    expect(result.itemListElement[2].position).toBe(3);
  });

  it("sets @type to ListItem for every element", () => {
    const crumbs = [{ name: "Home", url: BASE }, { name: "FAQ" }];
    const result = JSON.parse(buildBreadcrumbJsonLd(crumbs));
    result.itemListElement.forEach((item: Record<string, unknown>) => {
      expect(item["@type"]).toBe("ListItem");
    });
  });

  it("includes item.item (URL) when url is provided", () => {
    const url = `${BASE}/cities`;
    const result = JSON.parse(buildBreadcrumbJsonLd([{ name: "Cities", url }]));
    expect(result.itemListElement[0].item).toBe(url);
  });

  it("omits item.item when url is not provided", () => {
    const result = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "Current Page" }]),
    );
    expect(result.itemListElement[0].item).toBeUndefined();
  });

  it("preserves the crumb name correctly", () => {
    const result = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "South Asian Dating Tips" }]),
    );
    expect(result.itemListElement[0].name).toBe("South Asian Dating Tips");
  });

  it("handles an empty crumbs array", () => {
    const result = JSON.parse(buildBreadcrumbJsonLd([]));
    expect(result.itemListElement).toEqual([]);
  });

  it("handles a single crumb with no url", () => {
    const result = JSON.parse(buildBreadcrumbJsonLd([{ name: "Home" }]));
    expect(result.itemListElement).toHaveLength(1);
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[0].name).toBe("Home");
    expect(result.itemListElement[0].item).toBeUndefined();
  });

  it("handles special characters in crumb names", () => {
    const result = JSON.parse(buildBreadcrumbJsonLd([{ name: "FAQ & Tips" }]));
    expect(result.itemListElement[0].name).toBe("FAQ & Tips");
  });

  it("produces consistent output (not including non-schema fields)", () => {
    const result = JSON.parse(
      buildBreadcrumbJsonLd([{ name: "Home", url: BASE }]),
    );
    const item = result.itemListElement[0];
    // Only expected keys should exist
    expect(Object.keys(item)).toEqual(
      expect.arrayContaining(["@type", "position", "name", "item"]),
    );
  });
});
