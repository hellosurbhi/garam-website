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

// Mirrors FailureSchema in /api/alert-failure.ts: an over-limit field would
// 400 the whole report and silently swallow the page. Truncating here keeps
// a long URL or error message from costing the entire alert.
const cut = (s: string | undefined, max: number) =>
  s === undefined ? undefined : s.slice(0, max);

export function reportFailure(report: FailureReport): void {
  try {
    // keepalive lets the request survive a page unload right after failure.
    void fetch("/api/alert-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flow: report.flow,
        stage: report.stage.slice(0, 50),
        errorMessage: report.errorMessage.slice(0, 2000),
        ...(report.contact
          ? {
              contact: {
                name: cut(report.contact.name, 200),
                email: cut(report.contact.email, 320),
                phone: cut(report.contact.phone, 30),
                instagram: cut(report.contact.instagram, 100),
              },
            }
          : {}),
        pageUrl: window.location.href.slice(0, 2000),
        userAgent: navigator.userAgent.slice(0, 1000),
      }),
      keepalive: true,
    }).catch(() => {
      // Alerting must never affect the flow; PostHog trackError is the backup channel.
    });
  } catch {
    // Same rule: a reporter that throws would mask the original failure.
  }
}
