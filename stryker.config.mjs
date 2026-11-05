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
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: {
    fileName: "reports/mutation/index.html",
  },

  // Thresholds: reporting bands only. The absolute break gate is null on purpose,
  // and there is deliberately no push-time, PR-time or scheduled mutation gate.
  // Mutation testing takes 15-20 minutes; wired into the push path as a ratchet
  // it could only ever get weaker (any dip became the new floor) while blocking
  // routine pushes, and the scheduled GitHub workflow that replaced it was
  // removed 2026-11-05 because its report-only PRs were never read. Running
  // `npm run mutation:ratchet` locally is an optional, manual, non-blocking check.
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
