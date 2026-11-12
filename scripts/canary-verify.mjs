/**
 * Read back the production apply canary and fail with EXACT reasons.
 *
 * Runs after tests/canary/apply-canary.spec.ts in
 * .github/workflows/apply-canary.yml. For each browser profile it reads the one
 * fixed `_canary/<id>` document with the service account and requires:
 *   - the document name contains THIS run's CANARY_RUN_ID (not a stale write)
 *   - status is "New" and finalizedAt is newer than this run's start
 *   - exactly the two photos the canary attaches, each of which exists in the
 *     Storage bucket and was stored after this run's start
 * CANARY_STARTED_AT is the ISO time the workflow job began.
 * Nothing is created or deleted here: the canary overwrites the same document
 * and photo slots every run, so there is no growth and no cleanup to get wrong.
 *
 * Env: CANARY_RUN_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY,
 *      FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, optional DRAFT_TOKEN_SECRET
 *      (not needed here; ids are derived from the public canary key).
 */
import { createHash } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

/** The canary attaches a JPEG and a HEIC-shaped file. */
const EXPECTED_PHOTOS = 2;
/** Every external call has a deadline so a stall fails fast and the page goes out. */
const REQUEST_TIMEOUT_MS = 20_000;

const PROFILES = ["iphone-safari", "android-chrome", "instagram-webview"];

// Duplicated from src/lib/env.ts on purpose: this runs as plain node in CI.
// WHY: a GitHub secret can carry a literal trailing backslash-n that .trim()
// cannot strip and that silently corrupts URLs (see LESSONS.md, #215).
function readTrimmedEnv(value) {
  const trimmed = value?.trim().replace(/\\n$/, "");
  return trimmed ? trimmed : undefined;
}

// Same derivation as canaryDraftId() in src/lib/draftSecret.ts.
function canaryDraftId(key) {
  return createHash("sha256")
    .update(`canary:${key}`)
    .digest("hex")
    .slice(0, 32);
}

const runId = process.env.CANARY_RUN_ID;
const startedAtIso = process.env.CANARY_STARTED_AT;
const startedAt = Date.parse(startedAtIso ?? "");
const projectId = readTrimmedEnv(process.env.FIREBASE_PROJECT_ID);
const bucket = readTrimmedEnv(process.env.FIREBASE_STORAGE_BUCKET);
const clientEmail = readTrimmedEnv(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (
  !runId ||
  Number.isNaN(startedAt) ||
  !projectId ||
  !bucket ||
  !clientEmail ||
  !rawKey
) {
  console.error(
    "Missing env: CANARY_RUN_ID, CANARY_STARTED_AT (ISO time), FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are all required.",
  );
  process.exit(1);
}

async function getAccessToken() {
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope:
      "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_only",
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function readDoc(token, id) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/_canary/${id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(
      `Firestore read failed (${res.status}): ${await res.text()}`,
    );
  return (await res.json()).fields ?? {};
}

/** The object's metadata, or null only when Storage says it does not exist. */
async function objectMeta(token, path) {
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (res.status === 404) return null;
  // WHY not null: a 401, 403 or 5xx is a broken check, not a missing photo,
  // and reporting "file missing" would send the producer chasing the wrong cause.
  if (!res.ok)
    throw new Error(
      `Storage lookup failed (${res.status}): ${await res.text()}`,
    );
  return await res.json();
}

const token = await getAccessToken();
const failures = [];

for (const profile of PROFILES) {
  const fields = await readDoc(token, canaryDraftId(profile));
  if (!fields) {
    failures.push(
      `${profile}: no canary document exists, so the save never reached the server.`,
    );
    continue;
  }
  const name = fields.name?.stringValue ?? "";
  if (!name.includes(runId)) {
    failures.push(
      `${profile}: document holds a STALE write (name "${name}" does not contain this run's id ${runId}). The save from this run did not land.`,
    );
    continue;
  }
  const status = fields.status?.stringValue ?? "(missing)";
  if (status !== "New") {
    failures.push(
      `${profile}: saved but status is "${status}", expected "New". The final submit step did not finish.`,
    );
  }
  // WHY the time checks: the canary reuses one document and fixed photo
  // slots, so status "New" and the recorded photo paths survive from the
  // previous run. Only timestamps written by THIS run prove this run finished.
  const finalizedAt = Date.parse(fields.finalizedAt?.timestampValue ?? "");
  if (!(finalizedAt >= startedAt)) {
    failures.push(
      `${profile}: the final submit step did not run in this run (finalizedAt ${fields.finalizedAt?.timestampValue ?? "(missing)"} is older than the run start ${startedAtIso}).`,
    );
  }
  const paths = (fields.photoPaths?.arrayValue?.values ?? []).map(
    (v) => v.stringValue,
  );
  if (paths.length !== EXPECTED_PHOTOS) {
    failures.push(
      `${profile}: expected ${EXPECTED_PHOTOS} photos recorded on the application but found ${paths.length}.`,
    );
    continue;
  }
  for (const path of paths) {
    const meta = await objectMeta(token, path);
    if (!meta) {
      failures.push(
        `${profile}: photo ${path} is recorded on the application but the file is missing from Storage.`,
      );
    } else if (!(Date.parse(meta.updated) >= startedAt)) {
      failures.push(
        `${profile}: photo ${path} was not uploaded in this run (stored ${meta.updated}, run started ${startedAtIso}).`,
      );
    }
  }
  console.log(`${profile}: OK (${paths.length} photos, status ${status}).`);
}

if (failures.length > 0) {
  console.error(`CANARY VERIFY FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("CANARY VERIFY OK: all profiles landed with this run's id.");
