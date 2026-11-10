import { describe, expect, it, vi } from "vitest";
import { checkRedisHealth } from "./check-redis-health.mjs";

const connection = {
  url: "https://fixture.upstash.io",
  authorization: "Bearer fixture-only",
};
describe("packaged Redis health check", () => {
  it("sends exactly one authenticated PING without forwarding limiter commands", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json([{ result: "PONG" }]));
    const log = vi.fn();
    await checkRedisHealth(connection, { fetch, log });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://fixture.upstash.io/pipeline");
    expect(options.headers.authorization).toBe(connection.authorization);
    expect(JSON.parse(options.body)).toEqual([["PING"]]);
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("PONG"));
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      connection.authorization,
    );
  });
  it.each([401, 403, 429, 503])("fails on HTTP %s", async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status }));
    await expect(checkRedisHealth(connection, { fetch })).rejects.toThrow(
      `HTTP ${status}`,
    );
  });
  it.each(
    [[{ result: "NO" }], [{ error: "denied" }], [], { result: "PONG" }].map(
      (result) => ({ result }),
    ),
  )("rejects non-PONG responses %j", async ({ result }) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(result));
    await expect(checkRedisHealth(connection, { fetch })).rejects.toThrow(
      "expected PONG",
    );
  });
  it("fails closed on transport timeouts without exposing sensitive errors", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error(connection.authorization));
    await expect(checkRedisHealth(connection, { fetch })).rejects.toThrow(
      "network error, timeout",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["network", 429, 503])(
    "recovers after one transient failure %s",
    async (failure) => {
      const fetch = vi.fn();
      if (failure === "network")
        fetch.mockRejectedValueOnce(new Error("offline"));
      else fetch.mockResolvedValueOnce(new Response("", { status: failure }));
      fetch.mockResolvedValueOnce(Response.json([{ result: "PONG" }]));
      await checkRedisHealth(connection, { fetch, log: vi.fn() });
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );
  it.each([401, 403])(
    "does not retry invalid authorization HTTP %s",
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(new Response("", { status }));
      await expect(checkRedisHealth(connection, { fetch })).rejects.toThrow(
        `HTTP ${status}`,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("fails on malformed JSON", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("not JSON"));
    await expect(checkRedisHealth(connection, { fetch })).rejects.toThrow(
      "invalid JSON",
    );
  });
  it("fails production when the artifact does not exercise a configured connection", async () => {
    const fetch = vi.fn();
    await expect(
      checkRedisHealth(undefined, { fetch, required: true }),
    ).rejects.toThrow("no configured Redis connection");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("explicitly skips unconfigured local or CI builds", async () => {
    const fetch = vi.fn();
    const log = vi.fn();
    await checkRedisHealth(undefined, { fetch, log });
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("skipped"));
  });
  it("rejects insecure endpoints before sending authorization", async () => {
    const fetch = vi.fn();
    await expect(
      checkRedisHealth(
        { ...connection, url: "http://fixture.upstash.io" },
        { fetch },
      ),
    ).rejects.toThrow("invalid Upstash endpoint");
    expect(fetch).not.toHaveBeenCalled();
  });
});

it("pauses once before a transient retry but never after an auth failure", async () => {
  const sleep = vi.fn().mockResolvedValue(undefined);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json([{ result: "PONG" }]));
  await checkRedisHealth(connection, { fetch, sleep, log: vi.fn() });
  expect(sleep).toHaveBeenCalledExactlyOnceWith(250);
  expect(sleep.mock.invocationCallOrder[0]).toBeLessThan(
    fetch.mock.invocationCallOrder[1],
  );
  sleep.mockClear();
  await expect(
    checkRedisHealth(connection, {
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
      sleep,
    }),
  ).rejects.toThrow("HTTP 401");
  expect(sleep).not.toHaveBeenCalled();
});

it.each(["network", "body", 429, 503])(
  "delays exactly once on transient %s failures",
  async (kind) => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn();
    if (kind === "network") fetch.mockRejectedValue(new Error("offline"));
    else if (kind === "body")
      fetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("transport");
        },
      });
    else
      fetch.mockImplementation(
        async () => new Response(null, { status: kind }),
      );
    await expect(
      checkRedisHealth(connection, { fetch, sleep, log: vi.fn() }),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(250);
  },
);
