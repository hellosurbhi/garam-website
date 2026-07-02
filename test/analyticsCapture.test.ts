import { describe, it, expect, beforeEach, vi } from "vitest";
import { capture, enrichEvent } from "@/lib/analyticsCapture";

describe("analyticsCapture", () => {
  beforeEach(() => {
    window.posthog = { capture: vi.fn() };
    window.dataLayer = [];
    window.fbq = vi.fn();
    // Set URL with UTM params
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: new URL(
        "https://garammasaladating.com/tickets?utm_source=ig&utm_medium=social&utm_campaign=bio",
      ),
    });
    sessionStorage.clear();
  });

  it("enrichEvent adds URL, pathname, referrer, and current UTMs", () => {
    const enriched = enrichEvent({ cta_text: "Grab My Spot" });
    expect(enriched.current_url).toBe(
      "https://garammasaladating.com/tickets?utm_source=ig&utm_medium=social&utm_campaign=bio",
    );
    expect(enriched.pathname).toBe("/tickets");
    expect(enriched.utm_source).toBe("ig");
    expect(enriched.utm_medium).toBe("social");
    expect(enriched.utm_campaign).toBe("bio");
    expect(enriched.source_page).toBe("/tickets");
    expect(enriched.cta_text).toBe("Grab My Spot");
    expect(enriched.page_type).toBe("tickets");
  });

  it("capture forwards enriched properties to posthog and dataLayer", () => {
    capture("ticket_click", {
      cta_text: "Buy Tickets",
      destination_url: "https://eventbrite.com/e/1",
    });
    expect(window.posthog!.capture).toHaveBeenCalledWith(
      "ticket_click",
      expect.objectContaining({
        cta_text: "Buy Tickets",
        destination_url: "https://eventbrite.com/e/1",
        utm_source: "ig",
        pathname: "/tickets",
      }),
    );
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "ticket_click",
        cta_text: "Buy Tickets",
      }),
    );
  });

  it("capture forwards mapped Meta events", () => {
    capture("apply_submitted", { application_type: "self" });
    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "CompleteRegistration",
      expect.any(Object),
    );
  });

  it("capture forwards waitlist_submit and email_signup to Meta as Lead", () => {
    capture("waitlist_submit", { city: "NYC" });
    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "Lead",
      expect.any(Object),
    );

    vi.mocked(window.fbq!).mockClear();
    capture("email_signup", { source: "spice-list" });
    expect(window.fbq).toHaveBeenCalledWith(
      "track",
      "Lead",
      expect.any(Object),
    );
  });

  it("capture is a no-op on posthog when posthog is undefined (before load)", () => {
    delete window.posthog;
    expect(() => capture("ticket_click", { cta_text: "Buy" })).not.toThrow();
    // Should still push to dataLayer for GTM even without posthog
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({ event: "ticket_click" }),
    );
  });

  it("enrichEvent returns passed-in properties unchanged when run server-side (window undefined)", () => {
    // Simulate server-side by temporarily hiding window
    const origWindow = global.window;
    // @ts-expect-error testing SSR environment
    delete global.window;
    try {
      const enriched = enrichEvent({ foo: "bar" });
      expect(enriched.foo).toBe("bar");
    } finally {
      global.window = origWindow;
    }
  });
});
