export const prerender = false;

import type { APIRoute } from "astro";
import { cleanPhone } from "@/lib/phone";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { sendMail } from "@/lib/zohoMailer";
import { waiverReceipt } from "@/data/emails";
import { createHash } from "node:crypto";
import {
  checkRateLimit,
  getClientIp,
  stageWaiverLimiter,
} from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { StageWaiverSchema } from "@/lib/schemas";
import { verifyPortalToken } from "@/lib/portalToken";
import { fsGet, fsAdd, fsPatch } from "@/lib/firestoreRest";

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
    portalToken,
  } = body;

  if (waiverAgreed !== true)
    return jsonResponse({ error: "You must agree to the waiver" }, 400);
  if (waiverVersion !== WAIVER_VERSION)
    return jsonResponse(
      { error: "Waiver version mismatch. Please refresh the page." },
      400,
    );
  const expectedSig = `${firstName.trim()} ${lastName.trim()}`;
  if (signature.trim().toLowerCase() !== expectedSig.toLowerCase())
    return jsonResponse({ error: "Signature must match your full name" }, 400);

  const phone = cleanPhone(rawPhone);
  if (!phone) return jsonResponse({ error: "Invalid phone number" }, 400);

  // Resolve applicantId from portal token when present
  let applicantId: string | null = null;
  if (portalToken) {
    try {
      const { contestantId } = await verifyPortalToken(portalToken);
      const invite = await fsGet(`invites/${contestantId}`);
      applicantId =
        typeof invite?.applicantId === "string" ? invite.applicantId : null;
    } catch {
      return jsonResponse({ error: "Invalid or expired waiver link" }, 401);
    }
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
  if (applicantId) stageWaiverData.applicantId = applicantId;

  await fsAdd("stage_waivers", stageWaiverData);

  // Link waiver to application document when we have the applicantId
  if (applicantId) {
    await fsPatch(`applications/${applicantId}`, {
      waiverSignedAt: signedAtIso,
    });
    await fsAdd(`applications/${applicantId}/events`, {
      type: "waiver_signed",
      timestamp: signedAtIso,
      actor: email.trim().toLowerCase(),
      payload: { signature: signature.trim() },
    });
  }

  try {
    const template = waiverReceipt(firstName.trim());
    await sendMail({
      to: email.trim().toLowerCase(),
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  } catch {
    // Waiver is already signed; receipt email failure should not block the response
  }

  return jsonResponse({ ok: true });
};
