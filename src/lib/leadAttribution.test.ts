import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  bootstrapLeadAttribution,
  buildLeadAttribution,
} from "./leadAttribution";

describe("bootstrapLeadAttribution", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Set up default window.location
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/apply",
        search: "",
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    delete (window as Record<string, unknown>).posthog;
  });

  it("stores landing page in sessionStorage", () => {
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-landing-page")).toBe("/apply");
  });

  it("does not overwrite landing page on subsequent call", () => {
    bootstrapLeadAttribution();
    Object.defineProperty(window, "location", {
      value: { pathname: "/tickets", search: "" },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-landing-page")).toBe("/apply");
  });

  it("stores referrer host from document.referrer", () => {
    Object.defineProperty(document, "referrer", {
      value: "https://www.google.com/search?q=dating",
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-referrer-host")).toBe("www.google.com");
  });

  it("skips referrer when document.referrer is empty", () => {
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-referrer-host")).toBeNull();
  });

  it("stores UTM parameters from URL", () => {
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/apply",
        search:
          "?utm_source=instagram&utm_medium=social&utm_campaign=spring2026&utm_content=bio&utm_term=dating",
      },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-utm-source")).toBe("instagram");
    expect(sessionStorage.getItem("gmd-utm-medium")).toBe("social");
    expect(sessionStorage.getItem("gmd-utm-campaign")).toBe("spring2026");
    expect(sessionStorage.getItem("gmd-utm-content")).toBe("bio");
    expect(sessionStorage.getItem("gmd-utm-term")).toBe("dating");
  });

  it("skips UTM parameters that are not present", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/apply", search: "?utm_source=ig" },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-utm-source")).toBe("ig");
    expect(sessionStorage.getItem("gmd-utm-medium")).toBeNull();
    expect(sessionStorage.getItem("gmd-utm-campaign")).toBeNull();
  });

  it("handles malformed referrer URL gracefully", () => {
    Object.defineProperty(document, "referrer", {
      value: "not-a-valid-url",
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-referrer-host")).toBeNull();
  });

  it("falls back to / when pathname is empty", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "", search: "" },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-landing-page")).toBe("/");
  });

  it("does not store empty string UTM values", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/apply", search: "?utm_source=" },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    // utm_source="" is falsy, should not be stored
    expect(sessionStorage.getItem("gmd-utm-source")).toBeNull();
  });

  it("does not overwrite UTM values on second bootstrap call", () => {
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/apply",
        search: "?utm_source=first&utm_medium=first",
      },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/apply",
        search: "?utm_source=second&utm_medium=second",
      },
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-utm-source")).toBe("first");
    expect(sessionStorage.getItem("gmd-utm-medium")).toBe("first");
  });

  it("does not store referrer with empty hostname", () => {
    Object.defineProperty(document, "referrer", {
      value: "https://",
      writable: true,
      configurable: true,
    });
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-referrer-host")).toBeNull();
  });
});

