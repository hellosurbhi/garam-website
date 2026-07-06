#!/usr/bin/env node
/**
 * Grant the { admin: true } custom claim to every UID in ADMIN_UIDS.
 *
 * firestore.rules gates all reads of the applications and leads collections on
 * this claim (isAdmin()). Run this BEFORE deploying the rules, otherwise the
 * admin dashboard loses read access until the claim propagates.
 *
 * No firebase-admin dependency: this mints a service-account access token with
 * jose (already a dependency) and calls the Identity Toolkit REST API, the same
 * pattern src/lib/firestoreAdmin.ts uses for Firestore.
 *
 * Required env (from .env.local or the shell):
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY        (literal \n are converted to newlines)
 *   PUBLIC_FIREBASE_PROJECT_ID
 *   ADMIN_UIDS                        (comma-separated Firebase UIDs)
 *
 * Usage:
 *   node --env-file=.env.local scripts/grant-admin-claims.mjs
 * Admins must sign out and back in (or force a token refresh) for the claim to
 * appear in their ID token.
 */
import { SignJWT, importPKCS8 } from "jose";

const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const projectId = process.env.PUBLIC_FIREBASE_PROJECT_ID;
const adminUids = String(process.env.ADMIN_UIDS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function fail(message) {
  console.error(`[grant-admin-claims] ${message}`);
  process.exit(1);
}

if (!clientEmail || !rawKey) {
  fail(
    "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are required",
  );
}
if (!projectId) fail("PUBLIC_FIREBASE_PROJECT_ID is required");
if (adminUids.length === 0) fail("ADMIN_UIDS is empty — nothing to grant");

async function getAccessToken() {
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/identitytoolkit",
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

async function grant(uid, accessToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify({ admin: true }),
    }),
  });
  if (!res.ok) {
    console.error(`  ✗ ${uid}: ${res.status} ${await res.text()}`);
    return false;
  }
  console.log(`  ✓ ${uid}`);
  return true;
}

const token = await getAccessToken();
console.log(
  `[grant-admin-claims] granting admin claim to ${adminUids.length} uid(s):`,
);
let ok = 0;
for (const uid of adminUids) {
  if (await grant(uid, token)) ok += 1;
}
console.log(`[grant-admin-claims] done: ${ok}/${adminUids.length} succeeded.`);
console.log("Admins must re-authenticate for the claim to take effect.");
process.exit(ok === adminUids.length ? 0 : 1);
