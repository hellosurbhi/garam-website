import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = readFileSync(".github/workflows/apply-canary.yml", "utf8");
// The streak filter from the email step, run through the real jq binary.
const filter = source.match(
  /CANARY_INCIDENT=.*--json createdAt,body,comments --jq '(.+?)' \|\| true\)/,
)?.[1];

function streak(issue) {
  if (!filter) throw new Error("Missing CANARY_INCIDENT jq filter");
  return execFileSync("jq", ["-r", filter], {
    input: JSON.stringify(issue ? [issue] : []),
    encoding: "utf8",
  }).trim();
}

const run = (id) => `Run: https://github.com/o/r/actions/runs/${id}`;
const bot = (body) => ({ author: { login: "github-actions" }, body });

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
        { author: { login: "hellosurbhi" }, body: `see ${run(9)}` },
        bot(run(2)),
        bot(run(2)),
        bot(run(3)),
      ],
    }),
  ).toBe("2026-11-12 3");
});

it("is empty when no incident is open", () => {
  expect(streak(undefined)).toBe("");
});
