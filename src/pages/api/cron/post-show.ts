export const prerender = false;

import type { APIRoute } from "astro";
import { fsPatch, fsAdd, fsListAll } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import { postShow } from "@/data/emails";
import { verifyCronSecret } from "@/lib/cronAuth";
import { jsonResponse } from "@/lib/http";
import { toMs } from "@/utils/date";

const D3 = 3 * 24 * 60 * 60 * 1000;
const D10 = 10 * 24 * 60 * 60 * 1000;

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request))
    return jsonResponse({ error: "Unauthorized" }, 401);

  const now = Date.now();
  let sent = 0;

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
    } catch {
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
    } catch (err) {
      console.error("[post-show] Firestore write failed after send:", err);
    }
    sent++;
  }

  return jsonResponse({ ok: true, sent });
};
