// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import published from "../data/events.published.json";
import { diffSnapshots, type EventsSnapshot } from "../data/eventsSnapshot";
import type { FsDocument } from "./firestoreRest";

const fsGetDocument = vi.fn<(path: string) => Promise<FsDocument | null>>();
const fsGetPublic = vi.fn<(path: string) => Promise<FsDocument | null>>();
const fsCommit = vi.fn();
const fsPatch = vi.fn();
const fsQueryOrdered = vi.fn();

vi.mock("./firestoreRest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./firestoreRest")>()),
  fsGetDocument: (path: string) => fsGetDocument(path),
  fsGetPublic: (path: string) => fsGetPublic(path),
  fsCommit: (...args: unknown[]) => fsCommit(...args),
  fsPatch: (...args: unknown[]) => fsPatch(...args),
  fsQueryOrdered: (...args: unknown[]) => fsQueryOrdered(...args),
}));

const {
  buildPublicationWrites,
  commitPublication,
  eventVersionDocPath,
  listEventVersions,
  readEventVersion,
  readEventsDraft,
  readPublishedEvents,
  readPublishedEventsPublic,
  recordRebuildRequest,
  saveEventsDraft,
  EVENTS_DRAFT_PATH,
  EVENTS_PUBLISHED_PATH,
} = await import("./eventsStore.server");
const { CommitConflictError } = await import("./firestoreRest");

const snapshot = published.snapshot as EventsSnapshot;
const NOW = new Date("2026-11-11T12:00:00.000Z");
const UPDATE_TIME = "2026-11-11T11:00:00.000001Z";

function withEditedTagline(base: EventsSnapshot): EventsSnapshot {
  const [first, ...rest] = base.events;
  return { ...base, events: [{ ...first, tagline: "Fixture edit" }, ...rest] };
}

function publication(
  action: Parameters<typeof buildPublicationWrites>[0]["action"],
) {
  const next = withEditedTagline(snapshot);
  return {
    live: { version: 4, updateTime: UPDATE_TIME },
    draftPrecondition: { updateTime: "2026-11-11T11:30:00Z" },
    action,
    snapshot: next,
    changes: diffSnapshots(snapshot, next),
    note: "Fixture publish",
    author: { uid: "admin-uid", email: "admin@example.test" },
    now: NOW,
  };
}

beforeEach(() => {
  fsGetDocument.mockReset();
  fsGetPublic.mockReset();
  fsCommit.mockReset();
  fsPatch.mockReset();
  fsQueryOrdered.mockReset();
});

