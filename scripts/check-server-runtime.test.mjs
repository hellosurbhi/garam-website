import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const temporary = [];
afterEach(() => {
  for (const path of temporary.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe("packaged Redis fixture diagnostics", () => {
  it.each([
    "not json",
    "[]",
    "{}",
    JSON.stringify([["GET", "key"]]),
    JSON.stringify([["eval", "script", 0, "invalid-limit"]]),
  ])("fails directly for malformed fixture input %s", (body) => {
    const artifact = mkdtempSync(join(tmpdir(), "gmd-fixture-regression-"));
    temporary.push(artifact);
    writeFileSync(
      join(artifact, ".vc-config.json"),
      JSON.stringify({ handler: "entry.mjs" }),
    );
    writeFileSync(
      join(artifact, "entry.mjs"),
      `export default { async fetch() {
      const response = await fetch("https://fixture.upstash.io/pipeline", {method: "POST", body: ${JSON.stringify(body)}});
      if (response.ok) console.log("fixture fetch resolved without a retry");
      return new Response(null, {status: 404});
    }};`,
    );
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/check-server-runtime.mjs"), "--worker", artifact],
      {
        input: JSON.stringify({
          routes: ["/api/test"],
          ticketLinks: [],
          requireRedisHealth: false,
        }),
        encoding: "utf8",
        timeout: 5000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("fixture fetch resolved without a retry");
    expect(result.stderr).toContain(
      "Unexpected Redis command or malformed body",
    );
    expect(result.stderr).not.toContain("Timeout: Upstash");
    expect(result.stderr).not.toContain(body);
  });
});
