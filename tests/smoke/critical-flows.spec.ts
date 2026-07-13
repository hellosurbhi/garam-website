/**
 * Critical user flows — the tests that catch what broke production twice.
 *
 * Group A: Apply form happy path + spinner-never-stuck regression
 * Group B: Lead capture forms (HomeSignup, LeadCaptureModal, NotifyModal)
 * Group C: Ticket / watch link integrity
 * Group D: Primary CTA sanity
 *
 * Firebase SDK calls go directly to googleapis.com; page.route() intercepts
 * them at the Playwright network layer so no real Firebase account is needed.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Intercept every Firebase googleapis.com call so the form submits offline. */
async function mockFirebase(page: Page) {
  // Anonymous auth
  await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        localId: "smoke-uid",
        idToken: "smoke-tok",
        refreshToken: "smoke-ref",
        expiresIn: "3600",
      }),
    }),
  );
  // Storage upload (resumable and single-request)
  await page.route("**/firebasestorage.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "applications/smoke.png",
        downloadTokens: "smoke-token",
      }),
    }),
  );
  // Firestore write
  await page.route("**/firestore.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "projects/p/databases/(default)/documents/applications/smoke123",
      }),
    }),
  );
}

/** Fill every required apply form field so isValid becomes true. */
async function fillApplyForm(page: Page) {
  await page.fill("#field-name", "Smoke Tester");
  await page.fill("#field-age", "28");
  await page.selectOption("#field-gender", "Woman");
  await page.selectOption("#field-orientation", "Straight");
  await page.fill("#geo-place", "New York");
  await page.fill("#field-email", "smoketest@example.com");
  await page.fill("#field-instagram", "smoketester");

  // Photo upload — required for submission.
  // Path is relative to process.cwd() (project root) where Playwright runs.
  await page.setInputFiles("#photo-input", "tests/fixtures/1x1.png");

  // marketingConsent must be "yes"
  await page.check('input[name="marketingConsent"][value="yes"]');

  // Terms checkbox — no name attr; only 1 checkbox exists in self-application mode
  // (nomination-consent checkbox is only rendered when "For a friend" is selected)
  await page.check('input[type="checkbox"]');
}

// ---------------------------------------------------------------------------
// Group A: Apply form
// ---------------------------------------------------------------------------

test.describe("Apply form", () => {
  test("happy path: fills, submits, shows success panel", async ({ page }) => {
    test.setTimeout(60_000);
    await mockFirebase(page);
    await page.goto("/apply", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=apply-form]", {
      state: "visible",
      timeout: 15_000,
    });

    await fillApplyForm(page);

    // Submit button must become enabled once form is valid
    const submit = page.locator("[data-testid=apply-submit]");
    await expect(submit).not.toBeDisabled({ timeout: 5_000 });

    await submit.click();

    // Success panel must appear within 30s (Firebase init + write budgets)
    await expect(page.locator("[data-testid=apply-success]")).toBeVisible({
      timeout: 30_000,
    });

    // Spinner must NOT still be present
    await expect(page.locator("[data-testid=apply-submit]")).not.toBeAttached();
  });

  test("timeout regression: spinner always stops when Firebase hangs", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // Auth hangs forever — simulates Firebase Auth service down
    await page.route("**/identitytoolkit.googleapis.com/**", () => {
      // Never fulfill — route just absorbs the request
    });
    // Storage / Firestore don't matter (never reached)
    await page.route("**/firebasestorage.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.route("**/firestore.googleapis.com/**", (route) =>
      route.abort(),
    );
    // The static preview has no API routes; fulfill the alert endpoint so the
    // fire-and-forget request is observable.
    await page.route("**/api/alert-failure", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sent: true }),
      }),
    );
    const alertRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/alert-failure") && req.method() === "POST",
      { timeout: 20_000 },
    );

    await page.goto("/apply", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=apply-form]", {
      state: "visible",
      timeout: 15_000,
    });

    await fillApplyForm(page);

    const submit = page.locator("[data-testid=apply-submit]");
    await expect(submit).not.toBeDisabled({ timeout: 5_000 });
    await submit.click();

    // Within 15s (well inside the 10s Firebase auth timeout), the button must
    // re-enable (finally block ran) and an error toast/alert must be visible.
    await expect(submit).not.toBeDisabled({ timeout: 15_000 });
    const alert = page.locator('[role="alert"]');
    await expect(alert.first()).toBeVisible({ timeout: 15_000 });

    // One failed submission = one immediate producer alert, carrying the
    // applicant's contact fields for recovery.
    const req = await alertRequest;
    const body = req.postDataJSON() as {
      flow: string;
      stage: string;
      contact?: { email?: string };
    };
    expect(body.flow).toBe("apply");
    expect(body.stage).toBe("submit");
    expect(body.contact?.email).toBe("smoketest@example.com");
  });
});

// ---------------------------------------------------------------------------
// Group B: Lead capture forms
// ---------------------------------------------------------------------------

