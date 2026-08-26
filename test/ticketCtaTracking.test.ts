import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ capture: vi.fn() }));

const { capture } = await import("@/lib/analytics");
const { wireTicketCtaTracking } = await import("@/lib/ticketCtaTracking");

const GO_HREF = "/api/go/manhattan-2099-12-31";
const PAGE_URL = "https://garammasaladating.com/events/manhattan-2099-12-31";

// jsdom implements no navigation, so an unprevented click on an anchor logs a
// "Not implemented" error. This document-level listener runs after the
// anchor's own handler and swallows the navigation, recording whether the
// handler had already called preventDefault so the delayed-handoff behavior
// stays observable.
let preventedByHandler = false;
function swallowNavigation(event: Event): void {
  preventedByHandler = event.defaultPrevented;
  event.preventDefault();
}

function renderCta(attrs = ""): HTMLAnchorElement {
  document.body.innerHTML = `
    <a
      href="${GO_HREF}"
      data-go-ticket
      data-event-slug="manhattan-2099-12-31"
      data-event-city="Manhattan"
      data-event-date="Dec 31"
      data-event-title="Garam Masala Dating"
      data-event-vendor="eventbrite"
      data-cta-position="hero"
      data-cta-text="Get Tickets"
      ${attrs}
    >Get Tickets</a>`;
  return document.querySelector("a")!;
}

/** Dispatches a click and reports whether the CTA handler prevented it. */
function clickOn(
  anchor: HTMLAnchorElement,
  init: MouseEventInit = {},
): boolean {
  preventedByHandler = false;
  anchor.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    }),
  );
  return preventedByHandler;
}

/**
 * Dispatches an `auxclick`, the event a non-primary button actually produces.
 * `click` never fires for these, which is why the handler's `button !== 0`
 * branch alone could not cover a middle-click.
 */
function auxClickOn(anchor: HTMLAnchorElement, button: number): void {
  anchor.dispatchEvent(
    new MouseEvent("auxclick", { bubbles: true, cancelable: true, button }),
  );
}

function eidOf(anchor: HTMLAnchorElement): string | null {
  return new URL(anchor.href, window.location.origin).searchParams.get("eid");
}

