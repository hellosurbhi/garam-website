import { describe, expect, it } from "vitest";

import { browserFailures, canaryAlert } from "./canary-alert.mjs";

// Shape of run 44993267596 (Nov 22 2026): the browser step failed two
// profiles on a wrong assertion while every draft and photo landed.
const BROWSER_LOG = `
Running 3 tests using 1 worker

CANARY FILING STARTED: iphone-safari
CANARY FILING STARTED: android-chrome
CANARY FILING STARTED: instagram-webview
  1) [android-chrome] › tests/canary/apply-canary.spec.ts:50:1 › a phone applicant can file an application with photos on the live stack

    Error: direct upload to the bucket was blocked

    expect(received).toEqual(expected) // deep equality

    Retry #1 ───────────────────────────────────────

    Error: direct upload to the bucket was blocked

  2 failed
    [android-chrome] › tests/canary/apply-canary.spec.ts:50:1 › a phone applicant can file an application with photos on the live stack
    [instagram-webview] › tests/canary/apply-canary.spec.ts:50:1 › a phone applicant can file an application with photos on the live stack
  1 passed (59.4s)
`;
const VERIFY_OK = `iphone-safari: OK (2 photos, status New).
android-chrome: OK (2 photos, status New).
instagram-webview: OK (2 photos, status New).
CANARY VERIFY OK: all profiles landed with this run's id.`;
const VERIFY_FAILED = `iphone-safari: OK (2 photos, status New).
CANARY VERIFY FAILED:
- android-chrome: no draft carries this run's id
- instagram-webview: no draft carries this run's id`;

describe("browserFailures", () => {
  it("names each failed profile once and each distinct error once", () => {
    expect(browserFailures(BROWSER_LOG)).toEqual({
      profiles: ["android-chrome", "instagram-webview"],
      errors: ["direct upload to the bucket was blocked"],
    });
  });

  it("keeps timeout errors and the test deadline", () => {
    const log = `
    Test timeout of 90000ms exceeded.

    TimeoutError: locator.click: Timeout 20000ms exceeded.
`;
    expect(browserFailures(log).errors).toEqual([
      "Test timeout of 90000ms exceeded.",
      "TimeoutError: locator.click: Timeout 20000ms exceeded.",
    ]);
  });

  it("returns nothing for a missing log", () => {
    expect(browserFailures(undefined)).toEqual({ profiles: [], errors: [] });
  });
});

describe("canaryAlert", () => {
  it("says applicants are affected when the read-back finds nothing landed", () => {
    const alert = canaryAlert({
      verifyLog: VERIFY_FAILED,
      browserLog: BROWSER_LOG,
    });
    expect(alert.subject).toBe(
      "APPLICANTS AFFECTED: android-chrome: no draft carries this run's id",
    );
    expect(alert.message).toContain("Real applicants are probably failing");
    expect(alert.message).toContain(
      "What to do: open garammasaladating.com/apply on your phone now",
    );
  });

  it("separates a failed browser check from lost applications", () => {
    const alert = canaryAlert({
      verifyLog: VERIFY_OK,
      browserLog: BROWSER_LOG,
    });
    expect(alert.subject).toBe(
      "Apply page check failed on Android Chrome and the Instagram app, applications still landing",
    );
    expect(alert.subject).not.toMatch(/FAILED|AFFECTED/);
    expect(alert.message).toContain("no application data is being lost");
    expect(alert.message).toContain("direct upload to the bucket was blocked");
    expect(alert.message).toContain("What to do:");
    expect(alert.detail).toContain(
      "Browser check: direct upload to the bucket was blocked on Android Chrome and the Instagram app",
    );
  });

  it("says impact is unknown when the canary produced no read-back", () => {
    const alert = canaryAlert({ verifyLog: "", browserLog: "" });
    expect(alert.subject).toBe(
      "Apply monitor could not run, applicant impact unknown",
    );
    expect(alert.message).toContain("What to do:");
  });

  it("escalates a long red streak in every email", () => {
    const alert = canaryAlert({
      verifyLog: VERIFY_OK,
      browserLog: BROWSER_LOG,
      incident: { since: "2026-11-12", runs: 37 },
    });
    expect(alert.message).toContain(
      "This alarm has been failing since 2026-11-12 (37 failed runs in a row)",
    );
  });

  it("marks a first failure as new, counting the run the issue step just logged", () => {
    const alert = canaryAlert({
      verifyLog: VERIFY_FAILED,
      browserLog: BROWSER_LOG,
      incident: { since: "2026-11-22", runs: 1 },
    });
    expect(alert.message).toContain("first failed run");
  });

  it("does not blame applicants when the site rejected the canary's own credentials", () => {
    const alert = canaryAlert({
      verifyLog: VERIFY_FAILED,
      browserLog: `${BROWSER_LOG}\nCANARY AUTH REJECTED: android-chrome\nCANARY AUTH REJECTED: instagram-webview\n`,
    });
    expect(alert.subject).toBe(
      "Apply monitor could not run, applicant impact unknown",
    );
    expect(alert.message).toContain("test credentials");
  });

  it("never calls a failed history lookup a first failure", () => {
    const alert = canaryAlert({ verifyLog: VERIFY_FAILED, browserLog: BROWSER_LOG });
    expect(alert.message).not.toContain("first failed run");
    expect(alert.message).toContain("history could not be read");
  });

  it("does not blame applicants when browser setup failed before filing", () => {
    for (const browserLog of [
      "",
      "Running 3 tests using 1 worker\n\nError: browserType.launch: Executable doesn't exist",
      "Running 3 tests using 1 worker\n\nError: DRAFT_TOKEN_SECRET is not set",
    ]) {
      const alert = canaryAlert({ verifyLog: VERIFY_FAILED, browserLog });
      expect(alert.subject).toBe(
        "Apply monitor could not run, applicant impact unknown",
      );
      expect(alert.message).toContain("never started filing");
      expect(alert.detail).toContain("CANARY VERIFY FAILED");
    }
  });

  it("writes copy with no separator dashes", () => {
    for (const verifyLog of [VERIFY_OK, VERIFY_FAILED, ""]) {
      const { subject, message } = canaryAlert({
        verifyLog,
        browserLog: BROWSER_LOG,
        incident: { since: "2026-11-12", runs: 2 },
      });
      expect(`${subject}\n${message}`).not.toMatch(/[–—]|--| - /);
    }
  });
});
