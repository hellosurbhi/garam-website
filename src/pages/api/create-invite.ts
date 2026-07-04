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

  let body: Partial<Record<keyof InviteBody, unknown>>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const applicantId =
    typeof body.applicantId === "string" ? body.applicantId.trim() : "";
  const applicantName =
    typeof body.applicantName === "string" ? body.applicantName.trim() : "";
  const applicantEmail =
    typeof body.applicantEmail === "string" ? body.applicantEmail.trim() : "";
  const showId = typeof body.showId === "string" ? body.showId.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";

  if (!showId || !role)
    return json({ error: "Missing showId or role" }, 400);
  if (!VALID_ROLES.includes(role))
    return json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      400,
    );
  if (!applicantId) return json({ error: "Missing applicantId" }, 400);

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
    applicantId,
    applicantName,
    applicantEmail: applicantEmail.toLowerCase(),
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

  // Set casting metadata unconditionally; invitedAt and invite_sent only after email succeeds
  await fsPatch(`applications/${applicantId}`, {
    castEventId: showId,
    status: "Cast",
  });

  let emailSent = false;
  let emailError: string | undefined;

  if (applicantEmail) {
    const name = applicantName || "there";
    const template = inviteApproval(name, {
      portalUrl: waiverUrl,
      showDate: event.date,
      showCity: event.city,
    });
    try {
      await sendMail({
        to: applicantEmail.toLowerCase(),
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      emailSent = true;
      const sentAt = new Date().toISOString();
      await fsPatch(`applications/${applicantId}`, {
        invitedAt: sentAt,
      });
      await fsAdd(`applications/${applicantId}/events`, {
        type: "invite_sent",
        timestamp: sentAt,
        actor: identity.email,
        payload: { inviteId, showId },
      });
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
