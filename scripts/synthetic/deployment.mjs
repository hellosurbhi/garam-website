import { appendFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fetchPublishedEnvelope } from "../fetch-published-events.mjs";
import { getServiceAccountToken } from "../lib/google-access-token.mjs";
import { trimmed } from "./admin.mjs";
export const PRODUCTION = "https://garammasaladating.com";
/** What production reports it is running: commit and show list version. */
async function deployedVersion(fetchImpl) {
  const res = await fetchImpl(`${PRODUCTION}/api/version`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok)
    throw new Error(`Deployment version unavailable (${res.status})`);
  return res.json();
}
export async function deployedCommit(fetchImpl = fetch) {
  const { commit } = await deployedVersion(fetchImpl);
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Deployment version is invalid");
  return commit;
}
export async function requireVersion(expected, fetchImpl = fetch) {
  if (!/^[a-f0-9]{40}$/.test(expected ?? ""))
    throw new Error("Expected deployment commit is missing");
  if ((await deployedCommit(fetchImpl)) !== expected)
    throw new Error("Deployment version differs from the tested revision");
}
/** How long a publish may take to reach the site before the monitor pages. */
export const REBUILD_GRACE_MS = 20 * 60_000;
/** How often the ticket check rereads the versions while a rebuild runs. */
export const EVENTS_POLL_MS = 30_000;
const PROJECT_ID = /^[a-z0-9-]+$/;
/**
 * Plan R10: the ticket checks compare the live page with the show list the
 * deployment was built from. A publish starts a rebuild, so for a while the
 * site is behind: "check" when the versions match, "wait" while the deployed
 * version was replaced under 20 minutes ago, "stale" after that or when the
 * site is ahead (a failed or stuck rebuild must page).
 * WHY supersededAt and not the latest publishedAt: each new publish would
 * restart the clock, so steady publishing could hide a rebuild that never
 * lands. The deployed version stopped being current exactly when the next
 * version was created, however many came after it.
 */
export function decideEventsCheck({ deployed, published, supersededAt, now }) {
  if (deployed === published.version) return "check";
  if (deployed > published.version) return "stale";
  const age = now - Date.parse(supersededAt);
  return age < REBUILD_GRACE_MS ? "wait" : "stale";
}
/**
 * Full document name of one publish record. Same id format as
 * eventVersionDocPath in src/lib/eventsStore.server.ts, which plain Node
 * cannot import; deployment.test.mjs pins the two together.
 */
export function eventVersionDocName(projectId, version) {
  return `projects/${projectId}/databases/(default)/documents/eventVersions/v${String(version).padStart(6, "0")}`;
}
/** When the given version was published. eventVersions is admin-only. */
export async function versionCreatedAt(projectId, version, env, fetchImpl) {
  const token = await getServiceAccountToken({
    email: trimmed(env.FIREBASE_ADMIN_CLIENT_EMAIL),
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/datastore"],
    label: "Monitor",
    fetchImpl,
  });
  const res = await fetchImpl(
    `https://firestore.googleapis.com/v1/${eventVersionDocName(projectId, version)}?mask.fieldPaths=createdAt`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok)
    throw new Error(`Show list version ${version} unavailable (${res.status})`);
  const createdAt = (await res.json()).fields?.createdAt?.stringValue;
  if (!Number.isFinite(Date.parse(createdAt ?? "")))
    throw new Error(`Show list version ${version} has no creation time`);
  return createdAt;
}
/**
 * Returns the published snapshot once production renders it. While a
 * rebuild is inside its grace period it rereads every 30 seconds instead of
 * skipping, so a stuck rebuild pages within this run and a skipped check can
 * never count as a passing one. Throws when production is stale or the
 * versions cannot be read.
 */
export async function requireEventsVersion(
  env = process.env,
  {
    fetchImpl = fetch,
    now = Date.now,
    sleep: wait = sleep,
    pollMs = EVENTS_POLL_MS,
  } = {},
) {
  const projectId = trimmed(env.FIREBASE_PROJECT_ID);
  if (!projectId || !PROJECT_ID.test(projectId))
    throw new Error("Firebase project for the show list is missing or invalid");
  const supersededAt = new Map();
  for (;;) {
    const [{ eventsVersion }, published] = await Promise.all([
      deployedVersion(fetchImpl),
      fetchPublishedEnvelope(projectId, { fetch: fetchImpl }),
    ]);
    if (!Number.isInteger(eventsVersion))
      throw new Error("Deployment show list version is invalid");
    if (!published) throw new Error("Published show list is missing");
    if (eventsVersion < published.version && !supersededAt.has(eventsVersion))
      supersededAt.set(
        eventsVersion,
        await versionCreatedAt(projectId, eventsVersion + 1, env, fetchImpl),
      );
    const state = decideEventsCheck({
      deployed: eventsVersion,
      published,
      supersededAt: supersededAt.get(eventsVersion),
      now: now(),
    });
    if (state === "check") return published.snapshot;
    if (state === "stale")
      throw new Error(
        `Site shows list version ${eventsVersion} but version ${published.version} was published at ${published.publishedAt}`,
      );
    await wait(pollMs);
  }
}
export async function desiredMain(env, fetchImpl = fetch) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "") ||
    !env.GITHUB_TOKEN
  )
    throw new Error("Version gate repository authentication is unavailable");
  const response = await fetchImpl(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/commits/main`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new Error(`Cannot check the desired release (${response.status})`);
  const { sha } = await response.json();
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Desired release is invalid");
  return sha;
}
export function decideGate({ sha, main, deployed, expired, ref }) {
  if (ref !== "refs/heads/main") return "invalid-ref";
  if (main !== sha) return "superseded";
  if (deployed === sha) return "ready";
  return expired ? "timeout" : "wait";
}
if (process.argv[1]?.endsWith("synthetic/deployment.mjs")) {
  const waiting = process.env.MONITOR_WAIT_FOR_DEPLOY === "true";
  const deadline = Date.now() + (waiting ? 28 * 60_000 : 0);
  for (;;) {
    try {
      const main = await desiredMain(process.env);
      let deployed = null;
      if (main === process.env.GITHUB_SHA) {
        try {
          deployed = await deployedCommit();
        } catch (error) {
          if (Date.now() >= deadline) throw error;
        }
      }
      const state = decideGate({
        sha: process.env.GITHUB_SHA,
        main,
        deployed,
        expired: Date.now() >= deadline,
        ref: process.env.GITHUB_REF,
      });
      if (state === "invalid-ref")
        throw new Error(
          "Run production monitoring from main, not a feature branch",
        );
      if (state === "timeout")
        throw new Error(
          "Deployment did not match the expected revision within the check window",
        );
      if (state === "ready" || state === "superseded") {
        if (!process.env.GITHUB_OUTPUT)
          throw new Error("Version gate output is unavailable");
        await appendFile(process.env.GITHUB_OUTPUT, `state=${state}\n`);
        break;
      }
    } catch (error) {
      if (
        Date.now() >= deadline ||
        process.env.GITHUB_REF !== "refs/heads/main"
      ) {
        console.error(error.message);
        process.exitCode = 1;
        break;
      }
    }
    await sleep(15_000);
  }
}
