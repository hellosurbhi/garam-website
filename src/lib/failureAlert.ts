/**
 * Client-side reporter for critical-flow failures (apply, lead capture,
 * contestant portal).
 *
 * Fires a first-party request to /api/alert-failure, which pages the
 * producer immediately (email + optional push). This exists because
 * analytics-based error tracking (PostHog) is routinely blocked by ad
 * blockers and in-app browsers, and its digests are weekly: a broken
 * revenue flow must page a human on the FIRST failed user, not at the end
 * of the week.
 */
export interface FailureReport {
  flow: "apply" | "waiver" | "portal" | "lead";
  /** Where in the flow it failed, e.g. "submit", "email", "phone", "claim". */
  stage: string;
  errorMessage: string;
  /** Contact fields the user had filled in, so a failed user is recoverable. */
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    instagram?: string;
  };
}

export function reportFailure(report: FailureReport): void {
  try {
    // keepalive lets the request survive a page unload right after failure.
    void fetch("/api/alert-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...report,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {
      // Alerting must never affect the flow; PostHog trackError is the backup channel.
    });
  } catch {
    // Same rule: a reporter that throws would mask the original failure.
  }
}
