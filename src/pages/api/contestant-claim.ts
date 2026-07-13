import type { APIRoute } from "astro";
import { fsGet, fsAdd, fsPatch } from "@/lib/firestoreRest";
import { cleanPhone } from "@/lib/phone";
import { signPortalToken, _midnightLocalUnix } from "@/lib/portalToken";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { sendMail } from "@/lib/zohoMailer";
import { waiverReceiptWithText } from "@/data/emails";
import { createHash } from "node:crypto";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { ContestantClaimSchema } from "@/lib/schemas";
import { alertOps } from "@/lib/opsAlert";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.contestantClaim);
  if (limited) return limited;

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

  const invite = await fsGet(`invites/${inviteId}`);
  if (!invite) return jsonResponse({ error: "Invalid invite" }, 404);
  if (invite.claimed) {
    return jsonResponse({ error: "This invite has already been used" }, 409);
  }

  const showDate = typeof invite.showDate === "string" ? invite.showDate : "";
  const showTimezone =
    typeof invite.showTimezone === "string"
      ? invite.showTimezone
      : "America/New_York";

  const todayInShowTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: showTimezone,
  }).format(new Date());
  if (showDate < todayInShowTz)
    return jsonResponse({ error: "This show has already passed" }, 410);

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const signedAtIso = new Date().toISOString();
  const waiverTextHash = createHash("sha256").update(WAIVER_TEXT).digest("hex");

  const contestantData: Record<string, unknown> = {
    inviteId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    phone,
    role: invite.role,
    showId: invite.showId,
    showCity: invite.showCity,
    showDate,
    showDisplayDate: invite.showDisplayDate ?? null,
    showStartTime: invite.showStartTime ?? null,
    showVenueName: invite.showVenueName ?? null,
    showVenueAddress: invite.showVenueAddress ?? null,
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

  const claimContext = {
    name: `${firstName.trim()} ${lastName.trim()}`,
    email: email.trim().toLowerCase(),
    phone,
    inviteId,
  };

  let contestantId: string;
  let token: string;
  try {
    contestantId = await fsAdd("contestants", contestantData);
    token = await signPortalToken(
      contestantId,
      typeof invite.showId === "string" ? invite.showId : "",
      showDate,
      showTimezone,
    );

    await fsPatch(`invites/${inviteId}`, {
      claimed: true,
      claimedAt: signedAtIso,
      contestantId,
    });
  } catch (err) {
    // A failed claim blocks a cast contestant right before a show; page with
    // their contact fields so they can be walked through it.
    await alertOps({
      flow: "waiver",
      stage: "contestant_claim_write",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: claimContext,
    });
    return jsonResponse(
      { error: "Could not save your waiver. Please try again." },
      500,
    );
  }

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
  } catch (err) {
    // Email failure should not block the waiver claim, but a silently dead
    // mailer must still page.
    await alertOps({
      flow: "waiver",
      stage: "receipt_email",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: claimContext,
    });
  }

  const expireSec = _midnightLocalUnix(showDate, showTimezone);
  const expireDate = new Date(expireSec * 1000);
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `portal_session=${token}; Path=/; HttpOnly;${import.meta.env.DEV ? "" : " Secure;"} SameSite=Lax; Expires=${expireDate.toUTCString()}`,
  );

  return jsonResponse({ ok: true }, 200, headers);
};
