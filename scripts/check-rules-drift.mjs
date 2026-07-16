/**
 * Detect drift between the DEPLOYED Firebase security rules and the repo.
 *
 * Rules ship manually (firebase CLI) while code ships via Vercel, so a rules
 * change can merge without ever being deployed, or a console hotfix can
 * diverge from the repo. That split is exactly how the July 2026 apply
 * outage class happens: repo tests pass while production enforces something
 * else. This runs on the synthetic-monitor schedule (every 6 hours, default
 * branch), pages on drift and fails the run.
 *
 * Comparison is whitespace-insensitive per line (trailing whitespace and
 * blank-line differences do not page anyone), otherwise exact.
 *
 * Env: FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY,
 *      FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET
 */
import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

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
    scope: "https://www.googleapis.com/auth/firebase",
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

async function fetchJson(token, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${url} failed: ${await res.text()}`);
  return res.json();
}

/** The currently-live ruleset source for a release (e.g. cloud.firestore). */
async function deployedRules(token, releaseName) {
  const release = await fetchJson(
    token,
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${releaseName}`,
  );
  const ruleset = await fetchJson(
    token,
    `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
  );
  const files = ruleset.source?.files ?? [];
  if (files.length === 0) {
    throw new Error(`No source files on ruleset for ${releaseName}`);
  }
  return files.map((f) => f.content).join("\n");
}

function normalize(rules) {
  return rules
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

async function pageDrift(driftedTargets) {
  await fetch("https://garammasaladating.com/api/alert-failure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://garammasaladating.com",
    },
    body: JSON.stringify({
      flow: "ops",
      stage: "rules_drift",
      errorMessage: `Deployed Firebase rules differ from the repo: ${driftedTargets.join(", ")}. Deploy the repo rules (firebase CLI, --only firestore:rules,storage) or reconcile a console hotfix back into the repo. Until then, the emulator rules tests are validating rules production is not running.`,
    }),
  }).catch(() => {
    // The workflow failure notification is the backup channel.
  });
}

const token = await getAccessToken();
const targets = [
  {
    label: "firestore.rules",
    repo: readFileSync("firestore.rules", "utf8"),
    release: "cloud.firestore",
  },
  {
    label: "storage.rules",
    repo: readFileSync("storage.rules", "utf8"),
    release: `firebase.storage/${bucket}`,
  },
];

const drifted = [];
for (const target of targets) {
  const live = await deployedRules(token, encodeURIComponent(target.release));
  if (normalize(live) !== normalize(target.repo)) {
    drifted.push(target.label);
    console.error(`DRIFT: deployed ${target.label} differs from the repo.`);
  } else {
    console.log(`OK: ${target.label} matches the deployed ruleset.`);
  }
}

if (drifted.length > 0) {
  await pageDrift(drifted);
  process.exit(1);
}
console.log("No rules drift.");
