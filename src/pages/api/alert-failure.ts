import { createHash } from "node:crypto";
import type { APIRoute } from "astro";
import { z } from "zod";
import { alertOps, type OpsAlertReport } from "@/lib/opsAlert";
import { claimAlertKey } from "@/lib/alertDedupe";
import { isAllowedOrigin } from "@/lib/allowedOrigin";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const prerender = false;

/**
 * Real-time failure alert intake for every critical client flow.
 *
 * The apply form, lead capture and contestant portal are the show's revenue
 * and casting pipelines: a broken flow must email the producer on the FIRST
 * failure, not surface in a weekly analytics digest. Clients post here from
 * their failure paths with whatever contact fields the user had filled in,
 * so a failed user is reachable and recoverable even when nothing was saved.
 * The "ops" flow carries cron failures and other server-side alerts.
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
  /**
   * Plain facts about the failure: failing field, every field's length, photo
   * count and sizes, what was saved anyway, HTTP status. Rendered under
   * "WHAT WE KNOW" in the alert.
   */
  details: z
    .record(z.string().max(60), z.string().max(500))
    .refine((d) => Object.keys(d).length <= 40, "too many detail entries")
    .optional(),
});

// A user who retries a broken form five times (Dua, Aug 27 2026: four
// duplicate pages for one outage) produces one alert per hour per
// (flow, stage, reason, identity); the claim itself lives in alertDedupe.
function alertKey(report: z.infer<typeof FailureSchema>): string {
  const identity = report.contact?.email || report.pageUrl || "unknown";
  // WHY a digest, not the raw identity: the identity is applicant PII (email
  // or page URL) and must not sit in Redis key metadata. A plain SHA-256 is
  // enough because the key only needs deterministic per-incident uniqueness
  // for dedupe in a private store; a server-keyed HMAC would add a secret to
  // rotate for no additional protection here.
  const digest = createHash("sha256").update(identity).digest("hex");
  // WHY the reason hash: keyed on stage alone, a second DIFFERENT failure for
  // the same person (say a photo timeout after a save error) collapsed into the
  // first email and its distinct cause was never reported.
  const reason = createHash("sha256")
    .update(report.errorMessage)
    .digest("hex")
    .slice(0, 12);
  return `alert:${report.flow}:${report.stage}:${reason}:${digest}`;
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

  const claim = await claimAlertKey(alertKey(report));
  if (claim.duplicate) {
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
    context: report.contact ?? {},
    details: report.details,
    footer: { pageUrl: report.pageUrl, userAgent: report.userAgent },
  };

  // alertOps never throws; the client fires and forgets either way.
  const delivered = await alertOps(opsReport);
  if (!delivered) {
    console.error(
      `[alert-failure] delivery failed on every channel for ${report.flow}/${report.stage}; releasing dedupe claim`,
    );
    await claim.release();
  }
  // WHY: a 200 here used to mean "received", even when every channel failed, so
  // a caller could not tell a delivered page from a lost one. 502 reports the
  // truth; the browser still fires and forgets and ignores the status.
  return new Response(JSON.stringify({ ok: delivered }), {
    status: delivered ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
};
