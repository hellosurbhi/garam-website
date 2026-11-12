// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  REBUILD_GRACE_MS,
  decideEventsCheck,
  requireEventsVersion,
} from "./deployment.mjs";

const PUBLISHED_AT = "2026-11-12T09:00:00.000Z";
const T0 = Date.parse(PUBLISHED_AT);
const SNAPSHOT = { events: [], tbaCities: [] };

function published(version) {
  return { version, publishedAt: PUBLISHED_AT, snapshot: SNAPSHOT };
}

/** Production's /api/version, then the public published document. */
function fetchFor(deployedVersion, publishedVersion) {
  return vi.fn(async (url) =>
    String(url).endsWith("/api/version")
      ? Response.json({
          commit: "a".repeat(40),
          eventsVersion: deployedVersion,
        })
      : Response.json({
          fields: {
            version: { integerValue: String(publishedVersion) },
            publishedAt: { stringValue: PUBLISHED_AT },
            snapshotJson: { stringValue: JSON.stringify(SNAPSHOT) },
          },
        }),
  );
}

describe("decideEventsCheck", () => {
  it("checks when the site runs the published version", () => {
    expect(
      decideEventsCheck({ deployed: 3, published: published(3), now: T0 }),
    ).toBe("check");
  });

  it("waits while a new publish is still rebuilding", () => {
    expect(
      decideEventsCheck({
        deployed: 2,
        published: published(3),
        now: T0 + REBUILD_GRACE_MS - 1,
      }),
    ).toBe("wait");
  });

  it("calls the site stale once the rebuild is overdue", () => {
    expect(
      decideEventsCheck({
        deployed: 2,
        published: published(3),
        now: T0 + REBUILD_GRACE_MS,
      }),
    ).toBe("stale");
  });

  it("calls a site ahead of the published version stale", () => {
    expect(
      decideEventsCheck({ deployed: 4, published: published(3), now: T0 }),
    ).toBe("stale");
  });
});

describe("requireEventsVersion", () => {
  it("returns the published snapshot when the site has it", async () => {
    await expect(
      requireEventsVersion("demo", { fetchImpl: fetchFor(3, 3), now: T0 }),
    ).resolves.toEqual(SNAPSHOT);
  });

  it("returns null during the rebuild grace period", async () => {
    await expect(
      requireEventsVersion("demo", { fetchImpl: fetchFor(2, 3), now: T0 }),
    ).resolves.toBeNull();
  });

  it("fails when the rebuild is overdue", async () => {
    await expect(
      requireEventsVersion("demo", {
        fetchImpl: fetchFor(2, 3),
        now: T0 + REBUILD_GRACE_MS,
      }),
    ).rejects.toThrow(/version 2 but version 3 was published/);
  });

  it("fails without a project or a deployed version", async () => {
    await expect(
      requireEventsVersion(undefined, { fetchImpl: fetchFor(3, 3) }),
    ).rejects.toThrow(/project/);
    await expect(
      requireEventsVersion("demo", { fetchImpl: fetchFor(undefined, 3) }),
    ).rejects.toThrow(/show list version is invalid/);
  });
});
