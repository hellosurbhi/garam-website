import type { APIRoute } from "astro";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { alertOps, type OpsAlertReport } from "@/lib/opsAlert";
import { isAllowedOrigin } from "@/lib/allowedOrigin";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { readTrimmedEnv } from "@/lib/env";
import { withTimeout } from "@/utils/withTimeout";

export const prerender = false;

/**
 * Real-time failure alert intake for every critical client flow.
 *
 * The apply form, lead capture and contestant portal are the show's revenue
 * and casting pipelines: a broken flow must email the producer on the FIRST
 * failure, not surface in a weekly analytics digest. Clients post here from
 * their failure paths with whatever contact fields the user had filled in,
 * so a failed user is reachable and recoverable even when nothing was saved.
 * The "ops" flow carries the weekly pager heartbeat and CI monitor alerts.
 */
const FailureSchema = z.object({
  flow: z.enum(["apply", "waiver", "portal", "lead", "ops"]),
  stage: z.string().min(1).max(50),
  errorMessage: z.string().min(1).max(2000),
  pageUrl: z.string().max(2000).default(""),
  userAgent: z.string().max(1000).default(""),
  contact: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().max(320).optional(),
      phone: z.string().max(50).optional(),
      instagram: z.string().max(100).optional(),
    })
    .optional(),
});

// One failure incident = one email. A user who retries a broken form five
// times (Dua, Aug 27 2026: four duplicate pages for one outage) produces one
// alert per hour per (flow, stage, identity). SET NX EX is atomic: the first
// reporter wins the key and sends; everyone else inside the window is
// suppressed. Redis down or unconfigured = fail OPEN and send: an alert
// channel must never fail closed.
const ALERT_DEDUPE_SECONDS = 3600;

async function isDuplicateAlert(
  report: z.infer<typeof FailureSchema>,
): Promise<boolean> {
  try {
    const url = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_URL);
    const token = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_TOKEN);
    if (!url || !token) return false;

    const identity = report.contact?.email || report.pageUrl || "unknown";
    const key = `alert:${report.flow}:${report.stage}:${identity}`;
    const redis = new Redis({ url, token });
    const result = await withTimeout(
      redis.set(key, "1", { nx: true, ex: ALERT_DEDUPE_SECONDS }),
      1500,
      "Upstash alert dedupe",
    );
    // Upstash returns "OK" when the key was set (first alert) and null when
    // it already existed (duplicate inside the window).
    return result === null;
  } catch (error) {
    console.error("[alert-failure] dedupe check failed, sending:", error);
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.alertFailure);
  if (limited) return limited;

  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let report: z.infer<typeof FailureSchema>;
  try {
    const raw: unknown = await request.json();
    const result = FailureSchema.safeParse(raw);
    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    report = result.data;
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (await isDuplicateAlert(report)) {
    // Logged, never mailed: the first alert of the incident already paged.
    console.log(
      `[alert-failure] suppressed duplicate alert for ${report.flow}/${report.stage}`,
    );
    return new Response(JSON.stringify({ ok: true, suppressed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const opsReport: OpsAlertReport = {
    flow: report.flow,
    stage: report.stage,
    errorMessage: report.errorMessage,
    context: {
      ...(report.contact ?? {}),
      pageUrl: report.pageUrl,
      userAgent: report.userAgent,
    },
  };

  // alertOps never throws; the client fires and forgets either way.
  await alertOps(opsReport);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
