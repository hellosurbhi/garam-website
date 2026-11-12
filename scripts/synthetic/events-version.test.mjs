// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { eventVersionDocPath } from "../../src/lib/eventsStore.server";
import {
  EVENTS_POLL_MS,
  REBUILD_GRACE_MS,
  decideEventsCheck,
  eventVersionDocName,
  requireEventsVersion,
} from "./events-version.mjs";

const PUBLISHED_AT = "2026-11-12T09:00:00.000Z";
const SUPERSEDED_AT = "2026-11-12T08:50:00.000Z";
const T0 = Date.parse(SUPERSEDED_AT);
const SNAPSHOT = { events: [], tbaCities: [] };
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ENV = {
  FIREBASE_PROJECT_ID: " demo\\n",
  FIREBASE_ADMIN_CLIENT_EMAIL: "svc@demo.iam.gserviceaccount.com",
  FIREBASE_ADMIN_PRIVATE_KEY: privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString(),
};

function published(version) {
  return { version, publishedAt: PUBLISHED_AT, snapshot: SNAPSHOT };
}

/**
 * Production's /api/version (one answer per call, the last one repeating),
 * the public published document, the token grant and the admin-only
 * eventVersions record.
 */
function fetchFor(
  deployedVersions,
  publishedVersion,
  createdAt = () => SUPERSEDED_AT,
) {
  const deployed = [...deployedVersions];
  return vi.fn(async (url) => {
    const target = String(url);
    if (target.endsWith("/api/version"))
      return Response.json({
        commit: "a".repeat(40),
        eventsVersion: deployed.length > 1 ? deployed.shift() : deployed[0],
      });
    if (target === "https://oauth2.googleapis.com/token")
      return Response.json({ access_token: "fixture-token" });
    if (target.includes("/eventVersions/"))
      return Response.json({
        fields: { createdAt: { stringValue: createdAt(target) } },
      });
    return Response.json({
      fields: {
        version: { integerValue: String(publishedVersion) },
        publishedAt: { stringValue: PUBLISHED_AT },
        snapshotJson: { stringValue: JSON.stringify(SNAPSHOT) },
      },
    });
  });
}

describe("decideEventsCheck", () => {
  it("checks when the site runs the published version", () => {
    expect(
      decideEventsCheck({ deployed: 3, published: published(3), now: T0 }),
    ).toBe("check");
  });

  it("waits while the deployed version was replaced under 20 minutes ago", () => {
    expect(
      decideEventsCheck({
        deployed: 2,
        published: published(3),
        supersededAt: SUPERSEDED_AT,
        now: T0 + REBUILD_GRACE_MS - 1,
      }),
    ).toBe("wait");
  });

  it("dates the lag from the replacement, not the latest publish", () => {
    // Version 5 was published just now, but version 2 was replaced long ago.
    expect(
      decideEventsCheck({
        deployed: 2,
        published: {
          ...published(5),
          publishedAt: new Date(T0 + REBUILD_GRACE_MS).toISOString(),
        },
        supersededAt: SUPERSEDED_AT,
        now: T0 + REBUILD_GRACE_MS,
      }),
    ).toBe("stale");
  });

  it("calls a site ahead of the published version stale", () => {
    expect(
      decideEventsCheck({ deployed: 4, published: published(3), now: T0 }),
    ).toBe("stale");
  });

  it("calls an undated replacement stale", () => {
    expect(
      decideEventsCheck({
        deployed: 2,
        published: published(3),
        supersededAt: undefined,
        now: T0,
      }),
    ).toBe("stale");
  });
});

describe("eventVersionDocName", () => {
  it("uses the same id as the admin's eventVersionDocPath", () => {
    for (const version of [1, 42, 123456])
      expect(eventVersionDocName("demo", version)).toBe(
        `projects/demo/databases/(default)/documents/${eventVersionDocPath(version)}`,
      );
  });
});

