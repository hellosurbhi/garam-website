import { test, expect } from "./monitor-fixture";

test("Notify Me saves the exact synthetic city signup", async ({
  page,
  monitor,
}) => {
  await page.goto("/tickets", { waitUntil: "domcontentloaded" });
  const button = page.locator("button[data-notify-city]:visible").first();
  await expect(button).toBeVisible({ timeout: 20_000 });
  await button.click();
  await page.locator("#notify-email").fill(monitor.email);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/capture-lead") &&
      response.request().method() === "POST",
  );
  await page.locator("[data-testid=notify-submit]").click();
  const response = await responsePromise;
  expect(response.status(), "Notify Me submission response").toBe(200);
  const body = await response.json();
  expect(body.id).toBeTruthy();
  await expect(page.locator("#notify-phone-view")).toBeVisible();
  await monitor.verify();
});
