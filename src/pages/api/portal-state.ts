import type { APIRoute } from "astro";
import { fsGet } from "@/lib/firestoreRest";
import { verifyPortalToken } from "@/lib/portalToken";
import { events } from "@/data/events";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

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

function showIsUpcoming(
  isoDate: string,
  timezone: string | undefined,
): boolean {
  const todayInShowTz = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone ?? "America/New_York",
  }).format(new Date());
  return isoDate >= todayInShowTz;
}

function formatDisplayTime(startTime: string | undefined): string | null {
  return startTime
    ? new Date(`2000-01-01T${startTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
}

function currentVisibleShow() {
  return events.find(
    (e) =>
      !e.hidden &&
      e.citySlug &&
      e.isoDate &&
      showIsUpcoming(e.isoDate, e.timezone),
  );
}

function showInviteState(
  event: NonNullable<ReturnType<typeof currentVisibleShow>>,
  showId: string,
  role: "female" | "male" | "spectator" | null,
) {
  return {
    state: "show-invite",
    showId,
    showCity: event.city,
    showDate: event.isoDate,
    showDisplayDate: event.date,
    startTime: formatDisplayTime(event.startTime),
    venueName: event.venue?.name ?? null,
    role,
  };
}

export const GET: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.contestantClaim);
  if (limited) return limited;

  const url = new URL(request.url);
  const inviteId = url.searchParams.get("invite");
  const showId = url.searchParams.get("show");
  const roleParam = url.searchParams.get("role");

  if (showId) {
    const role = normalizeRole(roleParam);
    if (roleParam && !role) {
      return json({ state: "error", message: "Invalid role." }, 400);
    }
    const event = events.find(
      (e) =>
        !e.hidden &&
        e.citySlug &&
        e.isoDate &&
        `${e.citySlug}-${e.isoDate}` === showId,
    );
    if (!event || !event.isoDate) {
      return json({ state: "error", message: "Show not found." }, 404);
    }
    if (!showIsUpcoming(event.isoDate, event.timezone)) {
      return json({ state: "error", message: "This show has already passed." });
    }
    return json(showInviteState(event, showId, role));
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
    const event = currentVisibleShow();
    if (!event?.citySlug || !event.isoDate) {
      return json({ state: "no-access" });
    }
    return json(
      showInviteState(event, `${event.citySlug}-${event.isoDate}`, null),
    );
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
