/**
 * Firestore persistence for the admin Shows tab (issue 337, plan section 2).
 *
 * Three documents hold all show data:
 *  - `eventsPublished/current`: the live snapshot and its version number
 *    (public read; the build and the runtime read it with no credentials);
 *  - `eventVersions/v000012`: one immutable record per published version
 *    (who, when, why, what changed, full snapshot copy);
 *  - `eventsDraft/current`: the single shared work-in-progress snapshot.
 *
 * Clients never write any of them (firestore.rules); every write goes through
 * this module with the service account. Business validation lives in
 * src/data/eventsSnapshot.ts and runs before anything here is called.
 */
import { z } from "zod";
import {
  eventsSnapshotSchema,
  publishedEnvelopeSchema,
  type EventsSnapshot,
  type SnapshotDiff,
} from "../data/eventsSnapshot";
import {
  fsCommit,
  fsGetDocument,
  fsGetPublic,
  fsPatch,
  fsQueryOrdered,
  type FsDocument,
  type FsPrecondition,
  type FsWrite,
} from "./firestoreRest";

export const EVENTS_PUBLISHED_PATH = "eventsPublished/current";
export const EVENTS_DRAFT_PATH = "eventsDraft/current";
export const EVENT_VERSIONS_COLLECTION = "eventVersions";

/**
 * `eventVersions/v000012`. WHY zero-padded: Firestore orders document ids
 * lexically, so unpadded ids would sort v10 before v9 in the console and in
 * any id-ordered listing. Six digits outlast any realistic publish count.
 */
