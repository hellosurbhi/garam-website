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
import { ContestantClaimSchema } from "@/lib/schemas";
import { EMAIL_FROM } from "@/data/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rateLimitResponse = await checkRateLimit(
    contestantClaimLimiter,
    getClientIp(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await parseJsonRequest(request, ContestantClaimSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const {
    inviteId,
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
    const db = getAdminFirestore();

    const inviteDoc = await db.collection("invites").doc(inviteId).get();
    if (!inviteDoc.exists) {
      return jsonResponse({ error: "Invalid invite" }, 404);
    }
    const invite = inviteDoc.data()!;
    if (invite.claimed) {
      return jsonResponse({ error: "This invite has already been used" }, 409);
    }
    const showDate = invite.showDate as string;
    const showTimezone =
      (invite.showTimezone as string | undefined) ?? "America/New_York";

    // Compare show date against today in the show's timezone
    const todayInShowTz = new Intl.DateTimeFormat("en-CA", {
      timeZone: showTimezone,
    }).format(new Date());
    if (showDate < todayInShowTz) {
      return jsonResponse({ error: "This show has already passed" }, 410);
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const signedAtIso = new Date().toISOString();
    const waiverTextHash = createHash("sha256")
      .update(WAIVER_TEXT)
      .digest("hex");

    const contestantData = {
      inviteId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone,
      role: invite.role as string,
      showId: invite.showId as string,
      showCity: invite.showCity as string,
      showDate,
      showDisplayDate: invite.showDisplayDate as string | undefined,
      showStartTime: invite.showStartTime as string | undefined,
      showVenueName: invite.showVenueName as string | undefined,
      showVenueAddress: invite.showVenueAddress as string | undefined,
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

    const contestantRef = db.collection("contestants").doc();
    const token = await signPortalToken(
      contestantRef.id,
      invite.showId as string,
      showDate,
      showTimezone,
    );

    await db.runTransaction(async (tx) => {
      const freshInvite = await tx.get(db.collection("invites").doc(inviteId));
      if (!freshInvite.exists || freshInvite.data()!.claimed) {
        throw new Error("already_claimed");
      }
      tx.set(contestantRef, contestantData);
      tx.update(db.collection("invites").doc(inviteId), {
        claimed: true,
        claimedAt: signedAtIso,
        contestantId: contestantRef.id,
      });
    });

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

    // Cookie expires at local midnight of the day after the show (matches JWT expiry)
    const expireSec = _midnightLocalUnix(showDate, showTimezone);
    const expireDate = new Date(expireSec * 1000);
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append(
      "Set-Cookie",
      `portal_session=${token}; Path=/; HttpOnly;${import.meta.env.DEV ? "" : " Secure;"} SameSite=Lax; Expires=${expireDate.toUTCString()}`,
    );

    return jsonResponse({ ok: true }, 200, headers);
  } catch (err) {
    if (err instanceof Error && err.message === "already_claimed") {
      return jsonResponse({ error: "This invite has already been used" }, 409);
    }
    console.error("[contestant-claim] Claim failed:", err);
    return jsonResponse({ error: "Service temporarily unavailable" }, 500);
  }
};
