/**
 * Shared markers for the daily synthetic apply-form monitor
 * (.github/workflows/synthetic-apply.yml).
 *
 * The monitor submits a real application through the production UI using this
 * reserved email. Every layer that must treat synthetic traffic specially
 * (client flag, notification skip, admin dashboard filter, cleanup script)
 * keys off these values, so real applicant data can never match them.
 */
export const SYNTHETIC_MONITOR_EMAIL = "synthetic-monitor@garammasaladating.com";

export const SYNTHETIC_MONITOR_NAME = "SYNTHETIC MONITOR";

/** True when a submission comes from the synthetic monitor, never a real person. */
export function isSyntheticSubmission(email: string | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SYNTHETIC_MONITOR_EMAIL;
}
