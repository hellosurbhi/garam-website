/**
 * Read the published show list from Firestore `eventsPublished/current`
 * (issue 337). The document is public-read, so this needs only the project
 * id, never a credential.
 *
 * On main this module is used only by the seed script
 * (scripts/seed-events-firestore.mjs), which calls fetchPublishedEnvelope to
 * prove the public read returns what it wrote, and reads OUTPUT_PATH, the
 * committed baseline src/data/events.published.json. The build integration
 * that renders the site from this file, the `npm run events:pull` command and
 * the runtime check that shares requiresLiveEventsRead arrive with PR 366
 * (https://github.com/hellosurbhi/garam-website/pull/366); nothing on main
 * calls the prebuild or --pull modes below yet, and the build is unchanged.
 *
 * Modes (used once PR 366 wires them in):
 *   prebuild (no flag): fetches on Vercel builds only. CI and local builds
 *     keep the committed baseline, so a build never rewrites a tracked file.
 *   --pull: fetches anywhere and rewrites the committed baseline, for a PR
 *     that should carry the latest list.
 *
 * Failure policy: a production build fails closed and pages ops; every other
 * build keeps the committed baseline and says so.
 *
 * WHY plain .mjs that only transports: src/ modules use extensionless
 * imports and import.meta.env, which plain Node cannot load, so the full zod
 * validation is meant to run once, in TypeScript, where PR 366 parses this
 * file. Here we check only the envelope's shape.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OUTPUT_PATH = fileURLToPath(
  new URL("../src/data/events.published.json", import.meta.url),
);
export const ATTEMPTS = 3;
export const TIMEOUT_MS = 10_000;
const ALERT_URL = "https://garammasaladating.com/api/alert-failure";

class FetchFailure extends Error {
  constructor(message, { retry }) {
    super(message);
    this.retry = retry;
  }
}

/** The public REST URL of the published pointer document. */
export function publishedDocUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/eventsPublished/current`;
}

/**
 * Turn the REST document into the `{ version, publishedAt, snapshot }`
 * envelope the build reads. Throws on any shape the build could not use.
 */
export function toEnvelope(doc) {
  const fields = doc?.fields ?? {};
  const version = Number(fields.version?.integerValue);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("published document has no positive integer version");
  }
  const publishedAt =
    fields.publishedAt?.stringValue ?? fields.publishedAt?.timestampValue;
  if (typeof publishedAt !== "string") {
    throw new Error("published document has no publishedAt");
  }
  const json = fields.snapshotJson?.stringValue;
  if (typeof json !== "string") {
    throw new Error("published document has no snapshotJson");
  }
  const snapshot = JSON.parse(json);
  if (
    !snapshot ||
    !Array.isArray(snapshot.events) ||
    !Array.isArray(snapshot.tbaCities)
  ) {
    throw new Error("snapshotJson is not an { events, tbaCities } snapshot");
  }
  return { version, publishedAt, snapshot };
}

/**
 * Read the published envelope, or null when nothing is published (404).
 * Retries timeouts, network errors (including while reading the body), 429
 * and 5xx; any other answer (403 when
 * the rules are not deployed, a malformed body) fails at once.
 */
export async function fetchPublishedEnvelope(
  projectId,
  { fetch = globalThis.fetch, sleep = defaultSleep } = {},
) {
  const url = publishedDocUrl(projectId);
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      let res;
      try {
        res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (error) {
        throw new FetchFailure(`request failed: ${errorText(error)}`, {
          retry: true,
        });
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new FetchFailure(`HTTP ${res.status}`, {
          retry: res.status === 429 || res.status >= 500,
        });
      }
      // WHY read the body inside the retry: a connection reset or timeout
      // while the body streams is as transient as one before the headers.
      let body;
      try {
        body = await res.text();
      } catch (error) {
        throw new FetchFailure(
          `reading the response failed: ${errorText(error)}`,
          {
            retry: true,
          },
        );
      }
      return toEnvelope(JSON.parse(body));
    } catch (error) {
      lastError = error;
      if (!(error instanceof FetchFailure) || !error.retry) break;
      if (attempt < ATTEMPTS) await sleep(attempt * 1_000);
    }
  }
  throw lastError;
}

function defaultSleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function pageOps(errorMessage, fetch) {
  await fetch(ALERT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://garammasaladating.com",
    },
    body: JSON.stringify({ flow: "ops", stage: "events_fetch", errorMessage }),
  }).catch(() => {
    // The failed Vercel build is the backup channel.
  });
}

/**
 * The ONE rule for "does this build read Firestore or use the committed
 * baseline". The prebuild (run, below) and, once PR 366 lands, the postbuild
 * runtime check (check-server-runtime.mjs, through requiresLiveEventsRead)
 * both call it, so they cannot disagree: a preview without a project id used
 * the baseline here while the runtime check still demanded a live read and
 * failed the build.
 *
 *   not a Vercel build, not --pull        -> baseline
 *   no project id, production or --pull   -> error (fail loudly, never
 *                                            ship the baseline silently)
 *   no project id, any other Vercel build -> baseline
 *   project id present                    -> firestore
 */
export function eventsSource(env, { pull = false } = {}) {
  // WHY not fetch in CI and local builds: the output is a tracked file, and
  // a build that rewrites it leaves a diff nobody asked for. CI has no
  // project id anyway. `--pull` (the events:pull command in PR 366) is the deliberate refresh.
  if (!pull && !env.VERCEL) {
    return {
      source: "baseline",
      reason: "Not a Vercel build (run npm run events:pull to refresh)",
    };
  }
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    // WHY fail closed only in production: see the failure policy above.
    if (env.VERCEL_ENV === "production" || pull) {
      return {
        source: "error",
        reason: "PUBLIC_FIREBASE_PROJECT_ID is not set",
      };
    }
    return {
      source: "baseline",
      reason: "No PUBLIC_FIREBASE_PROJECT_ID in this build",
    };
  }
  return { source: "firestore", projectId };
}

/**
 * Whether the packaged server must have read Firestore at runtime. Throws
 * when the build should already have stopped (production, no project id).
 */
export function requiresLiveEventsRead(env) {
  const decision = eventsSource(env);
  if (decision.source === "error") throw new Error(decision.reason);
  return decision.source === "firestore";
}

/**
 * Run the prebuild or pull and return the process exit code. Fetch
 * problems become an exit code; only a failed file write throws.
 * Every side effect is injectable for tests.
 */
export async function run({
  argv = process.argv.slice(2),
  env = process.env,
  fetch = globalThis.fetch,
  sleep = defaultSleep,
  write = writeFile,
  log = console.log,
  error = console.error,
} = {}) {
  const pull = argv.includes("--pull");
  const production = env.VERCEL_ENV === "production";
  const keepBaseline = (reason) =>
    log(`[events] ${reason}. Building from the committed show list.`);

  const decision = eventsSource(env, { pull });
  const fail = async (message) => {
    error(`[events] ${message}`);
    if (production) {
      await pageOps(
        `Production build stopped: ${message}. The last deployment stays live with the last published shows. Fix the cause, then press Rebuild in the admin Shows tab.`,
        fetch,
      );
    }
    return 1;
  };
  if (decision.source === "baseline") {
    keepBaseline(decision.reason);
    return 0;
  }
  if (decision.source === "error") return fail(decision.reason);
  const { projectId } = decision;

  let envelope;
  try {
    envelope = await fetchPublishedEnvelope(projectId, { fetch, sleep });
  } catch (cause) {
    const message = `Could not read the published show list: ${errorText(cause)}`;
    // WHY a production build fails instead of using the baseline (see the
    // failure policy above): Vercel keeps the last successful deployment live,
    // and it already carries the last published shows. Falling back to the
    // committed baseline would silently roll the site back to whatever list
    // was last committed, undoing every publish since.
    if (production || pull) return fail(message);
    keepBaseline(message);
    return 0;
  }

  if (!envelope) {
    // WHY production fails on a missing document: the rollout order (seed
    // first, then merge PR 366) seeds eventsPublished/current BEFORE this merges, so
    // a production build never legitimately finds it missing. Missing means
    // it was deleted or the project id points at an unseeded database, and
    // building from the committed baseline would bring back canceled shows
    // and old checkout links without anyone noticing.
    const message =
      "No published show list in Firestore (eventsPublished/current is missing)";
    if (production || pull) return fail(message);
    keepBaseline(message);
    return 0;
  }

  await write(OUTPUT_PATH, `${JSON.stringify(envelope, null, 2)}\n`);
  log(
    `[events] Wrote published version ${envelope.version} (${envelope.snapshot.events.length} shows, published ${envelope.publishedAt}).`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  process.exitCode = await run();
}
