import type { APIRoute } from "astro";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { verifyAdminToken } from "@/lib/verifyToken";
import { events } from "@/data/events";
import { render } from "@react-email/render";
import { createElement } from "react";
import InviteEmail from "@/emails/InviteEmail";
import { Resend } from "resend";

const VALID_ROLES = ["female", "male"];

interface InviteBody {
  applicantId?: string;
  applicantName?: string;
  applicantEmail?: string;
  showId: string;
  role: string;
}

export const prerender = false;

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const adminUid = await verifyAdminToken(authHeader);
  if (!adminUid) {
    return json({ error: "Unauthorized" }, 401);
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return json({ error: "Invalid content type" }, 400);
  }

  let body: InviteBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { applicantId, applicantName, applicantEmail, showId, role } = body;

  if (!showId?.trim() || !role?.trim()) {
    return json({ error: "Missing showId or role" }, 400);
  }
  if (!VALID_ROLES.includes(role)) {
    return json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      400,
    );
  }

  const event = events.find(
    (e) => !e.hidden && e.isoDate && `${e.citySlug}-${e.isoDate}` === showId,
  );
  if (!event) {
    return json({ error: "Invalid showId or show not found" }, 400);
  }

  const db = getAdminFirestore();
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
    applicantId: applicantId?.trim() ?? "",
    applicantName: applicantName?.trim() ?? "",
    applicantEmail: applicantEmail?.trim().toLowerCase() ?? "",
    claimed: false,
    createdAt: new Date().toISOString(),
  };

  const inviteRef = await db.collection("invites").add(inviteData);
  const siteUrl = import.meta.env.SITE ?? "https://garammasaladating.com";
  const inviteUrl = `${siteUrl}/contestant-portal?invite=${inviteRef.id}`;
  let emailSent = false;
  let emailError: string | undefined;

  if (applicantEmail?.trim()) {
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const resend = new Resend(apiKey);
        const html = await render(
          createElement(InviteEmail, {
            firstName: applicantName?.split(" ")[0] ?? "there",
            showCity: event.city,
            showDate: event.date,
            portalUrl: inviteUrl,
          }),
        );
        await resend.emails.send({
          from: "Garam Masala Dating <casting@garammasaladating.com>",
          to: applicantEmail.trim().toLowerCase(),
          subject: "You have been cast for Garam Masala Dating",
          html,
        });
        emailSent = true;
      } catch {
        emailError = "Email service failed to send the invite.";
      }
    } else {
      emailError = "Email service is not configured.";
    }
  } else {
    emailError = "Applicant email is missing.";
  }

  return json({
    ok: true,
    inviteId: inviteRef.id,
    inviteUrl,
    emailSent,
    ...(emailError ? { emailError } : {}),
  });
};
