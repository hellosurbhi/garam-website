import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const sendCapiEvent = vi.fn();
const fetchEventOrders = vi.fn();

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: { syncOrders: {} },
}));
vi.mock("@/lib/verifyToken", () => ({
  verifyAdminToken: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn().mockResolvedValue("fs-token"),
}));
vi.mock("@/lib/opsAlert", () => ({ alertOps: vi.fn() }));
vi.mock("@/lib/eventbrite", () => ({
  fetchEventOrders: (...args: unknown[]) => fetchEventOrders(...args),
}));
vi.mock("@/lib/capi", () => ({
  sendCapiEvent: (...args: unknown[]) => sendCapiEvent(...args),
}));
vi.mock("@/data/events", () => ({
  events: [
    {
      city: "Manhattan",
      citySlug: "manhattan",
      slug: "manhattan-show",
      ticketSource: "our-eventbrite",
      eventbriteId: "EB1",
    },
  ],
}));

import { POST } from "@/pages/api/sync-orders";

type Fields = Record<string, Record<string, unknown>>;

const DOC_BASE =
  "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents";

const ebOrder = (orderId: string) => ({
  orderId,
  eventbriteEventId: "EB1",
  eventSlug: "manhattan",
  email: `${orderId}@example.com`,
  name: "Buyer",
  quantity: 2,
  grossRevenue: 50,
  netRevenue: 45,
  currency: "USD",
  status: "placed" as const,
  createdAt: "2026-10-20T12:00:00Z",
  syncedAt: "2026-10-21T12:00:00Z",
  matchedLeadId: null,
  attendees: [],
  purchaseCapiSent: false,
});

interface Harness {
  /** Stored order docs by id, as raw Firestore fields. */
  stored: Map<string, Fields>;
  /** Order ids returned by the pending-Purchase query, with their fields. */
  pending: { id: string; attempts: number }[];
  /** Every PATCH sent: [orderId, updateMask or "full"]. */
  patches: [string, string][];
  /** Full order upserts by id: the fields written. */
  upserts: Map<string, Fields>;
  /** Make the existing-state GET for this order id return a 500. */
  failStateRead: Set<string>;
}

function installFetch(h: Harness) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status });

      if (url === `${DOC_BASE}/syncMeta/eventbrite`) {
        return method === "PATCH" ? json({}) : json({}, 404);
      }
      if (url === `${DOC_BASE}:runQuery`) {
        const q = JSON.parse(String(init?.body)).structuredQuery;
        if (q.from[0].collectionId === "leads") return json([]);
        return json(
          h.pending.map((p) => ({
            document: {
              name: `projects/proj/databases/(default)/documents/orders/${p.id}`,
              fields: {
                eventbriteEventId: { stringValue: "EB1" },
                email: { stringValue: `${p.id}@example.com` },
                createdAt: { stringValue: "2026-10-20T12:00:00Z" },
                grossRevenue: { doubleValue: 50 },
                currency: { stringValue: "USD" },
                quantity: { integerValue: "2" },
                purchaseCapiAttempts: { integerValue: String(p.attempts) },
              },
            },
          })),
        );
      }
      const orderMatch = url.match(/\/orders\/([^/?]+)(?:\?(.+))?$/);
      if (orderMatch) {
        const [, id, query] = orderMatch;
        // Several fieldPaths join with "+" so a two-field PATCH is one entry.
        const mask = query
          ? [...query.matchAll(/updateMask\.fieldPaths=(\w+)/g)]
              .map((m) => m[1])
              .join("+")
          : undefined;
        if (method === "PATCH") {
          h.patches.push([id, mask ?? "full"]);
          if (!mask) {
            h.upserts.set(id, JSON.parse(String(init?.body)).fields);
          }
          return json({});
        }
        if (h.failStateRead.has(id)) {
          return json({ error: { message: "boom" } }, 500);
        }
        const doc = h.stored.get(id);
        return doc ? json({ name: id, fields: doc }) : json({}, 404);
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }),
  );
}

