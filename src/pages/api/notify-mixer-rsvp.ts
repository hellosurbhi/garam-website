import type { APIRoute } from "astro";
import { z } from "zod";
import { sendMail } from "@/lib/zohoMailer";
import {
  escapeHtml,
  subjectSafe,
  mixerRsvpDetails,
  mixerRsvpMissed,
} from "@/data/emails";
import { NEXT_MIXER, isMixerUpcoming } from "@/data/mixers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isAllowedOrigin } from "@/lib/allowedOrigin";
import { isSyntheticSubmission } from "@/lib/syntheticMonitor";
import { alertOps } from "@/lib/opsAlert";
import { jsonResponse, parseJsonRequest } from "@/lib/http";

export const prerender = false;

const MixerRsvpNotifySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  source: z.enum(["cuffing-season", "singles-mixers"]),
});

const SOURCE_LABELS: Record<string, string> = {
  "cuffing-season": "Cuffing Season",
  "singles-mixers": "Singles Mixers",
};

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.notifyMixerRsvp);
  if (limited) return limited;

  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const notificationEmail = import.meta.env.NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const parsed = await parseJsonRequest(request, MixerRsvpNotifySchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Same rule as notify-application: the daily synthetic monitor's
  // submission is already written to Firestore by capture-lead before this
  // endpoint is ever called, but it must not page the producer.
  if (isSyntheticSubmission(body.email)) {
    return jsonResponse({ sent: false, synthetic: true }, 200);
  }

  const sourceLabel = SOURCE_LABELS[body.source] ?? body.source;

  try {
    await sendMail({
      to: notificationEmail,
      subject: `New mixer RSVP: ${subjectSafe(body.name)} (${sourceLabel})`,
      text: `New mixer RSVP from ${sourceLabel}\n\nName: ${body.name}\nEmail: ${body.email}`,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#DC2626;margin:0 0 16px;">New Mixer RSVP (${escapeHtml(sourceLabel)})</h2>
        <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(body.name)}</p>
        <p style="margin:0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(body.email)}" style="color:#DC2626;">${escapeHtml(body.email)}</a></p>
      </div>`,
    });

    // Guest confirmation: non-fatal if it fails, but awaited so the
    // serverless function doesn't exit before the send attempt completes.
    // The lead is already saved via /api/capture-lead regardless of outcome.
    const guestTemplate = isMixerUpcoming()
      ? mixerRsvpDetails(body.name, NEXT_MIXER)
      : mixerRsvpMissed(body.name);
    await Promise.allSettled([
      sendMail({
        to: body.email,
        replyTo: "contact@garammasaladating.com",
        ...guestTemplate,
      }),
    ]);

    return jsonResponse({ sent: true }, 200);
  } catch (err) {
    // The lead is already saved via /api/capture-lead by the time this fires;
    // a dead mailer here means a silent signup with no page, not a lost lead.
    await alertOps({
      flow: "lead",
      stage: "mixer_rsvp_email",
      errorMessage: err instanceof Error ? err.message : String(err),
      context: { name: body.name, email: body.email, source: body.source },
    });
    return jsonResponse({ error: "Failed to send notification" }, 500);
  }
};
