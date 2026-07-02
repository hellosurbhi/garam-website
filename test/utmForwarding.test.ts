import { describe, it, expect, beforeEach } from "vitest";
import { getStoredUtms } from "@/lib/leadAttribution";
import { applyUtmsToUrl } from "@/utils/utmForwarding";

describe("UTM forwarding", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("getStoredUtms returns empty object when no session UTMs stored", () => {
    expect(getStoredUtms()).toEqual({});
  });

  it("getStoredUtms reads gmd-utm-* keys from sessionStorage", () => {
    sessionStorage.setItem("gmd-utm-source", "ig");
    sessionStorage.setItem("gmd-utm-medium", "social");
    sessionStorage.setItem("gmd-utm-campaign", "bio");
    expect(getStoredUtms()).toEqual({
      utmSource: "ig",
      utmMedium: "social",
      utmCampaign: "bio",
    });
  });

  it("applyUtmsToUrl forwards stored UTMs when visitor has them", () => {
    const stored = {
      utmSource: "ig",
      utmMedium: "social",
      utmCampaign: "bio",
      utmContent: "story",
    };
    const result = applyUtmsToUrl("https://eventbrite.com/e/1", stored, {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: "tickets",
      utmContent: "listing",
    });
    const url = new URL(result);
    expect(url.searchParams.get("utm_source")).toBe("ig");
    expect(url.searchParams.get("utm_medium")).toBe("social");
    expect(url.searchParams.get("utm_campaign")).toBe("bio");
    expect(url.searchParams.get("utm_content")).toBe("story");
  });

  it("applyUtmsToUrl falls back to defaults when visitor UTMs are missing", () => {
    const result = applyUtmsToUrl(
      "https://eventbrite.com/e/1",
      {},
      {
        utmSource: "garamsite",
        utmMedium: "web",
        utmCampaign: "tickets",
        utmContent: "listing",
      },
    );
    const url = new URL(result);
    expect(url.searchParams.get("utm_source")).toBe("garamsite");
    expect(url.searchParams.get("utm_medium")).toBe("web");
    expect(url.searchParams.get("utm_campaign")).toBe("tickets");
    expect(url.searchParams.get("utm_content")).toBe("listing");
  });

  it("applyUtmsToUrl preserves existing UTMs on the base URL (no clobber)", () => {
    const result = applyUtmsToUrl(
      "https://eventbrite.com/e/1?utm_source=preserved",
      {},
      {
        utmSource: "garamsite",
        utmMedium: "web",
        utmCampaign: "tickets",
        utmContent: "listing",
      },
    );
    const url = new URL(result);
    expect(url.searchParams.get("utm_source")).toBe("preserved");
    // Other params are filled in from defaults since base only has source
    expect(url.searchParams.get("utm_medium")).toBe("web");
  });

  it("applyUtmsToUrl also sets utm_term when provided in stored UTMs", () => {
    const stored = {
      utmSource: "ig",
      utmMedium: "social",
      utmCampaign: "bio",
      utmTerm: "desi",
    };
    const result = applyUtmsToUrl("https://eventbrite.com/e/1", stored, {
      utmSource: "garamsite",
      utmMedium: "web",
      utmCampaign: "tickets",
      utmContent: "listing",
    });
    const url = new URL(result);
    expect(url.searchParams.get("utm_term")).toBe("desi");
  });
});
