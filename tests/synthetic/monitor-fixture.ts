import { test as base, expect } from "@playwright/test";
import { createAdmin } from "../../scripts/synthetic/admin.mjs";
import {
  beginAttempt,
  parseUpload,
  recordUpload,
  verifyAttempt,
} from "../../scripts/synthetic/ledger.mjs";
import {
  requireVersion,
  PRODUCTION,
} from "../../scripts/synthetic/deployment.mjs";

export const test = base.extend<{
  monitor: { email: string; verify: () => Promise<void> };
}>({
  monitor: async ({ page, context }, provide, info) => {
    if (process.env.PLAYWRIGHT_BASE_URL !== PRODUCTION)
      throw new Error("Production monitor requires the canonical site");
    await requireVersion(process.env.GITHUB_SHA);
    const store = await createAdmin();
    const flow = info.title.includes("Notify Me") ? "lead" : "application";
    const ledger = await beginAttempt(
      store,
      process.env.MONITOR_RUN_ID,
      flow,
      info.retry,
    );
    let uploadError: Error | undefined;
    // This observes and journals the real request before forwarding it unchanged.
    // It never mocks Firebase responses or bypasses authentication/rules.
    await context.route(
      "https://firebasestorage.googleapis.com/**",
      async (route) => {
        try {
          const request = route.request();
          const headers = await request.allHeaders();
          const upload = parseUpload(
            request.url(),
            request.method(),
            headers,
            request.postData(),
            store.bucket,
          );
          if (upload) await recordUpload(store, ledger, upload);
          else if (
            request.method() === "POST" &&
            !["upload", "upload, finalize", "finalize", "query"].includes(
              headers["x-goog-upload-command"],
            )
          )
            throw new Error("Unrecognized Firebase upload initiation");
          await route.continue();
        } catch (error) {
          uploadError =
            error instanceof Error ? error : new Error("Upload journal failed");
          await route.abort();
        }
      },
    );
    await context.route(`${PRODUCTION}/ingest/**`, (route) => route.abort());
    await context.route(`${PRODUCTION}/_vercel/insights/**`, (route) =>
      route.abort(),
    );
    // Synthetic visits must not inflate third-party marketing analytics.
    await context.route(
      /https:\/\/[^/]*(posthog\.com|google-analytics\.com|facebook\.com|vercel-insights\.com)\//,
      (route) => route.abort(),
    );
    await provide({
      email: ledger.data.email,
      verify: async () => {
        if (uploadError) throw uploadError;
        await expect(async () => verifyAttempt(store, ledger)).toPass({
          timeout: 45_000,
          intervals: [1000, 3000],
        });
        if (uploadError) throw uploadError;
      },
    });
    // Never log request bodies, auth tokens or raw network traces.
    await page.close();
  },
});
export { expect };
