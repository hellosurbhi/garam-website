/**
 * Turns a failed apply canary run into a page that says who is affected,
 * which check failed and what to do.
 *
 * The canary has two independent checks. The browser step files an
 * application on three phone profiles and watches what the applicant sees.
 * The read-back step (scripts/canary-verify.mjs) then reads each draft and
 * its photos from the database. Their combination decides the page:
 *
 *   read-back FAILED  -> applications are not landing: real applicants are
 *                        affected, act now.
 *   read-back OK      -> nothing is being lost, but the browser check saw a
 *                        problem: either the check is wrong or applicants see
 *                        something broken, so look at /apply on a phone.
 *   no read-back      -> the canary could not run at all: impact unknown.
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
    const error = line.match(/^\s*Error: (.+?)\s*$/);
    if (error && !errors.includes(error[1])) errors.push(error[1]);
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
  const where = browser.profiles.length
    ? ` on ${listOf(browser.profiles.map(profileName))}`
    : "";
  // The issue step comments before this page is built, so the current run is
  // already counted: one run means this is the first failure.
  const streak =
    incident?.since && incident.runs > 1
      ? `This alarm has been failing since ${incident.since} (${incident.runs} failed runs). A long red streak is itself a problem: tell Claude.`
      : "This is the first failed run of this alarm.";

  let subject;
  let impact;
  let action;
  if (verify.includes("CANARY VERIFY FAILED")) {
    const first =
      verify
        .split("\n")
        .find((line) => line.startsWith("- "))
        ?.slice(2) ?? "an application did not land";
    subject = `APPLICANTS AFFECTED: ${first}`;
    impact =
      "Test applications are NOT reaching the database. Real applicants are probably failing right now.";
    action =
      "What to do: open garammasaladating.com/apply on your phone now and try to apply, then tell Claude what happened.";
  } else if (verify.includes("CANARY VERIFY OK")) {
    const what = browser.errors.length
      ? listOf(browser.errors)
      : "the browser check did not finish";
    subject = `Apply page check failed${where}, applications still landing`;
    impact = `Every test application and photo reached the database, so no application data is being lost. The browser check failed${where}: ${what}. Either the check is wrong or applicants see something broken.`;
    action =
      "What to do: open garammasaladating.com/apply on your phone. If it works, nothing is urgent: tell Claude the check needs fixing. If it does not, tell Claude right away.";
  } else {
    subject = "Apply monitor could not run, applicant impact unknown";
    impact =
      "The apply canary could not file or read back its test applications, so nobody knows whether real applicants are affected.";
    action =
      "What to do: open garammasaladating.com/apply on your phone and try it, then tell Claude.";
  }

  const detail = [
    browser.errors.length || browser.profiles.length
      ? `Browser check: ${browser.errors.join("; ") || "failed"}${where}`
      : "",
    verify.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject,
    message: [impact, "", action, "", streak].join("\n"),
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