describe("buildLeadAttribution", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      value: { pathname: "/apply", search: "" },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
    delete (window as Record<string, unknown>).posthog;
  });

  afterEach(() => {
    sessionStorage.clear();
    delete (window as Record<string, unknown>).posthog;
  });

  it("returns required fields: source, sourcePage, landingPage", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.source).toBe("apply-page");
    expect(result.sourcePage).toBe("/apply");
    expect(result.landingPage).toBe("/apply");
  });

  it("uses sessionStorage landing page when available", () => {
    sessionStorage.setItem("gmd-landing-page", "/tickets");
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.landingPage).toBe("/tickets");
  });

  it("falls back to current pathname when landing page not in sessionStorage", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.landingPage).toBe("/apply");
  });

  it("includes referrerHost when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-referrer-host", "www.google.com");
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.referrerHost).toBe("www.google.com");
  });

  it("omits referrerHost when not in sessionStorage", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("referrerHost");
  });

  it("includes UTM fields when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-utm-source", "instagram");
    sessionStorage.setItem("gmd-utm-medium", "social");
    sessionStorage.setItem("gmd-utm-campaign", "spring");
    sessionStorage.setItem("gmd-utm-content", "bio");
    sessionStorage.setItem("gmd-utm-term", "dating");
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.utmSource).toBe("instagram");
    expect(result.utmMedium).toBe("social");
    expect(result.utmCampaign).toBe("spring");
    expect(result.utmContent).toBe("bio");
    expect(result.utmTerm).toBe("dating");
  });

  it("omits UTM fields when not in sessionStorage", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("utmSource");
    expect(result).not.toHaveProperty("utmMedium");
    expect(result).not.toHaveProperty("utmCampaign");
    expect(result).not.toHaveProperty("utmContent");
    expect(result).not.toHaveProperty("utmTerm");
  });

  it("includes posthogDistinctId when posthog returns non-empty string", () => {
    (window as Record<string, unknown>).posthog = {
      get_distinct_id: () => "ph-user-123",
    };
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result.posthogDistinctId).toBe("ph-user-123");
  });

  it("excludes posthogDistinctId when it is whitespace-only", () => {
    (window as Record<string, unknown>).posthog = {
      get_distinct_id: () => "   ",
    };
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("posthogDistinctId");
  });

  it("excludes posthogDistinctId when posthog is undefined", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("posthogDistinctId");
  });

  it("includes sourceCitySlug when provided", () => {
    const result = buildLeadAttribution({
      source: "city-page",
      sourceCitySlug: "manhattan",
    });
    expect(result.sourceCitySlug).toBe("manhattan");
  });

  it("excludes sourceCitySlug when not provided", () => {
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("sourceCitySlug");
  });

  it("excludes posthogDistinctId when posthog returns a number", () => {
    (window as Record<string, unknown>).posthog = {
      get_distinct_id: () => 12345,
    };
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("posthogDistinctId");
  });

  it("excludes posthogDistinctId when posthog returns empty string", () => {
    (window as Record<string, unknown>).posthog = {
      get_distinct_id: () => "",
    };
    const result = buildLeadAttribution({ source: "apply-page" });
    expect(result).not.toHaveProperty("posthogDistinctId");
  });

  /* ── Geo data in build ──────────────────────────────── */

  it("includes geoCity when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-city", "New York");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoCity).toBe("New York");
  });

  it("includes geoRegion when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-region", "NY");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoRegion).toBe("NY");
  });

  it("includes geoCountry when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-country", "US");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoCountry).toBe("US");
  });

  it("includes geoLatitude when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-latitude", "40.7128");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoLatitude).toBe("40.7128");
  });

  it("includes geoLongitude when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-longitude", "-74.0060");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoLongitude).toBe("-74.0060");
  });

  it("includes geoTimezone when present in sessionStorage", () => {
    sessionStorage.setItem("gmd-geo-timezone", "America/New_York");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoTimezone).toBe("America/New_York");
  });

  it("omits geo fields when not in sessionStorage", () => {
    const result = buildLeadAttribution({ source: "apply" });
    expect(result).not.toHaveProperty("geoCity");
    expect(result).not.toHaveProperty("geoRegion");
    expect(result).not.toHaveProperty("geoCountry");
    expect(result).not.toHaveProperty("geoLatitude");
    expect(result).not.toHaveProperty("geoLongitude");
    expect(result).not.toHaveProperty("geoTimezone");
  });

  it("includes all geo fields when all present", () => {
    sessionStorage.setItem("gmd-geo-city", "Boston");
    sessionStorage.setItem("gmd-geo-region", "MA");
    sessionStorage.setItem("gmd-geo-country", "US");
    sessionStorage.setItem("gmd-geo-latitude", "42.36");
    sessionStorage.setItem("gmd-geo-longitude", "-71.06");
    sessionStorage.setItem("gmd-geo-timezone", "America/New_York");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.geoCity).toBe("Boston");
    expect(result.geoRegion).toBe("MA");
    expect(result.geoCountry).toBe("US");
    expect(result.geoLatitude).toBe("42.36");
    expect(result.geoLongitude).toBe("-71.06");
    expect(result.geoTimezone).toBe("America/New_York");
  });

  /* ── posthog edge cases ─────────────────────────────── */

  it("excludes posthogDistinctId when posthog has no get_distinct_id method", () => {
    (window as Record<string, unknown>).posthog = {};
    const result = buildLeadAttribution({ source: "apply" });
    expect(result).not.toHaveProperty("posthogDistinctId");
  });

  it("includes posthogDistinctId with non-empty trimmed string", () => {
    (window as Record<string, unknown>).posthog = {
      get_distinct_id: () => "  user-abc  ",
    };
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.posthogDistinctId).toBe("  user-abc  ");
  });

  /* ── Individual UTM field inclusion ─────────────────── */

  it("includes only utmSource when only that UTM is in storage", () => {
    sessionStorage.setItem("gmd-utm-source", "ig");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.utmSource).toBe("ig");
    expect(result).not.toHaveProperty("utmMedium");
    expect(result).not.toHaveProperty("utmCampaign");
  });

  it("includes only utmMedium when only that UTM is in storage", () => {
    sessionStorage.setItem("gmd-utm-medium", "social");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.utmMedium).toBe("social");
    expect(result).not.toHaveProperty("utmSource");
  });

  it("includes only utmCampaign when only that UTM is in storage", () => {
    sessionStorage.setItem("gmd-utm-campaign", "spring");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.utmCampaign).toBe("spring");
    expect(result).not.toHaveProperty("utmSource");
  });

  it("includes only utmContent when only that UTM is in storage", () => {
    sessionStorage.setItem("gmd-utm-content", "header");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.utmContent).toBe("header");
  });

  it("includes only utmTerm when only that UTM is in storage", () => {
    sessionStorage.setItem("gmd-utm-term", "dating");
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.utmTerm).toBe("dating");
  });

  /* ── source field ───────────────────────────────────── */

  it("source field matches the provided source parameter", () => {
    const result = buildLeadAttribution({ source: "tickets-page" });
    expect(result.source).toBe("tickets-page");
  });

  it("sourcePage reflects current pathname", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/tickets", search: "" },
      writable: true,
      configurable: true,
    });
    const result = buildLeadAttribution({ source: "apply" });
    expect(result.sourcePage).toBe("/tickets");
  });
});

