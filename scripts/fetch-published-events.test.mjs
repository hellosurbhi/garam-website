// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ATTEMPTS,
  OUTPUT_PATH,
  publishedDocUrl,
  run,
  toEnvelope,
} from "./fetch-published-events.mjs";

const SNAPSHOT = {
  events: [{ slug: "manhattan-2099-12-31", city: "Manhattan" }],
  tbaCities: [{ citySlug: "los-angeles" }],
};

/** `eventsPublished/current` exactly as the Firestore REST API returns it. */
function publishedDoc(snapshot = SNAPSHOT, version = 7) {
  return Response.json({
    fields: {
      version: { integerValue: String(version) },
      snapshotJson: { stringValue: JSON.stringify(snapshot) },
      publishedAt: { stringValue: "2026-11-11T12:00:00.000Z" },
      rebuild: { nullValue: null },
    },
    updateTime: "2026-11-11T12:00:00.000000Z",
  });
}

const VERCEL_PROD = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  PUBLIC_FIREBASE_PROJECT_ID: "demo-test",
};

function setup({ env, argv = [], fetch }) {
  const write = vi.fn(async () => {});
  const log = vi.fn();
  const error = vi.fn();
  const sleep = vi.fn(async () => {});
  return {
    write,
    log,
    error,
    sleep,
    go: () => run({ argv, env, fetch, sleep, write, log, error }),
  };
}

const alertCalls = (fetch) =>
  fetch.mock.calls.filter(([url]) => String(url).endsWith("/alert-failure"));

describe("fetch-published-events prebuild", () => {
  it("writes the published envelope on a production build", async () => {
    const fetch = vi.fn(async () => publishedDoc());
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(publishedDocUrl("demo-test"));
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/demo-test/databases/(default)/documents/eventsPublished/current",
    );
    // Public read: never a credential.
    expect(init.headers).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(t.write).toHaveBeenCalledTimes(1);
    const [path, body] = t.write.mock.calls[0];
    expect(path).toBe(OUTPUT_PATH);
    expect(path.endsWith("src/data/events.published.json")).toBe(true);
    expect(JSON.parse(body)).toEqual({
      version: 7,
      publishedAt: "2026-11-11T12:00:00.000Z",
      snapshot: SNAPSHOT,
    });
  });

  it("never fetches or writes in CI or local builds", async () => {
    const fetch = vi.fn();
    const t = setup({
      env: { CI: "true", PUBLIC_FIREBASE_PROJECT_ID: "demo-test" },
      fetch,
    });
    expect(await t.go()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(t.write).not.toHaveBeenCalled();
    expect(t.log).toHaveBeenCalledWith(
      expect.stringContaining("committed show list"),
    );
  });

  it("keeps the baseline on a non-production Vercel build with no project id", async () => {
    const fetch = vi.fn();
    const t = setup({ env: { VERCEL: "1", VERCEL_ENV: "preview" }, fetch });
    expect(await t.go()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(t.write).not.toHaveBeenCalled();
  });

  it("keeps the baseline, even in production, when nothing is published yet", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 404 }));
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(0);
    expect(t.write).not.toHaveBeenCalled();
    expect(alertCalls(fetch)).toHaveLength(0);
    expect(t.log).toHaveBeenCalledWith(
      expect.stringContaining("No published version"),
    );
  });

  it("fails a production build and pages ops when the read keeps failing", async () => {
    const fetch = vi.fn(async (url) =>
      String(url).endsWith("/alert-failure")
        ? new Response("{}")
        : new Response("down", { status: 503 }),
    );
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(1);
    expect(t.write).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(ATTEMPTS + 1);
    expect(t.sleep).toHaveBeenCalledTimes(ATTEMPTS - 1);
    const alerts = alertCalls(fetch);
    expect(alerts).toHaveLength(1);
    const [, init] = alerts[0];
    expect(init.headers.Origin).toBe("https://garammasaladating.com");
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({ flow: "ops", stage: "events_fetch" }),
    );
    expect(JSON.parse(init.body).errorMessage).toContain("HTTP 503");
  });

  it("fails a production build with no project id", async () => {
    const fetch = vi.fn(async () => new Response("{}"));
    const t = setup({
      env: { VERCEL: "1", VERCEL_ENV: "production" },
      fetch,
    });
    expect(await t.go()).toBe(1);
    expect(alertCalls(fetch)).toHaveLength(1);
  });

  it("keeps the baseline on a preview build when the read fails", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const t = setup({
      env: { ...VERCEL_PROD, VERCEL_ENV: "preview" },
      fetch,
    });
    expect(await t.go()).toBe(0);
    expect(t.write).not.toHaveBeenCalled();
    expect(alertCalls(fetch)).toHaveLength(0);
    expect(t.log).toHaveBeenCalledWith(expect.stringContaining("fetch failed"));
  });

  it("does not retry a 403 (rules not deployed)", async () => {
    const fetch = vi.fn(async (url) =>
      String(url).endsWith("/alert-failure")
        ? new Response("{}")
        : new Response("denied", { status: 403 }),
    );
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(t.sleep).not.toHaveBeenCalled();
  });

  it("recovers when a retry succeeds", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(publishedDoc());
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(0);
    expect(t.write).toHaveBeenCalledTimes(1);
  });

  it("fails production on a malformed snapshot instead of writing it", async () => {
    const fetch = vi.fn(async (url) =>
      String(url).endsWith("/alert-failure")
        ? new Response("{}")
        : publishedDoc({ events: "nope" }),
    );
    const t = setup({ env: VERCEL_PROD, fetch });
    expect(await t.go()).toBe(1);
    expect(t.write).not.toHaveBeenCalled();
  });
});

describe("npm run events:pull", () => {
  it("refreshes the committed baseline outside Vercel", async () => {
    const fetch = vi.fn(async () => publishedDoc());
    const t = setup({
      argv: ["--pull"],
      env: { PUBLIC_FIREBASE_PROJECT_ID: "demo-test" },
      fetch,
    });
    expect(await t.go()).toBe(0);
    expect(t.write).toHaveBeenCalledTimes(1);
  });

  it("fails loudly without a project id, and never pages", async () => {
    const fetch = vi.fn();
    const t = setup({ argv: ["--pull"], env: {}, fetch });
    expect(await t.go()).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(t.error).toHaveBeenCalledWith(
      expect.stringContaining("PUBLIC_FIREBASE_PROJECT_ID"),
    );
  });
});

describe("toEnvelope", () => {
  it.each([
    [{}, "version"],
    [{ fields: { version: { integerValue: "0" } } }, "version"],
    [{ fields: { version: { integerValue: "2" } } }, "publishedAt"],
    [
      {
        fields: {
          version: { integerValue: "2" },
          publishedAt: { stringValue: "2026-11-11T12:00:00.000Z" },
        },
      },
      "snapshotJson",
    ],
  ])("rejects %j", (doc, missing) => {
    expect(() => toEnvelope(doc)).toThrow(missing);
  });
});
