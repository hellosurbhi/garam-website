export const prerender = false;

import type { APIRoute } from "astro";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { verifyAdminToken } from "@/lib/verifyToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { fetchEventOrders } from "@/lib/eventbrite";
import { holdsRetryBudget, sendCapiEvent } from "@/lib/capi";
import { MAX_CAPI_ATTEMPTS, nextCapiFailureState } from "@/lib/capiRetryState";
import { mapWithConcurrency } from "@/utils/concurrency";
import { alertOps } from "@/lib/opsAlert";
import { events } from "@/data/events";
import type { EventEntry } from "@/data/events";
import type { Order, SyncMeta } from "@/types/analytics";

// Bounded per-call, not per-run: this loop can touch many orders in one
// sync, so a hanging Meta API call must not compound across all of them and
// eat the serverless function's execution ceiling. No user is waiting on
// this (unlike the go-redirect's InitiateCheckout call), so it's slightly
// more lenient than that route's 2s guard.
const CAPI_TIMEOUT_MS = 3000;

// Bounds how many orders' CAPI sends run concurrently instead of fully
// serial (a 100-order pending batch could consume up to
// 100 * CAPI_TIMEOUT_MS in the worst case, risking the serverless
// function's execution deadline before sync metadata is even persisted) or
// fully parallel (risks overwhelming Meta's API). Caught by Codex pre-push
// review (2026-08-03).
const CAPI_CONCURRENCY = 10;

// ─── Firestore REST types ─────────────────────────────────────────────────────

interface FirestoreStringValue {
  stringValue: string;
}

interface FirestoreIntegerValue {
  integerValue: string;
}

interface FirestoreDoubleValue {
  doubleValue: number;
}

interface FirestoreNullValue {
  nullValue: null;
}

interface FirestoreBooleanValue {
  booleanValue: boolean;
}

interface FirestoreArrayValue {
  arrayValue: {
    values: FirestoreMapValue[];
  };
}

interface FirestoreMapValue {
  mapValue: {
    fields: Record<string, FirestoreFieldValue>;
  };
}

type FirestoreFieldValue =
  | FirestoreStringValue
  | FirestoreIntegerValue
  | FirestoreDoubleValue
  | FirestoreNullValue
  | FirestoreBooleanValue
  | FirestoreArrayValue
  | FirestoreMapValue;

interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreFieldValue>;
}

interface FirestoreQueryResult {
  document?: FirestoreDocument;
}

interface FirestoreErrorBody {
  error?: { message?: string };
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function orderToFirestoreFields(
  order: Order,
): Record<string, FirestoreFieldValue> {
  return {
    orderId: { stringValue: order.orderId },
    eventbriteEventId: { stringValue: order.eventbriteEventId },
    eventSlug: { stringValue: order.eventSlug },
    email: { stringValue: order.email },
    name: { stringValue: order.name },
    quantity: { integerValue: String(order.quantity) },
    grossRevenue: { doubleValue: order.grossRevenue },
    netRevenue: { doubleValue: order.netRevenue },
    currency: { stringValue: order.currency },
    status: { stringValue: order.status },
    createdAt: { stringValue: order.createdAt },
    syncedAt: { stringValue: order.syncedAt },
    matchedLeadId: order.matchedLeadId
      ? { stringValue: order.matchedLeadId }
      : { nullValue: null },
    purchaseCapiSent: { booleanValue: order.purchaseCapiSent },
    purchaseCapiUnrecoverable: {
      booleanValue: order.purchaseCapiUnrecoverable,
    },
    purchaseCapiAttempts: {
      integerValue: String(order.purchaseCapiAttempts),
    },
    attendees: {
      arrayValue: {
        values: order.attendees.map((a) => ({
          mapValue: {
            fields: {
              name: { stringValue: a.name },
              email: { stringValue: a.email },
            },
          },
        })),
      },
    },
  };
}

function syncMetaToFirestoreFields(
  meta: SyncMeta,
): Record<string, FirestoreFieldValue> {
  return {
    lastSyncAt: { stringValue: meta.lastSyncAt },
    ordersProcessed: { integerValue: String(meta.ordersProcessed) },
    errors: {
      arrayValue: {
        values: meta.errors.map((e) => ({
          mapValue: {
            fields: {
              message: { stringValue: e },
            },
          },
        })),
      },
    },
  };
}

// ─── Firestore operations ─────────────────────────────────────────────────────

async function readSyncMeta(
  projectId: string,
  accessToken: string,
): Promise<SyncMeta | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/syncMeta/eventbrite`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to read syncMeta: ${res.status} ${body.error?.message ?? ""}`,
    );
  }

  const doc = (await res.json()) as FirestoreDocument;
  const fields = doc.fields;

  const lastSyncAt =
    "stringValue" in fields.lastSyncAt ? fields.lastSyncAt.stringValue : "";
  const ordersProcessed =
    "integerValue" in fields.ordersProcessed
      ? parseInt(fields.ordersProcessed.integerValue, 10)
      : 0;

  let errors: string[] = [];
  if (
    "arrayValue" in fields.errors &&
    fields.errors.arrayValue.values.length > 0
  ) {
    errors = fields.errors.arrayValue.values
      .map((v) => {
        if ("mapValue" in v && "message" in v.mapValue.fields) {
          const msgField = v.mapValue.fields.message;
          return "stringValue" in msgField ? msgField.stringValue : "";
        }
        return "";
      })
      .filter(Boolean);
  }

  return { lastSyncAt, ordersProcessed, errors };
}

