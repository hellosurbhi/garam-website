import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
const source = readFileSync(".github/workflows/synthetic-apply.yml", "utf8");
function concurrency(job) {
  const group = job === "synthetic" ? "synthetic-apply" : "synthetic-report";
  const block = source
    .split(`group: ${group}\n`)[1]
    ?.split("    steps:")[0]
    ?.split("    env:")[0];
  if (!block) throw new Error(`Missing concurrency group ${group}`);
  return block;
}
it.each(["synthetic", "report"])(
  "retains pending %s jobs without canceling active work",
  (job) => {
    expect(concurrency(job)).toMatch(/cancel-in-progress: false/);
    expect(concurrency(job)).toMatch(/queue: max/);
  },
);
it.each([
  ["ready", true, false, true],
  ["ready", false, true, true],
  ["superseded", true, false, false],
  ["superseded", false, true, false],
  [undefined, false, true, false],
  ["ready", false, false, false],
])(
  "gates redirects on revision %s and execution state",
  (state, succeeded, failed, expected) => {
    const expression = source.match(/id: redirects\n\s+if: ([^\n]+)/)?.[1];
    expect(expression).toBeDefined();
    expect(
      runInNewContext(
        expression,
        {
          success: () => succeeded,
          failure: () => failed,
          steps: { preversion: { outputs: { state } } },
        },
        { timeout: 1000 },
      ),
    ).toBe(expected);
  },
);
