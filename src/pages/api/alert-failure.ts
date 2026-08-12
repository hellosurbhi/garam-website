import type { APIRoute } from "astro";
import { z } from "zod";
import { alertOps, type OpsAlertReport } from "@/lib/opsAlert";
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
      phone: z.string().max(30).optional(),
      instagram: z.string().max(100).optional(),
    })
    .optional(),
});

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
