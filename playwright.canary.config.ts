import { defineConfig, devices } from "@playwright/test";

// Config for the production apply canary (tests/canary). It drives the LIVE
// /apply page in three phone-shaped browser profiles and files a real draft
// through the real endpoints, so it only runs from
// .github/workflows/apply-canary.yml, which then reads the result back.
if (!process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error(
    "PLAYWRIGHT_BASE_URL is required: the canary targets a real deployment.",
  );
}

// WHY a hand-written Instagram UA on Chromium: CI cannot run Instagram's
// embedded browser. This reproduces the UA string and a narrow viewport (what
// server code and CSP can see), not the webview's internals.
const INSTAGRAM_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.35.108 Android (33/13; 420dpi; 1080x2400; Google; Pixel 7; panther; tensor; en_US; 590153444)";

export default defineConfig({
  testDir: "./tests/canary",
  timeout: 120_000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    screenshot: "only-on-failure",
    // WHY off: traces embed request headers, including the x-canary-sig
    // credential, and the failure report is uploaded as a CI artifact that
    // anyone with Actions read access can download.
    trace: "off",
  },
  reporter: [["html", { open: "never" }], ["list"]],
  projects: [
    { name: "iphone-safari", use: { ...devices["iPhone 13"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    {
      name: "instagram-webview",
      use: { ...devices["Pixel 7"], userAgent: INSTAGRAM_UA },
    },
  ],
});
