export const prerender = false;

import type { APIRoute } from "astro";
import { verifyAdminIdentity } from "@/lib/verifyToken";
import { fsAdd, fsPatch } from "@/lib/firestoreRest";
import { signPortalToken } from "@/lib/portalToken";
import { sendMail } from "@/lib/zohoMailer";
import { inviteApproval } from "@/data/emails";
import { events } from "@/data/events";

const VALID_ROLES = ["female", "male"];

interface InviteBody {
  applicantId?: string;
  applicantName?: string;
  applicantEmail?: string;
  showId: string;
  role: string;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const identity = await verifyAdminIdentity(
    request.headers.get("authorization") ?? undefined,
  );
  if (!identity) return json({ error: "Unauthorized" }, 401);

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json"))
    return json({ error: "Invalid content type" }, 400);

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { applicantId, applicantName, applicantEmail, showId, role } = body;

  if (!showId?.trim() || !role?.trim())
    return json({ error: "Missing showId or role" }, 400);
  if (!VALID_ROLES.includes(role))
    return json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      400,
    );
  if (!applicantId?.trim()) return json({ error: "Missing applicantId" }, 400);

  const event = events.find(
    (e) => !e.hidden && e.isoDate && `${e.citySlug}-${e.isoDate}` === showId,
  );
  if (!event) return json({ error: "Invalid showId or show not found" }, 400);

  const inviteData = {
    showId,
    showCity: event.city,
    showDate: event.isoDate!,
    showDisplayDate: event.date,
    showStartTime: event.startTime ?? "20:00",
    showVenueName: event.venue?.name ?? "",
    showVenueAddress: event.venue?.streetAddress ?? "",
    showTimezone: event.timezone ?? "America/New_York",
    role,
    applicantId: applicantId.trim(),
    applicantName: applicantName?.trim() ?? "",
    applicantEmail: applicantEmail?.trim().toLowerCase() ?? "",
    claimed: false,
    createdAt: new Date().toISOString(),
  };

  const inviteId = await fsAdd("invites", inviteData);
  const siteUrl = import.meta.env.SITE ?? "https://garammasaladating.com";

  const token = await signPortalToken(
    inviteId,
    showId,
    event.isoDate!,
    event.timezone ?? "America/New_York",
  );
  const waiverUrl = `${siteUrl}/waiver?token=${encodeURIComponent(token)}`;

  // Set invitedAt + castEventId on the application and log invite_sent event
  await fsPatch(`applications/${applicantId.trim()}`, {
    invitedAt: new Date().toISOString(),
    castEventId: showId,
    status: "Cast",
  });
  await fsAdd(`applications/${applicantId.trim()}/events`, {
    type: "invite_sent",
    timestamp: new Date().toISOString(),
    actor: identity.email,
    payload: { inviteId, showId },
  });

  let emailSent = false;
  let emailError: string | undefined;

  if (applicantEmail?.trim()) {
    const name = applicantName?.trim() ?? "there";
    const template = inviteApproval(name, {
      portalUrl: waiverUrl,
      showDate: event.date,
      showCity: event.city,
    });
    try {
      await sendMail({
        to: applicantEmail.trim().toLowerCase(),
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email send failed";
    }
  } else {
    emailError = "Applicant email is missing.";
  }

  return json({
    ok: true,
    inviteId,
    inviteUrl: waiverUrl,
    emailSent,
    ...(emailError ? { emailError } : {}),
  });
};