async function findLeadByEmail(
  projectId: string,
  accessToken: string,
  email: string,
): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "leads" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "EQUAL",
            value: { stringValue: email.toLowerCase() },
          },
        },
        limit: 1,
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Lead query failed: ${res.status} ${body.error?.message ?? ""}`,
    );
  }

  const results = (await res.json()) as FirestoreQueryResult[];

  if (!results.length || !results[0].document) return null;

  // Extract the document ID from the name path
  const name = results[0].document.name;
  return name.split("/").pop() ?? null;
}

interface ExistingCapiState {
  sent: boolean;
  attempts: number;
  unrecoverable: boolean;
}

/**
 * The stored Purchase CAPI delivery state for this order: whether it has
 * already been confirmed delivered to Meta, how many failed attempts it has
 * used and whether the retry pass gave up on it. Returning all three lets the
 * per-event loop carry them forward instead of upserting the freshly mapped
 * defaults (attempts 0, unrecoverable false) over them, which would restart
 * the give-up budget every time Eventbrite re-reports a stuck order.
 *
 * `sent`: whether the Purchase CAPI event for this order has already been
 * confirmed delivered to Meta. Deliberately NOT "does this order document
 * exist": the order is always upserted below regardless of CAPI outcome
 * (order/revenue data must never be lost over a tracking hiccup), so mere
 * existence can't tell "Purchase delivered" apart from "Purchase attempt
 * failed transiently, order was still recorded". A 404 means "first time
 * we've ever seen this order" (nothing sent yet, hence `false`); a 200
 * returns the stored `purchaseCapiSent` flag, which stays `false` until
 * `sendCapiEvent` has actually returned `{ ok: true }` for it. Gating on
 * this flag instead of existence means a transient failure leaves it
 * `false`, and `findPendingPurchaseOrders()` below (run once per sync,
 * after this per-event loop) picks the order back up on the very next run
 * instead of losing that Purchase forever.
 */
async function readOrderCapiState(
  projectId: string,
  accessToken: string,
  orderId: string,
): Promise<ExistingCapiState> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404)
    return { sent: false, attempts: 0, unrecoverable: false };

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to check order ${orderId}: ${res.status} ${body.error?.message ?? ""}`,
    );
  }

  const doc = (await res.json()) as FirestoreDocument;
  const sent = doc.fields.purchaseCapiSent;
  const unrecoverable = doc.fields.purchaseCapiUnrecoverable;
  const attempts = doc.fields.purchaseCapiAttempts;
  return {
    sent: Boolean(sent && "booleanValue" in sent && sent.booleanValue),
    unrecoverable: Boolean(
      unrecoverable &&
      "booleanValue" in unrecoverable &&
      unrecoverable.booleanValue,
    ),
    // Missing on orders written before the attempt cap shipped: 0 is right.
    attempts:
      attempts && "integerValue" in attempts
        ? parseInt(attempts.integerValue, 10)
        : 0,
  };
}

