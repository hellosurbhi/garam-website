#!/usr/bin/env node
// Patch (diff) coverage gate for CI.
//
// WHY this exists instead of a global coverage threshold or a hosted service
// (Codecov/Coveralls): a global threshold blocks unrelated PRs on legacy
// untested code (the admin dashboard, pending a full rewrite, see
// ENHANCEMENTS.md), and a hosted service means a new account, a new secret,
// and third-party access to source structure for a problem a short local
// script solves directly. This checks only the lines a PR actually changed,
// which is the standard "new code needs tests" enforcement (the same idea as
// Codecov's patch coverage or the diff-cover tool): a change with no test
// reads as 0% no matter how well-covered the rest of the file is, and old
// untested code never blocks a PR that does not touch it.
//
// Requires coverage/coverage-final.json (Istanbul-shaped v8 coverage,
// produced by `vitest run --coverage`) to already exist. Run
// `npm run test:coverage` before this script.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const THRESHOLD = 80;
const COVERAGE_FILE = "coverage/coverage-final.json";

// Only enforce on source files vitest can actually instrument. Astro files
// are compiled by Astro's own pipeline and never imported under vitest, so
// they never appear in coverage-final.json -- including them here would
// always read as 0% and fail every template-only PR for a metric that
// cannot exist for that file type.
const INCLUDE_RE = /^(src|api)\/.*\.(ts|tsx)$/;
const EXCLUDE_RE =
  /(\.test\.|\.spec\.|\/data\/|^src\/types\/|\.config\.|\/test\/setup)/;

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
}

// Default to origin/main for ad-hoc local runs; CI always sets this from
// github.event.pull_request.base.sha. No silent no-base skip: a missing base
// is a config problem to surface, not a green check that never ran.
const baseSha = process.env.DIFF_BASE_SHA || "origin/main";
const headSha = process.env.DIFF_HEAD_SHA || "HEAD";

if (!existsSync(COVERAGE_FILE)) {
  console.error(
    `${COVERAGE_FILE} not found. Run "npm run test:coverage" before this script.`,
  );
  process.exit(1);
}

const coverage = JSON.parse(readFileSync(COVERAGE_FILE, "utf8"));

// Any statement with a hit count > 0 marks every line in its range covered.
function coveredLinesFor(fileCoverage) {
  const covered = new Set();
  for (const key of Object.keys(fileCoverage.statementMap)) {
    if (fileCoverage.s[key] > 0) {
      const { start, end } = fileCoverage.statementMap[key];
      for (let line = start.line; line <= end.line; line++) covered.add(line);
    }
  }
  return covered;
}

// coverage-final.json keys are absolute paths; normalize to repo-relative
// forward-slash paths so they match the diff parser below.
const repoRoot = sh("git rev-parse --show-toplevel").trim();
const coverageByRelPath = new Map();
for (const [absPath, fileCoverage] of Object.entries(coverage)) {
  const relPath = absPath.startsWith(repoRoot)
    ? absPath.slice(repoRoot.length + 1)
    : absPath;
  coverageByRelPath.set(relPath, coveredLinesFor(fileCoverage));
}

// Parse a zero-context unified diff into { file -> Set<addedLineNumber> }.
// Zero context means every emitted line is a real add/remove, so the running
// line counter needs no special casing for unchanged context lines.
const diff = sh(`git diff --unified=0 ${baseSha} ${headSha}`);

const changedLines = new Map(); // relPath -> Set<number>
let currentFile = null;
let trackFile = false;
let nextLine = null;

for (const line of diff.split("\n")) {
  const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
  if (fileMatch) {
    currentFile = fileMatch[1];
    trackFile = INCLUDE_RE.test(currentFile) && !EXCLUDE_RE.test(currentFile);
    continue;
  }
  const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunkMatch) {
    nextLine = Number(hunkMatch[1]);
    continue;
  }
  if (trackFile && line.startsWith("+") && !line.startsWith("+++")) {
    if (!changedLines.has(currentFile)) {
      changedLines.set(currentFile, new Set());
    }
    changedLines.get(currentFile).add(nextLine);
    nextLine++;
  }
}

let totalChanged = 0;
let totalCovered = 0;
const uncoveredByFile = new Map();

for (const [file, lines] of changedLines) {
  const covered = coverageByRelPath.get(file) ?? new Set();
  for (const lineNum of lines) {
    totalChanged++;
    if (covered.has(lineNum)) {
      totalCovered++;
    } else {
      if (!uncoveredByFile.has(file)) uncoveredByFile.set(file, []);
      uncoveredByFile.get(file).push(lineNum);
    }
  }
}

if (totalChanged === 0) {
  console.log(
    "No coverable src/**/*.ts(x) or api/**/*.ts lines changed -- nothing to enforce.",
  );
  process.exit(0);
}

const pct = (totalCovered / totalChanged) * 100;
console.log(
  `Patch coverage: ${totalCovered}/${totalChanged} changed lines covered (${pct.toFixed(1)}%)`,
);

if (pct < THRESHOLD) {
  console.error(
    `\nFAILED: patch coverage ${pct.toFixed(1)}% is below the ${THRESHOLD}% threshold.\n`,
  );
  console.error("Uncovered changed lines:");
  for (const [file, lines] of uncoveredByFile) {
    if (lines.length > 0) console.error(`  ${file}: lines ${lines.join(", ")}`);
  }
  console.error(
    "\nAdd or extend a test so these lines execute, then push again.",
  );
  process.exit(1);
}

console.log(`Patch coverage OK (>= ${THRESHOLD}%).`);
