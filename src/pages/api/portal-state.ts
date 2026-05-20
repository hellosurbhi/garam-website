import type { APIRoute } from "astro";
import { fsGet } from "@/lib/firestoreRest";
import { verifyPortalToken } from "@/lib/portalToken";
import { events } from "@/data/events";
import { isEventPast } from "@/utils/eventDate";

export const prerender = false;

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key) cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

function hasSignedWaiver(contestant: Record<string, unknown>): boolean {
  return (
    typeof contestant.signedAtIso === "string" &&
    contestant.signedAtIso.length > 0 &&
    typeof contestant.waiverVersion === "string" &&
    contestant.waiverVersion.length > 0 &&
    typeof contestant.signature === "string" &&
    contestant.signature.length > 0 &&
    typeof contestant.waiverTextHash === "string" &&
    contestant.waiverTextHash.length > 0
  );
}

function normalizeRole(
  role: string | null,
): "female" | "male" | "spectator" | null {
  if (!role) return null;
  if (role === "female" || role === "male" || role === "spectator") {
    return role;
  }
  if (role === "stealer") return "spectator";
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const inviteId = url.searchParams.get("invite");
  const showId = url.searchParams.get("show");

  if (showId) {
    const event = events.find(
      (e) =>
        !e.hidden &&
        e.citySlug &&
        e.isoDate &&
        `${e.citySlug}-${e.isoDate}` === showId,
    );
    if (!event || !event.isoDate) {
      return json({ state: "error", message: "Invalid show link." }, 404);
    }
    if (isEventPast(event.date)) {
      return json({
        state: "error",
        message: "This show has already passed.",
      });
    }
    return json({
      state: "show",
      showId,
      showCity: event.city,
      showDate: event.isoDate,
      showDisplayDate: event.date,
      startTime: event.startTime ?? null,
      venueName: event.venue?.name ?? null,
    });
  }

  if (inviteId) {
    if (inviteId.includes("/")) {
      return json({ state: "error", message: "Invalid invite link." }, 400);
    }
    const invite = await fsGet(`invites/${inviteId}`);
    if (!invite) {
      return json({ state: "error", message: "Invalid invite link." }, 404);
    }
    if (invite.claimed) {
      return json({
        state: "error",
        message:
          "This invite has already been used. If this is your link, your session may have expired.",
      });
    }
    return json({
      state: "invite",
      inviteId,
      showCity: invite.showCity,
      showDate: invite.showDate,
      showDisplayDate: invite.showDisplayDate,
      startTime: invite.showStartTime,
      venueName: invite.showVenueName,
      role: normalizeRole(typeof invite.role === "string" ? invite.role : null),
    });
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies.portal_session;
  if (!token) {
    return json({ state: "open" });
  }

  try {
    const { contestantId } = await verifyPortalToken(token);
    const contestant = await fsGet(`contestants/${contestantId}`);
    if (!contestant) {
      return json({ state: "expired" });
    }
    if (!hasSignedWaiver(contestant)) {
      return json({ state: "no-access" });
    }
    return json({
      state: "active",
      firstName: contestant.firstName,
      lastName: contestant.lastName,
      role: contestant.role,
      showCity: contestant.showCity,
      showDate: contestant.showDate,
      showDisplayDate: contestant.showDisplayDate,
      startTime: contestant.showStartTime,
      venueName: contestant.showVenueName,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "JWTExpired" ||
        err.name === "JWTInvalid" ||
        err.name === "JWSInvalid" ||
        err.name === "JWSSignatureVerificationFailed")
    ) {
      return json({ state: "expired" });
    }
    console.error("[portal-state] Unexpected token verification error:", err);
    return json(
      { state: "error", message: "Could not load portal. Please try again." },
      500,
    );
  }
};