/**
 * Marks an order's Purchase CAPI event as delivered without touching any
 * other field. Used only by the retry pass (`findPendingPurchaseOrders` +
 * this), which reconstructs just enough of the order from Firestore to
 * retry `sendCapiEvent` and does not have (and must not fabricate) the
 * rest of the document's fields, e.g. `matchedLeadId`. An `updateMask`
 * scoped to this one field keeps the PATCH from clobbering them.
 */
async function markPurchaseCapiSent(
  projectId: string,
  accessToken: string,
  orderId: string,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=purchaseCapiSent`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      fields: { purchaseCapiSent: { booleanValue: true } },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to mark order ${orderId} as CAPI-sent: ${res.status} ${body.error?.message ?? ""}`,
    );
  }
}

/**
 * Marks an order as a Purchase CAPI event that can never be delivered, so
 * `findPendingPurchaseOrders` stops returning it. Used only when the retry
 * pass can't find the order's source event in `events.ts` anymore (see the
 * call site): there is no eventSourceUrl left to build a correct CAPI
 * payload from, so retrying it every run forever would just burn one of
 * the pending query's limited rows on a request that can never succeed.
 * Deliberately a separate field from `purchaseCapiSent`, which must stay
 * `false`: this order's Purchase was never actually delivered to Meta, and
 * marking it "sent" would misreport that as done when it silently wasn't.
 */
async function markPurchaseCapiUnrecoverable(
  projectId: string,
  accessToken: string,
  orderId: string,
  attempts: number,
): Promise<void> {
  // WHY attempts is written in the same PATCH: persisting only the flag left
  // the stored count one behind the real number of failed deliveries.
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=purchaseCapiUnrecoverable&updateMask.fieldPaths=purchaseCapiAttempts`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      fields: {
        purchaseCapiUnrecoverable: { booleanValue: true },
        purchaseCapiAttempts: { integerValue: String(attempts) },
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to mark order ${orderId} as CAPI-unrecoverable: ${res.status} ${body.error?.message ?? ""}`,
    );
  }
}

/**
 * Persists an incremented Purchase CAPI attempt count for a pending order.
 * Used only by the retry pass after a failed send that hasn't yet crossed
 * MAX_CAPI_ATTEMPTS (once it does, markPurchaseCapiUnrecoverable is used
 * instead, see the retry pass's CAPI-failure branch). Scoped to this one
 * field via updateMask, same reasoning as markPurchaseCapiSent: the retry
 * pass only reconstructs a minimal PendingOrderDoc from Firestore and must
 * not clobber the rest of the order's fields.
 */
async function incrementPurchaseCapiAttempts(
  projectId: string,
  accessToken: string,
  orderId: string,
  attempts: number,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=purchaseCapiAttempts`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      fields: { purchaseCapiAttempts: { integerValue: String(attempts) } },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to increment CAPI attempts for order ${orderId}: ${res.status} ${body.error?.message ?? ""}`,
    );
  }
}

/** Minimal shape needed to retry a Purchase CAPI send; see PendingOrderDoc. */
interface PendingOrderDoc {
  orderId: string;
  eventbriteEventId: string;
  email: string;
  createdAt: string;
  grossRevenue: number;
  currency: string;
  quantity: number;
  purchaseCapiAttempts: number;
}

function parsePendingOrderDoc(doc: FirestoreDocument): PendingOrderDoc | null {
  const orderId = doc.name.split("/").pop();
  if (!orderId) return null;

  const fields = doc.fields;
  const eventbriteEventId =
    "stringValue" in fields.eventbriteEventId
      ? fields.eventbriteEventId.stringValue
      : "";
  const email = "stringValue" in fields.email ? fields.email.stringValue : "";
  const createdAt =
    "stringValue" in fields.createdAt ? fields.createdAt.stringValue : "";
  const grossRevenue =
    "doubleValue" in fields.grossRevenue ? fields.grossRevenue.doubleValue : 0;
  const currency =
    "stringValue" in fields.currency ? fields.currency.stringValue : "USD";
  const quantity =
    "integerValue" in fields.quantity
      ? parseInt(fields.quantity.integerValue, 10)
      : 1;
  // Guarded with `fields.purchaseCapiAttempts &&` (unlike the fields above):
  // this field didn't exist before this fix shipped, so orders upserted by
  // an older deploy have it missing entirely, not just a different variant.
  // `"x" in undefined` throws, so the plain `"integerValue" in fields...`
  // pattern used above would crash parsing any pre-existing pending order.
  // Missing means "never counted under this scheme", so 0 is the correct,
  // safe default: it gives that order a fresh MAX_CAPI_ATTEMPTS budget
  // rather than fabricating a count that was never tracked.
  const purchaseCapiAttempts =
    fields.purchaseCapiAttempts && "integerValue" in fields.purchaseCapiAttempts
      ? parseInt(fields.purchaseCapiAttempts.integerValue, 10)
      : 0;

  if (!eventbriteEventId || !email || !createdAt) return null;

  return {
    orderId,
    eventbriteEventId,
    email,
    createdAt,
    grossRevenue,
    currency,
    quantity,
    purchaseCapiAttempts,
  };
}

