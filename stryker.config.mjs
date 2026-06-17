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

  // Thresholds - start lenient, tighten over time
  thresholds: {
    high: 80,
    low: 65,
    break: 60, // CI fails if mutation score drops below 50%
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
