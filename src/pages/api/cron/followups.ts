export const prerender = false;

import type { APIRoute } from "astro";
import { fsGet, fsPatch, fsAdd, fsListAll, fsQuery } from "@/lib/firestoreRest";
import { sendMail } from "@/lib/zohoMailer";
import {
  schedulingFollowup,
  waiverNudge,
  hostBriefing,
  type InterviewSummary,
} from "@/data/emails";

const SKIP_FOLLOWUP_STATUSES = new Set([
  "Rejected",
  "Not Interested",
  "Not Interested Anymore",
  "Said Not Now",
  "Bailed",
  "Cast",
  "Participated",
  "No Response",
]);

const H48 = 48 * 60 * 60 * 1000;
const D7 = 7 * 24 * 60 * 60 * 1000;
const H24 = 24 * 60 * 60 * 1000;
// Hard cap per section to bound cron execution time within Vercel's function limit.
const MAX_PER_RUN = 50;

function verifyCronSecret(request: Request): boolean {
  const cronSecret = import.meta.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function toMs(val: unknown): number | null {
  if (typeof val !== "string") return null;
  const ms = Date.parse(val);
  return isNaN(ms) ? null : ms;
}

function todayNYC(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) return json({ error: "Unauthorized" }, 401);

  const now = Date.now();
  const results = {
    schedulingFollowups: 0,
    waiverNudges: 0,
    autoDecayed: 0,
    briefingSent: false,
    briefingSkipped: false,
  };

  const allApps = await fsListAll("applications");
  const calUrl =
    import.meta.env.CAL_INTERVIEW_URL ??
    "https://cal.com/garammasala/interview";
  const siteUrl = import.meta.env.SITE ?? "https://garammasaladating.com";

  // ── 1. Scheduling follow-up nudge ────────────────────────────────────────────
  for (const app of allApps) {
    if (results.schedulingFollowups >= MAX_PER_RUN) break;
    if (app.deletedAt) continue;
    const contactedMs = toMs(app.contactedAt);
    if (contactedMs === null) continue;
    if (app.scheduledAt || app.followupSentAt) continue;
    if (SKIP_FOLLOWUP_STATUSES.has(app.status as string)) continue;
    if (now - contactedMs < H48) continue;

    const email = typeof app.email === "string" ? app.email : null;
    if (!email) continue;
    const name = typeof app.name === "string" ? app.name : "there";

    const template = schedulingFollowup(name, calUrl);
    try {
      await sendMail({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch {
      continue;
    }

    const sentAt = new Date().toISOString();
    try {
      await fsPatch(`applications/${app.id as string}`, {
        followupSentAt: sentAt,
      });
      await fsAdd(`applications/${app.id as string}/events`, {
        type: "followup_sent",
        timestamp: sentAt,
        actor: "system",
        payload: {},
      });
      results.schedulingFollowups++;
    } catch {
      // Email already sent; persistence failure logged for manual follow-up.
    }
  }

  // ── 2. Waiver nudge ───────────────────────────────────────────────────────────
  for (const app of allApps) {
    if (results.waiverNudges >= MAX_PER_RUN) break;
    if (app.deletedAt) continue;
    const invitedMs = toMs(app.invitedAt);
    if (invitedMs === null) continue;
    if (app.waiverSignedAt || app.waiverNudgeSentAt) continue;
    if (app.status !== "Cast") continue;
    if (now - invitedMs < H48) continue;

    const email = typeof app.email === "string" ? app.email : null;
    if (!email) continue;
    const name = typeof app.name === "string" ? app.name : "there";
    const castEventId =
      typeof app.castEventId === "string" ? app.castEventId : null;

    // Nudge points at the native Cast Portal (Green Room). We resolve the
    // applicant's latest invite and link to /contestant-portal?invite=<id>,
    // matching the link create-invite emails. Fall back to the portal root if
    // no invite is found so the contestant still lands in the right place.
    let waiverUrl = `${siteUrl}/contestant-portal`;

    if (castEventId) {
      const invites = await fsQuery(
        "invites",
        "applicantId",
        app.id as string,
        "createdAt",
      );
      const latestInvite = invites[0];
      if (latestInvite && typeof latestInvite.id === "string") {
        waiverUrl = `${siteUrl}/contestant-portal?invite=${encodeURIComponent(latestInvite.id)}`;
      }
    }

    const template = waiverNudge(name, waiverUrl);
    try {
      await sendMail({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch {
      continue;
    }

    const sentAt = new Date().toISOString();
    try {
      await fsPatch(`applications/${app.id as string}`, {
        waiverNudgeSentAt: sentAt,
      });
      await fsAdd(`applications/${app.id as string}/events`, {
        type: "waiver_nudge_sent",
        timestamp: sentAt,
        actor: "system",
        payload: {},
      });
      results.waiverNudges++;
    } catch {
      // Email already sent; persistence failure logged for manual follow-up.
    }
  }

  // ── 3. Auto-decay ────────────────────────────────────────────────────────────
  for (const app of allApps) {
    if (results.autoDecayed >= MAX_PER_RUN) break;
    if (app.deletedAt) continue;
    const followupMs = toMs(app.followupSentAt);
    if (followupMs === null) continue;
    if (app.scheduledAt) continue;
    if (app.status === "No Response") continue;
    if (now - followupMs < D7) continue;

    const decayedAt = new Date().toISOString();
    try {
      await fsPatch(`applications/${app.id as string}`, {
        status: "No Response",
      });
      await fsAdd(`applications/${app.id as string}/events`, {
        type: "status_auto_decayed",
        timestamp: decayedAt,
        actor: "system",
        payload: {},
      });
      results.autoDecayed++;
    } catch {
      // Persistence failure; will retry on next cron run.
    }
  }

  // ── 4. Host briefing ─────────────────────────────────────────────────────────
  const cronDoc = await fsGet("systemConfig/cron");
  const lastBriefingDate =
    typeof cronDoc?.lastBriefingDate === "string"
      ? cronDoc.lastBriefingDate
      : null;
  const today = todayNYC();

  if (lastBriefingDate === today) {
    results.briefingSkipped = true;
  } else {
    const next24hEnd = now + H24;
    const upcomingApps = allApps.filter((app) => {
      if (app.deletedAt || !app.scheduledAt) return false;
      const schedMs = toMs(app.scheduledAt);
      return schedMs !== null && schedMs >= now && schedMs <= next24hEnd;
    });

    if (upcomingApps.length > 0) {
      const interviews: InterviewSummary[] = upcomingApps.map((app) => {
        const schedMs = toMs(app.scheduledAt) ?? now;
        const interviewTime = new Date(schedMs).toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        });
        const pitch = typeof app.pitch === "string" ? app.pitch : "";
        const pitchSnippet = pitch
          .split("\n")
          .slice(0, 2)
          .join(" ")
          .slice(0, 120);
        return {
          name: typeof app.name === "string" ? app.name : "Unknown",
          city: typeof app.city === "string" ? app.city : "",
          interviewTime,
          calUrl:
            typeof app.calBookingUrl === "string" ? app.calBookingUrl : calUrl,
          pitchSnippet,
        };
      });

      interviews.sort((a, b) => a.interviewTime.localeCompare(b.interviewTime));

      const template = hostBriefing(interviews);
      const hostEmailsRaw = import.meta.env.HOST_BRIEFING_EMAILS ?? "";
      const hostEmails = hostEmailsRaw
        .split(",")
        .map((e: string) => e.trim())
        .filter(Boolean);

      for (const hostEmail of hostEmails) {
        try {
          await sendMail({
            to: hostEmail,
            subject: template.subject,
            text: template.text,
            html: template.html,
          });
        } catch {
          // log but don't block saving lastBriefingDate
        }
      }
    }

    await fsPatch("systemConfig/cron", { lastBriefingDate: today });
    results.briefingSent = upcomingApps.length > 0;
  }

  return json({ ok: true, ...results });
};
