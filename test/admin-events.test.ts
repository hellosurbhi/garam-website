// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import publishedJson from "../src/data/events.published.json";
import type { EventEntry, EventsSnapshot } from "../src/data/eventsSnapshot";
import type {
  FsDocument,
  FsOrderedQuery,
  FsWrite,
} from "../src/lib/firestoreRest";

// ── In-memory Firestore at the firestoreRest boundary ──────────────────────
// WHY a fake store rather than per-call mocks: publish twice, rollback and
// the precondition races only mean something if writes land and later reads
// see them, with updateTime changing on every write like the real thing.

interface StoredDoc {
  fields: Record<string, unknown>;
  updateTime: string;
}

const store = new Map<string, StoredDoc>();
let writeCount = 0;

function nextUpdateTime(): string {
  writeCount += 1;
  return `2026-11-11T00:00:00.${String(writeCount).padStart(6, "0")}Z`;
}

function putDoc(
  path: string,
  fields: Record<string, unknown>,
  merge = false,
): void {
  const prev = store.get(path);
  store.set(path, {
    fields: structuredClone(
      merge && prev ? { ...prev.fields, ...fields } : fields,
    ),
    updateTime: nextUpdateTime(),
  });
}

const mocks = vi.hoisted(() => ({
  verifyAdminIdentity: vi.fn(),
  alertOps: vi.fn(),
  beforeCommit: vi.fn(),
  fsCommit: vi.fn(),
}));

vi.mock("@/lib/verifyToken", () => ({
  verifyAdminIdentity: mocks.verifyAdminIdentity,
}));
vi.mock("@/lib/opsAlert", () => ({ alertOps: mocks.alertOps }));
vi.mock("@/lib/firestoreRest", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../src/lib/firestoreRest")>();
  return {
    ...real,
    fsGetDocument: async (path: string): Promise<FsDocument | null> => {
      const doc = store.get(path);
      return doc ? structuredClone(doc) : null;
    },
    fsPatch: async (path: string, fields: Record<string, unknown>) => {
      putDoc(path, fields, true);
    },
    fsQueryOrdered: async (q: FsOrderedQuery) =>
      [...store.entries()]
        .filter(([path]) => path.startsWith(`${q.collectionId}/`))
        .map(([path, doc]) => ({
          id: path.split("/")[1],
          fields: Object.fromEntries(
            Object.entries(doc.fields).filter(
              ([k]) => !q.select || q.select.includes(k),
            ),
          ),
        }))
        .sort((a, b) => Number(b.fields.version) - Number(a.fields.version))
        .slice(0, q.limit),
    fsCommit: (writes: FsWrite[]) => mocks.fsCommit(writes),
  };
});

const { CommitConflictError, commitFailure } =
  await import("../src/lib/firestoreRest");

/** The real commit semantics: every precondition holds, or nothing lands. */
async function fakeCommit(writes: FsWrite[]): Promise<void> {
  await mocks.beforeCommit();
  for (const w of writes) {
    const doc = store.get(w.docPath);
    const p = w.precondition;
    const holds =
      !p ||
      ("exists" in p
        ? Boolean(doc) === p.exists
        : doc?.updateTime === p.updateTime);
    if (!holds) {
      throw new CommitConflictError(
        "FAILED_PRECONDITION",
        `fixture ${w.docPath}`,
      );
    }
  }
  for (const w of writes) putDoc(w.docPath, w.fields, w.merge);
}

const index = await import("../src/pages/api/admin/events/index");
const draftRoute = await import("../src/pages/api/admin/events/draft");
const publishRoute = await import("../src/pages/api/admin/events/publish");
const rollbackRoute = await import("../src/pages/api/admin/events/rollback");
const rebuildRoute = await import("../src/pages/api/admin/events/rebuild");

// ── Fixtures ───────────────────────────────────────────────────────────────

const baseline = publishedJson.snapshot as EventsSnapshot;
const HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/fixture";
const ADMIN = { uid: "admin-uid", email: "admin@example.test" };
const T0 = new Date("2026-11-11T20:00:00.000Z");

