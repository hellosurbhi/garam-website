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

  // Thresholds: reporting bands only. The absolute break gate is null on purpose:
  // the real score is ~29% and a 60% break blocked EVERY push that touched a test
  // file in the last 7 days, including the automation's own CI-fix pushes. The
  // enforced gate lives in scripts/mutation-ratchet.sh (repo-tracked): it blocks
  // any REGRESSION of the score vs the last recorded run. Invoked from
  // .husky/pre-push (falls through to it when ~/.git-hooks/pre-push is absent).
  // Run manually: npm run mutation:ratchet. Raise tests, the ratchet rises.
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
