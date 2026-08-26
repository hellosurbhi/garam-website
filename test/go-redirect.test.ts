import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventEntry } from "@/data/events";

vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

vi.mock("@/lib/capi", () => ({
  sendCapiEvent: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/data/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/events")>();
  return { ...actual, getEventBySlug: vi.fn() };
});

const { enforceRateLimit } = await import("@/lib/rateLimit");
const { sendCapiEvent } = await import("@/lib/capi");
const { getEventBySlug } = await import("@/data/events");
const { GET } = await import("@/pages/api/go/[slug]");

const CHECKOUT_URL = "https://www.eventbrite.com/e/test-show-tickets-123";

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Dec 31",
    city: "Manhattan",
    state: "New York",
    stateAbbr: "NY",
    citySlug: "manhattan",
    slug: "manhattan-2099-12-31",
    description: "Test show",
    lineup: [],
    ticketSource: "eventbrite-owned",
    url: CHECKOUT_URL,
    isoDate: "2099-12-31",
    ...overrides,
  } as EventEntry;
}

function makeContext(slug: string, headers: Record<string, string> = {}) {
  const request = new Request(`https://garammasaladating.com/api/go/${slug}`, {
    headers,
  });
  return { params: { slug }, request } as unknown as Parameters<typeof GET>[0];
}

describe("/api/go/[slug] tracked redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.META_CAPI_ACCESS_TOKEN = "test-token";
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  afterEach(() => {
    delete import.meta.env.META_CAPI_ACCESS_TOKEN;
  });

  it("404s an unknown slug", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(undefined);
    const res = await GET(makeContext("nope"));
    expect(res.status).toBe(404);
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("404s an event with no checkout destination yet", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(makeEvent({ url: "" }));
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(404);
  });

  it("redirects a live upcoming event to its checkout url with CAPI fired", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location.startsWith(CHECKOUT_URL)).toBe(true);
    expect(location).toContain("utm_source=garamsite");
    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
  });

  it("sends a canceled show to /tickets without firing CAPI", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(
      makeEvent({ status: "canceled" }),
    );
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/tickets");
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("sends a past show to /tickets without firing CAPI", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(
      makeEvent({ isoDate: "2020-01-01", slug: "manhattan-2020-01-01" }),
    );
    const res = await GET(makeContext("manhattan-2020-01-01"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/tickets");
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("still redirects a rate-limited request, only suppressing CAPI", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(
      new Response("Too many requests", { status: 429 }),
    );
    vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")!.startsWith(CHECKOUT_URL)).toBe(true);
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  // A browser prefetch carries the visitor's own browser User-Agent, so the
  // bot denylist above can never catch it; only the speculation headers can.
  it.each([
    ["sec-purpose", "prefetch"],
    ["sec-purpose", "prefetch;prerender"],
    ["purpose", "prefetch"],
    ["x-purpose", "preview"],
    ["x-moz", "prefetch"],
    ["sec-fetch-mode", "no-cors"],
  ])(
    "redirects a speculative request (%s: %s) without firing CAPI",
    async (header, value) => {
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      const res = await GET(
        makeContext("manhattan-2099-12-31", {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
          [header]: value,
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")!.startsWith(CHECKOUT_URL)).toBe(true);
      expect(sendCapiEvent).not.toHaveBeenCalled();
    },
  );

  it("fires CAPI for a real top-level navigation", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
    const res = await GET(
      makeContext("manhattan-2099-12-31", {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      }),
    );
    expect(res.status).toBe(302);
    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
  });

  it("redirects a recognized unfurl bot without firing CAPI", async () => {
    vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
    const res = await GET(
      makeContext("manhattan-2099-12-31", {
        "user-agent":
          "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")!.startsWith(CHECKOUT_URL)).toBe(true);
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  // Every enforceRateLimit call spends one unit of the shared per-IP budget,
  // and a prefetch arrives on the visitor's own IP. Charging fetches that can
  // never fire CAPI let a page speculating over several ticket links exhaust
  // the budget, so the visitor's real click found it empty and went untracked.
  describe("does not spend the tracking budget on requests that can't fire CAPI", () => {
    it("skips the rate limit for a speculative prefetch", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      const res = await GET(
        makeContext("manhattan-2099-12-31", { "sec-purpose": "prefetch" }),
      );
      expect(res.status).toBe(302);
      expect(enforceRateLimit).not.toHaveBeenCalled();
      expect(sendCapiEvent).not.toHaveBeenCalled();
    });

    it("skips the rate limit for a recognized unfurl bot", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      const res = await GET(
        makeContext("manhattan-2099-12-31", {
          "user-agent": "Slackbot-LinkExpanding 1.0",
        }),
      );
      expect(res.status).toBe(302);
      expect(enforceRateLimit).not.toHaveBeenCalled();
      expect(sendCapiEvent).not.toHaveBeenCalled();
    });

    it("skips the rate limit when CAPI is not configured at all", async () => {
      delete import.meta.env.META_CAPI_ACCESS_TOKEN;
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      const res = await GET(makeContext("manhattan-2099-12-31"));
      expect(res.status).toBe(302);
      expect(enforceRateLimit).not.toHaveBeenCalled();
    });

    it("still spends it on a real navigation, which is what the budget is for", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      await GET(
        makeContext("manhattan-2099-12-31", {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
          "sec-fetch-mode": "navigate",
        }),
      );
      expect(enforceRateLimit).toHaveBeenCalledTimes(1);
      expect(sendCapiEvent).toHaveBeenCalledTimes(1);
    });
  });

  // Filtering a prefetch out of CAPI is only half the job: a cached 302 can
  // still satisfy the real activation that follows, so the click never
  // reaches us and the conversion is lost through the other door. no-store is
  // what covers the activation paths no client-side handler can see
  // (context-menu "Open link in new tab", dragging the link, no-JS).
  describe("never lets a response be cached and replayed", () => {
    it("marks the checkout redirect no-store", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(makeEvent());
      const res = await GET(
        makeContext("manhattan-2099-12-31", { "sec-purpose": "prefetch" }),
      );
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("marks the /tickets fallback for a canceled show no-store", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(
        makeEvent({ status: "canceled" }),
      );
      const res = await GET(makeContext("manhattan-2099-12-31"));
      expect(res.headers.get("Location")).toBe("/tickets");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("marks the unknown-slug 404 no-store", async () => {
      vi.mocked(getEventBySlug).mockReturnValue(undefined);
      const res = await GET(makeContext("nope"));
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
