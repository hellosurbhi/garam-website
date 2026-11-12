import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

/** Probe the artifact's Redis connection with read-only PING and one transient retry, never a limiter command. */
export async function checkRedisHealth(
  connection,
  { fetch: fetchImpl, required = false, log = console.log, sleep = delay },
) {
  if (!connection) {
    assert.ok(
      !required,
      "Production Redis health check failed: no configured Redis connection was exercised",
    );
    log(
      "Redis health check skipped: Redis is not configured in this artifact.",
    );
    return;
  }
  const url = new URL(connection.url);
  assert.ok(
    url.protocol === "https:" &&
      url.hostname.endsWith(".upstash.io") &&
      !url.username &&
      !url.password,
    "Redis health check failed: invalid Upstash endpoint",
  );
  assert.ok(
    connection.authorization?.startsWith("Bearer "),
    "Redis health check failed: missing authorization",
  );
  const started = performance.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetchImpl(`${url.origin}/pipeline`, {
        method: "POST",
        headers: {
          authorization: connection.authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify([["PING"]]),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      if (attempt === 0) {
        log(
          "Redis health check: retrying once after a network error or timeout.",
        );
        await sleep(250);
        continue;
      }
      throw new Error(
        "Redis health check failed: network error, timeout after two attempts",
      );
    }
    if (
      !response.ok &&
      attempt === 0 &&
      (response.status === 429 || response.status >= 500)
    ) {
      await response.body?.cancel();
      log(`Redis health check: retrying once after HTTP ${response.status}.`);
      await sleep(250);
      continue;
    }
    assert.ok(
      response.ok,
      `Redis health check failed: HTTP ${response.status}`,
    );
    let result;
    try {
      result = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError) && attempt === 0) {
        log(
          "Redis health check: retrying once after a response timeout or transport error.",
        );
        await sleep(250);
        continue;
      }
      // Do not print response bodies or transport errors that could contain credentials.
      throw new Error(
        "Redis health check failed: network error, timeout or invalid JSON response",
      );
    }
    assert.ok(
      Array.isArray(result) &&
        result.length === 1 &&
        result[0]?.result === "PONG" &&
        !result[0]?.error,
      "Redis health check failed: expected PONG",
    );
    break;
  }
  log(
    `Live Redis health check passed: PONG in ${Math.round(performance.now() - started)}ms (read-only).`,
  );
}
