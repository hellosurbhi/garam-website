/** Reserved test identities classify traffic, never authorize access. */
export const SYNTHETIC_MONITOR_EMAIL =
  "synthetic-monitor@garammasaladating.com";
export const SYNTHETIC_MONITOR_NAME = "SYNTHETIC MONITOR";
// Kept identical to the Firestore rules predicate; parity is tested.
export const SYNTHETIC_EMAIL_PATTERN =
  "synthetic-monitor([+][0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?@garammasaladating[.]com";
const syntheticEmail = new RegExp(`^${SYNTHETIC_EMAIL_PATTERN}$`);
export function isSyntheticSubmission(email: unknown): boolean {
  return (
    typeof email === "string" && syntheticEmail.test(email.trim().toLowerCase())
  );
}
