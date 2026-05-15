import { defineConfig } from "@playwright/test";

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const hasRemoteURL = !!remoteBaseURL;

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30000,
  retries: 1,
  ...(hasRemoteURL
    ? {}
    : {
        webServer: {
          command:
            "npm run build && node tests/smoke/static-preview.mjs 4321 dist/client",
          port: 4321,
          reuseExistingServer: true,
          timeout: 180000, // 3 min — Astro build in CI can take 60-90s
        },
      }),
  use: {
    baseURL: remoteBaseURL || "http://localhost:4321",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  reporter: [["html", { open: "never" }], ["list"]],
  projects: [
    {
      name: "iphone",
      use: { viewport: { width: 375, height: 812 } },
    },
    {
      name: "ipad",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "ipad-landscape",
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
});
