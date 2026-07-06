export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminIdentity } from "@/lib/verifyToken";
import { fsGet, fsPatch, fsAdd } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import { waiverNudge } from "@/data/emails";
import { events } from "@/data/events";

const Schema = z.object({
  applicationId: z.string().min(1).max(200),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      400,
    );

  const { applicationId } = parsed.data;

  const app = await fsGet(`applications/${applicationId}`);
  if (!app) return json({ error: "Application not found" }, 404);
  if (typeof app.email !== "string" || !app.email)
    return json({ error: "Application has no email address" }, 400);

  const castEventId =
    typeof app.castEventId === "string" ? app.castEventId : null;
  if (!castEventId)
    return json(
      { error: "Application has no castEventId (not yet cast)" },
      400,
    );

  const event = events.find(
    (e) =>
      !e.hidden && e.isoDate && `${e.citySlug}-${e.isoDate}` === castEventId,
  );

  const siteUrl = import.meta.env.SITE ?? "https://garammasaladating.com";

  if (!event?.isoDate) {
    return json({ error: "Cast event not found" }, 400);
  }

  const { fsQuery } = await import("@/lib/firestoreRest");
  const invites = await fsQuery(
    "invites",
    "applicantId",
    applicationId,
    "createdAt",
  );
  const invite = invites.find(
    (item) => item.showId === castEventId && typeof item.id === "string",
  );
  if (!invite || typeof invite.id !== "string") {
    return json({ error: "No invite found for this application" }, 409);
  }

  // Link to the native Cast Portal (Green Room), matching create-invite. The
  // portal resolves the invite by id; no separate JWT is needed for the link.
  const waiverUrl = `${siteUrl}/contestant-portal?invite=${encodeURIComponent(invite.id)}`;

  const name = typeof app.name === "string" ? app.name : "there";
  const now = new Date().toISOString();
  const template = waiverNudge(name, waiverUrl);

  await sendMail({
    to: app.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  await fsPatch(`applications/${applicationId}`, { waiverNudgeSentAt: now });
  await fsAdd(`applications/${applicationId}/events`, {
    type: "waiver_nudge_sent",
    timestamp: now,
    actor: identity.email,
    payload: {},
  });

  return json({ ok: true });
};
