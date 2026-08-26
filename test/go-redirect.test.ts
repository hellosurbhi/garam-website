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
});
