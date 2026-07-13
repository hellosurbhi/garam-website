import type { APIRoute } from "astro";
import { z } from "zod";
import { sendMail } from "@/lib/zohoMailer";
import { escapeHtml, subjectSafe } from "@/data/emails";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const prerender = false;

/**
 * Real-time alert for apply-form failures.
 *
 * The apply form is the show's contestant pipeline: a broken form must email
 * the producer on the FIRST failure, not surface in a weekly analytics
 * digest. The client posts here from every failure path (submit crash,
 * notification email failure, React boundary crash) with whatever contact
 * fields the applicant had filled in, so a failed applicant can be reached
 * and recovered even though nothing was saved to Firestore.
 */
const FailureSchema = z.object({
  stage: z.enum(["submit", "notify_email", "react_boundary"]),
  errorMessage: z.string().min(1).max(2000),
  pageUrl: z.string().max(2000).default(""),
  userAgent: z.string().max(1000).default(""),
  applicant: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().max(320).optional(),
      phone: z.string().max(30).optional(),
      instagram: z.string().max(100).optional(),
    })
    .optional(),
});

type FailureReport = z.infer<typeof FailureSchema>;

const STAGE_LABELS: Record<FailureReport["stage"], string> = {
  submit: "Submission failed, application NOT saved",
  notify_email: "Application saved, but the admin email failed",
  react_boundary: "Apply page crashed (React boundary)",
};

function buildHtml(report: FailureReport): string {
  const applicant = report.applicant ?? {};
  const contactRows = (
    [
      ["Name", applicant.name],
      ["Email", applicant.email],
      ["Phone", applicant.phone],
      ["Instagram", applicant.instagram],
    ] as const
  )
    .filter(([, value]) => Boolean(value?.trim()))
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 12px;font-weight:600;white-space:nowrap;">${label}</td>
          <td style="padding:6px 12px;">${escapeHtml(value ?? "")}</td>
        </tr>`,
    )
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#DC2626;margin:0 0 8px;">Apply form failure</h2>
    <p style="margin:0 0 16px;color:#1A1A1A;font-weight:600;">${STAGE_LABELS[report.stage]}</p>
    <p style="margin:0 0 16px;padding:12px;background:#fef2f2;border-radius:8px;color:#7f1d1d;">${escapeHtml(report.errorMessage)}</p>
    ${
      contactRows
        ? `<h3 style="margin:0 0 8px;font-size:16px;">Reach the applicant</h3>
           <table style="border-collapse:collapse;">${contactRows}</table>`
        : `<p style="color:#666;">No contact fields were filled in yet.</p>`
    }
    <p style="color:#999;font-size:12px;margin:16px 0 0;">
      ${escapeHtml(report.pageUrl)}<br />
      ${escapeHtml(report.userAgent)}
    </p>
  </div>`;
}

function buildText(report: FailureReport): string {
  const applicant = report.applicant ?? {};
  const lines = [
    `Apply form failure: ${STAGE_LABELS[report.stage]}`,
    "",
    `Error: ${report.errorMessage}`,
    "",
  ];
  if (applicant.name) lines.push(`Name: ${applicant.name}`);
  if (applicant.email) lines.push(`Email: ${applicant.email}`);
  if (applicant.phone) lines.push(`Phone: ${applicant.phone}`);
  if (applicant.instagram) lines.push(`Instagram: @${applicant.instagram}`);
  lines.push("", report.pageUrl, report.userAgent);
  return lines.join("\n");
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.alertApplyFailure);
  if (limited) return limited;

  const notificationEmail = import.meta.env.NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let report: FailureReport;
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

  try {
    await sendMail({
      to: notificationEmail,
      subject: `APPLY FORM FAILURE: ${subjectSafe(STAGE_LABELS[report.stage])}`,
      text: buildText(report),
      html: buildHtml(report),
    });
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // The client fires and forgets; a failed alert send must still return
    // cleanly (PostHog trackError remains the backup channel).
    return new Response(JSON.stringify({ sent: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
