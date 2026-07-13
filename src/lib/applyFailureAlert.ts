/**
 * Client-side reporter for apply-form failures.
 *
 * Fires a first-party request to /api/alert-apply-failure, which emails the
 * producer immediately. This exists because analytics-based error tracking
 * (PostHog) is routinely blocked by ad blockers and in-app browsers, and its
 * digests are weekly: a broken apply form must page a human on the FIRST
 * failed applicant, not at the end of the week.
 */
export interface ApplyFailureReport {
  /** Where in the flow it failed, e.g. "submit", "notify_email", "react_boundary". */
  stage: string;
  errorMessage: string;
  /** Contact fields the applicant had filled in, so a failed applicant is recoverable. */
  applicant?: {
    name?: string;
    email?: string;
    phone?: string;
    instagram?: string;
  };
}

export function reportApplyFailure(report: ApplyFailureReport): void {
  try {
    // keepalive lets the request survive a page unload right after failure.
    void fetch("/api/alert-apply-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...report,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {
      // Alerting must never affect the form; PostHog trackError is the backup channel.
    });
  } catch {
    // Same rule: a reporter that throws would mask the original failure.
  }
}
