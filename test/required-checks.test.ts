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
// job is still allowed, it just has to be declared: add it to ADVISORY_JOBS
// below, with the reason it does not gate, so the choice is visible instead of
// being an omission nobody notices.
//
// Three files carry the required-check list and all three are read here: the
// ci.yml job names, the `contexts` array in scripts/setup-branch-protection.sh,
// and the human-facing list in docs/security/REMEDIATION.md. The doc is not
// decoration: it is the instruction an operator follows when setting the
// ruleset by hand, so a stale name there ships a wrong click path.
//
// What this test CANNOT check: the "Protect Main" ruleset itself, which lives
// in GitHub Settings and is the only thing that actually blocks a merge. Set
// equality across these three files is necessary, not sufficient; the ruleset
// half needs a human (see [NON-BLOCKING-RULES-GATE] in BUGS.md).

const ciYml = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf-8",
);
const protectionScript = readFileSync(
  join(process.cwd(), "scripts/setup-branch-protection.sh"),
  "utf-8",
);
const remediationDoc = readFileSync(
  join(process.cwd(), "docs/security/REMEDIATION.md"),
  "utf-8",
);

/**
 * ci.yml jobs that deliberately do NOT gate a merge, keyed by job id, valued by
 * the reason they are advisory. Empty on purpose: today every job is required.
 *
 * This is the declared exception the header describes. An advisory job costs an
 * entry here and shows up in a diff as a decision someone made, which is the
 * opposite of how the emulator rules job became advisory (nobody chose it; a
 * name was simply never added to a list in another file). Jobs listed here are
 * exempt from the set-equality checks and from the no-`if:` rule, since the
 * report-or-deadlock hazard only applies to checks a merge waits on.
 *
 * WHY a Map and not a plain object: membership decides whether a job gates, and
 * on an object the natural test (`job.id in ADVISORY_JOBS`) walks the prototype
 * chain, so a ci.yml job named `constructor`, `toString`, `valueOf` or
 * `hasOwnProperty` answers true and is silently exempted from every gating
 * assertion with no entry here at all: an undeclared advisory job, which is the
 * precise failure this list exists to make impossible. An object literal has
 * the mirror problem on the writing side, where a `__proto__:` key sets the
 * prototype instead of adding an entry. A Map has neither behaviour, so the
 * allowlist means exactly what it lists.
 */
const ADVISORY_JOBS = new Map<string, string>([
  // ["job-id", "why this job deliberately does not gate a merge"],
]);

/** The one place membership is decided, so no caller can reintroduce `in`. */
function isAdvisory(jobId: string): boolean {
  return ADVISORY_JOBS.has(jobId);
}

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

/**
 * The doc states the same list in prose, as `- Require status checks: A; B`.
 * Semicolons separate the names because a check name contains commas of its own
 * ("Lint, Types, Test, Build"), which is also why this cannot be split on `,`.
 */
function parseDocumentedContexts(doc: string): string[] {
  const line = doc
    .split("\n")
    .find((candidate) => /^\s*-\s*Require status checks:/.test(candidate));
  if (!line) return [];
  return line
    .replace(/^\s*-\s*Require status checks:/, "")
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
}

const jobs = parseCiJobs(ciYml);
/** Jobs a merge actually waits on: every job that is not declared advisory. */
const gatingJobs = jobs.filter((job) => !isAdvisory(job.id));
const requiredContexts = parseRequiredContexts(protectionScript);
const documentedContexts = parseDocumentedContexts(remediationDoc);

/**
 * The jobs that have to be found for the parsers to be believed. Membership,
 * not equality, and deliberately so: adding a job to ci.yml is a legal edit,
 * and the tests below are what decide whether it gates. A guard that pinned the
 * whole job list would fail on that edit with a message about the parser, which
 * turns the one-line ADVISORY_JOBS entry the header promises into a hunt
 * through a test file the person adding the job has no reason to open.
 */
const PARSED_BASELINE_JOB_IDS = ["check", "rules"];

