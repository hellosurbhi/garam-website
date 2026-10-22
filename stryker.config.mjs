/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // Use vitest to run your tests against mutations
  testRunner: "vitest",

  // Only mutate YOUR source code, not tests or config
  mutate: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/**/data/**/*.ts",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
  ],

  // Start with a focused scope - don't mutate everything at once
  // Uncomment and adjust to target specific directories first:
  // mutate: ['src/utils/**/*.ts', 'src/lib/**/*.ts'],

  // Reporters
  // "json" (default output: reports/mutation/mutation.json) feeds
  // scripts/mutation-audit-summary.mjs, the weekly scheduled audit
  // (.github/workflows/mutation-audit.yml) -- it needs per-mutant file/line/
  // mutator detail that the clear-text table doesn't carry.
  reporters: ["html", "clear-text", "progress", "json"],
  htmlReporter: {
    fileName: "reports/mutation/index.html",
  },

  // Thresholds: reporting bands only. The absolute break gate is null on purpose,
  // and there is deliberately no push-time or PR-time mutation gate at all as of
  // 2026-07-16 (see .github/workflows/mutation-audit.yml). Mutation testing takes
  // 15-20 minutes and was wired into the push path as a ratchet that could only
  // ever get weaker over time (any dip became the new floor) while also blocking
  // routine pushes for minutes. It now runs on a schedule instead and opens a
  // draft PR with findings; a human decides what to do with them. Running
  // `npm run mutation:ratchet` locally is still available as an optional,
  // manual, non-blocking check, not an enforced gate.
  thresholds: {
    high: 80,
    low: 65,
    break: null,
  },

  // Performance: use incremental mode so re-runs only test changed files
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",

  // Skip build artifacts and large dirs when copying to sandbox
  ignorePaths: ["dist", ".astro", ".vercel", "playwright-report"],
  ignorePatterns: [".claude", ".stryker-tmp"],

  // Timeout: mutations that take too long are killed
  timeoutMS: 60000,

  // Concurrency: use available cores
  concurrency_comment: "defaults to CPU cores - 1, which is fine",
};