export function eventVersionDocPath(version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid events version: ${version}`);
  }
  return `${EVENT_VERSIONS_COLLECTION}/v${String(version).padStart(6, "0")}`;
}

// WHY the snapshot is stored as a JSON string (plan section 2): it is an
// opaque artifact that must be byte-identical for the build, the runtime and
// the monitor, and a string field lets the credential-free scripts read it
// without a Firestore typed-value decoder. It is parsed and validated with
// the one shared schema on every read.
const snapshotJsonSchema = z
  .string()
  .transform((json, ctx): unknown => {
    try {
      return JSON.parse(json);
    } catch {
      ctx.addIssue({ code: "custom", message: "snapshotJson is not JSON" });
      return z.NEVER;
    }
  })
  .pipe(eventsSnapshotSchema);

const versionNumberSchema = publishedEnvelopeSchema.shape.version;
const isoSchema = publishedEnvelopeSchema.shape.publishedAt;

const rebuildSchema = z.object({
  requestedAt: isoSchema,
  jobId: z.string(),
  version: versionNumberSchema,
});

const publishedDocSchema = z
  .object({
    version: versionNumberSchema,
    snapshotJson: snapshotJsonSchema,
    publishedAt: isoSchema,
    rebuild: rebuildSchema.nullable(),
  })
  .transform(({ snapshotJson, ...rest }) => ({
    ...rest,
    snapshot: snapshotJson,
  }));

const changesSchema = z.object({
  added: z.array(z.string()),
  changed: z.array(z.string()),
  canceled: z.array(z.string()),
  tbaCitiesAdded: z.array(z.string()),
  tbaCitiesRemoved: z.array(z.string()),
}) satisfies z.ZodType<SnapshotDiff>;

/** A version record without its snapshot: what the History panel lists. */
const versionSummarySchema = z.object({
  version: versionNumberSchema,
  kind: z.enum(["migration", "publish", "rollback"]),
  restoresVersion: versionNumberSchema.optional(),
  note: z.string().min(1),
  authorUid: z.string().min(1),
  authorEmail: z.string(),
  createdAt: isoSchema,
  changes: changesSchema,
});

const versionDocSchema = versionSummarySchema
  .extend({ snapshotJson: snapshotJsonSchema })
  .transform(({ snapshotJson, ...rest }) => ({
    ...rest,
    snapshot: snapshotJson,
  }));

const draftDocSchema = z
  .object({
    snapshotJson: snapshotJsonSchema,
    basedOnVersion: versionNumberSchema,
    updatedAt: isoSchema,
    updatedBy: z.string(),
  })
  .transform(({ snapshotJson, ...rest }) => ({
    ...rest,
    snapshot: snapshotJson,
  }));

export type RebuildRequest = z.infer<typeof rebuildSchema>;
export type PublishedEvents = z.infer<typeof publishedDocSchema>;
export type EventVersionRecord = z.infer<typeof versionDocSchema>;
export type EventVersionSummary = z.infer<typeof versionSummarySchema>;
export type EventsDraft = z.infer<typeof draftDocSchema>;

/** A parsed document plus the `updateTime` a later commit locks on. */
export interface Stored<T> {
  data: T;
  updateTime: string;
}

function parseStored<T>(
  doc: FsDocument | null,
  schema: z.ZodType<T>,
): Stored<T> | null {
  return doc
    ? { data: schema.parse(doc.fields), updateTime: doc.updateTime }
    : null;
}

/** Live snapshot via the service account (admin routes). Throws on bad data. */
export async function readPublishedEvents(
  signal?: AbortSignal,
): Promise<Stored<PublishedEvents> | null> {
  const doc = await fsGetDocument(EVENTS_PUBLISHED_PATH, signal);
  return parseStored(doc, publishedDocSchema);
}

/** Live snapshot with no credentials (runtime loader). Throws on bad data. */
export async function readPublishedEventsPublic(
  signal?: AbortSignal,
): Promise<Stored<PublishedEvents> | null> {
  const doc = await fsGetPublic(EVENTS_PUBLISHED_PATH, signal);
  return parseStored(doc, publishedDocSchema);
}

export async function readEventsDraft(
  signal?: AbortSignal,
): Promise<Stored<EventsDraft> | null> {
  const doc = await fsGetDocument(EVENTS_DRAFT_PATH, signal);
  return parseStored(doc, draftDocSchema);
}

export async function readEventVersion(
  version: number,
  signal?: AbortSignal,
): Promise<Stored<EventVersionRecord> | null> {
  const doc = await fsGetDocument(eventVersionDocPath(version), signal);
  return parseStored(doc, versionDocSchema);
}

/** How many versions the History panel shows (plan section 6). */
export const VERSION_HISTORY_LIMIT = 20;

/**
 * The newest versions first, without their snapshots.
 * WHY a projection: each record carries a full snapshot copy (about 25 KB
 * today), which the list never shows; Restore reads the one it needs.
 */
export async function listEventVersions(
  signal?: AbortSignal,
): Promise<EventVersionSummary[]> {
  const rows = await fsQueryOrdered(
    {
      collectionId: EVENT_VERSIONS_COLLECTION,
      orderBy: "version",
      direction: "DESCENDING",
      limit: VERSION_HISTORY_LIMIT,
      select: Object.keys(versionSummarySchema.shape),
    },
    signal,
  );
  return rows.map((row) => versionSummarySchema.parse(row.fields));
}

/**
 * Save the shared draft. Last writer wins by design (plan section 10, risk
 * 5): two admins share one draft, and publish is still guarded atomically.
 */
export async function saveEventsDraft(
  draft: EventsDraft,
  signal?: AbortSignal,
): Promise<void> {
  const { snapshot, ...rest } = draft;
  await fsPatch(
    EVENTS_DRAFT_PATH,
    { ...rest, snapshotJson: JSON.stringify(snapshot) },
    signal,
  );
}

/** Record that a rebuild was requested for the live version. */
export async function recordRebuildRequest(
  rebuild: RebuildRequest,
  signal?: AbortSignal,
): Promise<void> {
  await fsPatch(EVENTS_PUBLISHED_PATH, { rebuild }, signal);
}

export type PublicationKind =
  { kind: "publish" } | { kind: "rollback"; restoresVersion: number };

export interface Publication {
  /** The live version and its `updateTime`, exactly as read before validating. */
  live: { version: number; updateTime: string };
  /** Guards the draft write: the draft's `updateTime` for a publish. */
  draftPrecondition: FsPrecondition;
  action: PublicationKind;
  snapshot: EventsSnapshot;
  changes: SnapshotDiff;
  note: string;
  author: { uid: string; email: string };
  now: Date;
}

/**
 * The three writes of one publish or rollback (plan section 5 and R2):
 *  1. create `eventVersions/v{n+1}`, which must not exist yet;
 *  2. replace `eventsPublished/current`, only if it is unchanged since read;
 *  3. advance the draft's `basedOnVersion` (a rollback also resets the
 *     draft's content to the restored snapshot).
 * Committed together, two racing publishers cannot both win: the loser's
 * preconditions fail and nothing of theirs lands.
 */
export function buildPublicationWrites(p: Publication): FsWrite[] {
  const version = p.live.version + 1;
  const snapshotJson = JSON.stringify(p.snapshot);
  const at = p.now.toISOString();
  const record: Record<string, unknown> = {
    version,
    kind: p.action.kind,
    ...(p.action.kind === "rollback"
      ? { restoresVersion: p.action.restoresVersion }
      : {}),
    snapshotJson,
    note: p.note,
    authorUid: p.author.uid,
    authorEmail: p.author.email,
    createdAt: at,
    changes: p.changes,
  };
  const draftFields: Record<string, unknown> =
    p.action.kind === "rollback"
      ? {
          basedOnVersion: version,
          snapshotJson,
          updatedAt: at,
          updatedBy: p.author.email,
        }
      : { basedOnVersion: version };
  return [
    {
      docPath: eventVersionDocPath(version),
      fields: record,
      precondition: { exists: false },
    },
    {
      docPath: EVENTS_PUBLISHED_PATH,
      fields: { version, snapshotJson, publishedAt: at, rebuild: null },
      precondition: { updateTime: p.live.updateTime },
    },
    {
      docPath: EVENTS_DRAFT_PATH,
      fields: draftFields,
      merge: true,
      precondition: p.draftPrecondition,
    },
  ];
}

/**
 * Commit a publish or rollback atomically and return the new live version.
 * Throws CommitConflictError (from firestoreRest) when the live version or
 * the draft changed since they were read.
 */
export async function commitPublication(
  p: Publication,
  signal?: AbortSignal,
): Promise<number> {
  await fsCommit(buildPublicationWrites(p), signal);
  return p.live.version + 1;
}
