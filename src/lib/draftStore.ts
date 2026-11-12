import {
  fsCreateWithId,
  fsGetMeta,
  fsPatchIfUnchanged,
  FsConflictError,
} from "@/lib/firestoreRest";

/**
 * Read-merge-write for one draft document with optimistic concurrency.
 *
 * Two requests for the same draft (autosave racing a photo confirm, a retry
 * racing the original) must never silently overwrite each other, so every
 * write is conditional on the document's updateTime and a lost race re-reads
 * and re-runs `build` against the fresh state.
 */

const MAX_ATTEMPTS = 6;

export interface UpsertOutcome {
  created: boolean;
  /** Document as it was before this write, null when it did not exist. */
  before: Record<string, unknown> | null;
  /** Document as it is after this write (before plus patch). */
  after: Record<string, unknown>;
  /** The patch that was written. */
  patch: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Apply a patch the way Firestore's updateMask does: every patch KEY is a mask
 * path. A dotted key sets that one nested field; a plain key whose value is a
 * map REPLACES the whole map at that path.
 * WHY not a deep merge of the expanded patch: `{ photos: { a: 1 } }` and
 * `{ "photos.a": 1 }` expand to the same object, so a merge kept the old
 * siblings of a replaced map that Firestore would have dropped, and the
 * predicted `after` diverged from what was stored.
 */
export function applyPatch(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out = structuredClone(before ?? {}) as Record<string, unknown>;
  for (const [path, value] of Object.entries(patch)) {
    const parts = path.split(".");
    let cursor = out;
    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      cursor = (isPlainObject(next) ? next : (cursor[part] = {})) as Record<
        string,
        unknown
      >;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}

/**
 * Create the document if it is missing, otherwise patch it. `build` receives
 * the current document (null when missing) and returns the patch (for a
 * missing document: the complete initial fields, dotted keys allowed). It runs
 * again on every lost race, so it must be pure.
 */
export async function upsertDoc(
  collectionPath: string,
  docId: string,
  build: (before: Record<string, unknown> | null) => Record<string, unknown>,
): Promise<UpsertOutcome> {
  const docPath = `${collectionPath}/${docId}`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const meta = await fsGetMeta(docPath);
    const patch = build(meta ? meta.fields : null);
    try {
      if (!meta) {
        await fsCreateWithId(collectionPath, docId, patch);
        return {
          created: true,
          before: null,
          after: applyPatch(null, patch),
          patch,
        };
      }
      if (Object.keys(patch).length > 0) {
        await fsPatchIfUnchanged(docPath, patch, meta.updateTime);
      }
      return {
        created: false,
        before: meta.fields,
        after: applyPatch(meta.fields, patch),
        patch,
      };
    } catch (err) {
      if (err instanceof FsConflictError) continue;
      throw err;
    }
  }
  throw new Error(
    `Draft ${docPath} could not be written after ${MAX_ATTEMPTS} attempts: concurrent writes kept changing it`,
  );
}
