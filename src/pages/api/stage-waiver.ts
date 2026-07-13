export const prerender = false;

import type { APIRoute } from "astro";
import { cleanPhone } from "@/lib/phone";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { sendMail } from "@/lib/zohoMailer";
import { waiverReceipt } from "@/data/emails";
import { createHash } from "node:crypto";
import { enforceRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { StageWaiverSchema } from "@/lib/schemas";
import { verifyPortalToken } from "@/lib/portalToken";
import { fsGet, fsAdd, fsPatch } from "@/lib/firestoreRest";
import { alertOps } from "@/lib/opsAlert";

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.stageWaiver);
  if (limited) return limited;

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
      if (!applicantId) {
        return jsonResponse({ error: "Invalid or expired waiver link" }, 401);
      }
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

  const signerContext = {
    name: `${firstName.trim()} ${lastName.trim()}`,
    email: email.trim().toLowerCase(),
    phone,
  };

  try {
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
  } catch (err) {
    // A failed waiver write blocks someone from going on stage; page with
    // their contact fields so they can be walked through it.
    await alertOps({
      flow: "waiver",
      stage: "firestore_write",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: signerContext,
    });
    return jsonResponse(
      { error: "Could not save your waiver. Please try again." },
      500,
    );
  }

  try {
    const template = waiverReceipt(firstName.trim());
    await sendMail({
      to: email.trim().toLowerCase(),
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  } catch (err) {
    // Waiver is already signed; receipt email failure should not block the
    // response, but a silently dead mailer must still page.
    await alertOps({
      flow: "waiver",
      stage: "receipt_email",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: signerContext,
    });
  }

  return jsonResponse({ ok: true });
};