/**
 * Finds every "placed" order still owed a Purchase CAPI delivery. This is
 * the retry mechanism `readOrderCapiState`'s doc comment refers to:
 * Eventbrite's `changed_since` incremental sync only re-surfaces an order
 * when something changes on Eventbrite's side (a refund, an attendee
 * edit), not when our own delivery attempt merely failed, so the per-event
 * fetch loop above has no way to naturally retry a stuck order. Querying
 * Firestore directly for `purchaseCapiSent == false AND status == "placed"
 * AND purchaseCapiUnrecoverable == false` sidesteps that entirely: all
 * three are plain equality filters combined with AND, which Firestore
 * serves without a manual composite index. `limit: 100` bounds one sync
 * run's worst case. The `purchaseCapiUnrecoverable` filter exists so a
 * genuinely stuck order (its source event was pruned from events.ts, so
 * there's no eventSourceUrl left to retry it with, see the call site's use
 * of markPurchaseCapiUnrecoverable) drops out of this result set for good
 * instead of reappearing on every future run and permanently occupying one
 * of the 100 slots, which would eventually starve real pending orders once
 * enough dropped-event orphans accumulated.
 */
async function findPendingPurchaseOrders(
  projectId: string,
  accessToken: string,
): Promise<PendingOrderDoc[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "orders" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "purchaseCapiSent" },
                  op: "EQUAL",
                  value: { booleanValue: false },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "status" },
                  op: "EQUAL",
                  value: { stringValue: "placed" },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "purchaseCapiUnrecoverable" },
                  op: "EQUAL",
                  value: { booleanValue: false },
                },
              },
            ],
          },
        },
        limit: 100,
      },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Pending Purchase query failed: ${res.status} ${body.error?.message ?? ""}`,
    );
  }

  const results = (await res.json()) as FirestoreQueryResult[];

  return results
    .filter((r): r is Required<FirestoreQueryResult> => Boolean(r.document))
    .map((r) => parsePendingOrderDoc(r.document))
    .filter((o): o is PendingOrderDoc => o !== null);
}

async function upsertOrder(
  projectId: string,
  accessToken: string,
  order: Order,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${order.orderId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields: orderToFirestoreFields(order) }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to upsert order ${order.orderId}: ${res.status} ${body.error?.message ?? ""}`,
    );
  }
}

async function writeSyncMeta(
  projectId: string,
  accessToken: string,
  meta: SyncMeta,
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/syncMeta/eventbrite`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields: syncMetaToFirestoreFields(meta) }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to write syncMeta: ${res.status} ${body.error?.message ?? ""}`,
    );
  }
}

// A show this many days past its date has no realistic new orders left to
// sync (3 days covers late walk-up orders finalizing after doors).
export const SYNC_WINDOW_DAYS = 3;

// `isoDate` is a calendar date in the event's own local timezone, not UTC.
// toISOString().slice(0, 10) reads the wrong calendar day for part of the
// evening in US timezones (9pm ET is already "tomorrow" in UTC), which would
// shift the cutoff by a day. `en-CA` makes Intl.DateTimeFormat emit
// YYYY-MM-DD directly.
function dateInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
}

