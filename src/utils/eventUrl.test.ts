import { describe, it, expect } from "vitest";
import { applyTicketAttribution } from "@/utils/eventUrl";

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