describe("required status checks match the CI jobs", () => {
  it("finds the known CI jobs and the required contexts, in every file that lists them", () => {
    // Guards the test itself: a parser that silently found nothing would make
    // every set comparison below pass vacuously.
    expect(jobs.map((job) => job.id)).toEqual(
      expect.arrayContaining(PARSED_BASELINE_JOB_IDS),
    );
    expect(requiredContexts.length).toBeGreaterThanOrEqual(
      PARSED_BASELINE_JOB_IDS.length,
    );
    expect(documentedContexts.length).toBeGreaterThanOrEqual(
      PARSED_BASELINE_JOB_IDS.length,
    );
  });

  it("requires every job in ci.yml, so no CI job is merely advisory", () => {
    const missing = gatingJobs
      .map((job) => job.checkName)
      .filter((checkName) => !requiredContexts.includes(checkName));
    expect(
      missing,
      "add these ci.yml job names to the contexts array in scripts/setup-branch-protection.sh AND to the ruleset in GitHub Settings, Rules (or declare the job advisory in ADVISORY_JOBS above, with a reason)",
    ).toEqual([]);
  });

  it("requires no context that no job reports, so a merge cannot deadlock", () => {
    const checkNames = gatingJobs.map((job) => job.checkName);
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

  it("states the same list in docs/security/REMEDIATION.md, the operator's click path", () => {
    // The doc is what a human reads while typing check names into the ruleset
    // by hand, so it drifting is not a documentation nit: it hands the operator
    // a name that matches no job, which is the PR #139 deadlock with extra
    // steps. Order included, so the two lists cannot diverge quietly.
    expect(
      documentedContexts,
      "keep the `- Require status checks:` line in docs/security/REMEDIATION.md in step with the contexts array in scripts/setup-branch-protection.sh",
    ).toEqual(requiredContexts);
  });

  it("declares every advisory job against a real ci.yml job, with a reason", () => {
    const jobIds = jobs.map((job) => job.id);
    const stale = [...ADVISORY_JOBS.keys()].filter(
      (id) => !jobIds.includes(id),
    );
    expect(
      stale,
      "ADVISORY_JOBS names a job that no longer exists in ci.yml; a stale exemption silently un-gates the next job that reuses the id",
    ).toEqual([]);
    const unexplained = [...ADVISORY_JOBS.entries()]
      .filter(([, reason]) => !reason.trim())
      .map(([id]) => id);
    expect(
      unexplained,
      "an advisory job needs the reason it does not gate written down, or it is the same silent omission this test exists to catch",
    ).toEqual([]);
  });

  it("exempts only the job ids actually listed, inherited property names included", () => {
    // Regression pin for the allowlist itself. While membership was tested with
    // `in` on a plain object, these four names were exempt from every gating
    // assertion below without appearing in ADVISORY_JOBS, so a job called
    // `constructor` could ship as a required check that required nothing. The
    // parser accepts any of them as a job id (`[A-Za-z0-9_-]+`), so nothing but
    // this stops one from being written.
    const inherited = ["constructor", "toString", "valueOf", "hasOwnProperty"];
    const yaml = [
      "jobs:",
      ...inherited.flatMap((id) => [`  ${id}:`, `    name: ${id} check`]),
    ].join("\n");

    // What is being pinned is "exempt only if listed", not "never exempt". A
    // prototype-named job is as declarable as any other: put it in
    // ADVISORY_JOBS with a reason and it should be advisory, like an ordinary
    // id would be. Asserting a bare `[]` here would instead outlaw those four
    // ids from the escape hatch the header offers everyone else, and it would
    // fail with a message about Object.prototype for someone whose entry is
    // correct, which is the same "the test knows better than the list" trap the
    // previous round removed from the parser guard above. So the expectation is
    // read off ADVISORY_JOBS rather than hard-coded: today it lists none of
    // them, so this is `[]` and the original regression is pinned unchanged.
    const declaredAdvisory = inherited.filter((id) => ADVISORY_JOBS.has(id));

    const parsed = parseCiJobs(yaml);
    expect(parsed.map((job) => job.id)).toEqual(inherited);
    expect(
      parsed.filter((job) => isAdvisory(job.id)).map((job) => job.id),
      "a job id that is also an Object.prototype key is exempt from the gating assertions without an ADVISORY_JOBS entry (it gates nothing while looking required), or a declared one is not exempt with an entry; either way membership is no longer being decided by the list alone",
    ).toEqual(declaredAdvisory);
  });

  it("runs CI on every pull request, with no path filter", () => {
    expect(ciDirectives).toContain("pull_request:");
    expect(ciDirectives).not.toContain("paths-ignore");
    expect(ciDirectives).not.toContain("paths:");
  });

  it("has no conditional gating job, so every required check always reports", () => {
    expect(
      gatingJobs.filter((job) => job.conditional).map((job) => job.id),
      "a required check behind a job-level `if:` can decline to report, which blocks the PR forever (PR #139); declare the job advisory in ADVISORY_JOBS if it genuinely should not gate",
    ).toEqual([]);
  });
});
