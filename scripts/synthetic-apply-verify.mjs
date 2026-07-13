/**
 * Verify + clean up the daily synthetic apply submission.
 *
 * Runs right after tests/synthetic/apply-monitor.spec.ts in
 * .github/workflows/synthetic-apply.yml:
 *   1. VERIFY: a synthetic application document exists in Firestore with a
 *      submittedAt inside the last 30 minutes (proves the live stack saved it).
 *   2. CLEAN UP: delete synthetic documents and their uploaded photos.
 *
 * Delete safety (structural, not best-effort): a document is deleted ONLY if
 * ALL of these hold, checked on the fetched document itself:
 *   - isSynthetic === true
 *   - emailNormalized === the reserved synthetic address
 *   - submittedAt is within the last 48 hours
 * Real applications can never carry the first two markers together (the
 * client only sets isSynthetic for the reserved email), and the query is
 * equality-scoped to that email, so a bug here cannot sweep real data. Any
 * document that matches the query but fails the checks aborts with a nonzero
 * exit instead of deleting. Photo deletes are restricted to paths under
 * "photos/" listed on a verified synthetic document.
 *
 * Env: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY,
 *      FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
 */
import { SignJWT, importPKCS8 } from "jose";

const SYNTHETIC_EMAIL = "synthetic-monitor@garammasaladating.com";
const FRESH_WINDOW_MS = 30 * 60 * 1000;
const CLEANUP_WINDOW_MS = 48 * 60 * 60 * 1000;

const projectId = process.env.FIREBASE_PROJECT_ID;
const bucket = process.env.FIREBASE_STORAGE_BUCKET;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !bucket || !clientEmail || !rawKey) {
  console.error(
    "Missing env: FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY are all required.",
  );
  process.exit(1);
}

async function getAccessToken() {
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope:
      "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function querySyntheticDocs(token) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "applications" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "emailNormalized" },
              op: "EQUAL",
              value: { stringValue: SYNTHETIC_EMAIL },
            },
          },
          limit: 20,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Firestore query failed: ${await res.text()}`);
  const rows = await res.json();
  return rows.filter((row) => row.document).map((row) => row.document);
}

function field(doc, name) {
  return doc.fields?.[name];
}

function isVerifiedSynthetic(doc) {
  const isSynthetic = field(doc, "isSynthetic")?.booleanValue === true;
  const email = field(doc, "emailNormalized")?.stringValue === SYNTHETIC_EMAIL;
  const submittedAt = Date.parse(
    field(doc, "submittedAt")?.timestampValue ?? "",
  );
  const fresh =
    Number.isFinite(submittedAt) &&
    Date.now() - submittedAt < CLEANUP_WINDOW_MS;
  return isSynthetic && email && fresh;
}

async function deletePhoto(token, path) {
  if (!/^photos\/[A-Za-z0-9._-]+$/.test(path)) {
    throw new Error(`Refusing to delete non-photo path: ${path}`);
  }
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  // 404 is fine: the photo may already be gone from a prior cleanup.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Photo delete failed (${res.status}): ${path}`);
  }
}

async function deleteDoc(token, doc) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Doc delete failed: ${await res.text()}`);
}

const token = await getAccessToken();
const docs = await querySyntheticDocs(token);

// 1. VERIFY: today's run must have produced a fresh document.
const fresh = docs.some((doc) => {
  const submittedAt = Date.parse(
    field(doc, "submittedAt")?.timestampValue ?? "",
  );
  return (
    Number.isFinite(submittedAt) && Date.now() - submittedAt < FRESH_WINDOW_MS
  );
});
if (!fresh) {
  console.error(
    `VERIFY FAILED: no synthetic application with submittedAt in the last 30 minutes (found ${docs.length} synthetic docs total). The apply form is likely broken in production.`,
  );
  process.exit(1);
}
console.log("VERIFY OK: synthetic application landed in Firestore.");

// 2. CLEAN UP: delete verified synthetic documents and their photos.
for (const doc of docs) {
  if (!isVerifiedSynthetic(doc)) {
    console.error(
      `CLEANUP REFUSED for ${doc.name}: document matched the synthetic email query but failed the isSynthetic/email/48h checks. Not deleting anything else; investigate manually.`,
    );
    process.exit(2);
  }
  const photoPaths = (field(doc, "photoPaths")?.arrayValue?.values ?? []).map(
    (v) => v.stringValue,
  );
  for (const path of photoPaths) {
    await deletePhoto(token, path);
  }
  await deleteDoc(token, doc);
  console.log(
    `Cleaned up ${doc.name} (+${photoPaths.length} photo${photoPaths.length === 1 ? "" : "s"}).`,
  );
}
console.log("CLEANUP OK.");
