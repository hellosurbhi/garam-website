import { defineConfig } from "@playwright/test";

// Config for the daily synthetic apply-form monitor. Unlike tests/smoke this
// performs a REAL submission against production (no Firebase mocking), so it
// only ever runs from .github/workflows/synthetic-apply.yml, which also
// verifies the document landed and cleans it up.
if (!process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error(
    "PLAYWRIGHT_BASE_URL is required: the synthetic monitor targets a real deployment.",
  );
}

export default defineConfig({
  testDir: "./tests/synthetic",
  timeout: 90_000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  reporter: [["html", { open: "never" }], ["list"]],
  projects: [
    {
      name: "iphone",
      use: { viewport: { width: 375, height: 812 } },
    },
  ],
});
