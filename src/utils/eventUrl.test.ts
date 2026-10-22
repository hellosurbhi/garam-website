import { describe, it, expect, vi, afterEach } from "vitest";
import { applyTicketAttribution, buildTicketUrl } from "@/utils/eventUrl";

// WHY mocked: getStoredUtms reads sessionStorage, which only exists in a
// browser. buildTicketUrl must pass those values through only when a window
// exists; the mock lets one test prove both sides of that check.
vi.mock("@/lib/leadAttribution", () => ({
  getStoredUtms: () => ({ utmSource: "instagram" }),
}));

const BASE = "https://www.eventbrite.com/e/test-tickets-123";

describe("applyTicketAttribution", () => {
  it("sets aff and falls back to garamsite UTM defaults", () => {
    const u = new URL(applyTicketAttribution(BASE, "tickets", "listing", {}));
    expect(u.searchParams.get("aff")).toBe("garamsitetickets");
    expect(u.searchParams.get("utm_source")).toBe("garamsite");
    expect(u.searchParams.get("utm_medium")).toBe("web");
    expect(u.searchParams.get("utm_campaign")).toBe("tickets");
    expect(u.searchParams.get("utm_content")).toBe("listing");
  });

  it("appends content to aff only for the home surface", () => {
    const u = new URL(applyTicketAttribution(BASE, "home", "hero", {}));
    expect(u.searchParams.get("aff")).toBe("garamsitehomehero");
  });

  it("prefers incoming visitor UTMs over defaults", () => {
    const u = new URL(
      applyTicketAttribution(BASE, "home", "hero", {
        utmSource: "instagram",
        utmCampaign: "bio",
      }),
    );
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_campaign")).toBe("bio");
    expect(u.searchParams.get("utm_content")).toBe("hero");
  });

  it("returns an empty or unparseable url unchanged", () => {
    expect(applyTicketAttribution("", "home", "hero", {})).toBe("");
    expect(applyTicketAttribution("not a url", "home", "hero", {})).toBe(
      "not a url",
    );
  });
});

describe("buildTicketUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses defaults on the server where there is no window", () => {
    // The suite runs under jsdom, so the server case must be simulated.
    vi.stubGlobal("window", undefined);
    const u = new URL(buildTicketUrl(BASE, "tickets", "listing"));
    expect(u.searchParams.get("utm_source")).toBe("garamsite");
    expect(u.searchParams.get("aff")).toBe("garamsitetickets");
  });

  it("forwards stored visitor UTMs in the browser", () => {
    vi.stubGlobal("window", {});
    const u = new URL(buildTicketUrl(BASE, "tickets", "listing"));
    expect(u.searchParams.get("utm_source")).toBe("instagram");
  });
});
