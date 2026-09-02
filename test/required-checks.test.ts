import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// WHY this test exists: the emulator rules job was added to ci.yml as a second
// job, but the documented required-check list in
// scripts/setup-branch-protection.sh was left at the single original context.
// A red "Firestore/Storage rules (emulator)" therefore did not block a merge,
// and that job is the only gate on firestore.rules/storage.rules. The drift was
// silent because nothing tied the two files together. This test is that tie:
// adding a job to ci.yml without adding it to the required list, or renaming
// either side alone, now fails the suite instead of quietly leaving a gate
// advisory.
//
// It also pins the two properties that make requiring EVERY job safe: no path
// filter on the trigger, and no job-level `if:`. A required check that can
// decline to report blocks the PR forever (hit on PR #139). Neither property is
// invented here: both are the owner decision recorded in the ci.yml header on
// 2026-07-14 ("Full CI now runs on EVERY PR ... no conditional skips and no
// success reported without the checks actually running"), and this test is
// where that decision is enforced rather than merely written down. An advisory
// job is still allowed, it just has to be declared: add it to a named exception
// list here, with the reason it does not gate, so the choice is visible instead
// of being an omission nobody notices.
//
// What this test CANNOT check: the "Protect Main" ruleset itself, which lives
// in GitHub Settings and is the only thing that actually blocks a merge. Set
// equality across these two files is necessary, not sufficient; the ruleset
// half needs a human (see [NON-BLOCKING-RULES-GATE] in BUGS.md).

const ciYml = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf-8",
);
const protectionScript = readFileSync(
  join(process.cwd(), "scripts/setup-branch-protection.sh"),
  "utf-8",
);

/** ci.yml lines with whole-line comments dropped, so prose about a key (the
 * header's "WHY there is no paths-ignore") is never read as the key itself. */
const ciDirectives = ciYml
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

interface CiJob {
  id: string;
  /** The string GitHub reports as the check name: `name:` if set, else the id. */
  checkName: string;
  conditional: boolean;
}

/**
 * Job-level keys sit at 4 spaces under a 2-space job id, and step-level keys at
 * 8 (steps themselves at 6, behind a `- `), so indentation alone separates them.
 */
function parseCiJobs(yaml: string): CiJob[] {
  const lines = yaml.split("\n");
  const jobsStart = lines.indexOf("jobs:");
  if (jobsStart === -1) return [];

  const jobs: CiJob[] = [];
  for (const line of lines.slice(jobsStart + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    // Any content back at column 0 ends the jobs block.
    if (!line.startsWith(" ")) break;

    const jobId = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobId) {
      jobs.push({ id: jobId[1], checkName: jobId[1], conditional: false });
      continue;
    }
    const current = jobs[jobs.length - 1];
    if (!current) continue;

    const name = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (name) current.checkName = name[1].replace(/^["']|["']$/g, "");
    if (/^ {4}if:/.test(line)) current.conditional = true;
  }
  return jobs;
}

/**
 * The whole gh-api payload in setup-branch-protection.sh is commented out (the
 * script is opt-in until the repo is on GitHub Pro), so uncomment first, then
 * read the `contexts` array out of the JSON body.
 */
function parseRequiredContexts(script: string): string[] {
  const uncommented = script
    .split("\n")
    .map((line) => line.replace(/^#\s?/, ""));
  const start = uncommented.findIndex((line) => line.includes('"contexts": ['));
  if (start === -1) return [];
  const end = uncommented.findIndex(
    (line, index) => index > start && line.includes("]"),
  );
  if (end === -1) return [];

  return uncommented
    .slice(start + 1, end)
    .flatMap((line) =>
      [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    );
}

const jobs = parseCiJobs(ciYml);
const requiredContexts = parseRequiredContexts(protectionScript);

describe("required status checks match the CI jobs", () => {
  it("parses both CI jobs and both required contexts", () => {
    // Guards the test itself: a parser that silently found nothing would make
    // every set comparison below pass vacuously.
    expect(jobs.map((job) => job.id)).toEqual(["check", "rules"]);
    expect(requiredContexts).toHaveLength(2);
  });

  it("requires every job in ci.yml, so no CI job is merely advisory", () => {
    const missing = jobs
      .map((job) => job.checkName)
      .filter((checkName) => !requiredContexts.includes(checkName));
    expect(
      missing,
      "add these ci.yml job names to the contexts array in scripts/setup-branch-protection.sh AND to the ruleset in GitHub Settings, Rules",
    ).toEqual([]);
  });

  it("requires no context that no job reports, so a merge cannot deadlock", () => {
    const checkNames = jobs.map((job) => job.checkName);
    const unreported = requiredContexts.filter(
      (context) => !checkNames.includes(context),
    );
    expect(
      unreported,
      "a required check with no matching ci.yml job never reports and blocks every PR forever (PR #139)",
    ).toEqual([]);
  });

  it("keeps the exact required check names", () => {
    // Spelled out because the real enforcement lives in the GitHub ruleset,
    // which no test can read. Renaming both files together would still match
    // here on set equality while the ruleset kept the old strings and silently
    // stopped matching, so the strings themselves are pinned.
    expect(requiredContexts).toEqual([
      "Lint, Types, Test, Build",
      "Firestore/Storage rules (emulator)",
    ]);
  });

  it("runs CI on every pull request, with no path filter", () => {
    expect(ciDirectives).toContain("pull_request:");
    expect(ciDirectives).not.toContain("paths-ignore");
    expect(ciDirectives).not.toContain("paths:");
  });

  it("has no conditional job, so every required check always reports", () => {
    expect(jobs.filter((job) => job.conditional).map((job) => job.id)).toEqual(
      [],
    );
  });
});
