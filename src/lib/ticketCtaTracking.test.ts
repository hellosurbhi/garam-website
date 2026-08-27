import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ capture: vi.fn() }));
vi.mock("@/lib/leadAttribution", () => ({ getStoredUtms: vi.fn(() => ({})) }));

const { capture } = await import("@/lib/analytics");
const { getStoredUtms } = await import("@/lib/leadAttribution");
const { wireTicketCtaTracking } = await import("./ticketCtaTracking");

function buildAnchor(
  overrides: Partial<HTMLAnchorElement> = {},
): HTMLAnchorElement {
  document.body.innerHTML = `
    <a data-go-ticket href="/api/go/manhattan-2099-12-31" data-event-slug="manhattan-2099-12-31">Get Tickets</a>
  `;
  const anchor = document.querySelector<HTMLAnchorElement>("[data-go-ticket]")!;
  Object.assign(anchor, overrides);
  return anchor;
}

function click(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  anchor.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
  );
}

describe("wireTicketCtaTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredUtms).mockReturnValue({});
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("stamps a stable event id and marks the anchor wired", () => {
    const anchor = buildAnchor();
    wireTicketCtaTracking();
    expect(anchor.dataset.eventId).toBeTruthy();
    expect(anchor.dataset.ctaWired).toBe("true");
  });

  it("does not double-wire an anchor on a second call", () => {
    const anchor = buildAnchor();
    wireTicketCtaTracking();
    const firstId = anchor.dataset.eventId;
    wireTicketCtaTracking();
    expect(anchor.dataset.eventId).toBe(firstId);
    expect(capture).not.toHaveBeenCalled();
  });

  it("forwards stored UTMs onto the href", () => {
    vi.mocked(getStoredUtms).mockReturnValue({
      utmSource: "instagram",
      utmMedium: "paid",
    });
    const anchor = buildAnchor();
    wireTicketCtaTracking();
    const url = new URL(anchor.href);
    expect(url.searchParams.get("utm_source")).toBe("instagram");
    expect(url.searchParams.get("utm_medium")).toBe("paid");
  });

  it("fires checkout_opened on click", () => {
    // target="_blank" isolates this assertion to capture() alone: the
    // same-tab path's real setTimeout-deferred navigation is exercised by
    // its own dedicated tests below, under fake timers.
    const anchor = buildAnchor({ target: "_blank" });
    wireTicketCtaTracking();
    click(anchor);
    expect(capture).toHaveBeenCalledWith(
      "checkout_opened",
      expect.objectContaining({ event_slug: "manhattan-2099-12-31" }),
      expect.objectContaining({ eventId: anchor.dataset.eventId }),
    );
  });

  it("lets a target=_blank click proceed without preventDefault or a loading state", () => {
    const anchor = buildAnchor({ target: "_blank" });
    wireTicketCtaTracking();
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(anchor.dataset.ctaLoading).toBeUndefined();
  });

  it("fires capture but lets the browser handle a modified click, without a loading state", () => {
    const anchor = buildAnchor();
    wireTicketCtaTracking();
    click(anchor, { metaKey: true });

    expect(capture).toHaveBeenCalled();
    expect(anchor.dataset.ctaLoading).toBeUndefined();
  });

  it("applies an instant loading state on a same-tab click and defers navigation", () => {
    vi.useFakeTimers();
    try {
      const anchor = buildAnchor();
      wireTicketCtaTracking();
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      anchor.dispatchEvent(clickEvent);

      expect(clickEvent.defaultPrevented).toBe(true);
      expect(anchor.dataset.ctaLoading).toBe("true");
      expect(anchor.getAttribute("aria-busy")).toBe("true");
      expect(anchor.textContent).toBe("Opening Checkout…");
      expect(anchor.querySelector(".event-cta__spinner")).not.toBeNull();
      // Navigation itself is deferred behind a 100ms setTimeout; not
      // advancing fake timers here keeps jsdom's unimplemented-navigation
      // warning out of this test, which only asserts the synchronous state.
    } finally {
      vi.useRealTimers();
    }
  });

  it("guards a second click during the loading window from re-firing capture or navigation", () => {
    vi.useFakeTimers();
    try {
      const anchor = buildAnchor();
      wireTicketCtaTracking();
      click(anchor);
      expect(capture).toHaveBeenCalledTimes(1);

      const secondEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      anchor.dispatchEvent(secondEvent);

      expect(secondEvent.defaultPrevented).toBe(true);
      expect(capture).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the original label when the page is shown from bfcache", () => {
    vi.useFakeTimers();
    try {
      const anchor = buildAnchor();
      wireTicketCtaTracking();
      click(anchor);
      expect(anchor.dataset.ctaLoading).toBe("true");

      window.dispatchEvent(
        Object.assign(new Event("pageshow"), { persisted: true }),
      );

      expect(anchor.dataset.ctaLoading).toBeUndefined();
      expect(anchor.getAttribute("aria-busy")).toBeNull();
      expect(anchor.textContent).toBe("Get Tickets");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a pageshow event that is not a bfcache restore", () => {
    const anchor = buildAnchor();
    wireTicketCtaTracking();
    anchor.dataset.ctaLoading = "true";
    anchor.setAttribute("aria-busy", "true");

    window.dispatchEvent(
      Object.assign(new Event("pageshow"), { persisted: false }),
    );

    expect(anchor.dataset.ctaLoading).toBe("true");
    expect(anchor.getAttribute("aria-busy")).toBe("true");
  });
});
