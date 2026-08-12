import type { APIRoute } from "astro";
import { fsAdd } from "@/lib/firestoreRest";
import { cleanPhone } from "@/lib/phone";
import { alertOps } from "@/lib/opsAlert";
import { signPortalToken, _midnightLocalUnix } from "@/lib/portalToken";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { events } from "@/data/events";
import { sendMail } from "@/lib/zohoMailer";
import { waiverReceiptWithText } from "@/data/emails";
import { createHash } from "node:crypto";
import { enforceRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rateLimit";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { ContestantShowClaimSchema } from "@/lib/schemas";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.contestantClaim);
  if (limited) return limited;

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

  if (waiverAgreed !== true)
    return jsonResponse({ error: "You must agree to the waiver" }, 400);
  if (waiverVersion !== WAIVER_VERSION)
    return jsonResponse(
      { error: "Waiver version mismatch. Please refresh the page." },
      400,
    );
  if (role === "spectator")
    return jsonResponse(
      { error: "Spectators only need the standalone waiver at /waiver." },
      400,
    );
  const expectedSig = `${firstName.trim()} ${lastName.trim()}`;
  if (signature.trim().toLowerCase() !== expectedSig.toLowerCase())
    return jsonResponse({ error: "Signature must match your full name" }, 400);

  const phone = cleanPhone(rawPhone);
  if (!phone) return jsonResponse({ error: "Invalid phone number" }, 400);

  const event = events.find(
    (e) =>
      !e.hidden &&
      e.citySlug &&
      e.isoDate &&
      `${e.citySlug}-${e.isoDate}` === showId,
  );
  if (!event || !event.isoDate)
    return jsonResponse({ error: "Invalid show" }, 404);

  const showDate = event.isoDate;
  const showTimezone = event.timezone ?? "America/New_York";

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
    showStartTime: event.startTime ?? null,
    showVenueName: event.venue?.name ?? null,
    showVenueAddress: event.venue?.streetAddress ?? null,
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
    showId,
  };

  let token: string;
  try {
    const contestantId = await fsAdd("contestants", contestantData);
    token = await signPortalToken(contestantId, showId, showDate, showTimezone);
  } catch (err) {
    // A failed show claim blocks a contestant right before a show; page with
    // their contact fields so they can be walked through it.
    await alertOps({
      flow: "waiver",
      stage: "show_claim_write",
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
