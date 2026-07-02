import type { APIRoute } from "astro";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { cleanPhone } from "@/lib/phone";
import { signPortalToken, _midnightLocalUnix } from "@/lib/portalToken";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
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
import { ContestantOpenClaimSchema } from "@/lib/schemas";
import { EMAIL_FROM } from "@/data/email";

export const prerender = false;

const OPEN_PACKET_SHOW_ID = "open-casting-packet";
const OPEN_PACKET_SHOW_DATE = "Casting date to be confirmed";
const OPEN_PACKET_TIMEZONE = "America/New_York";

function accessUntilIsoDate(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export const POST: APIRoute = async ({ request }) => {
  const rateLimitResponse = await checkRateLimit(
    contestantClaimLimiter,
    getClientIp(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await parseJsonRequest(request, ContestantOpenClaimSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const {
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
  const expectedSig = `${firstName.trim()} ${lastName.trim()}`;
  if (signature.trim().toLowerCase() !== expectedSig.toLowerCase()) {
    return jsonResponse({ error: "Signature must match your full name" }, 400);
  }
  const phone = cleanPhone(rawPhone);
  if (!phone) {
    return jsonResponse({ error: "Invalid phone number" }, 400);
  }

  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const signedAtIso = new Date().toISOString();
    const waiverTextHash = createHash("sha256")
      .update(WAIVER_TEXT)
      .digest("hex");
    const accessUntil = accessUntilIsoDate();

    const contestantData = {
      inviteId: null,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone,
      role,
      showId: OPEN_PACKET_SHOW_ID,
      showCity: "",
      showDate: OPEN_PACKET_SHOW_DATE,
      showTimezone: OPEN_PACKET_TIMEZONE,
      accessUntil,
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
      OPEN_PACKET_SHOW_ID,
      accessUntil,
      OPEN_PACKET_TIMEZONE,
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
        // Email send failure should not block packet completion.
      }
    }

    const expireSec = _midnightLocalUnix(accessUntil, OPEN_PACKET_TIMEZONE);
    const expireDate = new Date(expireSec * 1000);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append(
      "Set-Cookie",
      `portal_session=${token}; Path=/; HttpOnly;${import.meta.env.DEV ? "" : " Secure;"} SameSite=Lax; Expires=${expireDate.toUTCString()}`,
    );

    return jsonResponse({ ok: true }, 200, headers);
  } catch (err) {
    console.error("[contestant-open-claim] Claim failed:", err);
    return jsonResponse({ error: "Service temporarily unavailable" }, 500);
  }
};
