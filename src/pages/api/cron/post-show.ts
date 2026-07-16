export const prerender = false;

import type { APIRoute } from "astro";
import { fsPatch, fsAdd, fsListAll } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import { postShow } from "@/data/emails";
import { alertOps } from "@/lib/opsAlert";

const D3 = 3 * 24 * 60 * 60 * 1000;
const D10 = 10 * 24 * 60 * 60 * 1000;

function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function toMs(val: unknown): number | null {
  if (typeof val !== "string") return null;
  const ms = Date.parse(val);
  return isNaN(ms) ? null : ms;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) return json({ error: "Unauthorized" }, 401);

  const now = Date.now();
  let sent = 0;
  // Per-item failures page ONCE at the end of the run, never per applicant.
  const failures: string[] = [];

  const allApps = await fsListAll("applications");

  for (const app of allApps) {
    if (app.deletedAt) continue;
    if (app.status !== "Participated") continue;
    if (app.postShowSentAt) continue;

    const participatedMs = toMs(app.participatedAt);
    if (participatedMs === null) continue;

    const age = now - participatedMs;
    if (age < D3 || age > D10) continue;

    const email = typeof app.email === "string" ? app.email : null;
    if (!email) continue;
    const name = typeof app.name === "string" ? app.name : "there";

    const template = postShow(name);
    try {
      await sendMail({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (err) {
      failures.push(
        `post-show email to ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const sentAt = new Date().toISOString();
    try {
      await fsPatch(`applications/${app.id as string}`, {
        postShowSentAt: sentAt,
      });
      await fsAdd(`applications/${app.id as string}/events`, {
        type: "post_show_sent",
        timestamp: sentAt,
        actor: "system",
        payload: {},
      });
      sent++;
    } catch (err) {
      // Email already sent; a persistence failure means a duplicate email on
      // the next run, which is worth a page rather than a silent repeat.
      failures.push(
        `post-show persistence for ${app.id as string}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (failures.length > 0) {
    await alertOps({
      flow: "ops",
      stage: "cron_post_show",
      errorMessage:
        `${failures.length} failure${failures.length === 1 ? "" : "s"} in this run:\n${failures.join("\n")}`.slice(
          0,
          2000,
        ),
    });
  }

  return json({ ok: true, sent, failures: failures.length });
};
