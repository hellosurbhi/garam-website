/**
 * One-time seed of the admin Shows tab (issue 337, plan section 7 step 3).
 *
 *   npm run events:seed               # dry run: prints what it would write
 *   npm run events:seed -- --execute  # writes, then reads it back publicly
 *
 * Writes version 1 from the committed src/data/events.published.json in one
 * atomic commit: `eventVersions/v000001` (kind "migration"),
 * `eventsPublished/current` and `eventsDraft/current`. Every write requires
 * its document not to exist, so a second run (or a seed after the first
 * publish) changes nothing and fails. Seeded v1 equals the committed
 * baseline, so the first production build after merge is a data no-op.
 *
 * Needs PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and
 * FIREBASE_ADMIN_PRIVATE_KEY (from .env.local). Run it only with the
 * owner's go-ahead, after the Firestore rules are deployed.
 *
 * WHY a plain script that rebuilds the commit body instead of importing
 * src/lib/eventsStore.server.ts: those modules read Astro's import.meta.env,
 * which plain Node does not have. scripts/seed-events-firestore.test.ts
 * pins this body byte for byte to what the admin's own publish path
 * (buildPublicationWrites + fsCommit) sends for the same version, so the
 * two cannot drift.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { getServiceAccountToken } from "./lib/google-access-token.mjs";
import {
  OUTPUT_PATH as BASELINE_PATH,
  fetchPublishedEnvelope,
} from "./fetch-published-events.mjs";

export const SEED_AUTHOR = "seed-script";
export const SEED_NOTE =
  "Imported from src/data/events.ts when the Shows tab launched (issue 337)";

/** Firestore REST value for the plain JSON the seed writes. */
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}

function toFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toValue(v)]),
  );
}

export function documentsRoot(projectId) {
  if (!/^[a-z0-9-]+$/.test(projectId ?? "")) {
    throw new Error("PUBLIC_FIREBASE_PROJECT_ID is missing or invalid");
  }
  return `projects/${projectId}/databases/(default)/documents`;
}

/** The `:commit` body that creates version 1 from `snapshot`. */
export function seedCommitBody(root, snapshot, now) {
  const at = now.toISOString();
  const snapshotJson = JSON.stringify(snapshot);
  const noChanges = {
    added: [],
    changed: [],
    canceled: [],
    tbaCitiesAdded: [],
    tbaCitiesChanged: [],
    tbaCitiesRemoved: [],
  };
  const writes = [
    {
      docPath: "eventVersions/v000001",
      fields: {
        version: 1,
        kind: "migration",
        snapshotJson,
        note: SEED_NOTE,
        authorUid: SEED_AUTHOR,
        authorEmail: SEED_AUTHOR,
        createdAt: at,
        changes: noChanges,
      },
    },
    {
      docPath: "eventsPublished/current",
      fields: { version: 1, snapshotJson, publishedAt: at, rebuild: null },
    },
    {
      docPath: "eventsDraft/current",
      fields: {
        basedOnVersion: 1,
        snapshotJson,
        updatedAt: at,
        updatedBy: SEED_AUTHOR,
      },
      merge: true,
    },
  ];
  return {
    writes: writes.map((w) => ({
      update: { name: `${root}/${w.docPath}`, fields: toFields(w.fields) },
      ...(w.merge ? { updateMask: { fieldPaths: Object.keys(w.fields) } } : {}),
      currentDocument: { exists: false },
    })),
  };
}

/** The committed baseline envelope; refuses anything but version 1. */
export async function readBaseline(path = BASELINE_PATH) {
  const envelope = JSON.parse(await readFile(path, "utf8"));
  if (
    envelope?.version !== 1 ||
    !Array.isArray(envelope.snapshot?.events) ||
    !Array.isArray(envelope.snapshot?.tbaCities)
  ) {
    throw new Error(`${path} is not the version 1 baseline`);
  }
  return envelope;
}

export async function main(
  argv = process.argv.slice(2),
  env = process.env,
  { fetchImpl = fetch, log = console.log, now = () => new Date() } = {},
) {
  const execute = argv.includes("--execute");
  const projectId = env.PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const root = documentsRoot(projectId);
  const { snapshot } = await readBaseline();
  const body = seedCommitBody(root, snapshot, now());
  log(
    `[seed] ${execute ? "Writing" : "Dry run, would write"} version 1 to ${projectId}: ${snapshot.events.length} shows, ${snapshot.tbaCities.length} cities, documents ${body.writes.map((w) => w.update.name.slice(root.length + 1)).join(", ")}.`,
  );
  if (!execute) {
    log("[seed] Nothing written. Add --execute to write.");
    return 0;
  }

  const email = env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error(
      "FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY is not set",
    );
  }
  const token = await getServiceAccountToken({
    email,
    privateKey,
    scopes: ["https://www.googleapis.com/auth/datastore"],
    label: "Seed",
    fetchImpl,
  });
  const res = await fetchImpl(
    `https://firestore.googleapis.com/v1/${root}:commit`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    if (/FAILED_PRECONDITION|ALREADY_EXISTS/.test(text)) {
      throw new Error(
        "Already seeded: a show list document exists, so nothing was written",
      );
    }
    throw new Error(`Seed commit failed (HTTP ${res.status})`);
  }

  // The build and the monitor read the public document with no
  // credentials; prove that path returns exactly what was seeded.
  const published = await fetchPublishedEnvelope(projectId, {
    fetch: fetchImpl,
  });
  if (
    published?.version !== 1 ||
    JSON.stringify(published.snapshot) !== JSON.stringify(snapshot)
  ) {
    throw new Error(
      "Seeded, but the public read did not return version 1 as written (are the Firestore rules deployed?)",
    );
  }
  log(
    `[seed] Done. Public read returns version 1 with ${published.snapshot.events.length} shows.`,
  );
  return 0;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[seed] ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    },
  );
}

export const SCRIPT_PATH = fileURLToPath(import.meta.url);
