/**
 * Shared markers for synthetic traffic. The apply canary (.github/workflows/
 * apply-canary.yml) no longer creates applications, but the mixer RSVP monitor
 * still submits with this reserved email, so every layer that must treat that
 * traffic specially (notification skip) keys off these values, so real
 * applicant data can never match them.
 */
export const SYNTHETIC_MONITOR_EMAIL =
  "synthetic-monitor@garammasaladating.com";

export const SYNTHETIC_MONITOR_NAME = "SYNTHETIC MONITOR";

/** True when a submission comes from the synthetic monitor, never a real person. */
export function isSyntheticSubmission(email: string | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SYNTHETIC_MONITOR_EMAIL;
}
