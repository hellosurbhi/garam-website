/**
 * Synthetic lead capture against PRODUCTION, posted straight to the endpoint
 * the signup forms call. The reserved email keeps it out of Kit
 * (api/capture-lead skips synthetic addresses); scripts/synthetic-apply-verify.mjs
 * confirms the document landed in Firestore and deletes it.
 */
import { test, expect } from "@playwright/test";
import { SYNTHETIC_MONITOR_EMAIL } from "../../src/lib/syntheticMonitor";

test("lead capture saves a lead on the live stack", async ({ request }) => {
  const res = await request.post("/api/capture-lead", {
    data: {
      email: SYNTHETIC_MONITOR_EMAIL,
      name: "SYNTHETIC MONITOR",
      source: "synthetic-monitor",
      sourcePage: "/synthetic-monitor",
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.id, "capture-lead returned no document id").toBeTruthy();
});
