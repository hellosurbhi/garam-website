import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventEntry } from "@/data/events";

vi.mock("@/lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimit")>();
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

vi.mock("@/lib/capi", () => ({
  sendCapiEvent: vi.fn(async () => ({ ok: true })),
}));

// WHY the live list is mocked and getEventBySlug is real: the route must
// resolve slugs against the published list from getLiveEvents (issue 337),
// never the build's baked list. Every fixture below exists only in the live
// list, so a route that read the baked list would 404 them.
vi.mock("@/lib/publishedEvents.server", () => ({ getLiveEvents: vi.fn() }));

// WHY mocked instead of letting the real @vercel/functions waitUntil run
// (added after Codex review, 2026-08-27): the real implementation is a
// no-op outside Vercel's runtime (see node_modules/@vercel/functions/
// wait-until.js), so it never blocks either way, real or mocked. Mocking it
// lets the test below capture the exact promise passed to it and control
// when the background work settles, which is the only way to prove GET
// resolves before that work finishes rather than merely observing that it
// happens to finish fast.
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

const { enforceRateLimit } = await import("@/lib/rateLimit");
const { sendCapiEvent } = await import("@/lib/capi");
const { getLiveEvents } = await import("@/lib/publishedEvents.server");
const { publishedSnapshot } = await import("@/data/events");
const { waitUntil } = await import("@vercel/functions");
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
    ticketSource: "our-eventbrite",
    url: CHECKOUT_URL,
    isoDate: "2099-12-31",
    ...overrides,
  } as EventEntry;
}

/** Serve `event` (or nothing) as the whole live published list. */
function serveLive(event?: EventEntry) {
  const list = event ? [event] : [];
  vi.mocked(getLiveEvents).mockResolvedValue({ events: list, allEvents: list });
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
    serveLive();
    const res = await GET(makeContext("nope"));
    expect(res.status).toBe(404);
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("resolves against the live list, not the build's baked list", async () => {
    const baked = publishedSnapshot.events.find((e) =>
      e.url.startsWith("https://"),
    );
    expect(baked).toBeDefined();
    serveLive();
    const res = await GET(makeContext(baked?.slug ?? ""));
    expect(res.status).toBe(404);
  });

  it("404s an event with no checkout destination yet", async () => {
    serveLive(makeEvent({ url: "" }));
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(404);
  });

  it("redirects a live upcoming event to its checkout url with CAPI fired", async () => {
    serveLive(makeEvent());
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location.startsWith(CHECKOUT_URL)).toBe(true);
    expect(location).toContain("utm_source=garamsite");
    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
  });

  it("sends a canceled show to /tickets without firing CAPI", async () => {
    serveLive(makeEvent({ status: "canceled" }));
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/tickets");
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("sends a past show to /tickets without firing CAPI", async () => {
    serveLive(
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
    serveLive(makeEvent());
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")!.startsWith(CHECKOUT_URL)).toBe(true);
    expect(sendCapiEvent).not.toHaveBeenCalled();
  });

  it("redirects before the background rate-limit/CAPI work settles", async () => {
    let releaseLimiter!: () => void;
    const pendingLimiter = new Promise<Response | null>((resolve) => {
      releaseLimiter = () => resolve(null);
    });
    vi.mocked(enforceRateLimit).mockReturnValue(pendingLimiter);
    serveLive(makeEvent());

    // If GET ever went back to awaiting enforceRateLimit directly instead of
    // handing recordClickSignals() to waitUntil(), this would hang until the
    // test's timeout instead of resolving.
    const res = await GET(makeContext("manhattan-2099-12-31"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")!.startsWith(CHECKOUT_URL)).toBe(true);

    expect(vi.mocked(waitUntil)).toHaveBeenCalledTimes(1);
    expect(sendCapiEvent).not.toHaveBeenCalled();

    releaseLimiter();
    await vi.mocked(waitUntil).mock.calls[0][0];
    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
  });

  it("redirects a recognized unfurl bot without firing CAPI", async () => {
    serveLive(makeEvent());
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