test.describe("HomeSignup (Spice List)", () => {
  test("submits email and shows success state", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.fill(
      "[data-testid=signup-email-input]",
      "smoketest@example.com",
    );
    await page.click("[data-testid=signup-submit]");

    await expect(page.locator("[data-testid=signup-success]")).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Standalone waiver (/waiver)", () => {
  async function fillWaiverForm(page: Page) {
    await page.fill("#waiver-first-name", "Smoke");
    await page.fill("#waiver-last-name", "Tester");
    await page.fill("#waiver-email", "smoketest@example.com");
    await page.fill("#waiver-phone", "5551230100");
    // The waiver panel requires a scroll-through before agreeing.
    await page
      .locator("[data-testid=waiver-scroll]")
      .evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.fill("#waiver-signature", "Smoke Tester");
    await page.check('input[type="checkbox"]');
  }

  test("happy path: reads, signs, submits, sees confirmation", async ({
    page,
  }) => {
    await page.route("**/api/stage-waiver", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto("/waiver", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=waiver-form]", {
      state: "visible",
      timeout: 15_000,
    });

    const submit = page.locator("[data-testid=waiver-submit]");
    await expect(submit).toBeDisabled();
    await fillWaiverForm(page);
    await expect(submit).not.toBeDisabled({ timeout: 5_000 });
    await submit.click();

    await expect(page.locator("[data-testid=waiver-success]")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("failure path: shows the error and fires the producer alert", async ({
    page,
  }) => {
    await page.route("**/api/stage-waiver", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Could not save your waiver." }),
      }),
    );
    await page.route("**/api/alert-failure", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
    const alertRequest = page.waitForRequest(
      (req) =>
        req.url().includes("/api/alert-failure") && req.method() === "POST",
      { timeout: 15_000 },
    );

    await page.goto("/waiver", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=waiver-form]", {
      state: "visible",
      timeout: 15_000,
    });
    await fillWaiverForm(page);
    await page.click("[data-testid=waiver-submit]");

    await expect(page.locator('[role="alert"]').first()).toBeVisible({
      timeout: 10_000,
    });
    const body = (await alertRequest).postDataJSON() as {
      flow: string;
      contact?: { email?: string };
    };
    expect(body.flow).toBe("waiver");
    expect(body.contact?.email).toBe("smoketest@example.com");
  });
});

test.describe("LeadCaptureModal", () => {
  test("submits email and shows success state", async ({ page }) => {
    await page.goto("/links", { waitUntil: "domcontentloaded" });

    // Trigger from links page
    const trigger = page.locator('[data-open-modal="links-spice-modal"]');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator("dialog#links-spice-modal");
    await expect(dialog).toHaveAttribute("open", { timeout: 3_000 });

    await page.fill(
      "[data-testid=lead-capture-email-input]",
      "smoketest@example.com",
    );
    await page.click("[data-testid=lead-capture-submit]");

    await expect(
      page.locator("[data-testid=lead-capture-success]"),
    ).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("NotifyModal", () => {
  test("submits email and shows success state", async ({ page }) => {
    // NotifyModal is triggered by TBA cards on the homepage and /tickets page.
    // Try homepage first; fall back to /tickets if no TBA cards exist.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    let notifyBtn = page.locator("button[data-notify-city]").first();
    if ((await notifyBtn.count()) === 0) {
      await page.goto("/tickets", { waitUntil: "domcontentloaded" });
      notifyBtn = page.locator("button[data-notify-city]").first();
    }

    if ((await notifyBtn.count()) === 0) {
      test.skip(true, "No TBA show cards found on homepage or /tickets");
      return;
    }

    await notifyBtn.click();

    const dialog = page.locator("dialog#notify-modal");
    await expect(dialog).toHaveAttribute("open", { timeout: 3_000 });

    await page.fill(
      "[data-testid=notify-email-input]",
      "smoketest@example.com",
    );
    await page.click("[data-testid=notify-submit]");

    await expect(page.locator("[data-testid=notify-success]")).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Group C: Ticket and watch link integrity
// ---------------------------------------------------------------------------

test.describe("Ticket link integrity", () => {
  test("/tickets: no live or sold-out card has a broken href", async ({
    page,
  }) => {
    await page.goto("/tickets", { waitUntil: "domcontentloaded" });

    const liveCards = await page
      .locator("a.ticket-card--live, a.ticket-card--soldout")
      .all();

    for (const card of liveCards) {
      const href = await card.getAttribute("href");
      expect(href, "Ticket card href must be present").toBeTruthy();
      expect(href, "Ticket card href must not be '#'").not.toBe("#");
      expect(
        href,
        `Ticket card href must not contain 'undefined': ${href}`,
      ).not.toContain("undefined");
      expect(href, `Ticket card href must start with https: ${href}`).toMatch(
        /^https:\/\//,
      );
    }
  });

  test("/links: event and social links are all valid https URLs", async ({
    page,
  }) => {
    await page.goto("/links", { waitUntil: "domcontentloaded" });

    // All external links on the links page
    const externalLinks = await page.locator("a[href^='http']").all();
    expect(
      externalLinks.length,
      "Links page should have external links",
    ).toBeGreaterThan(0);

    for (const link of externalLinks) {
      const href = await link.getAttribute("href");
      expect(href, "Link href must be present").toBeTruthy();
      expect(href, `Link href must not be '#': ${href}`).not.toBe("#");
      expect(
        href,
        `Link href must not contain 'undefined': ${href}`,
      ).not.toContain("undefined");
      expect(href, `Link href must start with https: ${href}`).toMatch(
        /^https:\/\//,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Group D: Primary CTA sanity
// ---------------------------------------------------------------------------

test.describe("Primary CTAs", () => {
  test("Home hero primary CTA points to /tickets", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const heroCta = page.locator("a.btn.btn-hot").first();
    await expect(heroCta).toBeVisible();
    const href = await heroCta.getAttribute("href");
    expect(href, "Hero CTA must point to /tickets").toBe("/tickets");
  });

  test("Nav Tickets link is present and correct", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navTickets = page.locator("nav a[href='/tickets']");
    await expect(navTickets.first()).toBeVisible();
  });

  test("Apply CTA in hero points to /apply", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const applyCta = page.locator("a.btn.btn-outline[href='/apply']").first();
    await expect(applyCta).toBeVisible();
  });
});
