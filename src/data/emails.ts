import applicantWelcomeCopy from "./email-copy/applicant-welcome.json";
import schedulingInviteCopy from "./email-copy/scheduling-invite.json";
import schedulingFollowupCopy from "./email-copy/scheduling-followup.json";
import inviteApprovalCopy from "./email-copy/invite-approval.json";
import waiverNudgeCopy from "./email-copy/waiver-nudge.json";
import waiverReceiptWithTextCopy from "./email-copy/waiver-receipt-with-text.json";
import waiverReceiptCopy from "./email-copy/waiver-receipt.json";
import rejectionCopy from "./email-copy/rejection.json";
import hostBriefingCopy from "./email-copy/host-briefing.json";
import postShowCopy from "./email-copy/post-show.json";
import newShowAnnouncementCopy from "./email-copy/new-show-announcement.json";

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface InterviewSummary {
  name: string;
  city: string;
  interviewTime: string;
  calUrl: string;
  pitchSnippet: string;
}

function wrap(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A;line-height:1.6;">${body}</div>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

function link(url: string, label: string): string {
  // Scheme allowlist: only http(s) URLs may become hyperlinks. Anything else
  // (javascript:, data:, malformed) renders as escaped plain text so a poisoned
  // URL can never become a clickable payload in an email client.
  // label is caller-controlled: callers must pass already-escaped text or static strings.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return escapeHtml(url);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return escapeHtml(url);
  }
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" style="color:#DC2626;">${label}</a>`;
}

// Shared escaper for every HTML email surface in the app. Import this instead of
// writing a local copy: the duplicate that lived in notify-application.ts had
// drifted (it did not escape single quotes).
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Email subjects are headers: CR/LF in an interpolated value is a header-injection
// vector if the mailer does not reject it. Strip control characters defensively.
export function subjectSafe(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f\x7f]+/g, " ").trim();
}

// Fills {{token}} placeholders in a copy template with the given values, in a
// single pass over the ORIGINAL template string. Chained .replaceAll() calls
// would re-scan already-substituted text on every subsequent call, so a
// dynamic value that happens to contain a later token's literal text (e.g. an
// applicant's name, or the freeform signed waiver text) could get silently
// rewritten by the next substitution. A single regex pass never re-scans its
// own replacement output, so this can't happen.
function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

export function schedulingInvite(name: string, calUrl: string): EmailTemplate {
  const firstName = name.split(" ")[0];
  const copy = schedulingInviteCopy;

  const subject = fillTemplate(copy.subject, {
    firstName: subjectSafe(firstName),
  });
  const text = fillTemplate(copy.text, { name, calUrl });
  const html = fillTemplate(copy.html, {
    name: escapeHtml(name),
    calUrl: link(calUrl, escapeHtml(calUrl)),
  });

  return { subject, text, html };
}

export function schedulingFollowup(
  name: string,
  calUrl: string,
): EmailTemplate {
  const firstName = name.split(" ")[0];
  const copy = schedulingFollowupCopy;

  const subject = fillTemplate(copy.subject, {
    firstName: subjectSafe(firstName),
  });
  const text = fillTemplate(copy.text, { name, calUrl });
  const html = fillTemplate(copy.html, {
    name: escapeHtml(name),
    calUrl: link(calUrl, escapeHtml(calUrl)),
  });

  return { subject, text, html };
}

export function inviteApproval(
  name: string,
  opts: { portalUrl?: string; showDate?: string; showCity?: string } = {},
): EmailTemplate {
  const copy = inviteApprovalCopy;
  const subject = copy.subject;

  const hasShowDetails = Boolean(opts.showDate && opts.showCity);
  const showLineTemplate = hasShowDetails
    ? copy.showLineVariants.withDetails
    : copy.showLineVariants.fallback;
  const showLineText = hasShowDetails
    ? fillTemplate(showLineTemplate, {
        showDate: opts.showDate!,
        showCity: opts.showCity!,
      })
    : showLineTemplate;
  const showLineHtml = hasShowDetails
    ? fillTemplate(showLineTemplate, {
        showDate: escapeHtml(opts.showDate!),
        showCity: escapeHtml(opts.showCity!),
      })
    : showLineTemplate;

  const portalLineTemplate = opts.portalUrl
    ? copy.portalLineVariants.withPortal
    : copy.portalLineVariants.fallback;
  const portalLineText = opts.portalUrl
    ? fillTemplate(portalLineTemplate, { portalUrl: opts.portalUrl })
    : portalLineTemplate;
  const portalLineHtml = opts.portalUrl
    ? fillTemplate(portalLineTemplate, {
        portalUrl: link(opts.portalUrl, copy.portalLinkLabel),
      })
    : portalLineTemplate;

  const text = fillTemplate(copy.text, {
    name,
    showLine: showLineText,
    portalLine: portalLineText,
  });

  const html = fillTemplate(copy.html, {
    name: escapeHtml(name),
    showLine: showLineHtml,
    portalLine: portalLineHtml,
  });

  return { subject, text, html };
}

