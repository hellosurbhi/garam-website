import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    exclude: [
      "node_modules/**",
      // WHY: tests/smoke and tests/synthetic are PLAYWRIGHT suites (run via
      // playwright.config.ts and playwright.synthetic.config.ts); loading
      // them under vitest throws "Playwright Test did not expect test() to
      // be called here" and fails the whole run. test/rules needs the
      // Firebase emulator (npm run test:rules, CI job). None of these are
      // "disabled tests"; they run in their own harnesses.
      "tests/smoke/**",
      "tests/synthetic/**",
      "test/rules/**",
      ".stryker-tmp/**",
      ".worktrees/**",
      "dist/**",
      "playwright-report/**",
      ".vercel/**",
    ],
  },
});
