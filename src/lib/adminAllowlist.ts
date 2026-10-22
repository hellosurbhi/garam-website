// WHY: Admin authorization previously lived in two desynced places with two
// different keys: firestore.rules isAdmin() checked the token's email claim,
// while the admin API checked the uid against an ADMIN_UIDS env var. That
// check fails closed with the same 401 whether the var is unset, empty or
// holds a stale uid, and none of those states is inspectable from code
// review, which is how every admin API route could 401 while the rules-gated
// Applicants tab kept working. Keeping one list in code removes the
// env-var dependency entirely. The rules language cannot import TypeScript, so copies exist in
// firestore.rules, storage.rules and scripts/verify-admin-emails.mjs;
// verifyToken.test.ts parses all three and fails the pre-commit gate if any
// copy drifts. If you change one list, change all four. Note: removing an
// email here does not revoke a previously granted `admin` custom claim;
// clear that in the Firebase console (or an admin:grant-claims variant) if
// an admin is ever offboarded.
export const ADMIN_EMAILS: readonly string[] = [
  "messagesurbhi@gmail.com",
  "contact@garammasaladating.com",
];