async function runSync() {
  const res = await POST({
    request: new Request("https://x.test/api/sync-orders", {
      method: "POST",
      headers: { authorization: "Bearer cron" },
    }),
  } as unknown as APIContext);
  return (await res.json()) as {
    ok: boolean;
    purchaseRetried: number;
    errors: string[];
  };
}

let h: Harness;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("CRON_SECRET", "cron");
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "proj");
  vi.stubEnv("EVENTBRITE_API_TOKEN", "eb");
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "meta");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  sendCapiEvent.mockReset();
  fetchEventOrders.mockReset();
  h = {
    stored: new Map(),
    pending: [],
    patches: [],
    upserts: new Map(),
    failStateRead: new Set(),
  };
  installFetch(h);
});

describe("sync-orders CAPI delivery state", () => {
  it("carries the stored attempt count forward when Eventbrite re-surfaces a failing order", async () => {
    h.stored.set("o1", {
      purchaseCapiSent: { booleanValue: false },
      purchaseCapiUnrecoverable: { booleanValue: false },
      purchaseCapiAttempts: { integerValue: "3" },
    });
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o1")],
      rateLimitRemaining: 50,
    });
    sendCapiEvent.mockResolvedValue({ ok: false, error: "503" });
    h.pending = [{ id: "o1", attempts: 3 }];

    const out = await runSync();

    // One send for the run: the per-event loop attempted it, so the retry
    // pass skips it and the budget advances by exactly one.
    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
    expect(out.purchaseRetried).toBe(0);
    expect(h.upserts.get("o1")).toMatchObject({
      purchaseCapiAttempts: { integerValue: "4" },
      purchaseCapiUnrecoverable: { booleanValue: false },
      purchaseCapiSent: { booleanValue: false },
    });
  });

  it("does not resend an order the retry pass already gave up on", async () => {
    h.stored.set("o2", {
      purchaseCapiSent: { booleanValue: false },
      purchaseCapiUnrecoverable: { booleanValue: true },
      purchaseCapiAttempts: { integerValue: "5" },
    });
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o2")],
      rateLimitRemaining: 500,
    });

    await runSync();

    expect(sendCapiEvent).not.toHaveBeenCalled();
    expect(h.upserts.get("o2")).toMatchObject({
      purchaseCapiAttempts: { integerValue: "5" },
      purchaseCapiUnrecoverable: { booleanValue: true },
    });
  });

  it("marks an order delivered without resending when the stored flag is already true", async () => {
    h.stored.set("o3", { purchaseCapiSent: { booleanValue: true } });
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o3")],
      rateLimitRemaining: 500,
    });

    await runSync();

    expect(sendCapiEvent).not.toHaveBeenCalled();
    expect(h.upserts.get("o3")).toMatchObject({
      purchaseCapiSent: { booleanValue: true },
    });
  });

  it("does not overwrite stored state when the stored-state read fails", async () => {
    h.failStateRead.add("o4");
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o4")],
      rateLimitRemaining: 500,
    });

    const out = await runSync();

    expect(h.patches).not.toContainEqual(["o4", "full"]);
    expect(sendCapiEvent).not.toHaveBeenCalled();
    expect(out.errors.some((e) => e.startsWith("order:o4"))).toBe(true);
  });

  it("preserves stored state when the Meta token is missing", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    h.stored.set("o7", {
      purchaseCapiSent: { booleanValue: false },
      purchaseCapiAttempts: { integerValue: "4" },
      purchaseCapiUnrecoverable: { booleanValue: false },
    });
    h.stored.set("o8", { purchaseCapiSent: { booleanValue: true } });
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o7"), ebOrder("o8")],
      rateLimitRemaining: 500,
    });

    await runSync();

    expect(sendCapiEvent).not.toHaveBeenCalled();
    expect(h.upserts.get("o7")).toMatchObject({
      purchaseCapiAttempts: { integerValue: "4" },
    });
    expect(h.upserts.get("o8")).toMatchObject({
      purchaseCapiSent: { booleanValue: true },
    });
  });

  it("reports a first-pass rejection in the returned errors", async () => {
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o9")],
      rateLimitRemaining: 500,
    });
    sendCapiEvent.mockResolvedValue({
      ok: false,
      error: "400: bad",
      terminal: true,
    });

    const out = await runSync();

    expect(out.errors).toContain("capi:o9: 400: bad");
    expect(out.errors).toContain("unrecoverable:o9: Meta rejected the event");
  });

  it("marks a first-time order sent on success", async () => {
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o5")],
      rateLimitRemaining: 500,
    });
    sendCapiEvent.mockResolvedValue({ ok: true });

    await runSync();

    expect(sendCapiEvent).toHaveBeenCalledTimes(1);
    expect(h.upserts.get("o5")).toMatchObject({
      purchaseCapiSent: { booleanValue: true },
    });
  });

  it("gives up in the same run on a terminal rejection of a new order", async () => {
    fetchEventOrders.mockResolvedValue({
      orders: [ebOrder("o6")],
      rateLimitRemaining: 500,
    });
    sendCapiEvent.mockResolvedValue({
      ok: false,
      error: "400",
      terminal: true,
    });

    await runSync();

    expect(h.upserts.get("o6")).toMatchObject({
      purchaseCapiAttempts: { integerValue: "1" },
      purchaseCapiUnrecoverable: { booleanValue: true },
    });
  });
});

