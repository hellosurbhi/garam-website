import assert from "node:assert/strict";

/** Probe the artifact's Redis connection with one read-only PING, never a limiter command. */
export async function checkRedisHealth(
  connection,
  { fetch: fetchImpl, required = false, log = console.log },
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
  let response;
  let result;
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
    assert.ok(
      response.ok,
      `Redis health check failed: HTTP ${response.status}`,
    );
    result = await response.json();
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    // Never print transport errors or response bodies that could contain credentials.
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
  log(
    `Live Redis health check passed: PONG in ${Math.round(performance.now() - started)}ms (read-only).`,
  );
}
