import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAllEvents,
  publishedSnapshot,
  type EventEntry,
  type EventsSnapshot,
} from "@/data/events";

const mocks = vi.hoisted(() => ({
  alertOps: vi.fn(async () => true),
  waitUntil: vi.fn(),
}));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));

type Loader = typeof import("@/lib/publishedEvents.server");
let loader: Loader;
const fetchMock = vi.fn<typeof fetch>();

const LIVE_SHOW: EventEntry = {
  date: "Dec 31",
  city: "Manhattan",
  state: "New York",
  stateAbbr: "NY",
  citySlug: "manhattan",
  slug: "manhattan-2099-12-31",
  description: "Published from the admin, not yet rebuilt.",
  lineup: ["surbhi", "wyatt"],
  ticketSource: "our-eventbrite",
  url: "https://www.eventbrite.com/e/live-published-123",
  isoDate: "2099-12-31",
  eventbriteId: "123",
};

const liveSnapshot: EventsSnapshot = {
  events: [...publishedSnapshot.events, LIVE_SHOW],
  tbaCities: publishedSnapshot.tbaCities,
};

/** `eventsPublished/current` exactly as the Firestore REST API returns it. */
function publishedDoc(snapshot: unknown, version = 2): Response {
  return Response.json({
    name: "projects/demo-test/databases/(default)/documents/eventsPublished/current",
    fields: {
      version: { integerValue: String(version) },
      snapshotJson: { stringValue: JSON.stringify(snapshot) },
      publishedAt: { stringValue: "2026-11-11T12:00:00.000Z" },
      rebuild: { nullValue: null },
    },
    updateTime: "2026-11-11T12:00:00.000000Z",
  });
}

const today = () => new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "demo-test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mocks.alertOps.mockClear();
  mocks.waitUntil.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  loader = await import("@/lib/publishedEvents.server");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getLiveEvents", () => {
  it("reads the public published document with no credentials", async () => {
    fetchMock.mockResolvedValue(publishedDoc(liveSnapshot));
    await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://firestore.googleapis.com/v1/projects/demo-test/databases/(default)/documents/eventsPublished/current",
    );
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
  });

  it("serves the published snapshot instead of the baked one", async () => {
    fetchMock.mockResolvedValue(publishedDoc(liveSnapshot));
    const live = await loader.getLiveEvents();
    expect(live.events).toEqual(liveSnapshot.events);
    expect(live.allEvents).toEqual(buildAllEvents(liveSnapshot, today()));
    expect(live.allEvents).toContainEqual(LIVE_SHOW);
  });

  it("behaves exactly like the build when nothing is published yet", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const live = await loader.getLiveEvents();
    expect(live.events).toEqual(publishedSnapshot.events);
    expect(live.allEvents).toEqual(buildAllEvents(publishedSnapshot, today()));
    expect(console.error).not.toHaveBeenCalled();
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  it.each(["", "   "])(
    "skips the read quietly when the build has no project id (%j)",
    async (projectId) => {
      vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", projectId);
      const live = await loader.getLiveEvents();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(live.events).toEqual(publishedSnapshot.events);
      expect(live.allEvents).toEqual(
        buildAllEvents(publishedSnapshot, today()),
      );
      expect(console.error).not.toHaveBeenCalled();
      expect(mocks.alertOps).not.toHaveBeenCalled();
      expect(mocks.waitUntil).not.toHaveBeenCalled();
    },
  );

  it("falls back to the baked list and pages once when the read fails", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    const live = await loader.getLiveEvents();
    expect(live.events).toEqual(publishedSnapshot.events);
    expect(mocks.alertOps).toHaveBeenCalledTimes(1);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ flow: "ops", stage: "events_live_read" }),
    );
    expect(mocks.waitUntil).toHaveBeenCalledTimes(1);

    // Still failing after the TTL: retried, logged, but the same streak.
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_TTL_MS);
    await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(mocks.alertOps).toHaveBeenCalledTimes(1);
  });

  it("pages again for a new failure streak after a recovery", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await loader.getLiveEvents();
    fetchMock.mockResolvedValueOnce(publishedDoc(liveSnapshot));
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_TTL_MS);
    await loader.getLiveEvents();
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_TTL_MS);
    await loader.getLiveEvents();
    expect(mocks.alertOps).toHaveBeenCalledTimes(2);
  });

  it("treats an invalid snapshot as a failed read", async () => {
    const broken = {
      ...liveSnapshot,
      events: [{ ...LIVE_SHOW, url: "javascript:alert(1)" }],
    };
    fetchMock.mockResolvedValue(publishedDoc(broken));
    const live = await loader.getLiveEvents();
    expect(live.events).toEqual(publishedSnapshot.events);
    expect(mocks.alertOps).toHaveBeenCalledTimes(1);
  });

  it("keeps the last good published list when a later read fails", async () => {
    fetchMock.mockResolvedValueOnce(publishedDoc(liveSnapshot));
    await loader.getLiveEvents();
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_TTL_MS);
    const live = await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(live.events).toEqual(liveSnapshot.events);
  });

  it("re-reads only once the cache reaches the TTL", async () => {
    fetchMock.mockImplementation(async () => publishedDoc(liveSnapshot));
    await loader.getLiveEvents();
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_TTL_MS - 1);
    await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not re-read inside the TTL after a failure", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    await loader.getLiveEvents();
    await loader.getLiveEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one read between concurrent callers", async () => {
    fetchMock.mockImplementation(async () => publishedDoc(liveSnapshot));
    const [a, b, c] = await Promise.all([
      loader.getLiveEvents(),
      loader.getLiveEvents(),
      loader.getLiveEvents(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.events).toEqual(liveSnapshot.events);
    expect(b.events).toEqual(a.events);
    expect(c.events).toEqual(a.events);
  });

  it("serves the baked list once the deadline passes and cancels the read", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const pending = loader.getLiveEvents();
    await vi.advanceTimersByTimeAsync(loader.LIVE_EVENTS_DEADLINE_MS);
    const live = await pending;
    expect(live.events).toEqual(publishedSnapshot.events);
    expect(signal?.aborted).toBe(true);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: expect.stringContaining("Timeout"),
      }),
    );
  });

  it("recomputes TBA cards and past shows for the current day", async () => {
    fetchMock.mockImplementation(async () => publishedDoc(liveSnapshot));
    await loader.getLiveEvents();
    vi.setSystemTime(new Date("2100-01-02T00:00:00Z"));
    const later = await loader.getLiveEvents();
    expect(later.allEvents).toEqual(buildAllEvents(liveSnapshot, "2100-01-02"));
    // Guards the test itself: the two days must yield different lists.
    expect(later.allEvents).not.toEqual(
      buildAllEvents(liveSnapshot, "2026-11-11"),
    );
  });
});
