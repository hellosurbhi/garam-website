#!/usr/bin/env node
/**
 * Mark the allowlisted admin accounts as email-verified, in two steps.
 *
 * src/lib/verifyToken.ts and the Firebase rules only authorize an
 * allowlisted email when the ID token carries email_verified: true (an
 * attacker can register an unclaimed address but can never verify an inbox
 * they do not own). Email/password accounts created without a verification
 * flow stay unverified forever, so the real admin accounts may need this
 * one-time flip. Run it until it prints safe BEFORE the application change
 * merges (Vercel enforces email_verified the moment the code deploys) and
 * before deploying the rules files.
 *
 * WHY two steps: blindly verifying whichever account currently holds an
 * allowlisted email would hand admin access to a squatter who registered
 * the address first. Step 1 (no arguments) is a read-only listing of each
 * account's uid, creation time, last login and providers so the operator
 * can recognize her own account. Step 2 requires the operator to pass the
 * exact uids to trust via CONFIRM_UIDS; only those are marked verified.
 *
 * No firebase-admin dependency: mints a service-account access token with
 * jose and calls the Identity Toolkit REST API, the same pattern as
 * scripts/grant-admin-claims.mjs.
 *
 * Required env (from .env.local or the shell):
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY        (literal \n are converted to newlines)
 *   PUBLIC_FIREBASE_PROJECT_ID
 *   CONFIRM_UIDS                      (step 2 only: comma-separated uids)
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-admin-emails.mjs
 *   CONFIRM_UIDS=abc123 node --env-file=.env.local scripts/verify-admin-emails.mjs
 */
import { SignJWT, importPKCS8 } from "jose";
import { unsafeEmails } from "./lib/allowlist-safety.mjs";

// WHY: must match src/lib/adminAllowlist.ts (an .mjs script cannot import
// the TS module). The drift test in src/lib/verifyToken.test.ts parses
// this file and fails the commit gate if the lists diverge.
const ADMIN_EMAILS = [
  "messagesurbhi@gmail.com",
  "contact@garammasaladating.com",
];

const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
const confirmUids = String(process.env.CONFIRM_UIDS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function fail(message) {
  console.error(`[verify-admin-emails] ${message}`);
  process.exit(1);
}

if (!clientEmail || !rawKey) {
  fail(
    "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are required",
  );
}
if (!projectId) fail("PUBLIC_FIREBASE_PROJECT_ID is required");

async function getAccessToken() {
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({
    // Both scopes: the Identity Toolkit v1 discovery doc requires
    // cloud-platform for project-scoped accounts:lookup / accounts:update,
    // while older Google docs list the identitytoolkit scope. Requesting
    // both keeps this working under either enforcement.
    scope:
      "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) fail(`token exchange failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function lookupAccounts(email, accessToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: [email] }),
  });
  if (!res.ok) {
    // A failed lookup must never read as "listing complete": this script is
    // the pre-deploy safety check for the email_verified rules.
    fail(`lookup ${email} failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.users ?? [];
}

async function markVerified(uid, accessToken, entryNum) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
  if (!res.ok) {
    // WHY: log entry index, not uid — uid is env-derived and trips CodeQL js/clear-text-logging
    console.error(`  ✗ entry ${entryNum}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

function describe(user) {
  const created = user.createdAt
    ? new Date(Number(user.createdAt)).toISOString()
    : "unknown";
  const lastLogin = user.lastLoginAt
    ? new Date(Number(user.lastLoginAt)).toISOString()
    : "never";
  const providers = (user.providerUserInfo ?? [])
    .map((p) => p.providerId)
    .join(", ");
  return `uid=${user.localId} verified=${user.emailVerified === true} created=${created} lastLogin=${lastLogin} providers=[${providers}]`;
}

const token = await getAccessToken();
const allowlistedUids = new Map();
const listing = [];

console.log("[verify-admin-emails] accounts holding allowlisted emails:");
for (const email of ADMIN_EMAILS) {
  const users = await lookupAccounts(email, token);
  listing.push({ email, users });
  if (users.length === 0) {
    console.log(
      `  ${email}: NO ACCOUNT. Create it yourself (Firebase console > Authentication > Users > Add user) so nobody else can register this address.`,
    );
    continue;
  }
  for (const user of users) {
    allowlistedUids.set(user.localId, email);
    console.log(`  ${email}: ${describe(user)}`);
  }
}

if (confirmUids.length === 0) {
  console.log(
    "\nRead-only listing done. Check that each account above is yours (you created it, the last login is you, provider is password).",
  );
  // Same predicate as the post-update gate below (and its tests): safe when
  // every allowlisted email has at least one verified account.
  if (unsafeEmails(listing).length === 0) {
    console.log(
      "Every allowlisted email has a verified account. Nothing to do; safe to merge the auth change and deploy the rules.",
    );
    process.exit(0);
  }
  console.log(
    "NOT SAFE TO MERGE OR DEPLOY THE RULES YET: accounts above are missing or unverified.",
  );
  console.log(
    "Re-run with the uid(s) you trust, e.g.:\n  CONFIRM_UIDS=<uid1>,<uid2> npm run admin:verify-emails",
  );
  // Nonzero so this dry run can never be mistaken for a passed check.
  process.exit(1);
}

let ok = 0;
let entryNum = 0;
for (const uid of confirmUids) {
  entryNum++;
  const email = allowlistedUids.get(uid);
  if (!email) {
    // WHY: log entry index, not uid — uid is env-derived and trips CodeQL js/clear-text-logging
    console.error(
      `  ✗ entry ${entryNum}: not an account holding an allowlisted email, skipping`,
    );
    continue;
  }
  if (await markVerified(uid, token, entryNum)) {
    console.log(`  ✓ ${email} (entry ${entryNum}) marked verified`);
    ok += 1;
  }
}
console.log(`[verify-admin-emails] done: ${ok}/${confirmUids.length} ok.`);

// Success means the whole allowlist is now safe to deploy against, not just
// that the supplied uids updated. Re-check every email with fresh lookups
// only (unsafeEmails ignores in-memory update records on purpose, so a write
// that did not persist, a deleted account or an omitted uid all fail here).
const recheck = [];
for (const email of ADMIN_EMAILS) {
  recheck.push({ email, users: await lookupAccounts(email, token) });
}
const stillUnsafe = unsafeEmails(recheck);
if (stillUnsafe.length > 0) {
  for (const email of stillUnsafe) {
    console.error(`  ✗ ${email}: no verified account after this run`);
  }
  console.error(
    "[verify-admin-emails] NOT SAFE TO MERGE OR DEPLOY THE RULES YET: see accounts above.",
  );
  process.exit(1);
}
console.log(
  "Every allowlisted email has a verified account. Safe to merge the auth change and deploy the rules.",
);
console.log("Sign out and back in for the change to reach your ID token.");
process.exit(ok === confirmUids.length ? 0 : 1);
