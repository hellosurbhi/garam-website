import { appendFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fetchPublishedEnvelope } from "../fetch-published-events.mjs";
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
/**
 * Plan R10: the ticket checks compare the live page with the show list the
 * deployment was built from. A publish starts a rebuild, so for a while the
 * site is one version behind: "check" when they match, "wait" while the
 * newer version is under 20 minutes old, "stale" after that (a failed or
 * stuck rebuild must page). The admin status strip uses the same 20 minutes.
 */
export function decideEventsCheck({ deployed, published, now }) {
  if (deployed === published.version) return "check";
  const age = now - Date.parse(published.publishedAt);
  return deployed < published.version && age < REBUILD_GRACE_MS
    ? "wait"
    : "stale";
}
/**
 * Returns the published snapshot to check the live site against, or null
 * while a rebuild is still within its grace period. Throws when production
 * is stale or the versions cannot be read.
 */
export async function requireEventsVersion(
  projectId,
  { fetchImpl = fetch, now = Date.now() } = {},
) {
  if (!projectId) throw new Error("Firebase project for the show list is missing");
  const [{ eventsVersion }, published] = await Promise.all([
    deployedVersion(fetchImpl),
    fetchPublishedEnvelope(projectId, { fetch: fetchImpl }),
  ]);
  if (!Number.isInteger(eventsVersion))
    throw new Error("Deployment show list version is invalid");
  if (!published) throw new Error("Published show list is missing");
  const state = decideEventsCheck({ deployed: eventsVersion, published, now });
  if (state === "stale")
    throw new Error(
      `Site shows list version ${eventsVersion} but version ${published.version} was published at ${published.publishedAt}`,
    );
  return state === "check" ? published.snapshot : null;
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