export function waiverNudge(name: string, portalUrl: string): EmailTemplate {
  const firstName = name.split(" ")[0];
  const copy = waiverNudgeCopy;

  const subject = fillTemplate(copy.subject, {
    firstName: subjectSafe(firstName),
  });
  const text = fillTemplate(copy.text, { name, portalUrl });
  const html = fillTemplate(copy.html, {
    name: escapeHtml(name),
    portalUrl: link(portalUrl, copy.linkLabel),
  });

  return { subject, text, html };
}

export function waiverReceiptWithText(opts: {
  firstName: string;
  signature: string;
  signedAtIso: string;
  waiverText: string;
}): EmailTemplate {
  const copy = waiverReceiptWithTextCopy;
  const subject = copy.subject;

  const text = fillTemplate(copy.text, {
    firstName: opts.firstName,
    signature: opts.signature,
    signedAtIso: opts.signedAtIso,
    waiverText: opts.waiverText,
  });
  const html = fillTemplate(copy.html, {
    firstName: escapeHtml(opts.firstName),
    signature: escapeHtml(opts.signature),
    signedAtIso: escapeHtml(opts.signedAtIso),
    waiverText: escapeHtml(opts.waiverText),
  });

  return { subject, text, html };
}

export function waiverReceipt(name: string): EmailTemplate {
  const copy = waiverReceiptCopy;
  const subject = copy.subject;
  const text = fillTemplate(copy.text, { name });
  const html = fillTemplate(copy.html, { name: escapeHtml(name) });

  return { subject, text, html };
}

export function rejection(name: string): EmailTemplate {
  const copy = rejectionCopy;
  const subject = copy.subject;
  const text = fillTemplate(copy.text, { name });
  const html = fillTemplate(copy.html, { name: escapeHtml(name) });

  return { subject, text, html };
}

export function hostBriefing(interviews: InterviewSummary[]): EmailTemplate {
  const copy = hostBriefingCopy;
  const count = interviews.length;
  const plural = count === 1 ? "" : "s";
  const subject = fillTemplate(copy.subject, { count: String(count) });
  const summaryLine = fillTemplate(copy.summaryLine, {
    count: String(count),
    plural,
  });

  const rows = interviews
    .map(
      (i) =>
        `${i.name} (${i.city}) at ${i.interviewTime} | ${i.calUrl}\n  "${i.pitchSnippet}"`,
    )
    .join("\n\n");

  const text = [summaryLine, "", rows, "", copy.closingLine].join("\n");

  const tableRows = interviews
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(i.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.city)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.interviewTime)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${link(i.calUrl, copy.viewBookingLabel)}</td>
    </tr>
    <tr>
      <td colspan="4" style="padding:4px 12px 12px;border-bottom:2px solid #f0f0f0;color:#555;font-size:14px;">"${escapeHtml(i.pitchSnippet)}"</td>
    </tr>`,
    )
    .join("");

  const html = wrap(
    p(summaryLine) +
      `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${tableRows}</table>` +
      p(copy.closingLine),
  );

  return { subject, text, html };
}

export function postShow(name: string): EmailTemplate {
  const copy = postShowCopy;
  const subject = copy.subject;
  const text = fillTemplate(copy.text, { name });
  const html = fillTemplate(copy.html, { name: escapeHtml(name) });

  return { subject, text, html };
}

export function applicationReceived(name: string): EmailTemplate {
  const firstName = name.split(" ")[0];
  const copy = applicantWelcomeCopy;

  const subject = fillTemplate(copy.subject, {
    firstName: subjectSafe(firstName),
  });
  const text = fillTemplate(copy.text, { firstName });
  const html = fillTemplate(copy.html, { firstName: escapeHtml(firstName) });

  return { subject, text, html };
}

export function newShowAnnouncement(opts: {
  subject: string;
  city: string;
  date: string;
  venue: string;
  ticketUrl: string;
  customMessage?: string;
}): EmailTemplate {
  const { city, date, venue, ticketUrl, customMessage } = opts;
  const copy = newShowAnnouncementCopy;
  const subject = subjectSafe(opts.subject);

  const message =
    customMessage ?? fillTemplate(copy.fallbackMessage, { city, date, venue });
  const safeMessage = customMessage
    ? escapeHtml(customMessage)
    : fillTemplate(copy.fallbackMessage, {
        city: escapeHtml(city),
        date: escapeHtml(date),
        venue: escapeHtml(venue),
      });

  const text = fillTemplate(copy.text, { message, ticketUrl });
  const html = fillTemplate(copy.html, {
    message: safeMessage,
    ticketUrl: link(ticketUrl, copy.ticketLinkLabel),
  });

  return { subject, text, html };
}