/**
 * Events whose orders our Eventbrite access token can actually read: shows
 * ticketed on our own account that have a real listing ID, and that are not
 * more than SYNC_WINDOW_DAYS past their show date. A "their-eventbrite" show
 * (e.g. Los Angeles) also carries a public `eventbriteId`, but the orders API
 * rejects our token on it, so including one just generates an authorization
 * error on every sync run.
 *
 * WHY the trailing window: one failed event fetch holds the shared
 * `changed_since` cursor for EVERY event (see hadSyncFailure's WHY comment in
 * the handler), so a long-past show whose ticketSource is stale or no longer
 * verifiable would silently jam Purchase syncing for every current show.
 * `ticketSource` is manual business knowledge with no drift detection, so
 * this cannot be prevented at the source; bounding eligibility caps the blast
 * radius instead. Shows without an `isoDate` (TBA) stay eligible.
 */
export function orderSyncableEvents(
  list: EventEntry[],
  now: Date = new Date(),
): EventEntry[] {
  const cutoffInstant = new Date(
    now.getTime() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  return list.filter((e) => {
    if (e.ticketSource !== "our-eventbrite" || !e.eventbriteId) return false;
    if (!e.isoDate) return true;
    return (
      e.isoDate >= dateInZone(cutoffInstant, e.timezone ?? "America/New_York")
    );
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  // Rate limit before secret comparison so the guard also throttles
  // brute-force attempts against the bearer secret.
  const limited = await enforceRateLimit(request, RATE_LIMITS.syncOrders);
  if (limited) return limited;

  const authHeader = request.headers.get("authorization") ?? "";

  // Auth: check cron secret first, then Firebase ID token
  let isAuthorized = false;
  const cronSecret = import.meta.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    const uid = await verifyAdminToken(authHeader);
    if (uid) isAuthorized = true;
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  const eventbriteToken = import.meta.env.EVENTBRITE_API_TOKEN;
  // Optional: sync still runs (and still records order data) without it,
  // only Purchase CAPI firing is skipped. See src/lib/capi.ts.
  const capiAccessToken = import.meta.env.META_CAPI_ACCESS_TOKEN;

  if (!projectId) {
    return new Response(
      JSON.stringify({
        error: "Server configuration error: missing project ID",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!eventbriteToken) {
    return new Response(
      JSON.stringify({
        error: "Server configuration error: missing Eventbrite token",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const accessToken = await getFirestoreAccessToken();

    // Read previous sync metadata to enable incremental sync
    const prevMeta = await readSyncMeta(projectId, accessToken);
    const lastSyncAt = prevMeta?.lastSyncAt;
    const previousTotal = prevMeta?.ordersProcessed ?? 0;

    const syncableEvents = orderSyncableEvents(events);

    const syncErrors: string[] = [];
    let totalProcessed = 0;
    let totalMatched = 0;
    let globalRateLimitRemaining = 1000;
    // WHY: `changed_since` is a single global cursor, not per-event, so it
    // must only move forward when every event's orders for this window were
    // actually fetched and persisted. If event B's fetch throws (transient
    // network/auth blip) while event A succeeds, and lastSyncAt still
    // advances to `now`, the next run's changed_since=now permanently skips
    // whatever changed on event B between the old and new cursor: there is
    // no other record of that window. Same risk if an order is fetched but
    // its Firestore upsert throws: Eventbrite's changed_since won't return
    // that order again unless it changes a second time. Caught by Codex
    // pre-push review (2026-08-03). Fix: hold the cursor at its previous
    // value on any fetch or upsert failure, so the next run re-requests the
    // same window. Reprocessing succeeded events/orders in that replay is
    // safe: upsertOrder is keyed by the stable Eventbrite order.orderId, and
    // Purchase CAPI is gated on the purchaseCapiSent flag, so nothing here
    // resends or double-writes on a retry.
    let hadSyncFailure = false;
    // Captured BEFORE any fetching begins, not after the run completes: an
    // order that changes on Eventbrite's side between this timestamp and the
    // run's end must still be covered by the NEXT run's changed_since, and
    // that only holds if the next cursor is <= when the order actually
    // changed. Capturing "now" at the END of the run (the previous bug) set
    // the next cursor to a timestamp AFTER such an order's change, so
    // changed_since on the next run permanently skipped it. Reprocessing the
    // resulting overlap on the next run is safe for the same reason
    // hadSyncFailure's replay above is: upsertOrder is keyed by the stable
    // order ID and Purchase CAPI is gated on purchaseCapiSent. Caught by
    // Codex pre-push review (2026-08-03).
    const syncStartedAt = new Date().toISOString();
    const attemptedThisRun = new Set<string>();

    for (const event of syncableEvents) {
      const eventbriteId = event.eventbriteId!;
      const eventSlug = event.citySlug ?? event.city;

      let fetchResult: Awaited<ReturnType<typeof fetchEventOrders>>;
      try {
        fetchResult = await fetchEventOrders(
          eventbriteId,
          eventSlug,
          eventbriteToken,
          lastSyncAt,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[sync-orders] fetchEventOrders failed for ${eventbriteId}: ${msg}`,
        );
        syncErrors.push(`fetch:${eventbriteId}: ${msg}`);
        hadSyncFailure = true;
        continue;
      }

      const { orders, rateLimitRemaining } = fetchResult;
      globalRateLimitRemaining = Math.min(
        globalRateLimitRemaining,
        rateLimitRemaining,
      );

      if (rateLimitRemaining < 100) {
        console.warn(
          `[sync-orders] Eventbrite rate limit low: ${rateLimitRemaining} remaining`,
        );
      }

      await mapWithConcurrency(orders, CAPI_CONCURRENCY, async (order) => {
        try {
          // Check if the buyer email matches a known lead
          let matchedLeadId: string | null = null;
          try {
            matchedLeadId = await findLeadByEmail(
              projectId,
              accessToken,
              order.email,
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(
              `[sync-orders] Lead lookup failed for ${order.email}: ${msg}`,
            );
            // Non-fatal: proceed without match
          }

          const orderWithMatch: Order = {
            ...order,
            matchedLeadId,
            purchaseCapiSent: false,
          };

          // Purchase CAPI: the sole remaining Purchase signal now that the
          // Eventbrite modal embed (and its browser-side fbq("track",
          // "Purchase", ...) call in the retired EventbriteWidgetInit.astro)
          // is gone. Gated on purchaseCapiSent, not mere existence, so a
          // failed attempt gets retried instead of silently forfeited: see
          // readOrderCapiState's doc comment and the pending-retry
          // pass after this loop.
          // WHY the state read is not gated on the Meta token and has no
          // catch: the full upsert below overwrites purchaseCapiSent,
          // purchaseCapiAttempts and purchaseCapiUnrecoverable, so writing it
          // without knowing the stored values (token missing, or the read
          // failing) reset a delivered or exhausted order to zero. A failed
          // read now throws into the per-order catch, which records the error
          // and holds the cursor so the order is re-fetched next run.
          const existing = await readOrderCapiState(
            projectId,
            accessToken,
            order.orderId,
          );
          orderWithMatch.purchaseCapiSent = existing.sent;
          orderWithMatch.purchaseCapiAttempts = existing.attempts;
          orderWithMatch.purchaseCapiUnrecoverable = existing.unrecoverable;
          if (
            capiAccessToken &&
            !existing.sent &&
            !existing.unrecoverable &&
            order.status === "placed"
          ) {
            // Already-delivered orders re-surface when something else changed
            // on Eventbrite's side (e.g. a refund) and must not resend; gave-up
            // orders must not restart delivery.
            const result = await sendCapiEvent(
              {
                eventName: "Purchase",
                eventId: order.orderId,
                eventTime: Math.floor(
                  new Date(order.createdAt).getTime() / 1000,
                ),
                eventSourceUrl: `https://garammasaladating.com/events/${event.slug}`,
                userData: { email: order.email },
                customData: {
                  value: order.grossRevenue,
                  currency: order.currency,
                  contentIds: [event.slug],
                  contentType: "event",
                  numItems: order.quantity,
                },
              },
              capiAccessToken,
              CAPI_TIMEOUT_MS,
            );
            if (result.ok) {
              orderWithMatch.purchaseCapiSent = true;
            } else {
              const next = nextCapiFailureState(
                existing.attempts,
                result.terminal === true,
                holdsRetryBudget(result),
              );
              orderWithMatch.purchaseCapiAttempts = next.attempts;
              orderWithMatch.purchaseCapiUnrecoverable = next.unrecoverable;
              // One delivery attempt per run: the retry pass below skips
              // this order so a single run cannot count it twice.
              attemptedThisRun.add(order.orderId);
              console.error(
                `[sync-orders] CAPI Purchase failed for order ${order.orderId}: ${result.error}`,
              );
              syncErrors.push(`capi:${order.orderId}: ${result.error}`);
              if (next.unrecoverable) {
                syncErrors.push(
                  `unrecoverable:${order.orderId}: Meta rejected the event`,
                );
              }
            }
          }

          await upsertOrder(projectId, accessToken, orderWithMatch);

          totalProcessed += 1;
          if (matchedLeadId) totalMatched += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[sync-orders] Failed to upsert order ${order.orderId}: ${msg}`,
          );
          syncErrors.push(`order:${order.orderId}: ${msg}`);
          hadSyncFailure = true;
        }
      });
    }

    // Retry pass: pick up every order still owed a Purchase delivery from
    // a previous run (see findPendingPurchaseOrders's doc comment for why
    // the per-event loop above can't be relied on to naturally retry
    // these). Runs once per sync, independent of which events were
    // touched above.
    let purchaseRetried = 0;
    if (capiAccessToken) {
      let pending: PendingOrderDoc[] = [];
      try {
        pending = await findPendingPurchaseOrders(projectId, accessToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-orders] Pending Purchase query failed: ${msg}`);
        syncErrors.push(`pending-query: ${msg}`);
      }

      await mapWithConcurrency(
        pending,
        CAPI_CONCURRENCY,
        async (pendingOrder) => {
          // Cross-reference by Eventbrite event ID, not the stored
          // `eventSlug` (that field is actually `citySlug`, e.g.
          // "manhattan", not the per-show landing-page `slug` CAPI's
          // eventSourceUrl needs: see EventEntry in src/data/events.ts).
          const sourceEvent = events.find(
            (e) => e.eventbriteId === pendingOrder.eventbriteEventId,
          );
          if (!sourceEvent) {
            // The show this order belongs to is no longer in events.ts
            // (pruned after it aged out). Nothing to build a correct
            // eventSourceUrl from, and this will never change on a future
            // run either, so give up for good instead of leaving
            // purchaseCapiSent false: see markPurchaseCapiUnrecoverable's
            // doc comment for what breaks if this order just gets skipped
            // (`return`) here without changing anything, as it used to.
            try {
              await markPurchaseCapiUnrecoverable(
                projectId,
                accessToken,
                pendingOrder.orderId,
                pendingOrder.purchaseCapiAttempts,
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(
                `[sync-orders] Failed to mark order ${pendingOrder.orderId} unrecoverable: ${msg}`,
              );
              syncErrors.push(`unrecoverable:${pendingOrder.orderId}: ${msg}`);
            }
            syncErrors.push(
              `orphaned:${pendingOrder.orderId}: source event ${pendingOrder.eventbriteEventId} no longer in events.ts, Purchase CAPI will never be sent`,
            );
            return;
          }

          if (attemptedThisRun.has(pendingOrder.orderId)) return;

          let capiFailed = false;
          let capiErrorMsg = "";
          let capiTerminal = false;
          let capiHoldBudget = false;
          try {
            const result = await sendCapiEvent(
              {
                eventName: "Purchase",
                eventId: pendingOrder.orderId,
                eventTime: Math.floor(
                  new Date(pendingOrder.createdAt).getTime() / 1000,
                ),
                eventSourceUrl: `https://garammasaladating.com/events/${sourceEvent.slug}`,
                userData: { email: pendingOrder.email },
                customData: {
                  value: pendingOrder.grossRevenue,
                  currency: pendingOrder.currency,
                  contentIds: [sourceEvent.slug],
                  contentType: "event",
                  numItems: pendingOrder.quantity,
                },
              },
              capiAccessToken,
              CAPI_TIMEOUT_MS,
            );

            if (result.ok) {
              // WHY its own try: Meta already has the event, so a failed
              // sent-flag write is a persistence fault, not a delivery
              // failure. Sharing the send's catch burned the attempt budget
              // (and could retire the order) for a purchase that was
              // delivered. The flag stays false, so the next run resends the
              // event under the same event_id.
              try {
                await markPurchaseCapiSent(
                  projectId,
                  accessToken,
                  pendingOrder.orderId,
                );
                purchaseRetried += 1;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                  `[sync-orders] Failed to record CAPI delivery for order ${pendingOrder.orderId}: ${msg}`,
                );
                syncErrors.push(`sent-flag:${pendingOrder.orderId}: ${msg}`);
              }
            } else {
              capiFailed = true;
              capiErrorMsg = result.error ?? "unknown error";
              capiTerminal = result.terminal === true;
              capiHoldBudget = holdsRetryBudget(result);
            }
          } catch (err) {
            capiFailed = true;
            capiErrorMsg = err instanceof Error ? err.message : String(err);
          }

          if (capiFailed) {
            console.error(
              `[sync-orders] Retry CAPI Purchase failed for order ${pendingOrder.orderId}: ${capiErrorMsg}`,
            );
            syncErrors.push(`retry:${pendingOrder.orderId}: ${capiErrorMsg}`);

            // Give up for good past MAX_CAPI_ATTEMPTS: see MAX_CAPI_ATTEMPTS's
            // WHY comment for what a persistently failing order (bad token,
            // malformed payload, not just a missing source event) would do to
            // findPendingPurchaseOrders's 100-row query without this cap.
            const next = nextCapiFailureState(
              pendingOrder.purchaseCapiAttempts,
              capiTerminal,
              capiHoldBudget,
            );
            try {
              if (next.unrecoverable) {
                await markPurchaseCapiUnrecoverable(
                  projectId,
                  accessToken,
                  pendingOrder.orderId,
                  next.attempts,
                );
                syncErrors.push(
                  `unrecoverable:${pendingOrder.orderId}: ${capiTerminal ? "Meta rejected the event" : `exceeded ${MAX_CAPI_ATTEMPTS} CAPI delivery attempts`}`,
                );
              } else if (next.attempts !== pendingOrder.purchaseCapiAttempts) {
                await incrementPurchaseCapiAttempts(
                  projectId,
                  accessToken,
                  pendingOrder.orderId,
                  next.attempts,
                );
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(
                `[sync-orders] Failed to update CAPI attempts for order ${pendingOrder.orderId}: ${msg}`,
              );
              syncErrors.push(`attempts:${pendingOrder.orderId}: ${msg}`);
            }
          }
        },
      );
    }

    // Persist sync metadata, keeping last 10 errors
    const allErrors = [...(prevMeta?.errors ?? []), ...syncErrors].slice(-10);
    // Hold the cursor at its previous value when any event's fetch or order
    // upsert failed this run (see hadSyncFailure's WHY comment above the
    // sync loop); otherwise advance to syncStartedAt, captured before any
    // fetching began rather than a fresh "now" after all work completes
    // (see syncStartedAt's WHY comment for why an end-of-run timestamp is
    // unsafe as the next cursor).
    const nextCursor = hadSyncFailure ? (lastSyncAt ?? "") : syncStartedAt;
    const newMeta: SyncMeta = {
      lastSyncAt: nextCursor,
      ordersProcessed: previousTotal + totalProcessed,
      errors: allErrors,
    };

    await writeSyncMeta(projectId, accessToken, newMeta);

    return new Response(
      JSON.stringify({
        ok: true,
        ordersProcessed: totalProcessed,
        leadsMatched: totalMatched,
        purchaseRetried,
        errors: syncErrors,
        rateLimitRemaining: globalRateLimitRemaining,
        lastSyncAt: nextCursor,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-orders] Fatal error: ${msg}`);
    // A dead order sync silently stops ticket revenue attribution; page once
    // per failed run.
    await alertOps({
      flow: "ops",
      stage: "order_sync",
      errorMessage: msg,
    });
    return new Response(JSON.stringify({ error: "Sync failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Vercel Cron Jobs only ever issue GET requests, and automatically attach
// `Authorization: Bearer $CRON_SECRET` to them for any env var literally
// named CRON_SECRET (see vercel.json's crons entry for this path): the
// exact header POST above already checks first, before falling back to
// Firebase admin-token auth for the manual "Sync Now" button in
// AnalyticsDashboard.tsx. Same handler, no separate implementation needed.
export const GET: APIRoute = POST;
