export const prerender = false;

import type { APIRoute } from "astro";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { verifyAdminToken } from "@/lib/verifyToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { fetchEventOrders } from "@/lib/eventbrite";
import { sendCapiEvent } from "@/lib/capi";
import { withTimeout } from "@/utils/withTimeout";
import { alertOps } from "@/lib/opsAlert";
import { events } from "@/data/events";
import type { EventEntry } from "@/data/events";
import type { Order, SyncMeta } from "@/types/analytics";

// 3 days past the show covers late walk-up orders finalizing after doors; a
// show that old has no realistic new orders left to sync. See the WHY
// comment on `getSyncableEvents`'s call site below for why this window
// exists at all.
export const SYNC_WINDOW_DAYS = 3;

/**
 * Events eligible for order sync: business-owned Eventbrite listings with a
 * real Eventbrite ID, bounded to a trailing window so a show past that
 * window can never affect the sync run regardless of its `ticketSource`
 * value. Pure and exported so it's unit-testable without exercising the
 * full POST handler (Firestore/Eventbrite/CAPI side effects).
 */
export function getSyncableEvents(
  allEvents: EventEntry[],
  now: Date = new Date(),
): EventEntry[] {
  const syncCutoffISO = new Date(
    now.getTime() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  return allEvents.filter(
    (e) =>
      e.ticketSource === "eventbrite-owned" &&
      e.eventbriteId &&
      (!e.isoDate || e.isoDate >= syncCutoffISO),
  );
}

// Bounded per-call, not per-run: this loop can touch many orders in one
// sync, so a hanging Meta API call must not compound across all of them and
// eat the serverless function's execution ceiling. No user is waiting on
// this (unlike the go-redirect's InitiateCheckout call), so it's slightly
// more lenient than that route's 2s guard.
const CAPI_TIMEOUT_MS = 3000;

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

/**
 * Whether the Purchase CAPI event for this order has already been
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
async function readOrderPurchaseCapiSent(
  projectId: string,
  accessToken: string,
  orderId: string,
): Promise<boolean> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return false;

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to check order ${orderId}: ${res.status} ${body.error?.message ?? ""}`,
    );
  }

  const doc = (await res.json()) as FirestoreDocument;
  const field = doc.fields.purchaseCapiSent;
  return Boolean(field && "booleanValue" in field && field.booleanValue);
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
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}?updateMask.fieldPaths=purchaseCapiUnrecoverable`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      fields: { purchaseCapiUnrecoverable: { booleanValue: true } },
    }),
  });

  if (!res.ok) {
    const body = (await res.json()) as FirestoreErrorBody;
    throw new Error(
      `Failed to mark order ${orderId} as CAPI-unrecoverable: ${res.status} ${body.error?.message ?? ""}`,
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

  if (!eventbriteEventId || !email || !createdAt) return null;

  return {
    orderId,
    eventbriteEventId,
    email,
    createdAt,
    grossRevenue,
    currency,
    quantity,
  };
}

/**
 * Finds every "placed" order still owed a Purchase CAPI delivery. This is
 * the retry mechanism `readOrderPurchaseCapiSent`'s doc comment refers to:
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

    // Only process events we actually sell tickets for ourselves. The Los
    // Angeles listing (ticketSource: "external") carries a real
    // `eventbriteId` too, but it belongs to a third party's Eventbrite
    // account: our access token has no orders permission on it, so
    // including it here just generates an authorization error on every run.
    //
    // WHY the trailing-window cutoff: a fetch failure on any one event holds
    // the shared `changed_since` cursor at its previous value for every
    // event this run (see the WHY comment on hadSyncFailure below), so a
    // long-past show wrongly (or no longer accurately) marked
    // "eventbrite-owned" would silently jam Purchase syncing for every
    // currently relevant show too, not just fail to sync itself.
    // `ticketSource` is manually set business knowledge with no drift
    // detection (see its doc comment in events.ts), so this can't be
    // prevented at the source; bounding which events are even eligible caps
    // the blast radius instead.
    const syncableEvents = getSyncableEvents(events);

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

      for (const order of orders) {
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
          // readOrderPurchaseCapiSent's doc comment and the pending-retry
          // pass after this loop.
          if (capiAccessToken) {
            try {
              const alreadySent = await readOrderPurchaseCapiSent(
                projectId,
                accessToken,
                order.orderId,
              );
              if (alreadySent) {
                // Already delivered on a prior run (this fetch re-surfaced
                // it only because something else changed on Eventbrite's
                // side, e.g. a refund): preserve the flag, don't resend.
                orderWithMatch.purchaseCapiSent = true;
              } else if (order.status === "placed") {
                const result = await withTimeout(
                  sendCapiEvent(
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
                  ),
                  CAPI_TIMEOUT_MS,
                  "Meta CAPI Purchase",
                );
                if (result.ok) {
                  orderWithMatch.purchaseCapiSent = true;
                } else {
                  console.error(
                    `[sync-orders] CAPI Purchase failed for order ${order.orderId}: ${result.error}`,
                  );
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(
                `[sync-orders] CAPI Purchase check failed for order ${order.orderId}: ${msg}`,
              );
              // WHY: we don't know whether this order's flag was already
              // true (the GET that would have told us is what just threw),
              // so leaving purchaseCapiSent at its false default risks one
              // redundant resend later rather than the old bug (losing the
              // Purchase forever). That's the safe direction to be wrong in:
              // sendCapiEvent's eventId is the stable order.orderId, and
              // Meta dedupes repeated server events sharing an event_id, so
              // a rare redundant send is a no-op there rather than double
              // counted revenue. A Firestore GET failing right as we first
              // see a brand new order is itself rare.
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
      }
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

      for (const pendingOrder of pending) {
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
          // (`continue`) here without changing anything, as it used to.
          try {
            await markPurchaseCapiUnrecoverable(
              projectId,
              accessToken,
              pendingOrder.orderId,
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
          continue;
        }

        try {
          const result = await withTimeout(
            sendCapiEvent(
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
            ),
            CAPI_TIMEOUT_MS,
            "Meta CAPI Purchase retry",
          );

          if (result.ok) {
            await markPurchaseCapiSent(
              projectId,
              accessToken,
              pendingOrder.orderId,
            );
            purchaseRetried += 1;
          } else {
            console.error(
              `[sync-orders] Retry CAPI Purchase failed for order ${pendingOrder.orderId}: ${result.error}`,
            );
            syncErrors.push(`retry:${pendingOrder.orderId}: ${result.error}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[sync-orders] Retry CAPI Purchase threw for order ${pendingOrder.orderId}: ${msg}`,
          );
          syncErrors.push(`retry:${pendingOrder.orderId}: ${msg}`);
        }
      }
    }

    // Persist sync metadata, keeping last 10 errors
    const now = new Date().toISOString();
    const allErrors = [...(prevMeta?.errors ?? []), ...syncErrors].slice(-10);
    const newMeta: SyncMeta = {
      // Hold the cursor at its previous value when any event's fetch or
      // order upsert failed this run: see hadSyncFailure's WHY comment
      // above the sync loop for what breaks if this advances anyway.
      lastSyncAt: hadSyncFailure ? (lastSyncAt ?? "") : now,
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
        lastSyncAt: now,
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
