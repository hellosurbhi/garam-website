/**
 * Migrate pre-July-2026 applications from tokened photo download URLs to
 * Storage paths, then revoke the download tokens.
 *
 * Old documents store `photoUrls` (long-lived tokened URLs: anyone holding
 * one can view applicant PII photos without auth). New documents store
 * `photoPaths` and the admin dashboard reads through its authenticated
 * session. This script makes old docs identical to new docs and kills the
 * outstanding tokens.
 *
 * DRY-RUN by default: prints every planned change and touches nothing.
 * Run with --execute to apply. Per-document behavior is all-or-nothing: if
 * any URL on a document fails to parse into a photos/ path, that document is
 * skipped and reported, never partially migrated.
 *
 * Env: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY,
 *      FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
 * Usage: node --env-file=.env.local scripts/migrate-legacy-photo-urls.mjs [--execute]
 */
import { SignJWT, importPKCS8 } from "jose";

const execute = process.argv.includes("--execute");

const projectId =
  process.env.FIREBASE_PROJECT_ID ?? process.env.PUBLIC_FIREBASE_PROJECT_ID;
const bucket =
  process.env.FIREBASE_STORAGE_BUCKET ??
  process.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
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
      "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write https://www.googleapis.com/auth/firebase",
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

/** Extract the `photos/...` storage path from a tokened download URL. */
function pathFromDownloadUrl(url) {
  const match = /\/o\/([^?]+)/.exec(url);
  if (!match) return null;
  const path = decodeURIComponent(match[1]);
  return /^photos\/[A-Za-z0-9._-]+$/.test(path) ? path : null;
}

/** Docs with a photoUrls field (orderBy only returns docs that have it). */
async function queryLegacyDocs(token) {
  const docs = [];
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
          orderBy: [{ field: { fieldPath: "photoUrls" } }],
          limit: 1000,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Firestore query failed: ${await res.text()}`);
  for (const row of await res.json()) {
    if (row.document) docs.push(row.document);
  }
  return docs;
}

async function patchDocToPaths(token, docName, photoPaths) {
  const url = new URL(`https://firestore.googleapis.com/v1/${docName}`);
  // photoPaths gets written; photoUrls/photoUrl are masked but absent from
  // the body, which deletes them from the document.
  for (const field of ["photoPaths", "photoUrls", "photoUrl"]) {
    url.searchParams.append("updateMask.fieldPaths", field);
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        photoPaths: {
          arrayValue: {
            values: photoPaths.map((p) => ({ stringValue: p })),
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Doc patch failed: ${await res.text()}`);
}

async function revokeDownloadTokens(token, path) {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ firebaseStorageDownloadTokens: null }),
    },
  );
  // 404: the object is already gone; nothing left to revoke.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Token revoke failed (${res.status}) for ${path}`);
  }
}

const token = await getAccessToken();
const docs = await queryLegacyDocs(token);
console.log(
  `${execute ? "EXECUTE" : "DRY-RUN"}: found ${docs.length} application(s) with legacy photoUrls.`,
);

let migrated = 0;
let skipped = 0;

for (const document of docs) {
  const id = document.name.split("/").pop();
  const alreadyMigrated = Boolean(document.fields?.photoPaths);
  const urls = (document.fields?.photoUrls?.arrayValue?.values ?? []).map(
    (v) => v.stringValue,
  );
  const paths = urls.map(pathFromDownloadUrl);

  if (alreadyMigrated) {
    console.log(`- ${id}: already has photoPaths, skipping doc patch.`);
  }
  if (paths.some((p) => p === null)) {
    console.error(
      `- ${id}: SKIPPED, could not parse every URL into a photos/ path (${urls.join(", ")}).`,
    );
    skipped++;
    continue;
  }

  console.log(`- ${id}: ${urls.length} photo(s) -> ${paths.join(", ")}`);
  if (execute) {
    if (!alreadyMigrated) await patchDocToPaths(token, document.name, paths);
    for (const path of paths) {
      await revokeDownloadTokens(token, path);
    }
  }
  migrated++;
}

console.log(
  `${execute ? "Migrated" : "Would migrate"} ${migrated} doc(s), skipped ${skipped}.`,
);
if (!execute) {
  console.log("Re-run with --execute to apply.");
}
if (skipped > 0) process.exit(2);
