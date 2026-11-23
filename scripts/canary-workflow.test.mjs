import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const source = readFileSync(".github/workflows/apply-canary.yml", "utf8");
// The incident lookup from the email step, run as the real shell block.
const lookup = source.match(
  /\n\s*(CANARY_INCIDENT=[\s\S]*?)\n\s*export CANARY_INCIDENT/,
)?.[1];

// WHY a fake gh: the block must be tested as written, including how it pages
// comments. The fake applies the caller's own --jq filter with the real jq
// binary, per page like gh does. `gh issue list` mimics GitHub's GraphQL
// bound of 100 comments per issue; `gh api --paginate` serves 100 per page.
const FAKE_GH = `#!/bin/bash
set -e
fixture="$FIXTURE"
args=("$@")
jq_filter=""
for ((i = 0; i < \${#args[@]}; i++)); do
  if [ "\${args[$i]}" = "--jq" ]; then jq_filter="\${args[$((i + 1))]}"; fi
done
if [ "$1" = "issue" ]; then
  jq '[.[] | .comments |= .[0:100]]' "$fixture" | jq -r "$jq_filter"
elif [ "$1" = "api" ]; then
  jq -c '.[0].comments | [range(0; length; 100) as $s | .[$s:$s+100]] | .[]' "$fixture" |
    while read -r page; do echo "$page" | jq -r "$jq_filter"; done
else
  exit 1
fi
`;

// WHY a timeout shim: the workflow block calls coreutils `timeout`, which
// ubuntu runners have and stock macOS does not. Without it the lookup failed
// into its own `|| true` and returned empty, so the counting tests failed on
// a laptop whatever the workflow said. The workflow text stays untouched; the
// test supplies a portable stand-in first on PATH. Same contract as coreutils
// for what the block needs: run the command, kill it after N seconds and exit
// 124, otherwise pass its exit code through. Do not drop it to rely on the
// host: that is the failure this fixes.
const TIMEOUT_SHIM = `#!${process.execPath}
const { spawn } = require("node:child_process");
const [seconds, cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: "inherit" });
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
}, Number(seconds) * 1000);
child.on("error", () => process.exit(127));
child.on("close", (code, signal) => {
  clearTimeout(timer);
  process.exit(timedOut ? 124 : (code ?? 128));
});
`;

function toolDir() {
  const dir = mkdtempSync(join(tmpdir(), "canary-gh-"));
  writeFileSync(join(dir, "timeout"), TIMEOUT_SHIM);
  chmodSync(join(dir, "timeout"), 0o755);
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  return dir;
}

it("needs jq installed, and says so plainly when it is missing", () => {
  const found = spawnSync("sh", ["-c", "command -v jq"], { encoding: "utf8" });
  if (found.status !== 0) {
    throw new Error(
      "jq is required to run scripts/canary-workflow.test.mjs (the fake gh applies --jq filters with it). Install jq and rerun.",
    );
  }
});

it("timeout shim exits 124 when the command overruns and passes other codes through", () => {
  const shim = join(toolDir(), "timeout");
  expect(spawnSync(shim, ["1", "sleep", "10"]).status).toBe(124);
  expect(spawnSync(shim, ["5", "sh", "-c", "exit 3"]).status).toBe(3);
  expect(spawnSync(shim, ["5", "true"]).status).toBe(0);
});

function streak(issue) {
  if (!lookup) throw new Error("Missing CANARY_INCIDENT lookup block");
  const dir = toolDir();
  const fixture = join(dir, "issues.json");
  writeFileSync(
    fixture,
    JSON.stringify(issue ? [{ number: 7, ...issue }] : []),
  );
  return execFileSync(
    "bash",
    ["-c", `${lookup}\nprintf '%s' "$CANARY_INCIDENT"`],
    {
      encoding: "utf8",
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        FIXTURE: fixture,
        GITHUB_REPOSITORY: "o/r",
      },
    },
  ).trim();
}

// Real REST shape: comments posted with GITHUB_TOKEN carry the login
// "github-actions[bot]" (GraphQL says "github-actions"), checked against
// issue 409's comments.
const run = (id) => `Run: https://github.com/o/r/actions/runs/${id}`;
const bot = (body) => ({
  user: { login: "github-actions[bot]", type: "Bot" },
  body,
});

it("counts the incident-opening run once", () => {
  expect(
    streak({ createdAt: "2026-11-22T01:00:00Z", body: run(1), comments: [] }),
  ).toBe("2026-11-22 1");
});

it("counts distinct failed runs, ignoring reruns and human replies", () => {
  expect(
    streak({
      createdAt: "2026-11-12T01:00:00Z",
      body: run(1),
      comments: [
        bot(run(1)),
        {
          user: { login: "hellosurbhi", type: "User" },
          body: `see ${run(9)}`,
        },
        bot(run(2)),
        bot(run(2)),
        bot(run(3)),
      ],
    }),
  ).toBe("2026-11-12 3");
});

it("counts every failed run when the incident has more than one page of comments", () => {
  const comments = Array.from({ length: 150 }, (_, i) => bot(run(i + 2)));
  expect(
    streak({
      createdAt: "2026-11-01T01:00:00Z",
      body: run(1),
      comments,
    }),
  ).toBe("2026-11-01 151");
});

it("is empty when no incident is open", () => {
  expect(streak(undefined)).toBe("");
});
