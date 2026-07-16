export const prerender = false;

import type { APIRoute } from "astro";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { verifyAdminToken } from "@/lib/verifyToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { fetchEventOrders } from "@/lib/eventbrite";
import { sendCapiEvent } from "@/lib/capi";
import { withTimeout } from "@/utils/withTimeout";
import { events } from "@/data/events";
import type { Order, SyncMeta } from "@/types/analytics";

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
 * Whether this order already exists in Firestore, i.e. whether it has been
 * through this sync loop before. This is the sole idempotency guard for
 * Purchase CAPI firing: `orders/{orderId}` is only ever written by this
 * route, so a 404 here means "first time we've ever seen this order" and a
 * 200 means "already processed at least once", regardless of how its
 * status may have changed since (e.g. later refunded). Firing Purchase
 * exactly once per order, on first sight while still "placed", is what
 * prevents a repeat sync (incremental `changed_since` re-fetches orders
 * that were merely updated, such as refunds) from double-counting revenue
 * in Meta.
 */
async function orderAlreadySynced(
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

  return true;
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

    // Only process events that have an Eventbrite ID
    const syncableEvents = events.filter((e) => e.eventbriteId);

    const syncErrors: string[] = [];
    let totalProcessed = 0;
    let totalMatched = 0;
    let globalRateLimitRemaining = 1000;

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

          const orderWithMatch: Order = { ...order, matchedLeadId };

          // Purchase CAPI: the sole remaining Purchase signal now that the
          // Eventbrite modal embed (and its browser-side fbq("track",
          // "Purchase", ...) call in the retired EventbriteWidgetInit.astro)
          // is gone. Fired at most once per order, see orderAlreadySynced.
          if (capiAccessToken) {
            try {
              const alreadySynced = await orderAlreadySynced(
                projectId,
                accessToken,
                order.orderId,
              );
              if (!alreadySynced && order.status === "placed") {
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
                if (!result.ok) {
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
              // Non-fatal and, in this one case, unrecoverable: the order
              // is still upserted below regardless (order data must never
              // be lost over a tracking hiccup), which means a transient
              // failure here permanently forfeits that order's Purchase
              // signal: the existence check will read "already synced" on
              // every later run. Acceptable: this is the same best-effort
              // posture CAPI takes everywhere else (see src/lib/capi.ts),
              // and a Firestore GET failing right as we first see a brand
              // new order is rare.
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
        }
      }
    }

    // Persist sync metadata, keeping last 10 errors
    const now = new Date().toISOString();
    const allErrors = [...(prevMeta?.errors ?? []), ...syncErrors].slice(-10);
    const newMeta: SyncMeta = {
      lastSyncAt: now,
      ordersProcessed: previousTotal + totalProcessed,
      errors: allErrors,
    };

    await writeSyncMeta(projectId, accessToken, newMeta);

    return new Response(
      JSON.stringify({
        ok: true,
        ordersProcessed: totalProcessed,
        leadsMatched: totalMatched,
        errors: syncErrors,
        rateLimitRemaining: globalRateLimitRemaining,
        lastSyncAt: now,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-orders] Fatal error: ${msg}`);
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
