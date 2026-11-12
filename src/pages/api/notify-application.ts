import type { APIRoute } from "astro";
import { z } from "zod";
import { sendMail } from "@/lib/zohoMailer";
import { applicationReceived } from "@/data/emails";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isAllowedOrigin } from "@/lib/allowedOrigin";
import { alertOps } from "@/lib/opsAlert";

export const prerender = false;

/**
 * LEGACY endpoint for stale browser tabs only.
 *
 * Before the autosave rewrite the apply page wrote the application straight to
 * Firestore and then called this route to email the applicant a receipt (and
 * the producer a per-application notice). The current page files everything
 * through /api/save-application, which sends the receipt itself on finalize.
 * A tab loaded before the deploy still runs the old script, so this route keeps
 * accepting its payload and sends ONLY the applicant receipt. The per-
 * application producer email is gone on purpose: new applications reach the
 * producer in the daily digest, and an email means something is broken.
 *
 * WHY only the three fields the receipt needs: the old schema rejected under-18
 * and over-limit payloads with a 400, which silently dropped the receipt for a
 * real applicant. Nothing here may reject on content.
 */
const ReceiptSchema = z.object({
  name: z.string().min(1),
  city: z.string().default(""),
  email: z.string().min(1),
});

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(
    request,
    RATE_LIMITS.notifyApplication,
  );
  if (limited) return limited;

  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: z.infer<typeof ReceiptSchema>;
  try {
    const result = ReceiptSchema.safeParse(await request.json());
    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    body = result.data;
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await sendMail({
      to: body.email,
      ...applicationReceived(body.name, body.city),
    });
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // The application is saved; only the applicant's receipt failed.
    await alertOps({
      flow: "apply",
      stage: "welcome_email_legacy",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: { name: body.name, email: body.email },
    });
    return new Response(JSON.stringify({ error: "Failed to send receipt" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
