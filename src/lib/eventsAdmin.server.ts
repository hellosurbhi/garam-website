/**
 * What the admin Shows routes do (issue 337, plan sections 5 and R2, R9,
 * R14, R15, R19): load, save the draft, publish, roll back and rebuild.
 *
 * All Firestore access goes through ./eventsStore.server and all validation
 * through ../data/eventsSnapshot; this module only sequences them, maps
 * failures to HTTP answers and asks Vercel for a rebuild. The route files
 * under src/pages/api/admin/events/ are thin wrappers around `runAdminRoute`.
 */
import type { APIContext } from "astro";
import { z } from "zod";
import { cities } from "../data/cities";
import {
  buildRollbackSnapshot,
  diffSnapshots,
  validateSnapshotAgainstLive,
  type EventsSnapshot,
  type SnapshotDiff,
  type SnapshotIssue,
} from "../data/eventsSnapshot";
import {
  commitPublication,
  listEventVersions,
  readEventVersion,
  readEventsDraft,
  readPublishedEvents,
  recordRebuildRequest,
  saveEventsDraft,
  type PublicationKind,
  type PublishedEvents,
  type Stored,
} from "./eventsStore.server";
import { readTrimmedEnv } from "./env";
import { CommitConflictError } from "./firestoreRest";
import { jsonResponse, parseJsonRequest } from "./http";
import { alertOps } from "./opsAlert";
import { verifyAdminIdentity, type AdminIdentity } from "./verifyToken";

/** Deploy hook deadline (plan section 5). */
const DEPLOY_HOOK_TIMEOUT_MS = 5_000;
/** Publish, Restore and Rebuild wait this long after a rebuild request (R15). */
export const REBUILD_DEBOUNCE_MS = 60_000;

const CONFLICT_MESSAGE = "The live version changed, reload";

/** A refusal the admin UI shows as is; never paged. */
export class EventsAdminError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "EventsAdminError";
  }
}

export type RebuildStatus = "requested" | "failed";

/** Field paths as "events.3.url", the key the editor matches inputs on. */
function issuesBody(issues: SnapshotIssue[]) {
  return issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
}

function invalidShows(issues: SnapshotIssue[]): EventsAdminError {
  return new EventsAdminError(400, "Some shows need fixing", {
    issues: issuesBody(issues),
  });
}

/**
 * Validate a candidate against live with every write rule (R12, R19).
 * WHY the city list is built here: eventsSnapshot.ts takes it as a
 * parameter so the client bundles that import events.ts never pull in every
 * city page's data; the server routes are the place that can afford it.
 */
function validateCandidate(
  next: unknown,
  live: EventsSnapshot,
  rollbackTarget?: EventsSnapshot,
): EventsSnapshot {
  const result = validateSnapshotAgainstLive(next, live, {
    knownCitySlugs: new Set(Object.keys(cities)),
    rollbackTarget,
  });
  if (!result.ok) throw invalidShows(result.issues);
  return result.snapshot;
}

function hasChanges(diff: SnapshotDiff): boolean {
  return Object.values(diff).some((slugs) => slugs.length > 0);
}

async function requireLive(): Promise<Stored<PublishedEvents>> {
  const live = await readPublishedEvents();
  if (!live) {
    // WHY 503 and not a page: the seed (plan section 7) has not run yet,
    // which is a rollout step, not an outage.
    throw new EventsAdminError(503, "Shows are not set up yet");
  }
  return live;
}

function requireVersion(expected: number, live: Stored<PublishedEvents>) {
  if (expected !== live.data.version) {
    throw new EventsAdminError(409, CONFLICT_MESSAGE, {
      liveVersion: live.data.version,
    });
  }
}

/** Refuse while a rebuild was requested under 60 s ago (R15). */
function requireRebuildSettled(live: PublishedEvents, now: Date): void {
  if (!live.rebuild) return;
  const waitMs =
    Date.parse(live.rebuild.requestedAt) + REBUILD_DEBOUNCE_MS - now.getTime();
  if (waitMs > 0) {
    throw new EventsAdminError(429, "A rebuild just started, try again soon", {
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    });
  }
}

const deployHookResponseSchema = z.object({
  job: z.object({ id: z.string() }),
});

