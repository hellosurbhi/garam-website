import { describe, expect, it } from "vitest";

import { browserFailures, canaryAlert } from "./canary-alert.mjs";

// Shape of run 44993267596 (Nov 22 2026): the browser step failed two
// profiles on a wrong assertion while every draft and photo landed.
const BROWSER_LOG = `
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
      "This alarm has been failing since 2026-11-12 (37 failed runs)",
    );
  });

  it("marks a first failure as new, counting the run the issue step just logged", () => {
    for (const incident of [undefined, { since: "2026-11-22", runs: 1 }]) {
      const alert = canaryAlert({
        verifyLog: VERIFY_FAILED,
        browserLog: "",
        incident,
      });
      expect(alert.message).toContain("first failed run");
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
