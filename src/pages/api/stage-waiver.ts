import type { APIRoute } from "astro";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { cleanPhone } from "@/lib/phone";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { render } from "@react-email/render";
import { createElement } from "react";
import WaiverReceipt from "@/emails/WaiverReceipt";
import { Resend } from "resend";
import { createHash } from "crypto";
import {
  checkRateLimit,
  getClientIp,
  stageWaiverLimiter,
} from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { StageWaiverSchema } from "@/lib/schemas";
import { EMAIL_FROM } from "@/data/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rateLimitResponse = await checkRateLimit(
    stageWaiverLimiter,
    getClientIp(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = await parseJsonRequest(request, StageWaiverSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  const {
    firstName,
    lastName,
    email,
    phone: rawPhone,
    waiverAgreed,
    signature,
    waiverVersion,
    mailingListOptIn,
    showId,
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

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const signedAtIso = new Date().toISOString();
  const waiverTextHash = createHash("sha256").update(WAIVER_TEXT).digest("hex");

  const stageWaiverData: Record<string, string | boolean> = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phone,
    waiverVersion: WAIVER_VERSION,
    waiverText: WAIVER_TEXT,
    waiverTextHash,
    signature: signature.trim(),
    signedAtIso,
    ip,
    userAgent,
    mailingListOptIn: mailingListOptIn === true,
    createdAt: signedAtIso,
  };
  if (showId?.trim()) stageWaiverData.showId = showId.trim();

  const db = getAdminFirestore();
  await db.collection("stage_waivers").add(stageWaiverData);

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
      // Email failure should not block waiver signing
    }
  }

  return jsonResponse({ ok: true });
};
