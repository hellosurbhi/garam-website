import type { APIRoute } from "astro";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { cleanPhone } from "@/lib/phone";
import { signPortalToken, _midnightLocalUnix } from "@/lib/portalToken";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { events } from "@/data/events";
import { render } from "@react-email/render";
import { createElement } from "react";
import WaiverReceipt from "@/emails/WaiverReceipt";
import { Resend } from "resend";
import { createHash } from "crypto";
import {
  checkRateLimit,
  contestantClaimLimiter,
  getClientIp,
} from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { ContestantShowClaimSchema } from "@/lib/schemas";
import { EMAIL_FROM } from "@/data/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rateLimitResponse = await checkRateLimit(
    contestantClaimLimiter,
    getClientIp(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await parseJsonRequest(request, ContestantShowClaimSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const {
    showId,
    role,
    firstName,
    lastName,
    email,
    phone: rawPhone,
    waiverAgreed,
    signature,
    waiverVersion,
    mailingListOptIn,
  } = body;

  if (waiverAgreed !== true) {
    return jsonResponse({ error: "You must agree to the waiver" }, 400);
  }
  if (waiverVersion !== WAIVER_VERSION) {
    return jsonResponse(
      { error: "Waiver version mismatch. Please refresh the page." },
      400,
    );
  }
  if (role === "spectator") {
    return jsonResponse(
      { error: "Spectators only need the standalone waiver at /waiver." },
      400,
    );
  }
  const expectedSig = `${firstName.trim()} ${lastName.trim()}`;
  if (signature.trim().toLowerCase() !== expectedSig.toLowerCase()) {
    return jsonResponse({ error: "Signature must match your full name" }, 400);
  }
  const phone = cleanPhone(rawPhone);
  if (!phone) {
    return jsonResponse({ error: "Invalid phone number" }, 400);
  }

  const event = events.find(
    (e) =>
      !e.hidden &&
      e.citySlug &&
      e.isoDate &&
      `${e.citySlug}-${e.isoDate}` === showId,
  );
  if (!event || !event.isoDate) {
    return jsonResponse({ error: "Invalid show" }, 404);
  }

  const showDate = event.isoDate;
  const showTimezone = "America/New_York";

  const todayInShowTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: showTimezone,
  }).format(new Date());
  if (showDate < todayInShowTz) {
    return jsonResponse({ error: "This show has already passed" }, 410);
  }

  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const signedAtIso = new Date().toISOString();
    const waiverTextHash = createHash("sha256")
      .update(WAIVER_TEXT)
      .digest("hex");

    const contestantData = {
      inviteId: null,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone,
      role,
      showId,
      showCity: event.city,
      showDate,
      showDisplayDate: event.date,
      showStartTime: event.startTime ?? "20:00",
      showVenueName: event.venue?.name ?? "",
      showVenueAddress: event.venue?.streetAddress ?? "",
      showTimezone,
      waiverVersion: WAIVER_VERSION,
      waiverText: WAIVER_TEXT,
      waiverTextHash,
      signature: signature.trim(),
      signedAtIso,
      ip,
      userAgent,
      mailingListOptIn: mailingListOptIn === true,
      postShowEmailSentAt: null,
      createdAt: signedAtIso,
    };

    const db = getAdminFirestore();
    const contestantRef = db.collection("contestants").doc();
    const token = await signPortalToken(
      contestantRef.id,
      showId,
      showDate,
      showTimezone,
    );
    await contestantRef.set(contestantData);

    const apiKey = import.meta.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        const html = await render(
          createElement(WaiverReceipt, {
            firstName: firstName.trim(),
            signature: signature.trim(),
            signedAtIso,
            waiverText: WAIVER_TEXT,
          }),
        );
        await resend.emails.send({
          from: EMAIL_FROM,
          to: email.trim().toLowerCase(),
          subject: "Your Garam Masala Dating waiver (signed copy)",
          html,
        });

        if (mailingListOptIn) {
          const audienceId = import.meta.env.RESEND_CONTESTANT_AUDIENCE_ID;
          if (audienceId) {
            await resend.contacts.create({
              audienceId,
              email: email.trim().toLowerCase(),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              unsubscribed: false,
            });
          }
        }
      } catch {
        // Email send failure should not block the waiver claim
      }
    }

    const expireSec = _midnightLocalUnix(showDate, showTimezone);
    const expireDate = new Date(expireSec * 1000);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append(
      "Set-Cookie",
      `portal_session=${token}; Path=/; HttpOnly;${import.meta.env.DEV ? "" : " Secure;"} SameSite=Lax; Expires=${expireDate.toUTCString()}`,
    );

    return jsonResponse({ ok: true }, 200, headers);
  } catch (err) {
    console.error("[contestant-show-claim] Claim failed:", err);
    return jsonResponse({ error: "Service temporarily unavailable" }, 500);
  }
};
