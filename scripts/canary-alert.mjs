/**
 * Turns a failed apply canary run into a page that says who is affected,
 * which check failed and what to do.
 *
 * The canary has two independent checks. The browser step files an
 * application on three phone profiles and watches what the applicant sees.
 * The read-back step (scripts/canary-verify.mjs) then reads each draft and
 * its photos from the database. Their combination decides the page:
 *
 *   read-back FAILED  -> a test application was not saved: applicants are
 *                        probably affected, act now.
 *   read-back OK      -> the robot's own application was saved, which does
 *                        not prove real applicants are fine: the browser
 *                        check is broken or applicants see something broken.
 *   no read-back, or  -> the canary could not run at all: impact unknown.
 *   browser never
 *   started
 *
 * WHY: the first version paged "APPLY FAILED" for every red run and pasted
 * only the read-back log. For ten days (Nov 2026) it paged with three "OK"
 * lines while a wrong browser assertion was the only failure, so a real
 * outage would have looked identical to that noise. Collapsing these cases
 * back into one subject brings that blindness back.
 */
import { readFileSync } from "node:fs";

import { sendPagerEmail } from "./send-pager-email.mjs";

const PROFILE_NAMES = {
  "iphone-safari": "iPhone Safari",
  "android-chrome": "Android Chrome",
  "instagram-webview": "the Instagram app",
};

function profileName(id) {
  return PROFILE_NAMES[id] ?? id;
}

function listOf(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The failed profiles and distinct error messages from Playwright output. */
export function browserFailures(log) {
  const lines = (log ?? "").split("\n");
  const profiles = [];
  const errors = [];
  let inFailedList = false;
  for (const line of lines) {
    // Playwright prints "Error: ...", typed errors such as "TimeoutError:
    // locator.click: Timeout 20000ms exceeded." and the test deadline as a
    // bare "Test timeout of 90000ms exceeded." line.
    const error =
      line.match(/^\s*Error: (.+?)\s*$/)?.[1] ??
      line.match(/^\s*(\w+Error: .+?)\s*$/)?.[1] ??
      line.match(/^\s*(Test timeout of \d+ms exceeded\.?)\s*$/)?.[1];
    if (error && !errors.includes(error)) errors.push(error);
    if (/^\s*\d+ failed\s*$/.test(line)) {
      inFailedList = true;
      continue;
    }
    if (inFailedList) {
      const profile = line.match(/^\s*\[([\w-]+)\] ›/);
      if (profile) {
        if (!profiles.includes(profile[1])) profiles.push(profile[1]);
      } else {
        inFailedList = false;
      }
    }
  }
  return { profiles, errors };
}

/**
 * Builds the page. `incident` is { since: "YYYY-MM-DD", runs: n } from the
 * open canary issue, so a monitor that stays red escalates in every email
 * instead of turning into background noise.
 */
export function canaryAlert({ verifyLog, browserLog, incident }) {
  const verify = verifyLog ?? "";
  const browser = browserFailures(browserLog);
  // WHY: the read-back runs even when browser setup failed, and then finds no
  // drafts because none were filed. Only a profile that printed the spec's
  // "CANARY FILING STARTED" marker reached production, so only its read-back
  // failure means applicants are affected. Playwright's "Running N tests"
  // banner was tried first: it prints before browser launch, so a launch
  // failure still paged APPLICANTS AFFECTED.
  const marked = (label) =>
    [
      ...(browserLog ?? "").matchAll(new RegExp(`${label}: ([\\w-]+)`, "g")),
    ].map((match) => match[1]);
  const started = marked("CANARY FILING STARTED");
  // A profile whose canary signature the site rejected was blocked by the
  // monitor's own credentials, which real applicants never send.
  const rejected = marked("CANARY AUTH REJECTED");
  const affected = verify
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))
    .filter((line) =>
      started.some((id) => line.startsWith(`${id}:`) && !rejected.includes(id)),
    );
  const where = browser.profiles.length
    ? ` on ${listOf(browser.profiles.map(profileName))}`
    : "";
  // The issue step comments before this page is built, so the current run is
  // already counted. A passing run closes the issue (recover job), so the
  // issue only spans one unbroken red streak. No incident means the lookup
  // failed, which is never reported as a first failure.
  const streak = incident
    ? `Failing since ${incident.since}, ${incident.runs} runs`
    : "The alarm history could not be read, so it is unknown how long this has been failing.";
  const runLink = "(the run link is at the bottom of this email)";

  let subject;
  let lines;
  // The read-back log's "OK" lines describe the robot's own test application,
  // so they are left out of the detail unless that is the failing evidence.
  let verifyDetail = verify.trim();
  if (verify.includes("CANARY VERIFY FAILED") && affected.length) {
    const profile = affected[0].split(":")[0];
    subject = `APPLICANTS AFFECTED: ${profileName(profile)}`;
    lines = [
      "What failed: a test application could not be saved.",
      `Evidence: ${affected[0]} ${runLink}.`,
      "",
      "Try garammasaladating.com/apply on your phone now and tell Claude.",
    ];
  } else if (verify.includes("CANARY VERIFY OK")) {
    const what = browser.errors.length
      ? listOf(browser.errors)
      : "the browser check did not finish";
    subject = "Apply page check failed (test application was saved)";
    verifyDetail = "";
    lines = [
      "The robot's own application went through. That does not prove every real applicant is fine.",
      `Evidence: the browser check failed${where}: ${what} ${runLink}.`,
      "",
      "Nothing urgent. Tell Claude.",
    ];
  } else {
    subject = "Apply monitor could not run";
    const why = rejected.length
      ? "The site rejected the apply canary's own test credentials (the GitHub and Vercel secrets no longer match), so the monitor is blind until they are fixed."
      : started.length
        ? "The apply canary could not read back its test applications."
        : "The apply canary never started filing test applications (its own setup failed).";
    lines = ["Applicant impact unknown.", why, "", "Tell Claude."];
  }

  const detail = [
    browser.errors.length || browser.profiles.length
      ? `Browser check: ${browser.errors.join("; ") || "failed"}${where}`
      : "",
    verifyDetail,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject,
    message: [...lines, "", streak].join("\n"),
    detail,
  };
}

function readIfPresent(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function parseIncident(value) {
  const match = (value ?? "").trim().match(/^(\d{4}-\d{2}-\d{2}) (\d+)$/);
  return match ? { since: match[1], runs: Number(match[2]) } : null;
}

const isCli = process.argv[1]?.endsWith("canary-alert.mjs");
if (isCli) {
  try {
    const alert = canaryAlert({
      verifyLog: readIfPresent("verify.log"),
      browserLog: readIfPresent("browser.log"),
      incident: parseIncident(process.env.CANARY_INCIDENT),
    });
    const { to, subject } = await sendPagerEmail("page", {
      ...process.env,
      MONITOR_SUBJECT: alert.subject,
      MONITOR_MESSAGE: alert.message,
      DETAIL: alert.detail,
    });
    console.log(`Pager email sent to ${to}: ${subject}`);
  } catch (err) {
    // Same rule as send-pager-email.mjs: print only the error's own message,
    // which never embeds env values, so credentials cannot reach the log.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
