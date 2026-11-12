/**
 * Pure builder for the one daily email. Takes plain Firestore rows and returns
 * the subject, text and warnings. No I/O here so every rule is unit-testable.
 *
 * Rule of the inbox: good news lives in this digest, an instant email means
 * something is broken. A digest that does not arrive means the mailer is down.
 */

import { escapeHtml } from "@/data/emails";

export type Row = Record<string, unknown>;

export interface DigestInput {
  now: Date;
  /** Start of the reporting window (the previous digest, or 24h ago). */
  since: Date;
  leads: Row[];
  applications: Row[];
  incidents: Row[];
  /** Env var names whose value ends in a literal backslash-n or whitespace. */
  dirtyEnvNames: string[];
}

export interface DigestResult {
  subject: string;
  text: string;
  /** Tripwire lines; non-empty means the subject carries a WARNING. */
  warnings: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ms(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function inWindow(value: unknown, from: number, to: number): boolean {
  const t = ms(value);
  return t !== null && t >= from && t < to;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function contactOf(row: Row): string {
  const parts = [str(row.email), str(row.phone), str(row.instagram)].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(", ") : "no contact left";
}

function isLive(row: Row): boolean {
  return !row.deletedAt && row.isSynthetic !== true;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Stage of the weekly monitor notification test (scripts/synthetic/report.mjs). */
const DRILL_STAGE = "monitor_heartbeat";

/** Applications are "finished" once status moved past Draft. */
function isFinished(row: Row): boolean {
  return str(row.status) !== "Draft";
}

/** When an application was filed; rows from before finalizedAt existed fall back to when they started. */
function finishedAt(row: Row): unknown {
  return row.finalizedAt ?? row.submittedAt;
}

export function buildDailyDigest(input: DigestInput): DigestResult {
  const from = input.since.getTime();
  const to = input.now.getTime();

  const leads = input.leads.filter(
    (r) => isLive(r) && inWindow(r.createdAt, from, to),
  );
  const live = input.applications.filter(isLive);
  // WHY finished is picked by when it was finished, not started: someone who
  // starts at 11pm and finishes at 8am must show up as finished in the digest
  // covering 8am, or the producer never hears about the application.
  const finished = live.filter(
    (r) => isFinished(r) && inWindow(finishedAt(r), from, to),
  );
  const unfinished = live.filter(
    (r) => !isFinished(r) && inWindow(r.submittedAt, from, to),
  );
  const apps = [...finished, ...unfinished];
  // WHY the drill is excluded: the weekly monitor test posts a labelled alert
  // through the real alert path to prove delivery works. Counting it would flip
  // every Monday digest to ATTENTION over a failure that never happened.
  const problems = input.incidents.filter(
    (r) => inWindow(r.createdAt, from, to) && str(r.stage) !== DRILL_STAGE,
  );
  const legacyWrites = apps.filter(
    (r) => typeof r.clientVersion !== "number",
  ).length;
  const finishedNoPhotos = finished.filter(
    (r) => !Array.isArray(r.photoPaths) || r.photoPaths.length === 0,
  );
  const underEighteen = apps.filter((r) => r.ageUnder18 === true);

  // Tripwires compare against the trailing 7 days of the same source so a
  // silent break (analytics blocked, form dead) shows up even with no alert.
  const warnings: string[] = [];
  const weekFrom = to - 7 * DAY_MS;
  const weekApps = input.applications.filter(
    (r) => isLive(r) && inWindow(r.submittedAt, weekFrom, from),
  );
  const weekDays = Math.max(1, (from - weekFrom) / DAY_MS);
  const dailyDrafts = weekApps.length / weekDays;
  const dailyFinished =
    live.filter((r) => isFinished(r) && inWindow(finishedAt(r), weekFrom, from))
      .length / weekDays;
  const windowDays = Math.max(0.25, (to - from) / DAY_MS);

  // WHY the 4 and 3 a day floors: at 1 to 2 a day a quiet day is ordinary luck
  // (about a one in three chance of zero at 1 a day), and a tripwire that cries
  // wolf trains the owner to ignore it. At 3+ finished or 4+ started a day a
  // zero is under about 5% by chance, so a warning there means something broke.
  // WHY started is counted by start time on its own: `apps` also holds
  // applications started earlier and finished today, which would hide a dead
  // form behind yesterday's drafts.
  const started = live.filter((r) => inWindow(r.submittedAt, from, to)).length;
  if (dailyDrafts >= 4 && started / windowDays < dailyDrafts * 0.25) {
    warnings.push(
      `Applications started dropped to ${started} (trailing 7 day average is ${dailyDrafts.toFixed(1)} a day). The form may be failing silently.`,
    );
  }
  if (dailyFinished >= 3 && finished.length === 0) {
    warnings.push(
      `Zero applications were finished (trailing 7 day average is ${dailyFinished.toFixed(1)} a day). Check the submit step.`,
    );
  }
  if (finishedNoPhotos.length > 0) {
    warnings.push(
      `${plural(finishedNoPhotos.length, "finished application")} arrived with no photos: ${finishedNoPhotos.map((r) => str(r.name) || "unnamed").join(", ")}.`,
    );
  }
  if (input.dirtyEnvNames.length > 0) {
    warnings.push(
      `These environment variables end in a stray newline or space and will break requests: ${input.dirtyEnvNames.join(", ")}.`,
    );
  }
  if (problems.length > 0) {
    warnings.push(
      `${plural(problems.length, "failure alert")} fired in this window (listed below).`,
    );
  }

  const unfinishedLabel =
    unfinished.length > 0 ? ` (${unfinished.length} unfinished)` : "";
  const subject = `${warnings.length > 0 ? "ATTENTION " : ""}Garam daily: ${plural(leads.length, "signup")}, ${plural(apps.length, "application")}${unfinishedLabel}, ${plural(problems.length, "problem")}`;

  const lines: string[] = [];
  if (warnings.length > 0) {
    lines.push("WHAT NEEDS ATTENTION", ...warnings.map((w) => `- ${w}`), "");
  }

  lines.push(
    `APPLICATIONS (${apps.length})`,
    ...(apps.length === 0
      ? ["None in this window."]
      : apps.map(
          (r) =>
            `- ${str(r.name) || "unnamed"} | ${isFinished(r) ? "finished" : "UNFINISHED"} | ${contactOf(r)}${r.ageUnder18 === true ? " | UNDER 18" : ""}`,
        )),
    "",
    `SIGNUPS (${leads.length})`,
    ...(leads.length === 0
      ? ["None in this window."]
      : leads.map((r) => `- ${contactOf(r)} | ${str(r.city) || "no city"}`)),
    "",
  );

  if (problems.length > 0) {
    lines.push(
      `FAILURE ALERTS (${problems.length})`,
      ...problems.map(
        (r) =>
          `- ${str(r.subject) || `${str(r.flow)}/${str(r.stage)}`}: ${str(r.errorMessage).split("\n")[0].slice(0, 200)}`,
      ),
      "",
    );
  }

  lines.push(
    "HEALTH",
    `- Database login and mail send worked (you are reading this).`,
    `- Applications still written by old cached tabs: ${legacyWrites}${legacyWrites === 0 ? "" : " (the owner deploys the lockdown rules only after this stays at 0 for 48 hours)"}`,
    `- Under 18 flagged: ${underEighteen.length}`,
  );

  return { subject, text: lines.join("\n"), warnings };
}

/** The text digest in a monospace block: the mailer requires an html body. */
export function digestHtml(text: string): string {
  return `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
}

/** Calendar date in New York, the idempotency key for one digest per day. */
export function digestDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
}
