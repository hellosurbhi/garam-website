/**
 * The cause of a server failure in words safe to show the browser.
 *
 * WHY: the apply endpoints used to return `err.message` verbatim as `detail`.
 * Upstream messages carry request URLs, project ids and response bodies, which
 * must not reach the public (CodeQL js/stack-trace-exposure). The full message
 * still goes to the ops alert, which is where the exact cause is read. The
 * browser only needs the class of failure for its own error line. Returning
 * the raw message again would leak those details; do not.
 */
export function publicCause(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const service = /storage/i.test(message)
    ? "storage"
    : /firestore|firebase|google/i.test(message)
      ? "database"
      : "server";
  const status = /\b([45]\d{2})\b/.exec(message)?.[1];
  if (/timeout|timed out|abort/i.test(message)) return `${service} timed out`;
  if (status) return `${service} answered HTTP ${status}`;
  if (/fetch failed|network|econn|enotfound/i.test(message)) {
    return `${service} unreachable`;
  }
  return `${service} error`;
}
