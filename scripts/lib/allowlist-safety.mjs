/**
 * Pure safety decision for verify-admin-emails: the email_verified rules are
 * only safe to deploy when EVERY allowlisted email resolves to at least one
 * account whose fresh lookup reports emailVerified true AND whose stored
 * email is byte-for-byte the allowlist entry. The exact-match requirement
 * mirrors verifyToken.ts, which compares the token email case-sensitively;
 * an account stored under a case variant would pass a loose check here yet
 * still 401 in production. Derived solely from the lookup results passed in;
 * no in-memory state may override a lookup (a "we just updated it" record
 * must not greenlight a write that did not actually persist).
 *
 * @param {Array<{ email: string, users: Array<{ email?: string, emailVerified?: boolean }> }>} entries
 * @returns {string[]} the emails that are NOT safe (missing, mismatched or unverified)
 */
export function unsafeEmails(entries) {
  return entries
    .filter(
      ({ email, users }) =>
        !users.some((u) => u.emailVerified === true && u.email === email),
    )
    .map(({ email }) => email);
}
