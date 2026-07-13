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
 * plain-text body) so email is not a single point of failure. alertOps never
 * throws and never blocks the caller's response semantics.
 */
export type AlertFlow = "apply" | "waiver" | "portal" | "lead" | "ops";

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

async function pushWebhook(report: OpsAlertReport): Promise<void> {
  const url = readTrimmedEnv(import.meta.env.ALERT_WEBHOOK_URL);
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      Title: `FAILURE ${report.flow}/${report.stage}`,
      Priority: "urgent",
      Tags: "rotating_light",
    },
    body: buildAlertText(report),
  });
}

/** Page the producer. Never throws; safe to call from any catch block. */
export async function alertOps(report: OpsAlertReport): Promise<void> {
  const notificationEmail = readTrimmedEnv(import.meta.env.NOTIFICATION_EMAIL);
  await Promise.allSettled([
    notificationEmail
      ? sendMail({
          to: notificationEmail,
          subject: `FAILURE [${report.flow}/${report.stage}]`,
          text: buildAlertText(report),
          html: buildAlertHtml(report),
        })
      : Promise.resolve(),
    pushWebhook(report),
  ]);
}
