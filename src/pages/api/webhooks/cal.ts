export const prerender = false;

import { timingSafeEqual, createHmac } from "node:crypto";
import type { APIRoute } from "astro";
import {
  fsQuery,
  fsPatch,
  fsAdd,
  fsDeleteFields,
} from "../../../lib/firestoreRest";

// ---------------------------------------------------------------------------
// IMPORTANT: cal.com payload field paths
// These field names were derived from cal.com webhook documentation.
// Verify against live webhook payloads before relying on them:
//   - triggerEvent: top-level string ("BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED")
//   - payload.id: numeric booking ID
//   - payload.uid: booking UID string (used to construct the booking URL)
//   - payload.startTime: ISO 8601 datetime string (the interview start time)
//   - payload.attendees[0].email: first attendee's email address
//   - payload.calLink: full booking URL (e.g. https://cal.com/organizer/event/uid)
// ---------------------------------------------------------------------------

interface CalAttendee {
  email: string;
  name?: string;
  timeZone?: string;
}

interface CalPayload {
  id?: number;
  uid?: string;
  startTime?: string;
  attendees?: CalAttendee[];
  calLink?: string;
  status?: string;
}

interface CalWebhookBody {
  triggerEvent?: string;
  payload?: CalPayload;
}

function verifyHmac(rawBody: string, signatureHeader: string | null): boolean {
  const secret = import.meta.env.CAL_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(signatureHeader.replace(/^sha256=/, ""), "hex");

  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

async function findApplication(
  email: string,
): Promise<Record<string, unknown> | null> {
  const emailNormalized = email.toLowerCase();
  const results = await fsQuery(
    "applications",
    "emailNormalized",
    emailNormalized,
    "submittedAt",
  );

  if (results.length === 0) return null;

  if (results.length > 1) {
    // Multiple applications with same email — take the most recent (fsQuery orders by submittedAt DESC)
    console.warn(
      `cal-webhook: multiple applications for ${emailNormalized}, using most recent`,
    );
  }

  return results[0];
}

async function addEvent(
  appId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await fsAdd(`applications/${appId}/events`, {
    type,
    timestamp: new Date().toISOString(),
    actor: "system",
    payload,
  });
}

export const POST: APIRoute = async ({ request }) => {
  // Read raw body BEFORE parsing — required for HMAC verification
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("X-Cal-Signature-256");

  const valid = verifyHmac(rawBody, signatureHeader);
  if (!valid) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: CalWebhookBody;
  try {
    body = JSON.parse(rawBody) as CalWebhookBody;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { triggerEvent, payload } = body;

  if (
    triggerEvent !== "BOOKING_CREATED" &&
    triggerEvent !== "BOOKING_RESCHEDULED" &&
    triggerEvent !== "BOOKING_CANCELLED"
  ) {
    // Unknown event type — ack and ignore
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const attendeeEmail = payload?.attendees?.[0]?.email;
  if (!attendeeEmail) {
    return new Response(JSON.stringify({ error: "missing attendee email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const app = await findApplication(attendeeEmail);
  if (!app) {
    console.log(`cal-webhook: no-match: ${attendeeEmail.toLowerCase()}`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appId = app.id as string;
  const bookingId = payload?.id;
  const bookingUrl = payload?.calLink ?? "";
  const startTime = payload?.startTime ?? "";

  if (triggerEvent === "BOOKING_CREATED") {
    const fields: Record<string, unknown> = {
      calBookingId: bookingId,
      calBookingUrl: bookingUrl,
      scheduledAt: startTime ? new Date(startTime).toISOString() : null,
    };

    // New -> Contacted on first booking; already Contacted stays unchanged
    if (app.status === "New") {
      fields.status = "Contacted";
    }

    await fsPatch(`applications/${appId}`, fields);
    await addEvent(appId, "booking_created", {
      calBookingId: bookingId,
      bookingTime: startTime,
    });
  } else if (triggerEvent === "BOOKING_RESCHEDULED") {
    // Only update if this matches the stored booking (prevents stale webhooks)
    if (app.calBookingId !== bookingId) {
      console.warn(
        `cal-webhook: BOOKING_RESCHEDULED calBookingId mismatch for ${appId}: stored=${app.calBookingId} got=${bookingId}`,
      );
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const oldTime = app.scheduledAt as string | undefined;
    await fsPatch(`applications/${appId}`, {
      scheduledAt: startTime ? new Date(startTime).toISOString() : null,
      calBookingUrl: bookingUrl,
    });
    await addEvent(appId, "booking_rescheduled", {
      calBookingId: bookingId,
      oldTime,
      newTime: startTime,
    });
  } else if (triggerEvent === "BOOKING_CANCELLED") {
    if (app.calBookingId !== bookingId) {
      console.warn(
        `cal-webhook: BOOKING_CANCELLED calBookingId mismatch for ${appId}: stored=${app.calBookingId} got=${bookingId}`,
      );
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await fsDeleteFields(`applications/${appId}`, [
      "scheduledAt",
      "calBookingUrl",
      "calBookingId",
    ]);
    await addEvent(appId, "booking_cancelled", { calBookingId: bookingId });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