describe("sync-orders retry pass", () => {
  beforeEach(() => {
    fetchEventOrders.mockResolvedValue({ orders: [], rateLimitRemaining: 500 });
  });

  it("marks a pending order sent when the retry succeeds", async () => {
    h.pending = [{ id: "p1", attempts: 1 }];
    sendCapiEvent.mockResolvedValue({ ok: true });

    const out = await runSync();

    expect(out.purchaseRetried).toBe(1);
    expect(h.patches).toContainEqual(["p1", "purchaseCapiSent"]);
  });

  it("records one more attempt on a transient failure", async () => {
    h.pending = [{ id: "p2", attempts: 1 }];
    sendCapiEvent.mockResolvedValue({ ok: false, error: "503" });

    const out = await runSync();

    expect(h.patches).toContainEqual(["p2", "purchaseCapiAttempts"]);
    expect(out.errors).toContain("retry:p2: 503");
  });

  it("gives up at once when Meta rejects the event for good", async () => {
    h.pending = [{ id: "p3", attempts: 0 }];
    sendCapiEvent.mockResolvedValue({
      ok: false,
      error: "400",
      terminal: true,
    });

    const out = await runSync();

    expect(h.patches).toContainEqual([
      "p3",
      "purchaseCapiUnrecoverable+purchaseCapiAttempts",
    ]);
    expect(out.errors).toContain("unrecoverable:p3: Meta rejected the event");
  });

  it("gives up when the attempt budget is spent", async () => {
    h.pending = [{ id: "p4", attempts: 4 }];
    sendCapiEvent.mockResolvedValue({ ok: false, error: "503" });

    const out = await runSync();

    expect(h.patches).toContainEqual([
      "p4",
      "purchaseCapiUnrecoverable+purchaseCapiAttempts",
    ]);
    expect(out.errors).toContain(
      "unrecoverable:p4: exceeded 5 CAPI delivery attempts",
    );
  });

  it("does not spend the attempt budget on a credential failure", async () => {
    h.pending = [{ id: "p6", attempts: 4 }];
    sendCapiEvent.mockResolvedValue({
      ok: false,
      error: "400: token",
      credential: true,
    });

    const out = await runSync();

    expect(h.patches.filter(([id]) => id === "p6")).toEqual([]);
    expect(out.errors).toContain("retry:p6: 400: token");
  });

  it("counts a thrown send as a transient failure", async () => {
    h.pending = [{ id: "p5", attempts: 0 }];
    sendCapiEvent.mockRejectedValue(new Error("socket hang up"));

    const out = await runSync();

    expect(h.patches).toContainEqual(["p5", "purchaseCapiAttempts"]);
    expect(out.errors).toContain("retry:p5: socket hang up");
  });
});
