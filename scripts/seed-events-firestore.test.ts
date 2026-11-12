// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventsSnapshot } from "../src/data/eventsSnapshot";
import {
  SEED_AUTHOR,
  SEED_NOTE,
  documentsRoot,
  main,
  readBaseline,
  seedCommitBody,
} from "./seed-events-firestore.mjs";

vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue({}),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setSubject() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "fixture-jwt";
    }
  },
}));

const PROJECT = "demo-test";
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const NOW = new Date("2026-11-12T09:00:00.000Z");
const ENV = {
  PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_ADMIN_CLIENT_EMAIL: "fixture@example.test",
  FIREBASE_ADMIN_PRIVATE_KEY: "fixture-key",
};
const tokenResponse = () =>
  Response.json({ access_token: "fixture-token", expires_in: 3600 });

/** What the public read of `eventsPublished/current` returns for `snapshot`. */
function publishedDoc(version: number, snapshot: EventsSnapshot): Response {
  return Response.json({
    fields: {
      version: { integerValue: String(version) },
      snapshotJson: { stringValue: JSON.stringify(snapshot) },
      publishedAt: { stringValue: NOW.toISOString() },
      rebuild: { nullValue: null },
    },
    updateTime: NOW.toISOString(),
  });
}

let snapshot: EventsSnapshot;
beforeEach(async () => {
  ({ snapshot } = await readBaseline());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("seed commit body", () => {
  // The contract: the seed writes exactly what the admin's own publish path
  // would write for version 1, so the Shows tab reads the seed like any
  // version it published itself.
  it("matches the admin publish path byte for byte", async () => {
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
    vi.stubEnv("FIREBASE_ADMIN_CLIENT_EMAIL", ENV.FIREBASE_ADMIN_CLIENT_EMAIL);
    vi.stubEnv("FIREBASE_ADMIN_PRIVATE_KEY", ENV.FIREBASE_ADMIN_PRIVATE_KEY);
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ writeResults: [] }));
    const { commitPublication } = await import("../src/lib/eventsStore.server");

    const version = await commitPublication({
      live: { version: 0, updateTime: null },
      draftPrecondition: { exists: false },
      action: { kind: "migration" },
      snapshot,
      changes: {
        added: [],
        changed: [],
        canceled: [],
        tbaCitiesAdded: [],
        tbaCitiesChanged: [],
        tbaCitiesRemoved: [],
      },
      note: SEED_NOTE,
      author: { uid: SEED_AUTHOR, email: SEED_AUTHOR },
      now: NOW,
    });

    expect(version).toBe(1);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`https://firestore.googleapis.com/v1/${ROOT}:commit`);
    expect(init.body).toBe(JSON.stringify(seedCommitBody(ROOT, snapshot, NOW)));
  });

  it("requires every document to be new", () => {
    const body = seedCommitBody(ROOT, snapshot, NOW);
    expect(body.writes.map((w) => w.currentDocument)).toEqual([
      { exists: false },
      { exists: false },
      { exists: false },
    ]);
  });

  it("refuses a missing or unsafe project id", () => {
    expect(() => documentsRoot(undefined)).toThrow(/missing or invalid/);
    expect(() => documentsRoot("demo/../other")).toThrow(/missing or invalid/);
  });
});

describe("main", () => {
  it("writes nothing without --execute", async () => {
    const fetchImpl = vi.fn();
    const log = vi.fn();
    await expect(
      main([], ENV, { fetchImpl, log, now: () => NOW }),
    ).resolves.toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log.mock.calls.join("\n")).toMatch(/Dry run.*Nothing written/s);
  });

  it("commits once and proves the public read returns what it wrote", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ writeResults: [] }))
      .mockResolvedValueOnce(publishedDoc(1, snapshot));
    const log = vi.fn();
    await expect(
      main(["--execute"], ENV, { fetchImpl, log, now: () => NOW }),
    ).resolves.toBe(0);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual(
      seedCommitBody(ROOT, snapshot, NOW),
    );
    expect(fetchImpl.mock.calls[2][1]?.headers?.Authorization).toBeUndefined();
    expect(log.mock.calls.at(-1)?.[0]).toMatch(/Done/);
  });

  it("reports an existing show list instead of overwriting it", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        Response.json(
          { error: { status: "FAILED_PRECONDITION", message: "exists" } },
          { status: 400 },
        ),
      );
    await expect(
      main(["--execute"], ENV, { fetchImpl, log: vi.fn(), now: () => NOW }),
    ).rejects.toThrow(/Already seeded/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails when the public read does not match the seed", async () => {
    const other = { ...snapshot, events: snapshot.events.slice(1) };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ writeResults: [] }))
      .mockResolvedValueOnce(publishedDoc(1, other));
    await expect(
      main(["--execute"], ENV, { fetchImpl, log: vi.fn(), now: () => NOW }),
    ).rejects.toThrow(/public read did not return version 1/);
  });

  it("needs the admin credentials to execute", async () => {
    await expect(
      main(
        ["--execute"],
        { PUBLIC_FIREBASE_PROJECT_ID: PROJECT },
        { fetchImpl: vi.fn(), log: vi.fn(), now: () => NOW },
      ),
    ).rejects.toThrow(/is not set/);
  });
});
