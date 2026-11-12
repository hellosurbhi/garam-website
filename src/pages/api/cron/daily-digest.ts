export const prerender = false;

import type { APIRoute } from "astro";
import { fsGet, fsListAll, fsPatch } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import { alertOps } from "@/lib/opsAlert";
import { readTrimmedEnv } from "@/lib/env";
import { buildDailyDigest, digestDateKey, digestHtml } from "@/lib/dailyDigest";

const DAY_MS = 24 * 60 * 60 * 1000;
const CURSOR_DOC = "systemConfig/digest";

/** Env vars the apply flow cannot work without. */
const WATCHED_ENV: Array<[string, string | undefined]> = [
  ["PUBLIC_FIREBASE_PROJECT_ID", import.meta.env.PUBLIC_FIREBASE_PROJECT_ID],
  ["FIREBASE_ADMIN_CLIENT_EMAIL", import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL],
  ["NOTIFICATION_EMAIL", import.meta.env.NOTIFICATION_EMAIL],
  ["CRON_SECRET", import.meta.env.CRON_SECRET],
];

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

/**
 * WHY: Vercel env values have shipped with a literal "\n" suffix before, which
 * .trim() cannot strip and which silently 404s requests. Checking the raw value
 * here turns that into a line in the digest instead of a mystery outage.
 */
function dirtyEnvNames(): string[] {
  return WATCHED_ENV.filter(
    ([, value]) =>
      typeof value === "string" &&
      (value.endsWith("\\n") || value !== value.trim()),
  ).map(([name]) => name);
}

const run: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) return json({ error: "Unauthorized" }, 401);

  const to = readTrimmedEnv(import.meta.env.NOTIFICATION_EMAIL);
  if (!to) throw new Error("NOTIFICATION_EMAIL is not set");

  const now = new Date();
  const dateKey = digestDateKey(now);

  // This read doubles as the service-account token mint check: a dead key
  // throws here and pages instead of silently producing an empty digest.
  const cursor = await fsGet(CURSOR_DOC);
  if (cursor?.lastDateKey === dateKey) {
    return json({ ok: true, skipped: "already sent", dateKey });
  }
  const lastSent =
    typeof cursor?.lastSentAt === "string"
      ? Date.parse(cursor.lastSentAt)
      : NaN;
  // WHY anchored to the New York date, not `now - 24h`: with no cursor yet, a
  // failed send retried later the same day would slide the window forward and
  // drop the earliest hours. The date's UTC midnight minus a day is stable for
  // every retry of that date and only ever widens the window.
  const since = new Date(
    Number.isNaN(lastSent)
      ? Date.parse(`${dateKey}T00:00:00Z`) - DAY_MS
      : lastSent,
  );

  const [leads, applications, incidents] = await Promise.all([
    fsListAll("leads"),
    fsListAll("applications"),
    fsListAll("incidents"),
  ]);

  const digest = buildDailyDigest({
    now,
    since,
    leads,
    applications,
    incidents,
    dirtyEnvNames: dirtyEnvNames(),
  });

  await sendMail({
    to,
    subject: digest.subject,
    text: digest.text,
    html: digestHtml(digest.text),
  });

  // Cursor moves only after the send succeeded, so a failed send is retried by
  // the next run with the same window instead of losing a day.
  await fsPatch(CURSOR_DOC, {
    lastSentAt: now.toISOString(),
    lastDateKey: dateKey,
  });

  return json({ ok: true, subject: digest.subject, dateKey });
};

export const GET: APIRoute = async (ctx) => {
  try {
    return await run(ctx);
  } catch (err) {
    await alertOps({
      flow: "ops",
      stage: "cron_daily_digest",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "Cron run failed" }, 500);
  }
};