describe("requireEventsVersion", () => {
  it("returns the published snapshot when the site has it, without credentials", async () => {
    const fetchImpl = fetchFor([3], 3);
    await expect(
      requireEventsVersion(
        { FIREBASE_PROJECT_ID: "demo" },
        { fetchImpl, now: () => T0 },
      ),
    ).resolves.toEqual(SNAPSHOT);
    expect(
      fetchImpl.mock.calls.some(([url]) => String(url).includes("oauth2")),
    ).toBe(false);
  });

  it("waits in this run until the rebuild lands", async () => {
    const fetchImpl = fetchFor([2, 2, 3], 3);
    const sleep = vi.fn(async () => {});
    await expect(
      requireEventsVersion(ENV, { fetchImpl, now: () => T0, sleep }),
    ).resolves.toEqual(SNAPSHOT);
    expect(sleep.mock.calls).toEqual([[EVENTS_POLL_MS], [EVENTS_POLL_MS]]);
    const record = fetchImpl.mock.calls.filter(([url]) =>
      String(url).includes("/eventVersions/"),
    );
    // Dated once per run, as the record of the version after the first one.
    expect(record).toHaveLength(1);
    expect(String(record[0][0])).toContain(
      "projects/demo/databases/(default)/documents/eventVersions/v000003",
    );
    expect(record[0][1].headers.Authorization).toBe("Bearer fixture-token");
  });

  it("fails once the rebuild is overdue", async () => {
    let clock = T0;
    const sleep = vi.fn(async (ms) => {
      clock += ms;
    });
    await expect(
      requireEventsVersion(ENV, {
        fetchImpl: fetchFor([2], 3),
        now: () => clock,
        sleep,
      }),
    ).rejects.toThrow(/version 2 but version 3 was published/);
    expect(sleep).toHaveBeenCalledTimes(REBUILD_GRACE_MS / EVENTS_POLL_MS);
  });

  it("keeps the first lag date when a rebuild lands still behind", async () => {
    let clock = T0;
    const sleep = vi.fn(async (ms) => {
      clock += ms;
    });
    // Each later version was created 15 minutes after the one before it, so
    // redating on every intermediate rebuild would keep the run waiting.
    const fetchImpl = fetchFor([2, 3, 4], 5, (url) =>
      new Date(T0 + (Number(url.match(/eventVersions\/v(\d+)/)[1]) - 3) * 15 * 60_000)
        .toISOString(),
    );
    await expect(
      requireEventsVersion(ENV, { fetchImpl, now: () => clock, sleep }),
    ).rejects.toThrow(/version 4 but version 5 was published/);
    expect(sleep).toHaveBeenCalledTimes(REBUILD_GRACE_MS / EVENTS_POLL_MS);
  });

  it("fails without a valid project or a deployed version", async () => {
    await expect(
      requireEventsVersion({}, { fetchImpl: fetchFor([3], 3) }),
    ).rejects.toThrow(/project/);
    await expect(
      requireEventsVersion(
        { FIREBASE_PROJECT_ID: "Bad/Project" },
        { fetchImpl: fetchFor([3], 3) },
      ),
    ).rejects.toThrow(/project/);
    await expect(
      requireEventsVersion(ENV, { fetchImpl: fetchFor([undefined], 3) }),
    ).rejects.toThrow(/show list version is invalid/);
  });
});

describe("dependency-free monitor modules", () => {
  // WHY: the version gate and the reporter run without npm ci, so anything
  // they import outside Node fails before monitoring starts.
  it.each(["scripts/synthetic/deployment.mjs", "scripts/synthetic/report.mjs"])(
    "%s imports only Node built-ins and relative modules",
    (entry) => {
      const seen = new Set();
      const walk = (file) => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const [, spec] of readFileSync(file, "utf8").matchAll(
          /^\s*(?:import|export)\b[^"'`]*?from\s+["']([^"']+)["']/gm,
        )) {
          if (spec.startsWith(".")) walk(resolve(dirname(file), spec));
          else expect(spec, `${file} imports ${spec}`).toMatch(/^node:/);
        }
      };
      walk(resolve(entry));
      expect(seen.size).toBeGreaterThan(0);
    },
  );
});
