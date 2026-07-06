import type { APIRoute } from "astro";
import { fsAdd } from "@/lib/firestoreRest";
import { cleanPhone } from "@/lib/phone";
import { signPortalToken, _midnightLocalUnix } from "@/lib/portalToken";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { sendMail } from "@/lib/zohoMailer";
import { waiverReceiptWithText } from "@/data/emails";
import { createHash } from "node:crypto";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { ContestantOpenClaimSchema } from "@/lib/schemas";

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
  const limited = await enforceRateLimit(request, RATE_LIMITS.contestantClaim);
  if (limited) return limited;

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

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const signedAtIso = new Date().toISOString();
  const waiverTextHash = createHash("sha256").update(WAIVER_TEXT).digest("hex");
  const accessUntil = accessUntilIsoDate();

  const contestantData: Record<string, unknown> = {
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

  const contestantId = await fsAdd("contestants", contestantData);
  const token = await signPortalToken(
    contestantId,
    OPEN_PACKET_SHOW_ID,
    accessUntil,
    OPEN_PACKET_TIMEZONE,
  );

  try {
    const template = waiverReceiptWithText({
      firstName: firstName.trim(),
      signature: signature.trim(),
      signedAtIso,
      waiverText: WAIVER_TEXT,
    });
    await sendMail({
      to: email.trim().toLowerCase(),
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  } catch {
    // Email failure should not block packet completion
  }

  const expireSec = _midnightLocalUnix(accessUntil, OPEN_PACKET_TIMEZONE);
  const expireDate = new Date(expireSec * 1000);
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `portal_session=${token}; Path=/; HttpOnly;${import.meta.env.DEV ? "" : " Secure;"} SameSite=Lax; Expires=${expireDate.toUTCString()}`,
  );

  return jsonResponse({ ok: true }, 200, headers);
};