/** A new show with a fixture date, venue and ticket URL (plan section 8.1). */
function fixtureShow(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Jan 9",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: "chicago-2027-01-09",
    description: "Garam Masala Dating comes to Chicago.",
    lineup: ["surbhi", "wyatt"],
    ticketSource: "our-eventbrite",
    url: "https://www.eventbrite.com/e/garam-masala-dating-chicago-tickets-123",
    isoDate: "2027-01-09",
    startTime: "19:00",
    endTime: "21:00",
    venue: {
      name: "Lincoln Lodge",
      addressLocality: "Chicago",
      addressRegion: "IL",
      addressCountry: "US",
    },
    price: "25",
    eventbriteId: "123",
    timezone: "America/Chicago",
    updatedAt: "2026-11-11T20:00:00.000Z",
    ...overrides,
  };
}

function seedVersion1(): void {
  const snapshotJson = JSON.stringify(baseline);
  putDoc("eventsPublished/current", {
    version: 1,
    snapshotJson,
    publishedAt: publishedJson.publishedAt,
    rebuild: null,
  });
  putDoc("eventVersions/v000001", {
    version: 1,
    kind: "migration",
    snapshotJson,
    note: "Baseline from events.ts",
    authorUid: "seed",
    authorEmail: "",
    createdAt: publishedJson.publishedAt,
    changes: {
      added: [],
      changed: [],
      canceled: [],
      tbaCitiesAdded: [],
      tbaCitiesRemoved: [],
    },
  });
  putDoc("eventsDraft/current", {
    snapshotJson,
    basedOnVersion: 1,
    updatedAt: publishedJson.publishedAt,
    updatedBy: "seed",
  });
}

function liveDoc() {
  const doc = store.get("eventsPublished/current");
  if (!doc) throw new Error("not seeded");
  return {
    ...doc.fields,
    snapshot: JSON.parse(String(doc.fields.snapshotJson)) as EventsSnapshot,
  };
}

function draftDoc() {
  const doc = store.get("eventsDraft/current");
  if (!doc) throw new Error("no draft");
  return {
    ...doc.fields,
    snapshot: JSON.parse(String(doc.fields.snapshotJson)) as EventsSnapshot,
  };
}

function bySlug(snapshot: EventsSnapshot, slug: string): EventEntry {
  const entry = snapshot.events.find((e) => e.slug === slug);
  if (!entry) throw new Error(`missing ${slug}`);
  return entry;
}

function replaceEntry(
  snapshot: EventsSnapshot,
  slug: string,
  edit: (e: EventEntry) => EventEntry,
): EventsSnapshot {
  return {
    ...snapshot,
    events: snapshot.events.map((e) => (e.slug === slug ? edit(e) : e)),
  };
}

type Route = (ctx: never) => Response | Promise<Response>;

