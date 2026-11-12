/**
 * Critical user flows — the tests that catch what broke production twice.
 *
 * Group A: Apply form happy path + spinner-never-stuck regression
 * Group B: Lead capture forms (HomeSignup, LeadCaptureModal, NotifyModal)
 * Group C: Ticket / watch link integrity
 * Group D: Primary CTA sanity
 *
 * Form writes are intercepted before they reach either the site API or Firebase.
 * Unmocked mutations are blocked, including when this suite targets production.
 */

import { test, expect, type Page } from "@playwright/test";
import { allEvents } from "../../src/data/events";
import { checkTicketListings } from "../synthetic/ticket-checks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stand in for our own apply endpoints so the form can be driven offline. The
 * apply page talks only to /api/* and one signed storage URL (no Firebase SDK),
 * so these three routes are the whole surface. The real stack is exercised by
 * the production canary (.github/workflows/apply-canary.yml).
 */
async function mockApplyApi(
  page: Page,
  opts: { saveStatus?: number; saveBody?: Record<string, unknown> } = {},
) {
  const saves: Array<Record<string, unknown>> = [];
  await page.route("**/api/save-application", (route) => {
    saves.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({
      status: opts.saveStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        opts.saveBody ?? { ok: true, draftId: "d".repeat(32), token: "tok" },
      ),
    });
  });
  await page.route("**/api/upload-application-photo", (route) => {
    const { action } = route.request().postDataJSON() as { action: string };
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        action === "reserve"
          ? {
              ok: true,
              path: `photos/${"d".repeat(32)}/1-smoke.png`,
              uploadUrl: "https://storage.example.com/photos/smoke.png",
              contentType: "image/png",
            }
          : { ok: true },
      ),
    });
  });
  // The page is cross-origin to this host, so the browser sends a preflight
  // and rejects the PUT unless both answers carry the CORS headers.
  await page.route("https://storage.example.com/**", (route) =>
    route.fulfill({
      status: 200,
      body: "",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    }),
  );
  return saves;
}

// These tests exercise form behavior. Server persistence is covered separately.
// A context-level backstop blocks mutations that a future form adds without a mock.
test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", (route) =>
    ["GET", "HEAD", "OPTIONS"].includes(route.request().method())
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await page.route("**/api/capture-lead", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        id: "smoke-lead-local",
        updateToken: "smoke-update-local",
      }),
    }),
  );
  await page.route("**/api/update-lead", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );
});

test("form isolation: lead writes are mocked and unmocked writes are blocked", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const capture = await page.evaluate(async () => {
    const response = await fetch("/api/capture-lead", {
      method: "POST",
      body: JSON.stringify({ email: "smoketest@example.com" }),
    });
    return response.json();
  });
  expect(capture.id).toBe("smoke-lead-local");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("/api/unmocked-smoke-write", { method: "POST" });
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});

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
  await page.check('[data-testid="apply-terms"]');
}

// ---------------------------------------------------------------------------
// Group A: Apply form
// ---------------------------------------------------------------------------