describe("wireTicketCtaTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: new URL(PAGE_URL),
    });
    document.addEventListener("click", swallowNavigation);
  });

  afterEach(() => {
    document.removeEventListener("click", swallowNavigation);
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  // THE regression test for the inflated-conversion bug: an href that already
  // carries ?eid= at render time is prefetchable, and a browser prefetch
  // sends the visitor's own User-Agent, so the server could not tell that
  // speculative fetch apart from a real click (src/lib/isSpeculativeRequest.ts
  // is the server half of the same fix).
  it("leaves the eid off the href until the anchor is actually clicked", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    expect(anchor.getAttribute("href")).not.toContain("eid=");
    expect(eidOf(anchor)).toBeNull();
  });

  it("stamps the eid on click and reports the same id to analytics", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    clickOn(anchor);

    const eid = eidOf(anchor);
    expect(eid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      "checkout_opened",
      expect.objectContaining({
        event_id: eid,
        event_slug: "manhattan-2099-12-31",
        event_city: "Manhattan",
        cta_position: "hero",
        cta_text: "Get Tickets",
      }),
      { eventId: eid },
    );
  });

  // Deliberate, documented behavior: repeated clicks on one rendered anchor
  // are a single checkout intent, so the id is minted per anchor and reused.
  it("reuses one eid across repeated clicks instead of appending more", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    clickOn(anchor);
    const first = eidOf(anchor);
    clickOn(anchor);

    expect(eidOf(anchor)).toBe(first);
    expect(anchor.href.match(/eid=/g)).toHaveLength(1);
  });

  it("forwards stored first-touch UTMs onto the href at wire time", () => {
    sessionStorage.setItem("gmd-utm-source", "ig");
    sessionStorage.setItem("gmd-utm-medium", "social");
    sessionStorage.setItem("gmd-utm-campaign", "bio");
    const anchor = renderCta();

    wireTicketCtaTracking();

    const params = new URL(anchor.href).searchParams;
    expect(params.get("utm_source")).toBe("ig");
    expect(params.get("utm_medium")).toBe("social");
    expect(params.get("utm_campaign")).toBe("bio");
    // Still no eid: the UTMs are prefetch-safe, the click id is not.
    expect(params.get("eid")).toBeNull();
  });

  it("wires each anchor once even when several components call it", () => {
    const anchor = renderCta();

    wireTicketCtaTracking();
    wireTicketCtaTracking();
    clickOn(anchor);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(anchor.href.match(/eid=/g)).toHaveLength(1);
  });

  it("stamps the eid for a new-tab click and lets the browser navigate", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    const prevented = clickOn(anchor, { metaKey: true });

    expect(prevented).toBe(false);
    expect(eidOf(anchor)).not.toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("stamps the eid for a target=_blank click without delaying it", () => {
    const anchor = renderCta('target="_blank"');
    wireTicketCtaTracking();

    const prevented = clickOn(anchor);

    expect(prevented).toBe(false);
    expect(eidOf(anchor)).not.toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
  });

  // Regression test for the second half of the prefetch-swallowing bug: a
  // middle-click opens the link in a new tab like a modified click does, but
  // it fires `auxclick`, not `click`, so it used to reach checkout with no
  // analytics event and a bare href that a prefetcher may already have cached.
  it("stamps the eid for a middle-click, which fires auxclick and not click", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    auxClickOn(anchor, 1);

    const eid = eidOf(anchor);
    expect(eid).not.toBeNull();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      "checkout_opened",
      expect.objectContaining({ event_id: eid }),
      { eventId: eid },
    );
  });

  it("reuses the anchor's one eid across a click and a middle-click", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    clickOn(anchor);
    const first = eidOf(anchor);
    auxClickOn(anchor, 1);

    expect(eidOf(anchor)).toBe(first);
    expect(anchor.href.match(/eid=/g)).toHaveLength(1);
  });

  it("never delays or cancels the native middle-click navigation", () => {
    vi.useFakeTimers();
    const anchor = renderCta();
    wireTicketCtaTracking();

    let prevented = false;
    anchor.addEventListener("auxclick", (e) => {
      prevented = e.defaultPrevented;
    });
    auxClickOn(anchor, 1);

    expect(prevented).toBe(false);
    vi.advanceTimersByTime(100);
    expect(window.location.href).toBe(PAGE_URL);
  });

  // The right button opens a context menu, which is not yet a navigation.
  // Counting it would report checkout intents for menus the visitor dismisses;
  // a tab actually opened from that menu is covered by the route's no-store
  // response instead (src/pages/api/go/[slug].ts).
  it("ignores a right-button auxclick", () => {
    const anchor = renderCta();
    wireTicketCtaTracking();

    auxClickOn(anchor, 2);

    expect(capture).not.toHaveBeenCalled();
    expect(eidOf(anchor)).toBeNull();
  });

  it("wires the auxclick listener once even when several components call it", () => {
    const anchor = renderCta();

    wireTicketCtaTracking();
    wireTicketCtaTracking();
    auxClickOn(anchor, 1);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(anchor.href.match(/eid=/g)).toHaveLength(1);
  });

  it("delays the same-tab handoff and navigates to the stamped href", () => {
    vi.useFakeTimers();
    const anchor = renderCta();
    wireTicketCtaTracking();

    const prevented = clickOn(anchor);
    expect(prevented).toBe(true);
    expect(window.location.href).not.toContain("/api/go/");

    vi.advanceTimersByTime(100);

    expect(window.location.href).toBe(anchor.href);
    expect(window.location.href).toContain("eid=");
  });
});
