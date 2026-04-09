import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
});
