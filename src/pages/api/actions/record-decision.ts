export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminIdentity } from "@/lib/verifyToken";
import { fsGet, fsPatch, fsAdd } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import { rejection } from "@/data/emails";
import { jsonResponse as json } from "@/lib/http";

const Schema = z.object({
  applicationId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !value.includes("/"), {
      message: "Invalid applicationId",
    }),
  decision: z.enum(["approve", "reject", "unsure"]),
  note: z.string().max(2000).optional(),
});

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

  const { applicationId, decision, note } = parsed.data;
  const now = new Date().toISOString();

  const app = await fsGet(`applications/${applicationId}`);
  if (!app) return json({ error: "Application not found" }, 404);

  const patch: Record<string, unknown> = {
    decision,
    decidedAt: now,
    interviewedAt: now,
  };

  if (decision === "reject") {
    patch.status = "Rejected";
  }

  await fsPatch(`applications/${applicationId}`, patch);

  await fsAdd(`applications/${applicationId}/events`, {
    type: "decision_recorded",
    timestamp: now,
    actor: identity.email,
    payload: { decision, ...(note ? { note } : {}) },
  });

  if (note) {
    await fsAdd(`applications/${applicationId}/events`, {
      type: "interview_note",
      timestamp: now,
      actor: identity.email,
      payload: { note },
    });
  }

  if (decision === "reject" && typeof app.email === "string" && app.email) {
    const name = typeof app.name === "string" ? app.name : "there";
    const template = rejection(name);
    let emailSent = false;
    try {
      await sendMail({
        to: app.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      emailSent = true;
    } catch (e) {
      console.error("Rejection email failed", e);
    }

    if (emailSent) {
      await fsPatch(`applications/${applicationId}`, { rejectionSentAt: now });
      await fsAdd(`applications/${applicationId}/events`, {
        type: "rejection_sent",
        timestamp: now,
        actor: "system",
        payload: {},
      });
    }
  }

  return json({ ok: true });
};