/* ── bootstrapGeoData ─────────────────────────────────── */

describe("bootstrapLeadAttribution — geo data", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      value: { pathname: "/", search: "" },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
    delete (window as Record<string, unknown>).posthog;
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("fetches geo data from /api/geo on first bootstrap", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    bootstrapLeadAttribution();
    expect(fetchSpy).toHaveBeenCalledWith("/api/geo");
  });

  it("does not fetch geo data on second bootstrap", () => {
    sessionStorage.setItem("gmd-geo-fetched", "1");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    bootstrapLeadAttribution();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores geo city from API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          city: "Boston",
          region: "MA",
          country: "US",
          latitude: "42.36",
          longitude: "-71.06",
          timezone: "America/New_York",
        }),
        { status: 200 },
      ),
    );
    bootstrapLeadAttribution();
    // Wait for the fire-and-forget fetch to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem("gmd-geo-city")).toBe("Boston");
    expect(sessionStorage.getItem("gmd-geo-region")).toBe("MA");
    expect(sessionStorage.getItem("gmd-geo-country")).toBe("US");
    expect(sessionStorage.getItem("gmd-geo-latitude")).toBe("42.36");
    expect(sessionStorage.getItem("gmd-geo-longitude")).toBe("-71.06");
    expect(sessionStorage.getItem("gmd-geo-timezone")).toBe("America/New_York");
  });

  it("skips storing empty geo fields from API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ city: "Boston" }), { status: 200 }),
    );
    bootstrapLeadAttribution();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem("gmd-geo-city")).toBe("Boston");
    expect(sessionStorage.getItem("gmd-geo-region")).toBeNull();
  });

  it("handles non-ok geo response gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500 }),
    );
    bootstrapLeadAttribution();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem("gmd-geo-city")).toBeNull();
  });

  it("handles geo fetch failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    bootstrapLeadAttribution();
    await new Promise((r) => setTimeout(r, 50));
    // Should not throw, geo data just won't be stored
    expect(sessionStorage.getItem("gmd-geo-city")).toBeNull();
  });

  it("sets gmd-geo-fetched flag on bootstrap", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    bootstrapLeadAttribution();
    expect(sessionStorage.getItem("gmd-geo-fetched")).toBe("1");
  });
});