describe("eventVersionDocPath", () => {
  it("zero-pads so ids sort in version order", () => {
    expect(eventVersionDocPath(12)).toBe("eventVersions/v000012");
    expect(eventVersionDocPath(9) < eventVersionDocPath(10)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects %s", (bad) => {
    expect(() => eventVersionDocPath(bad)).toThrow("Invalid events version");
  });
});

describe("buildPublicationWrites", () => {
  it("creates the next version, swaps the pointer and advances the draft", () => {
    const p = publication({ kind: "publish" });
    const writes = buildPublicationWrites(p);
    const snapshotJson = JSON.stringify(p.snapshot);

    expect(writes).toEqual([
      {
        docPath: "eventVersions/v000005",
        precondition: { exists: false },
        fields: {
          version: 5,
          kind: "publish",
          snapshotJson,
          note: "Fixture publish",
          authorUid: "admin-uid",
          authorEmail: "admin@example.test",
          createdAt: NOW.toISOString(),
          changes: p.changes,
        },
      },
      {
        docPath: EVENTS_PUBLISHED_PATH,
        precondition: { updateTime: UPDATE_TIME },
        fields: {
          version: 5,
          snapshotJson,
          publishedAt: NOW.toISOString(),
          rebuild: null,
        },
      },
      {
        docPath: EVENTS_DRAFT_PATH,
        merge: true,
        precondition: { updateTime: "2026-11-11T11:30:00Z" },
        fields: { basedOnVersion: 5 },
      },
    ]);
    expect(p.changes.changed).toEqual([snapshot.events[0].slug]);
  });

  it("records the restored version and resets the draft on rollback", () => {
    const p = publication({ kind: "rollback", restoresVersion: 2 });
    const [record, , draft] = buildPublicationWrites(p);
    expect(record.fields).toMatchObject({
      kind: "rollback",
      restoresVersion: 2,
    });
    expect(draft.fields).toEqual({
      basedOnVersion: 5,
      snapshotJson: JSON.stringify(p.snapshot),
      updatedAt: NOW.toISOString(),
      updatedBy: "admin@example.test",
    });
  });

  it("writes documents the readers parse back to the same snapshot", async () => {
    const p = publication({ kind: "rollback", restoresVersion: 2 });
    const [record, pointer, draft] = buildPublicationWrites(p);
    const asDoc = (fields: Record<string, unknown>) => ({
      fields,
      updateTime: UPDATE_TIME,
    });

    fsGetDocument.mockResolvedValueOnce(asDoc(record.fields));
    const version = await readEventVersion(5);
    expect(version?.data).toMatchObject({
      version: 5,
      kind: "rollback",
      restoresVersion: 2,
      snapshot: p.snapshot,
    });

    fsGetDocument.mockResolvedValueOnce(asDoc(pointer.fields));
    const live = await readPublishedEvents();
    expect(live).toEqual({
      data: {
        version: 5,
        snapshot: p.snapshot,
        publishedAt: NOW.toISOString(),
        rebuild: null,
      },
      updateTime: UPDATE_TIME,
    });

    fsGetDocument.mockResolvedValueOnce(asDoc(draft.fields));
    expect((await readEventsDraft())?.data.snapshot).toEqual(p.snapshot);
  });
});

describe("commitPublication", () => {
  it("commits the three writes atomically and returns the new version", async () => {
    fsCommit.mockResolvedValueOnce(undefined);
    const p = publication({ kind: "publish" });
    await expect(commitPublication(p)).resolves.toBe(5);
    expect(fsCommit).toHaveBeenCalledTimes(1);
    expect(fsCommit.mock.calls[0][0]).toEqual(buildPublicationWrites(p));
  });

  it("lets a lost race surface as CommitConflictError", async () => {
    fsCommit.mockRejectedValueOnce(
      new CommitConflictError("FAILED_PRECONDITION", "fixture"),
    );
    await expect(
      commitPublication(publication({ kind: "publish" })),
    ).rejects.toBeInstanceOf(CommitConflictError);
  });
});

describe("readers", () => {
  const pointerFields = {
    version: 1,
    snapshotJson: JSON.stringify(snapshot),
    publishedAt: published.publishedAt,
    rebuild: null,
  };

  it("read the live pointer without credentials from the public path", async () => {
    fsGetPublic.mockResolvedValueOnce({
      fields: pointerFields,
      updateTime: UPDATE_TIME,
    });
    const live = await readPublishedEventsPublic();
    expect(fsGetPublic).toHaveBeenCalledWith(EVENTS_PUBLISHED_PATH);
    expect(live?.data.snapshot).toEqual(snapshot);
  });

  it("return null when the document does not exist", async () => {
    fsGetDocument.mockResolvedValue(null);
    await expect(readPublishedEvents()).resolves.toBeNull();
    await expect(readEventsDraft()).resolves.toBeNull();
    await expect(readEventVersion(3)).resolves.toBeNull();
    expect(fsGetDocument).toHaveBeenLastCalledWith("eventVersions/v000003");
  });

  it("reject a snapshot that is not JSON", async () => {
    fsGetPublic.mockResolvedValueOnce({
      fields: { ...pointerFields, snapshotJson: "{not json" },
      updateTime: UPDATE_TIME,
    });
    await expect(readPublishedEventsPublic()).rejects.toThrow(
      "snapshotJson is not JSON",
    );
  });

  it("reject a snapshot that fails the shared schema", async () => {
    fsGetDocument.mockResolvedValueOnce({
      fields: {
        ...pointerFields,
        snapshotJson: JSON.stringify({ events: [{ slug: "Bad Slug" }] }),
      },
      updateTime: UPDATE_TIME,
    });
    await expect(readPublishedEvents()).rejects.toThrow();
  });
});

describe("writers", () => {
  it("saveEventsDraft stores the snapshot as one JSON string", async () => {
    await saveEventsDraft({
      snapshot,
      basedOnVersion: 3,
      updatedAt: NOW.toISOString(),
      updatedBy: "admin@example.test",
    });
    expect(fsPatch).toHaveBeenCalledWith(
      EVENTS_DRAFT_PATH,
      {
        basedOnVersion: 3,
        updatedAt: NOW.toISOString(),
        updatedBy: "admin@example.test",
        snapshotJson: JSON.stringify(snapshot),
      },
      undefined,
    );
  });

  it("recordRebuildRequest patches only the rebuild field", async () => {
    const rebuild = {
      requestedAt: NOW.toISOString(),
      jobId: "job-1",
      version: 5,
    };
    await recordRebuildRequest(rebuild);
    expect(fsPatch).toHaveBeenCalledWith(
      EVENTS_PUBLISHED_PATH,
      { rebuild },
      undefined,
    );
  });
});

describe("listEventVersions", () => {
  it("asks for the newest 20 versions without their snapshots", async () => {
    const summary = {
      version: 2,
      kind: "publish",
      note: "Fixture publish",
      authorUid: "admin-uid",
      authorEmail: "admin@example.test",
      createdAt: NOW.toISOString(),
      changes: diffSnapshots(snapshot, snapshot),
    };
    fsQueryOrdered.mockResolvedValueOnce([{ id: "v000002", fields: summary }]);
    await expect(listEventVersions()).resolves.toEqual([summary]);
    const [query] = fsQueryOrdered.mock.calls[0] as [
      { select: string[] } & Record<string, unknown>,
    ];
    expect(query).toMatchObject({
      collectionId: "eventVersions",
      orderBy: "version",
      direction: "DESCENDING",
      limit: 20,
    });
    expect(query.select).not.toContain("snapshotJson");
    expect(query.select).toContain("changes");
  });

  it("rejects a record that fails the schema", async () => {
    fsQueryOrdered.mockResolvedValueOnce([
      { id: "v000002", fields: { version: 2 } },
    ]);
    await expect(listEventVersions()).rejects.toThrow();
  });
});
