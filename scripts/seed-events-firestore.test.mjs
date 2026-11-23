// @vitest-environment node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  SEED_AUTHOR,
  documentsRoot,
  main,
  readBaseline,
  seedCommitBody,
} from "./seed-events-firestore.mjs";

// The token exchange signs a JWT; the fake key below is not a real PKCS8 key.
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

// WHY a temp baseline, never src/data/events.published.json: that live file
// moves on with every publish once the Shows admin lands, and readBaseline
// refuses anything but version 1. This fixture is a version 1 envelope the
// test controls.
const SNAPSHOT = {
  events: [
    { slug: "manhattan-2099-12-31", city: "Manhattan" },
    { slug: "la-2099-12-31", city: "LA" },
  ],
  tbaCities: [{ citySlug: "chicago" }],
};
const PROJECT = "demo-test";
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const NOW = new Date("2026-11-12T09:00:00.000Z");
const ENV = {
  PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_ADMIN_CLIENT_EMAIL: "fixture@example.test",
  FIREBASE_ADMIN_PRIVATE_KEY: "fixture-key",
};
const DOCS = [
  "eventVersions/v000001",
  "eventsPublished/current",
  "eventsDraft/current",
];

let baselinePath;
let badBaselinePath;
beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), "seed-test-"));
  baselinePath = join(dir, "baseline.json");
  badBaselinePath = join(dir, "v2.json");
  await writeFile(
    baselinePath,
    JSON.stringify({
      version: 1,
      publishedAt: NOW.toISOString(),
      snapshot: SNAPSHOT,
    }),
  );
  await writeFile(
    badBaselinePath,
    JSON.stringify({
      version: 2,
      publishedAt: NOW.toISOString(),
      snapshot: SNAPSHOT,
    }),
  );
});

const tokenResponse = () =>
  Response.json({ access_token: "fixture-token", expires_in: 3600 });

/** What the public read of `eventsPublished/current` returns. */
function publishedDoc(version, snapshot) {
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

const opts = (fetchImpl, path = baselinePath) => ({
  fetchImpl,
  log: vi.fn(),
  now: () => NOW,
  baselinePath: path,
});

describe("seed commit body", () => {
  it("is exactly three documents, each required not to exist", () => {
    const body = seedCommitBody(ROOT, SNAPSHOT, NOW);
    expect(body.writes.map((w) => w.update.name)).toEqual(
      DOCS.map((d) => `${ROOT}/${d}`),
    );
    expect(body.writes.map((w) => w.currentDocument)).toEqual([
      { exists: false },
      { exists: false },
      { exists: false },
    ]);
  });

  it("writes version 1 as a migration by the seed script", () => {
    const [version, published, draft] = seedCommitBody(
      ROOT,
      SNAPSHOT,
      NOW,
    ).writes;
    expect(version.update.fields.kind).toEqual({ stringValue: "migration" });
    expect(version.update.fields.authorUid).toEqual({
      stringValue: SEED_AUTHOR,
    });
    expect(published.update.fields.version).toEqual({ integerValue: "1" });
    expect(draft.update.fields.basedOnVersion).toEqual({ integerValue: "1" });
    expect(published.update.fields.snapshotJson).toEqual({
      stringValue: JSON.stringify(SNAPSHOT),
    });
  });
});

describe("project id and baseline checks", () => {
  it("refuses a missing or unsafe project id", () => {
    expect(() => documentsRoot(undefined)).toThrow(/missing or invalid/);
    expect(() => documentsRoot("demo/../other")).toThrow(/missing or invalid/);
  });

  it("main refuses a bad project id before any request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      main(
        ["--execute"],
        { ...ENV, PUBLIC_FIREBASE_PROJECT_ID: "a/b" },
        opts(fetchImpl),
      ),
    ).rejects.toThrow(/missing or invalid/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a baseline that is not version 1", async () => {
    await expect(readBaseline(badBaselinePath)).rejects.toThrow(
      /version 1 baseline/,
    );
    const fetchImpl = vi.fn();
    await expect(
      main(["--execute"], ENV, opts(fetchImpl, badBaselinePath)),
    ).rejects.toThrow(/version 1 baseline/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("main", () => {
  it("dry run writes nothing and needs no key", async () => {
    const fetchImpl = vi.fn();
    const o = opts(fetchImpl);
    await expect(
      main([], { PUBLIC_FIREBASE_PROJECT_ID: PROJECT }, o),
    ).resolves.toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    const logged = o.log.mock.calls.map((c) => c[0]).join("\n");
    expect(logged).toMatch(/Dry run.*2 shows, 1 cities.*Nothing written/s);
  });

  it("--execute sends one commit with the three documents, then reads back", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ writeResults: [] }))
      .mockResolvedValueOnce(publishedDoc(1, SNAPSHOT));
    const o = opts(fetchImpl);
    await expect(main(["--execute"], ENV, o)).resolves.toBe(0);

    const commits = fetchImpl.mock.calls.filter(([url]) =>
      String(url).endsWith(":commit"),
    );
    expect(commits).toHaveLength(1);
    const body = JSON.parse(commits[0][1].body);
    expect(body).toEqual(seedCommitBody(ROOT, SNAPSHOT, NOW));
    expect(body.writes).toHaveLength(3);
    for (const w of body.writes)
      expect(w.currentDocument).toEqual({ exists: false });
    expect(commits[0][1].headers.Authorization).toBe("Bearer fixture-token");
    // The public read-back carries no credential.
    expect(fetchImpl.mock.calls[2][1]?.headers?.Authorization).toBeUndefined();
    expect(o.log.mock.calls.at(-1)[0]).toMatch(/Done/);
  });

  it("an existing show list fails with Already seeded and writes nothing more", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        Response.json(
          { error: { status: "FAILED_PRECONDITION", message: "exists" } },
          { status: 400 },
        ),
      );
    await expect(main(["--execute"], ENV, opts(fetchImpl))).rejects.toThrow(
      /Already seeded/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails when the public read does not match the seed", async () => {
    const other = { ...SNAPSHOT, events: SNAPSHOT.events.slice(1) };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(Response.json({ writeResults: [] }))
      .mockResolvedValueOnce(publishedDoc(1, other));
    await expect(main(["--execute"], ENV, opts(fetchImpl))).rejects.toThrow(
      /public read did not return version 1/,
    );
  });

  it("needs the admin credentials to execute", async () => {
    const fetchImpl = vi.fn();
    await expect(
      main(
        ["--execute"],
        { PUBLIC_FIREBASE_PROJECT_ID: PROJECT },
        opts(fetchImpl),
      ),
    ).rejects.toThrow(/is not set/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
