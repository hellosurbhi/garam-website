import { sendMail } from "@/lib/zohoMailer";
import { escapeHtml } from "@/data/emails";
import { readTrimmedEnv } from "@/lib/env";

/**
 * Server-side real-time paging for critical failures.
 *
 * Any money-path breakage (a lost lead, a failed waiver write, a dropped
 * cal.com booking, an admin email that never sent) must page the producer
 * the moment it happens; server logs and weekly analytics digests both
 * proved too slow during the July 2026 apply outage.
 *
 * Channels: email to NOTIFICATION_EMAIL (primary) and, when
 * ALERT_WEBHOOK_URL is set, an ntfy-style push POST (Title/Priority headers,
 * plain-text body) so email is not a single point of failure. The push body is
 * treated as public: no context entries, and email addresses inside the error
 * message are redacted. alertOps never throws and never blocks the caller's
 * response semantics.
 */
export type AlertFlow = "apply" | "waiver" | "portal" | "lead" | "ops";

/** Bound on the error text sent over either channel. */
const MAX_ERROR_CHARS = 2000;

export interface OpsAlertReport {
  flow: AlertFlow;
  /** Where in the flow it failed, e.g. "submit", "firestore_write", "receipt_email". */
  stage: string;
  errorMessage: string;
  /** Whatever helps recovery: contact fields, doc ids, page URL, user agent. */
  context?: Record<string, string | undefined>;
}

function contextEntries(report: OpsAlertReport): [string, string][] {
  return Object.entries(report.context ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]?.trim()),
  );
}

export function buildAlertText(report: OpsAlertReport): string {
  const lines = [
    `Failure in ${report.flow}/${report.stage}`,
    "",
    report.errorMessage,
    "",
    ...contextEntries(report).map(([key, value]) => `${key}: ${value}`),
  ];
  return lines.join("\n");
}

function buildAlertHtml(report: OpsAlertReport): string {
  const rows = contextEntries(report)
    .map(
      ([key, value]) =>
        `<tr>
          <td style="padding:6px 12px;font-weight:600;white-space:nowrap;">${escapeHtml(key)}</td>
          <td style="padding:6px 12px;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#DC2626;margin:0 0 8px;">Failure: ${escapeHtml(report.flow)}/${escapeHtml(report.stage)}</h2>
    <p style="margin:0 0 16px;padding:12px;background:#fef2f2;border-radius:8px;color:#7f1d1d;">${escapeHtml(report.errorMessage)}</p>
    ${rows ? `<table style="border-collapse:collapse;">${rows}</table>` : ""}
  </div>`;
}

// An ntfy topic URL is a bearer secret at best: anyone who learns it can
// subscribe, so the webhook body is treated as public. Error messages are free
// text and routinely name the person the operation was for, e.g. the cron
// summaries in src/pages/api/cron/*.ts read "post-show email to
// priya@example.com: SMTP 535". Addresses are stripped at this sink rather
// than at each caller so no future caller can reintroduce the leak; the
// unredacted message still reaches the producer through the email path.
//
// WHY this pattern mirrors src/utils/validateEmail.ts instead of matching a
// conventional address shape: the redactor has to cover every address the app
// LETS IN, not every address that is well formed. The apply form and the
// capture-lead API accept `[^\s@]+@[^\s@]+\.[^\s@]+` (native validation is off,
// and Firestore rules only bound the length), so `priya!@example.com` reaches a
// cron failure summary; a local part restricted to `[\w.+-]` never matched it
// and the full address went out over the public topic. Keep the two patterns in
// step: loosening the validator without loosening this one reopens the leak.
// The cost is deliberate over-redaction of non-address text shaped like one
// (a versioned package spec such as `pkg@1.2.3`), which is the safe direction:
// the unredacted text is one click away on the alert email.
//
// The domain half splits the dot out of the character class
// (`[^\s@.]+(?:\.[^\s@.]+)+` rather than `[^\s@]+\.[^\s@]+`) so the two parts
// cannot match the same characters. An ambiguous pair backtracks quadratically
// on a long run that never matches, and this runs on caught-exception text.
const EMAIL_ADDRESS = /[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+/g;

export function redactEmails(text: string): string {
  return text.replace(EMAIL_ADDRESS, "[email redacted]");
}

/**
 * Ceiling on the text handed to the redactor. Generous multiple of the output
 * bound so nothing that could survive to the body is dropped first, but finite:
 * `errorMessage` is whatever a caught exception carried, so it is not otherwise
 * bounded before this point.
 */
const MAX_REDACTION_INPUT_CHARS = MAX_ERROR_CHARS * 4;

function boundRedactionInput(text: string): string {
  if (text.length <= MAX_REDACTION_INPUT_CHARS) return text;
  // Drop the token the cut landed inside. Half an address no longer matches
  // EMAIL_ADDRESS, and publishing "priya@exam" still names the applicant.
  return text.slice(0, MAX_REDACTION_INPUT_CHARS).replace(/\S+$/, "");
}

/**
 * Webhook body for `report`, redacted then bounded (never the reverse: a cut
 * that lands inside an address, which the 2000-char cron summaries make a real
 * case, would otherwise leave a half address the pattern no longer matches).
 */
export function buildWebhookBody(report: OpsAlertReport): string {
  const message = redactEmails(boundRedactionInput(report.errorMessage)).slice(
    0,
    MAX_ERROR_CHARS,
  );
  return `Failure in ${report.flow}/${report.stage}\n\n${message}\n\nDetails in the alert email.`;
}

async function pushWebhook(report: OpsAlertReport): Promise<void> {
  const url = readTrimmedEnv(import.meta.env.ALERT_WEBHOOK_URL);
  if (!url) return;
  // WHY: the webhook body carries flow/stage plus a redacted error only, never
  // the context entries. Context can hold applicant PII (name, email, phone);
  // the full context still reaches the producer through the email path. The 5s
  // deadline keeps a stalled webhook host from delaying every failure response
  // that awaits alertOps.
  await fetch(url, {
    method: "POST",
    headers: {
      Title: `FAILURE ${report.flow}/${report.stage}`,
      Priority: "urgent",
      Tags: "rotating_light",
    },
    body: buildWebhookBody(report),
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Page the producer. Never throws; safe to call from any catch block.
 *
 * Returns whether at least one CONFIGURED channel actually delivered, so
 * callers holding a dedupe claim (alert-failure.ts) can release it when the
 * page never went out. An unconfigured channel never counts as delivered.
 */
export async function alertOps(rawReport: OpsAlertReport): Promise<boolean> {
  // Central bound: callers used to slice(0, 2000) by hand, inconsistently.
  const report: OpsAlertReport = {
    ...rawReport,
    errorMessage: rawReport.errorMessage.slice(0, MAX_ERROR_CHARS),
  };
  const notificationEmail = readTrimmedEnv(import.meta.env.NOTIFICATION_EMAIL);
  const webhookConfigured = Boolean(
    readTrimmedEnv(import.meta.env.ALERT_WEBHOOK_URL),
  );
  const [mailResult, webhookResult] = await Promise.allSettled([
    notificationEmail
      ? sendMail({
          to: notificationEmail,
          subject: `FAILURE [${report.flow}/${report.stage}]`,
          text: buildAlertText(report),
          html: buildAlertHtml(report),
        })
      : Promise.resolve(),
    // The raw message, not the bounded one: buildWebhookBody redacts before it
    // truncates.
    pushWebhook(rawReport),
  ]);
  return (
    (Boolean(notificationEmail) && mailResult.status === "fulfilled") ||
    (webhookConfigured && webhookResult.status === "fulfilled")
  );
}
