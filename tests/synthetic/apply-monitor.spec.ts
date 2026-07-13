/**
 * Daily synthetic apply submission against PRODUCTION.
 *
 * This is the only test class that exercises the real deployed stack:
 * security rules, Firebase project config, Vercel env vars, CSP headers.
 * Every marker below is load-bearing: the reserved email flags the document
 * as synthetic (client sets isSynthetic, notify-application skips emails,
 * admin dashboard hides it) and the cleanup script will only ever delete
 * documents carrying ALL of these markers.
 */
import { test, expect } from "@playwright/test";
import {
  SYNTHETIC_MONITOR_EMAIL,
  SYNTHETIC_MONITOR_NAME,
} from "../../src/lib/syntheticMonitor";

test("synthetic applicant can submit end to end on the live stack", async ({
  page,
}) => {
  await page.goto("/apply", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=apply-form]", {
    state: "visible",
    timeout: 20_000,
  });

  await page.fill("#field-name", SYNTHETIC_MONITOR_NAME);
  await page.fill("#field-age", "30");
  await page.selectOption("#field-gender", "Woman");
  await page.selectOption("#field-orientation", "Straight");
  await page.fill("#geo-place", "New York");
  await page.fill("#field-email", SYNTHETIC_MONITOR_EMAIL);
  await page.fill("#field-instagram", "garammasaladating");
  await page.setInputFiles("#photo-input", "tests/fixtures/1x1.png");
  await page.check('input[name="marketingConsent"][value="yes"]');
  await page.check('input[type="checkbox"]');

  const submit = page.locator("[data-testid=apply-submit]");
  await expect(submit).not.toBeDisabled({ timeout: 10_000 });
  await submit.click();

  // Real Firebase auth + upload + Firestore write on production.
  await expect(page.locator("[data-testid=apply-success]")).toBeVisible({
    timeout: 45_000,
  });
});