async function call(
  route: Route,
  method: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const request = new Request(
    "https://garammasaladating.com/api/admin/events",
    {
      method,
      headers: {
        authorization: "Bearer admin-token",
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const res = await route({ request } as never);
  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

const saveDraft = (snapshot: unknown, basedOnVersion: number) =>
  call(draftRoute.PUT as Route, "PUT", { snapshot, basedOnVersion });
const publish = (expectedVersion: number, note = "Fixture publish") =>
  call(publishRoute.POST as Route, "POST", { expectedVersion, note });
const rollback = (
  targetVersion: number,
  expectedVersion: number,
  note = "Fixture restore",
) =>
  call(rollbackRoute.POST as Route, "POST", {
    targetVersion,
    expectedVersion,
    note,
  });
const rebuild = () => call(rebuildRoute.POST as Route, "POST", {});

/** Move past the 60 s rebuild debounce (R15). */
function afterDebounce(): void {
  vi.setSystemTime(new Date(Date.now() + 61_000));
}

const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  writeCount = 0;
  vi.clearAllMocks();
  // WHY only Date: AbortSignal.timeout and the rest of the runtime keep real
  // timers; the debounce compares wall-clock ISO times.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  mocks.verifyAdminIdentity.mockResolvedValue(ADMIN);
  mocks.alertOps.mockResolvedValue(true);
  mocks.fsCommit.mockImplementation(fakeCommit);
  fetchMock.mockImplementation(async () =>
    Response.json({ job: { id: "job-1", state: "PENDING" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VERCEL_DEPLOY_HOOK", HOOK_URL);
  seedVersion1();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ── Acceptance 2: unauthorized editor is denied ────────────────────────────

describe("admin auth", () => {
  const routes: Array<[string, Route, string]> = [
    ["GET index", index.GET as Route, "GET"],
    ["PUT draft", draftRoute.PUT as Route, "PUT"],
    ["POST draft", draftRoute.POST as Route, "POST"],
    ["POST publish", publishRoute.POST as Route, "POST"],
    ["POST rollback", rollbackRoute.POST as Route, "POST"],
    ["POST rebuild", rebuildRoute.POST as Route, "POST"],
  ];

  it.each(routes)("%s answers 401 to a non-admin", async (_, route, method) => {
    mocks.verifyAdminIdentity.mockResolvedValue(null);
    const before = structuredClone([...store.entries()]);
    const res = await call(
      route,
      method,
      method === "GET" ? undefined : { expectedVersion: 1 },
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorized" });
    expect([...store.entries()]).toEqual(before);
    expect(mocks.fsCommit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── GET ────────────────────────────────────────────────────────────────────

describe("GET /api/admin/events", () => {
  it("returns live, draft with pending changes, and history newest first", async () => {
    const draft = { ...baseline, events: [...baseline.events, fixtureShow()] };
    expect((await saveDraft(draft, 1)).status).toBe(200);
    expect((await publish(1)).status).toBe(200);

    const res = await call(index.GET as Route, "GET");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      live: { version: 2, rebuild: { jobId: "job-1", version: 2 } },
      draft: { basedOnVersion: 2, changes: { added: [], changed: [] } },
    });
    const history = res.json.history as Array<Record<string, unknown>>;
    expect(history.map((h) => h.version)).toEqual([2, 1]);
    expect(history[0]).toMatchObject({
      kind: "publish",
      note: "Fixture publish",
      authorEmail: ADMIN.email,
      changes: { added: ["chicago-2027-01-09"] },
    });
    expect(history[0]).not.toHaveProperty("snapshotJson");
  });

  it("answers 503 before the seed has run", async () => {
    store.clear();
    const res = await call(index.GET as Route, "GET");
    expect(res.status).toBe(503);
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });
});

// ── Acceptance 1: publish a fixture date, venue and ticket URL ─────────────

describe("publish", () => {
  it("commits v2 atomically, requests one rebuild and returns the version", async () => {
    const show = fixtureShow();
    expect(
      (await saveDraft({ ...baseline, events: [...baseline.events, show] }, 1))
        .status,
    ).toBe(200);
    const pointerTimeBefore = store.get("eventsPublished/current")?.updateTime;
    const draftTimeBefore = store.get("eventsDraft/current")?.updateTime;

    const res = await publish(1);

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ version: 2, rebuild: "requested" });
    expect(mocks.fsCommit).toHaveBeenCalledTimes(1);
    const [writes] = mocks.fsCommit.mock.calls[0] as [FsWrite[]];
    expect(writes.map((w) => [w.docPath, w.precondition])).toEqual([
      ["eventVersions/v000002", { exists: false }],
      ["eventsPublished/current", { updateTime: pointerTimeBefore }],
      ["eventsDraft/current", { updateTime: draftTimeBefore }],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(HOOK_URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });

    const live = liveDoc();
    expect(live.version).toBe(2);
    expect(bySlug(live.snapshot, show.slug)).toEqual(show);
    expect(live.rebuild).toEqual({
      requestedAt: T0.toISOString(),
      jobId: "job-1",
      version: 2,
    });
    expect(draftDoc().basedOnVersion).toBe(2);
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  it("returns 200 with rebuild failed and pages when the hook fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 500 }));
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );

    const res = await publish(1);

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ version: 2, rebuild: "failed" });
    expect(liveDoc().version).toBe(2);
    expect(liveDoc().rebuild).toBeNull();
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ flow: "ops", stage: "events_rebuild" }),
    );
  });

  it("treats a hook timeout and a missing hook URL as a failed rebuild", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("timeout", "TimeoutError"),
    );
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    expect((await publish(1)).json.rebuild).toBe("failed");

    vi.stubEnv("VERCEL_DEPLOY_HOOK", "");
    expect((await rebuild()).json).toMatchObject({
      version: 2,
      rebuild: "failed",
    });
    expect(mocks.alertOps).toHaveBeenCalledTimes(2);
  });

  it("refuses a stale expectedVersion with 409 and writes nothing", async () => {
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    const res = await publish(7);
    expect(res.status).toBe(409);
    expect(res.json.error).toBe("The live version changed, reload");
    expect(mocks.fsCommit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 409 when another publish lands between read and commit", async () => {
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    mocks.beforeCommit.mockImplementationOnce(() => {
      putDoc("eventsPublished/current", { rebuild: null }, true);
    });

    const res = await publish(1);

    expect(res.status).toBe(409);
    expect(res.json.error).toBe("The live version changed, reload");
    expect(store.has("eventVersions/v000002")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  // R9: the conflict is recognised by canonical status, whatever the HTTP code.
  it.each([
    ["FAILED_PRECONDITION", 400],
    ["FAILED_PRECONDITION", 412],
    ["ALREADY_EXISTS", 409],
    ["ABORTED", 409],
  ])("maps a %s (%i) commit failure to 409", async (status, code) => {
    mocks.fsCommit.mockRejectedValueOnce(
      commitFailure(code, JSON.stringify({ error: { code, status } })),
    );
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    const res = await publish(1);
    expect(res.status).toBe(409);
    expect(mocks.alertOps).not.toHaveBeenCalled();
  });

  it.each([
    ["PERMISSION_DENIED", 403],
    ["UNAVAILABLE", 503],
  ])("maps a %s (%i) commit failure to 502 and pages", async (status, code) => {
    mocks.fsCommit.mockRejectedValueOnce(
      commitFailure(code, JSON.stringify({ error: { code, status } })),
    );
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    const res = await publish(1);
    expect(res.status).toBe(502);
    expect(mocks.alertOps).toHaveBeenCalledWith(
      expect.objectContaining({ flow: "ops", stage: "events_publish" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publishes twice in a row once the debounce has passed (R2)", async () => {
    const first = [...baseline.events, fixtureShow()];
    await saveDraft({ ...baseline, events: first }, 1);
    expect((await publish(1)).json.version).toBe(2);

    afterDebounce();
    const second = replaceEntry(
      { ...baseline, events: first },
      "chicago-2027-01-09",
      (e) => ({ ...e, tagline: "Selling fast" }),
    );
    expect((await saveDraft(second, 2)).status).toBe(200);
    const res = await publish(2, "Second publish");

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ version: 3, rebuild: "requested" });
    expect(bySlug(liveDoc().snapshot, "chicago-2027-01-09").tagline).toBe(
      "Selling fast",
    );
    expect(draftDoc().basedOnVersion).toBe(3);
  });

  it("refuses a second publish inside the 60 s rebuild debounce (R15)", async () => {
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    await publish(1);
    await saveDraft(
      replaceEntry(liveDoc().snapshot, "chicago-2027-01-09", (e) => ({
        ...e,
        tagline: "Selling fast",
      })),
      2,
    );
    vi.setSystemTime(new Date(T0.getTime() + 30_000));

    const res = await publish(2);

    expect(res.status).toBe(429);
    expect(res.json.retryAfterSeconds).toBe(30);
    expect(mocks.fsCommit).toHaveBeenCalledTimes(1);
  });

  it("refuses a publish with no changes", async () => {
    const res = await publish(1);
    expect(res.status).toBe(400);
    expect(mocks.fsCommit).not.toHaveBeenCalled();
  });

  it("revalidates the stored draft and answers 400 with field paths", async () => {
    // A draft that predates a rule change: stored as is, refused at publish.
    putDoc(
      "eventsDraft/current",
      {
        snapshotJson: JSON.stringify({
          ...baseline,
          events: [...baseline.events, fixtureShow({ timezone: undefined })],
        }),
      },
      true,
    );
    const res = await publish(1);
    expect(res.status).toBe(400);
    expect(res.json.issues).toContainEqual({
      path: `events.${baseline.events.length}.timezone`,
      message: "Pick the show's time zone",
    });
    expect(mocks.fsCommit).not.toHaveBeenCalled();
  });

  it("answers 400 with field errors for a bad body", async () => {
    const res = await call(publishRoute.POST as Route, "POST", {
      expectedVersion: 1,
      note: " ",
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      details: { fieldErrors: { note: expect.any(Array) } },
    });
  });
});

// ── Acceptance 3: invalid URL is rejected ──────────────────────────────────

describe("draft save", () => {
  it.each([
    ["http://www.eventbrite.com/e/x-123", "events.31.url"],
    ["javascript:alert(1)", "events.31.url"],
    ["#", "events.31.url"],
    ["https://tickets.citywinery.com/e/123", "events.31.url"],
    ["https://garammasaladating.com/tickets", "events.31.url"],
  ])("rejects ticket URL %s with 400 at %s", async (url, path) => {
    const res = await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow({ url })] },
      1,
    );
    expect(res.status).toBe(400);
    const issues = res.json.issues as Array<{ path: string }>;
    expect(issues.map((i) => i.path)).toContain(path);
    expect(draftDoc().snapshot).toEqual(baseline);
  });

  it("rejects a ticket URL with ticketSource none", async () => {
    const res = await saveDraft(
      {
        ...baseline,
        events: [
          ...baseline.events,
          fixtureShow({ ticketSource: "none", eventbriteId: undefined }),
        ],
      },
      1,
    );
    expect(res.status).toBe(400);
    expect(res.json.issues).toContainEqual(
      expect.objectContaining({ path: "events.31.url" }),
    );
  });

  it("saves a valid draft with who and when, and reports pending changes", async () => {
    const res = await call(draftRoute.POST as Route, "POST", {
      snapshot: { ...baseline, events: [...baseline.events, fixtureShow()] },
      basedOnVersion: 1,
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      basedOnVersion: 1,
      updatedAt: T0.toISOString(),
      updatedBy: ADMIN.email,
      changes: { added: ["chicago-2027-01-09"] },
    });
    expect(draftDoc()).toMatchObject({ updatedBy: ADMIN.email });
  });

  it("refuses a draft built on an older live version with 409", async () => {
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    await publish(1);
    const res = await saveDraft(baseline, 1);
    expect(res.status).toBe(409);
  });

  it("refuses removing a show (never delete)", async () => {
    const res = await saveDraft(
      { ...baseline, events: baseline.events.slice(1) },
      1,
    );
    expect(res.status).toBe(400);
  });
});

// ── Acceptance 4: rollback restores the prior version ──────────────────────

describe("rollback", () => {
  async function publishFixture(): Promise<void> {
    await saveDraft(
      { ...baseline, events: [...baseline.events, fixtureShow()] },
      1,
    );
    expect((await publish(1)).json.version).toBe(2);
    afterDebounce();
  }

  it("commits a rollback version, rebuilds and resets the draft", async () => {
    await publishFixture();
    // An unpublished edit in the draft is replaced by the restored content.
    await saveDraft(
      replaceEntry(liveDoc().snapshot, "chicago-2027-01-09", (e) => ({
        ...e,
        tagline: "Unpublished",
      })),
      2,
    );

    const res = await rollback(1, 2);

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ version: 3, rebuild: "requested" });
    const [writes] = mocks.fsCommit.mock.calls[1] as [FsWrite[]];
    expect(writes[0]).toMatchObject({
      docPath: "eventVersions/v000003",
      precondition: { exists: false },
      fields: { kind: "rollback", restoresVersion: 1, note: "Fixture restore" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const live = liveDoc();
    expect(live.version).toBe(3);
    // Baseline entries are back exactly; the later show is kept, hidden.
    for (const entry of baseline.events) {
      expect(bySlug(live.snapshot, entry.slug)).toEqual(entry);
    }
    expect(bySlug(live.snapshot, "chicago-2027-01-09")).toMatchObject({
      hidden: true,
      status: "canceled",
      note: "Removed by rollback to v1: Fixture restore",
    });
    expect(draftDoc()).toMatchObject({
      basedOnVersion: 3,
      updatedBy: ADMIN.email,
    });
    expect(draftDoc().snapshot).toEqual(live.snapshot);
  });

  it("notes a restored date on an entry that had no note (R14)", async () => {
    await publishFixture();
    await saveDraft(
      replaceEntry(liveDoc().snapshot, "chicago-2027-01-09", (e) => ({
        ...e,
        date: "Jan 16",
        isoDate: "2027-01-16",
        previousDate: "2027-01-09",
        note: "Moved from Jan 9",
      })),
      2,
    );
    expect((await publish(2)).json.version).toBe(3);
    afterDebounce();

    const res = await rollback(2, 3, "Venue fell through");

    expect(res.status).toBe(200);
    const restored = bySlug(liveDoc().snapshot, "chicago-2027-01-09");
    expect(restored).toMatchObject({
      isoDate: "2027-01-09",
      date: "Jan 9",
      note: "Restored to 2027-01-09 by rollback to v2: Venue fell through",
      previousDates: ["2027-01-16"],
    });
  });

  it("restores a legacy entry without re-checking it against new rules (R19)", async () => {
    const slug = "san-francisco-2026-06-25";
    expect(bySlug(baseline, slug).timezone).toBeUndefined();
    const edited = replaceEntry(baseline, slug, (e) => ({
      ...e,
      timezone: "America/Los_Angeles",
      updatedAt: T0.toISOString(),
    }));
    expect((await saveDraft(edited, 1)).status).toBe(200);
    expect((await publish(1)).json.version).toBe(2);
    expect(bySlug(liveDoc().snapshot, slug).timezone).toBe(
      "America/Los_Angeles",
    );
    afterDebounce();

    const res = await rollback(1, 2);

    expect(res.status).toBe(200);
    const restored = bySlug(liveDoc().snapshot, slug);
    expect(restored).toEqual(bySlug(baseline, slug));
    expect(restored).not.toHaveProperty("timezone");
  });

  it("creates the draft when none exists, guarded by exists:false", async () => {
    await publishFixture();
    store.delete("eventsDraft/current");

    const res = await rollback(1, 2);

    expect(res.status).toBe(200);
    const [writes] = mocks.fsCommit.mock.calls[1] as [FsWrite[]];
    expect(writes[2]).toMatchObject({
      docPath: "eventsDraft/current",
      precondition: { exists: false },
    });
    expect(draftDoc()).toMatchObject({ basedOnVersion: 3 });
  });

  it("refuses a target that is not earlier than live", async () => {
    await publishFixture();
    expect((await rollback(2, 2)).status).toBe(400);
    expect((await rollback(5, 2)).status).toBe(400);
  });

  it("answers 404 for a version that does not exist", async () => {
    await publishFixture();
    store.delete("eventVersions/v000001");
    expect((await rollback(1, 2)).status).toBe(404);
  });

  it("refuses a stale expectedVersion with 409", async () => {
    await publishFixture();
    expect((await rollback(1, 1)).status).toBe(409);
    expect(mocks.fsCommit).toHaveBeenCalledTimes(1);
  });
});

// ── Rebuild (R15) ──────────────────────────────────────────────────────────

describe("rebuild", () => {
  it("requests a rebuild of the live version and records it", async () => {
    const res = await rebuild();
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ version: 1, rebuild: "requested" });
    expect(liveDoc().rebuild).toEqual({
      requestedAt: T0.toISOString(),
      jobId: "job-1",
      version: 1,
    });
  });

  it("refuses within 60 s of the last request, then allows it", async () => {
    await rebuild();
    vi.setSystemTime(new Date(T0.getTime() + 59_000));
    const early = await rebuild();
    expect(early.status).toBe(429);
    expect(early.json.retryAfterSeconds).toBe(1);

    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    expect((await rebuild()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never locks the owner out after a failed hook", async () => {
    fetchMock.mockResolvedValueOnce(new Response("down", { status: 502 }));
    expect((await rebuild()).json.rebuild).toBe("failed");
    expect((await rebuild()).json.rebuild).toBe("requested");
  });
});