test.describe("Apply form", () => {
  test("happy path: fills, submits, and shows the success panel", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const saves = await mockApplyApi(page);
    await page.goto("/apply", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=apply-form]", {
      state: "visible",
      timeout: 15_000,
    });

    await fillApplyForm(page);

    const submit = page.locator("[data-testid=apply-submit]");
    await expect(submit).not.toBeDisabled({ timeout: 5_000 });
    await submit.click();

    await expect(page.locator("[data-testid=apply-success]")).toBeVisible({
      timeout: 30_000,
    });
    expect(saves.some((body) => body.finalize === true)).toBe(true);
  });

  test("autosave: a name typed and abandoned is still filed with the server", async ({
    page,
  }) => {
    const saves = await mockApplyApi(page);
    await page.goto("/apply", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=apply-form]", {
      state: "visible",
      timeout: 15_000,
    });

    await page.fill("#field-name", "Half Done");
    await page.locator("#field-name").blur();

    await expect
      .poll(
        () =>
          saves.some((body) =>
            JSON.stringify(body.fields ?? body).includes("Half Done"),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("a server failure names the real cause, keeps the form, and pages once", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await mockApplyApi(page, {
      saveStatus: 500,
      saveBody: {
        error: "save_failed",
        stage: "finalize",
        detail: "deadline exceeded after 15s",
      },
    });
    // The static preview has no API routes; fulfill the alert endpoint so the
    // fire-and-forget request is observable.
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
      { timeout: 60_000 },
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

    // The spinner must always stop and the person must see an alert.
    await expect(page.locator('[role="alert"]').first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(submit).not.toBeDisabled({ timeout: 15_000 });
    await expect(page.locator("#field-name")).toHaveValue("Smoke Tester");

    // One failed submission = one alert carrying the raw reason and the
    // applicant's contact so they can be recovered.
    const body = (await alertRequest).postDataJSON() as {
      flow: string;
      stage: string;
      errorMessage: string;
      contact?: { email?: string };
    };
    expect(body.flow).toBe("apply");
    expect(body.stage).toBe("finalize");
    expect(body.errorMessage).toContain("deadline exceeded after 15s");
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

    // Step 2 (optional phone) must open after the email is captured; the
    // success state only appears once it is submitted or skipped.
    await expect(page.locator("#nl-step-2")).toBeVisible({ timeout: 10_000 });
    await page.fill("#nl-phone", "5551230100");
    await page.click("#nl-phone-form [type=submit]");

    await expect(page.locator("[data-testid=signup-success]")).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Standalone waiver (/waiver)", () => {
  // WHY: the form is a client:load React island over server-rendered HTML.
  // Filling before hydration types into inputs React then resets, and the
  // scroll lands before onScroll is attached, so the agree box never
  // unlocks (the production timeout in issue 336). Astro drops the island's
  // ssr attribute once hydration starts, but React may not have committed
  // yet, so the fill is retried until the unlocked checkbox proves it took.
  async function fillWaiverForm(page: Page) {
    await page
      .locator("astro-island:not([ssr]) [data-testid=waiver-form]")
      .waitFor({ timeout: 15_000 });
    const checkbox = page.getByRole("checkbox");
    await expect(async () => {
      await page.fill("#waiver-first-name", "Smoke");
      await page.fill("#waiver-last-name", "Tester");
      await page.fill("#waiver-email", "smoketest@example.com");
      await page.fill("#waiver-phone", "5551230100");
      // The waiver panel requires a scroll-through before agreeing. Start
      // from the top so a retry still produces a scroll to the bottom.
      const scroll = page.locator("[data-testid=waiver-scroll]");
      // Mobile WebKit has no mouse wheel, and two scrollTo calls in one frame
      // collapse into no scroll event, so wait a frame between them.
      await scroll.evaluate(async (el) => {
        el.scrollTo(0, 0);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        el.scrollTo(0, el.scrollHeight);
      });
      await expect(checkbox).toBeEnabled({ timeout: 2_000 });
      await expect(page.locator("#waiver-email")).toHaveValue(
        "smoketest@example.com",
      );
    }).toPass({ timeout: 15_000 });
    await page.fill("#waiver-signature", "Smoke Tester");
    await checkbox.check();
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

    // Step 2 (optional phone) opens after the email is captured; success
    // only appears once it is submitted or skipped.
    const phoneStep = dialog.locator('[data-lc-step="phone"]');
    await expect(phoneStep).toBeVisible({ timeout: 10_000 });
    await phoneStep.locator("[data-lc-phone]").fill("5551230100");
    await phoneStep.locator("[type=submit]").click();

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

    // Step 2 (optional phone) opens after the email is captured; success
    // only appears once it is submitted or skipped.
    await expect(page.locator("#notify-phone-view")).toBeVisible({
      timeout: 10_000,
    });
    await page.fill("#notify-phone", "5551230100");
    await page.click("#notify-phone-form [type=submit]");

    await expect(page.locator("[data-testid=notify-success]")).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Group C: Ticket and watch link integrity
// ---------------------------------------------------------------------------

test.describe("Ticket link integrity", () => {
  // WHY the shared checker instead of a selector loop: the old loop selected
  // a.ticket-card--live, but regular cards are a div wrapping
  // a.ticket-card__inner, so it matched zero of production's four ticket
  // links and passed no matter what they pointed at (issue 336).
  test("/tickets: every on-sale show links to its own checkout", async ({
    page,
    request,
  }) => {
    // "load" so the presale reveal script has run before :visible is read.
    await page.goto("/tickets", { waitUntil: "load" });
    // The static preview serves no /api/go route; a deployed target gets
    // the redirect and vendor listing checks too.
    const deployed = !!process.env.PLAYWRIGHT_BASE_URL;
    await checkTicketListings(page, request, allEvents, new Date(), {
      followRedirects: deployed,
      verifyListings: deployed,
    });
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

test("Notify Me supports native keyboard activation on existing and late cards", async ({
  page,
}) => {
  await page.goto("/tickets", { waitUntil: "domcontentloaded" });
  // A fixed native trigger keeps this regression useful even when all shows sell tickets.
  if ((await page.locator("button[data-notify-city]").count()) === 0) {
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.notifyCity = "Chicago";
      button.textContent = "Notify Me keyboard fixture";
      document.body.append(button);
    });
  }
  const button = page.locator("button[data-notify-city]").first();
  await expect(button).toBeVisible();
  const dialog = page.locator("dialog#notify-modal");
  for (const key of ["Enter", "Space"]) {
    await button.focus();
    await page.keyboard.press(key);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(button).toBeFocused();
  }
  await button.evaluate((element) => {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.id = "late-notify-test";
    element.after(clone);
  });
  const late = page.locator("#late-notify-test");
  await late.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(late).toBeFocused();
});