/**
 * POST the Vercel deploy hook for `version` and record it on the live
 * pointer. Never throws: a failed rebuild must not undo a publish whose data
 * is already live for /api/go (plan section 5, step 3), so it pages instead
 * and the admin offers the Rebuild button.
 */
export async function requestRebuild(
  version: number,
  now: Date,
): Promise<RebuildStatus> {
  const hookUrl = readTrimmedEnv(import.meta.env.VERCEL_DEPLOY_HOOK);
  let jobId: string;
  try {
    if (!hookUrl) throw new Error("VERCEL_DEPLOY_HOOK is not set");
    const res = await fetch(hookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(DEPLOY_HOOK_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Deploy hook answered ${res.status}`);
    const body = deployHookResponseSchema.safeParse(await res.json());
    // WHY tolerate a missing job id: Vercel accepted the hook, so the build
    // is queued; the id only labels it.
    jobId = body.success ? body.data.job.id : "";
  } catch (err) {
    await alertOps({
      flow: "ops",
      stage: "events_rebuild",
      errorMessage: `Shows v${version} is live but the site rebuild was not requested: ${errorText(err)}`,
    });
    return "failed";
  }
  try {
    await recordRebuildRequest({
      requestedAt: now.toISOString(),
      jobId,
      version,
    });
  } catch (err) {
    // The build is queued either way; only the 60 s debounce record is lost.
    await alertOps({
      flow: "ops",
      stage: "events_rebuild_record",
      errorMessage: `Rebuild for shows v${version} requested but not recorded: ${errorText(err)}`,
    });
  }
  return "requested";
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Operations ───────────────────────────────────────────────────────────

/** Everything the Shows tab shows: live, draft with its pending changes, history. */
export async function loadEventsAdmin() {
  const [live, draft, history] = await Promise.all([
    requireLive(),
    readEventsDraft(),
    listEventVersions(),
  ]);
  return {
    live: live.data,
    draft: draft
      ? {
          ...draft.data,
          changes: diffSnapshots(live.data.snapshot, draft.data.snapshot),
        }
      : null,
    history,
  };
}

export const saveDraftBodySchema = z.object({
  snapshot: z.unknown(),
  basedOnVersion: z.number().int().min(1),
});

export async function saveDraft(
  body: z.infer<typeof saveDraftBodySchema>,
  admin: AdminIdentity,
) {
  const live = await requireLive();
  // WHY: a draft edited from an older live version would silently undo
  // whatever was published since; the editor must reload first.
  requireVersion(body.basedOnVersion, live);
  const snapshot = validateCandidate(body.snapshot, live.data.snapshot);
  const updatedAt = new Date().toISOString();
  await saveEventsDraft({
    snapshot,
    basedOnVersion: body.basedOnVersion,
    updatedAt,
    updatedBy: admin.email,
  });
  return {
    basedOnVersion: body.basedOnVersion,
    updatedAt,
    updatedBy: admin.email,
    changes: diffSnapshots(live.data.snapshot, snapshot),
  };
}

const noteSchema = z.string().trim().min(1).max(500);
const versionSchema = z.number().int().min(1);

export const publishBodySchema = z.object({
  expectedVersion: versionSchema,
  note: noteSchema,
});

export const rollbackBodySchema = z.object({
  targetVersion: versionSchema,
  expectedVersion: versionSchema,
  note: noteSchema,
});

interface CommitInput {
  live: Stored<PublishedEvents>;
  draftUpdateTime: string | undefined;
  action: PublicationKind;
  snapshot: EventsSnapshot;
  note: string;
  admin: AdminIdentity;
  now: Date;
}

/** Commit a validated snapshot as the next version, then ask for a rebuild. */
async function publishSnapshot(input: CommitInput) {
  const changes = diffSnapshots(input.live.data.snapshot, input.snapshot);
  if (!hasChanges(changes)) {
    throw new EventsAdminError(400, "Nothing changed since the live version");
  }
  const version = await commitPublication({
    live: {
      version: input.live.data.version,
      updateTime: input.live.updateTime,
    },
    // WHY exists:false when there is no draft: the commit then creates it
    // and still fails if another admin created one in the meantime.
    draftPrecondition: input.draftUpdateTime
      ? { updateTime: input.draftUpdateTime }
      : { exists: false },
    action: input.action,
    snapshot: input.snapshot,
    changes,
    note: input.note,
    author: input.admin,
    now: input.now,
  });
  const rebuild = await requestRebuild(version, input.now);
  return { version, rebuild, changes };
}

export async function publishDraft(
  body: z.infer<typeof publishBodySchema>,
  admin: AdminIdentity,
) {
  const now = new Date();
  const [live, draft] = await Promise.all([requireLive(), readEventsDraft()]);
  requireVersion(body.expectedVersion, live);
  requireRebuildSettled(live.data, now);
  if (!draft) throw new EventsAdminError(409, "There is no draft to publish");
  requireVersion(draft.data.basedOnVersion, live);
  const snapshot = validateCandidate(draft.data.snapshot, live.data.snapshot);
  return publishSnapshot({
    live,
    // WHY lock on the draft too: an edit saved between this read and the
    // commit would otherwise be marked published without ever going live.
    draftUpdateTime: draft.updateTime,
    action: { kind: "publish" },
    snapshot,
    note: body.note,
    admin,
    now,
  });
}

export async function rollbackTo(
  body: z.infer<typeof rollbackBodySchema>,
  admin: AdminIdentity,
) {
  const now = new Date();
  const [live, draft] = await Promise.all([requireLive(), readEventsDraft()]);
  requireVersion(body.expectedVersion, live);
  requireRebuildSettled(live.data, now);
  if (body.targetVersion >= live.data.version) {
    throw new EventsAdminError(400, "Pick an earlier version to restore");
  }
  const target = await readEventVersion(body.targetVersion);
  if (!target) {
    throw new EventsAdminError(404, `Version ${body.targetVersion} not found`);
  }
  const candidate = buildRollbackSnapshot(
    live.data.snapshot,
    target.data.snapshot,
    body.targetVersion,
    body.note,
  );
  const snapshot = validateCandidate(
    candidate,
    live.data.snapshot,
    target.data.snapshot,
  );
  return publishSnapshot({
    live,
    draftUpdateTime: draft?.updateTime,
    action: { kind: "rollback", restoresVersion: body.targetVersion },
    snapshot,
    note: body.note,
    admin,
    now,
  });
}

export async function rebuildLive() {
  const now = new Date();
  const live = await requireLive();
  requireRebuildSettled(live.data, now);
  const rebuild = await requestRebuild(live.data.version, now);
  return { version: live.data.version, rebuild };
}

// ── Route plumbing ───────────────────────────────────────────────────────

type AdminHandler = (
  admin: AdminIdentity,
  context: APIContext,
) => Promise<Response>;

/**
 * Admin auth plus one error mapping for every Shows route:
 * EventsAdminError -> its status; CommitConflictError -> 409 (R9);
 * anything else -> 502 and a page, because Firestore or the network failed.
 */
export async function runAdminRoute(
  context: APIContext,
  stage: string,
  handler: AdminHandler,
): Promise<Response> {
  const admin = await verifyAdminIdentity(
    context.request.headers.get("authorization") ?? undefined,
  );
  if (!admin) return jsonResponse({ error: "Unauthorized" }, 401);
  try {
    return await handler(admin, context);
  } catch (err) {
    if (err instanceof EventsAdminError) {
      return jsonResponse({ error: err.message, ...err.extra }, err.status);
    }
    if (err instanceof CommitConflictError) {
      return jsonResponse({ error: CONFLICT_MESSAGE }, 409);
    }
    await alertOps({
      flow: "ops",
      stage,
      errorMessage: errorText(err),
      context: { admin: admin.email },
    });
    return jsonResponse(
      { error: "Could not reach the show data, try again" },
      502,
    );
  }
}

/** A JSON-body admin route: parse with `schema` (400 with field errors), then run. */
export function adminJsonRoute<TSchema extends z.ZodType>(
  stage: string,
  schema: TSchema,
  run: (body: z.infer<TSchema>, admin: AdminIdentity) => Promise<unknown>,
) {
  return (context: APIContext) =>
    runAdminRoute(context, stage, async (admin) => {
      const parsed = await parseJsonRequest(context.request, schema);
      if (!parsed.success) return parsed.response;
      return jsonResponse(await run(parsed.data, admin));
    });
}
