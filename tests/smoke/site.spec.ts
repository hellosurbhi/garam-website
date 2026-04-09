import { test, expect, type Page } from "@playwright/test";

// =============================================
// ROUTE LISTS
// When you add a page, city, or journal post,
// add the slug to the appropriate array.
// =============================================

const STATIC_PAGES = [
  { path: "/", label: "Homepage" },
  { path: "/faq", label: "FAQ" },
  { path: "/apply", label: "Apply" },
  { path: "/tickets", label: "Tickets" },
  { path: "/hosts", label: "Hosts" },
  { path: "/links", label: "Links" },
  { path: "/journal", label: "Journal Index" },
  { path: "/south-asian-dating-tips", label: "Tips Index" },
  { path: "/cities", label: "Cities Hub" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Service" },
  { path: "/contestant-prep", label: "Contestant Prep" },
];

// Journal and tips slugs are discovered at runtime by scraping
// the index pages — no manual updates needed as posts go live.

const ACTIVE_CITIES = [
  "manhattan",
  "jersey-city",
  "san-diego",
  "los-angeles",
  "san-francisco",
  "salt-lake-city",
  "denver",
];

const SAMPLE_CITIES = ["chicago", "london", "toronto"];

const ALL_CITIES = [...ACTIVE_CITIES, ...SAMPLE_CITIES];

// =============================================
// THIRD-PARTY CONSOLE NOISE FILTER
// =============================================

const THIRD_PARTY_NOISE = [
  /favicon/i,
  /gtm\.js/i,
  /googletagmanager/i,
  /google.*analytics/i,
  /facebook/i,
  /fbevents/i,
  /connect\.facebook/i,
  /meta.*pixel/i,
  /tiktok/i,
  /posthog/i,
  /firebase/i,
  /firestore/i,
  /vercel.*speed-insights/i,
  /vercel.*analytics/i,
  /clarity\.ms/i,
  /sentry/i,
  /hotjar/i,
  /Failed to load resource.*favicon/i,
  /the server responded with a status of 404.*favicon/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /net::ERR_FAILED/i,
];

function isThirdPartyNoise(msg: string): boolean {
  return THIRD_PARTY_NOISE.some((re) => re.test(msg));
}

// =============================================
// SHARED HELPERS
// =============================================

function setupConsoleCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isThirdPartyNoise(msg.text())) {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function assertSeoMeta(page: Page) {
  const title = await page.title();
  expect(title.length, "Page title should not be empty").toBeGreaterThan(0);

  const desc = page.locator('meta[name="description"]');
  await expect(desc).toHaveAttribute("content", /.+/);

  const ogTitle = page.locator('meta[property="og:title"]');
  await expect(ogTitle).toHaveAttribute("content", /.+/);

  const ogDesc = page.locator('meta[property="og:description"]');
  await expect(ogDesc).toHaveAttribute("content", /.+/);

  const ogImage = page.locator('meta[property="og:image"]');
  await expect(ogImage).toHaveAttribute("content", /.+/);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.body.scrollWidth - window.innerWidth;
  });
  expect(overflow, "Page should not overflow horizontally").toBeLessThanOrEqual(
    1,
  );
}

async function assertSkipLink(page: Page) {
  const skipLink = page.locator('a.sr-skip-link[href="#main-content"]');
  expect(await skipLink.count(), "Skip link should exist").toBeGreaterThan(0);
}

async function assertNav(page: Page) {
  const nav = page.locator("nav");
  await expect(nav.first()).toBeVisible();
}

async function assertFooter(page: Page) {
  const footer = page.locator('footer[role="contentinfo"]');
  await expect(footer).toBeVisible();

  const logo = footer.locator("img.footer-logo");
  expect(await logo.count()).toBeGreaterThan(0);

  const legalPrivacy = footer.locator('a[href="/privacy"]');
  expect(await legalPrivacy.count()).toBeGreaterThan(0);

  const legalTerms = footer.locator('a[href="/terms"]');
  expect(await legalTerms.count()).toBeGreaterThan(0);
}

async function assertAllLinksValid(page: Page) {
  const links = await page.locator("a[href]").all();
  for (const link of links) {
    const href = await link.getAttribute("href");
    expect(href, "Link href should not be empty").toBeTruthy();
    expect(href, `Link href should not be bare "#"`).not.toBe("#");
    expect(
      href?.startsWith("javascript:"),
      `Link should not use javascript: protocol — ${href}`,
    ).toBeFalsy();
  }
}

async function assertAllButtonsAccessible(page: Page) {
  const buttons = await page.locator("button").all();
  for (const btn of buttons) {
    if (!(await btn.isVisible())) continue;
    const text = (await btn.textContent())?.trim() ?? "";
    const ariaLabel = (await btn.getAttribute("aria-label")) ?? "";
    const ariaLabelledBy = (await btn.getAttribute("aria-labelledby")) ?? "";
    const title = (await btn.getAttribute("title")) ?? "";
    expect(
      text.length > 0 ||
        ariaLabel.length > 0 ||
        ariaLabelledBy.length > 0 ||
        title.length > 0,
      "Visible button must have text, aria-label, aria-labelledby, or title",
    ).toBe(true);
  }
}

async function assertJsonLd(page: Page) {
  const scripts = page.locator('script[type="application/ld+json"]');
  expect(
    await scripts.count(),
    "Page should have at least one JSON-LD script",
  ).toBeGreaterThan(0);

  const first = await scripts.first().textContent();
  expect(
    () => JSON.parse(first!),
    "JSON-LD should be valid JSON",
  ).not.toThrow();
}

// =============================================
// SECTION A: STATIC PAGES SMOKE
// Every public page loads, has structure, no
// console errors, no overflow, valid links.
// =============================================

test.describe("Static pages smoke", () => {
  for (const { path, label } of STATIC_PAGES) {
    test(`${label} (${path})`, async ({ page }) => {
      const errors = setupConsoleCollector(page);
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${path} should return 200`).toBe(200);

      // Main content landmark
      const main = page.locator("main#main-content");
      expect(
        await main.count(),
        "main#main-content should exist",
      ).toBeGreaterThan(0);

      // No horizontal overflow
      await assertNoHorizontalOverflow(page);

      // SEO meta tags (skip for contestant-prep which has empty description)
      if (path !== "/contestant-prep") {
        await assertSeoMeta(page);
      }

      // Skip link
      await assertSkipLink(page);

      // Nav (present on all static pages)
      await assertNav(page);

      // Footer (present on all except contestant-prep which may vary)
      if (path !== "/contestant-prep") {
        await assertFooter(page);
      }

      // All links valid
      await assertAllLinksValid(page);

      // All buttons accessible
      await assertAllButtonsAccessible(page);

      // JSON-LD (skip non-public pages that don't have structured data)
      if (
        path !== "/contestant-prep" &&
        path !== "/privacy" &&
        path !== "/terms"
      ) {
        await assertJsonLd(page);
      }

      // Console errors
      expect(errors, `Console errors on ${path}`).toEqual([]);
    });
  }
});

// =============================================
// SECTION B: HOMEPAGE DEEP
// =============================================

test.describe("Homepage deep", () => {
  test("Hero section renders with CTAs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Hero
    const hero = page.locator("section.hero");
    await expect(hero).toBeVisible();

    const h1 = hero.locator("h1");
    await expect(h1).toBeVisible();

    const eyebrow = hero.locator(".hero-eyebrow");
    await expect(eyebrow).toBeVisible();

    // Get Tickets CTA
    const ticketCta = page.locator("a.btn.btn-hot");
    await expect(ticketCta).toBeVisible();
    const ticketHref = await ticketCta.getAttribute("href");
    expect(ticketHref).toBeTruthy();

    // Apply CTA
    const applyCta = page.locator('a.btn.btn-outline[href="/apply"]');
    await expect(applyCta).toBeVisible();
  });

  test("Shows section with event cards", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const shows = page.locator("section.shows#shows");
    await expect(shows).toBeVisible();

    const heading = shows.locator("#shows-heading");
    await expect(heading).toBeVisible();

    // At least one show card (live or notify)
    const cards = page.locator(".show-card");
    expect(
      await cards.count(),
      "Should have at least one show card",
    ).toBeGreaterThan(0);

    // Live cards should be links to eventbrite
    const liveCards = await page.locator("a.show-card--live").all();
    for (const card of liveCards) {
      const href = await card.getAttribute("href");
      expect(href, "Live show card should link somewhere").toBeTruthy();
    }

    // TBA cards should be buttons with data-notify-city
    const tbaCards = await page.locator("button.show-card--notify").all();
    for (const card of tbaCards) {
      const city = await card.getAttribute("data-notify-city");
      expect(city, "TBA card should have data-notify-city").toBeTruthy();
    }
  });

  test("Request city modal opens and closes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("#request-city-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator("dialog#request-city-modal");
    await expect(dialog).toHaveAttribute("open", { timeout: 3000 });

    // Modal contents
    await expect(page.locator("#city-name")).toBeVisible();
    await expect(page.locator("#city-email")).toBeVisible();
    await expect(dialog.locator('button[type="submit"]')).toBeVisible();

    // Close
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", { timeout: 3000 });
  });

  test("FAQ accordion works", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const faqItems = page.locator("details.faq-item");
    expect(await faqItems.count(), "Homepage should have 5 FAQ items").toBe(5);

    // Click first FAQ
    const firstSummary = faqItems.first().locator("summary");
    await firstSummary.click();
    await expect(faqItems.first()).toHaveAttribute("open", { timeout: 2000 });

    // CTA links
    await expect(page.locator('a.faq-cta-btn[href="/tickets"]')).toBeVisible();
    await expect(page.locator('a.faq-cta-link[href="/apply"]')).toBeVisible();
  });

  test("Email popup dialog exists in DOM", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const dialog = page.locator("dialog#email-popup");
    expect(await dialog.count(), "Email popup dialog should be in DOM").toBe(1);
    expect(
      await page.locator("#popup-email").count(),
      "Popup email input should exist",
    ).toBe(1);
  });

  test("Nav links are all valid", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navLinks = page.locator("nav a[href]");
    const count = await navLinks.count();
    expect(count, "Nav should have links").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).not.toBe("#");
    }
  });

  test("Experience section has CTAs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const expTickets = page.locator('a.exp-cta-btn[href="/tickets"]');
    await expect(expTickets).toBeVisible();

    const expApply = page.locator('a.exp-cta-link[href="/apply"]');
    await expect(expApply).toBeVisible();
  });
});

// =============================================
// SECTION C: HOMEPAGE SECTIONS EXIST
// =============================================

test.describe("Homepage sections", () => {
  test("All homepage sections render", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Hero
    await expect(page.locator("section.hero")).toBeVisible();

    // Marquee
    expect(
      await page.locator(".marquee").count(),
      "Marquee should exist",
    ).toBeGreaterThan(0);

    // Experience
    await expect(page.locator("section.experience#experience")).toBeVisible();

    // Shows
    await expect(page.locator("section.shows#shows")).toBeVisible();

    // Stats
    await expect(page.locator("section.stats")).toBeVisible();

    // Press
    await expect(page.locator("section.press")).toBeVisible();

    // Testimonials
    await expect(page.locator("section.testimonials")).toBeVisible();

    // Creators — with links to hosts page
    const creators = page.locator("section.creators#about");
    await expect(creators).toBeVisible();
    const hostsLinks = creators.locator('a[href="/hosts"]');
    expect(
      await hostsLinks.count(),
      "Creators section should link to /hosts",
    ).toBeGreaterThan(0);

    // Video — play button
    const video = page.locator("section.video#watch");
    await expect(video).toBeVisible();
    const playBtn = video.locator(".video-facade");
    expect(
      await playBtn.count(),
      "Video play button should exist",
    ).toBeGreaterThan(0);

    // FAQ
    await expect(page.locator("section.faq#faq")).toBeVisible();

    // Signup
    const signupEmail = page.locator("input#nl-email");
    expect(
      await signupEmail.count(),
      "Newsletter email input should exist",
    ).toBe(1);
  });
});

// =============================================
// SECTION D: FAQ PAGE DEEP
// =============================================

test.describe("FAQ page deep", () => {
  test("FAQ structure with 13 items", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.faq-page")).toBeVisible();
    await expect(page.locator("h1.faq-title")).toBeVisible();

    const faqItems = page.locator("div.faq-item");
    expect(await faqItems.count(), "FAQ page should have 13 items").toBe(13);

    // Each item has a question and answer
    for (let i = 0; i < 13; i++) {
      const item = faqItems.nth(i);
      const question = item.locator("h2.faq-question");
      expect(
        await question.count(),
        `FAQ item ${i + 1} should have a question heading`,
      ).toBe(1);
      const answer = item.locator("p.faq-answer-text");
      expect(
        await answer.count(),
        `FAQ item ${i + 1} should have an answer`,
      ).toBe(1);
    }

    // Contact email link
    const emailLink = page.locator(
      'a[href="mailto:contact@garammasaladating.com"]',
    );
    expect(
      await emailLink.count(),
      "Contact email link should exist",
    ).toBeGreaterThan(0);
  });

  test("FAQ answer links are valid", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });

    const answerLinks = await page.locator(".faq-answer-text a[href]").all();
    for (const link of answerLinks) {
      const href = await link.getAttribute("href");
      expect(href, "FAQ answer link should have a valid href").toBeTruthy();
      expect(href).not.toBe("#");
    }
  });
});

// =============================================
// SECTION E: APPLY PAGE DEEP
// =============================================

test.describe("Apply page deep", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/apply", { waitUntil: "domcontentloaded" });
    // Wait for React hydration
    await page.waitForSelector("input#field-name", {
      state: "visible",
      timeout: 15000,
    });
  });

  test("All form fields present", async ({ page }) => {
    // Text inputs
    await expect(page.locator("input#field-name")).toBeVisible();
    await expect(page.locator("input#field-age")).toBeVisible();
    await expect(page.locator("input#field-height")).toBeVisible();

    // Instagram input
    await expect(page.locator("input#field-instagram")).toBeVisible();

    // Selects
    await expect(page.locator("select#field-gender")).toBeVisible();
    await expect(page.locator("select#field-orientation")).toBeVisible();
    await expect(page.locator("select#field-community")).toBeVisible();
    await expect(page.locator("select#field-income")).toBeVisible();

    // Textarea
    await expect(page.locator("textarea#field-pitch")).toBeVisible();
  });

  test("Consent and submit controls exist", async ({ page }) => {
    // Marketing consent radios
    const radios = page.locator('input[name="marketingConsent"]');
    expect(await radios.count(), "Should have 2 marketing consent radios").toBe(
      2,
    );

    // Terms checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    expect(
      await checkbox.count(),
      "Should have terms checkbox",
    ).toBeGreaterThan(0);

    // Submit button
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible();
    const text = await submit.textContent();
    expect(text?.toLowerCase()).toContain("submit");
  });

  test("Type toggle reveals nomination field", async ({ page }) => {
    // Toggle buttons exist
    const forMyself = page.getByRole("button", { name: "For myself" });
    const forFriend = page.getByRole("button", { name: "For a friend" });
    await expect(forMyself).toBeVisible();
    await expect(forFriend).toBeVisible();

    // Click "For a friend" — referrer field should appear
    await forFriend.click();
    await expect(page.locator("input#field-referrer")).toBeVisible({
      timeout: 3000,
    });

    // Click "For myself" — referrer field should disappear
    await forMyself.click();
    await expect(page.locator("input#field-referrer")).not.toBeVisible({
      timeout: 3000,
    });
  });
});

// =============================================
// SECTION F: TICKETS PAGE DEEP
// =============================================

test.describe("Tickets page deep", () => {
  test("Structure and heading", async ({ page }) => {
    await page.goto("/tickets", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.tickets-page")).toBeVisible();

    const h1 = page.locator("h1.tickets-h1");
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(/Upcoming Shows/);

    // Proof text
    const proof = page.locator(".tickets-proof");
    expect(await proof.count(), "Proof text should exist").toBeGreaterThan(0);
  });

  test("Ticket cards and links", async ({ page }) => {
    await page.goto("/tickets", { waitUntil: "domcontentloaded" });

    // Either a list of cards or empty state
    const hasList = (await page.locator(".tickets-list").count()) > 0;
    const hasEmpty = (await page.locator(".tickets-empty").count()) > 0;
    expect(
      hasList || hasEmpty,
      "Should have either ticket list or empty state",
    ).toBe(true);

    if (hasList) {
      const cards = page.locator(".ticket-card");
      expect(await cards.count()).toBeGreaterThan(0);

      // Live cards are links
      const liveCards = await page
        .locator("a.ticket-card--live, a.ticket-card--soldout")
        .all();
      for (const card of liveCards) {
        const href = await card.getAttribute("href");
        expect(href, "Live ticket card should have href").toBeTruthy();
      }

      // TBA cards are buttons with data-notify-city
      const tbaCards = await page.locator("button.ticket-card--tba").all();
      for (const card of tbaCards) {
        const city = await card.getAttribute("data-notify-city");
        expect(city, "TBA card should have data-notify-city").toBeTruthy();
      }
    }

    // Back link
    const back = page.locator('a.tickets-footer__back[href="/"]');
    expect(
      await back.count(),
      "Back to home link should exist",
    ).toBeGreaterThan(0);
  });
});

// =============================================
// SECTION G: HOSTS PAGE DEEP
// =============================================

test.describe("Hosts page deep", () => {
  test("Structure with two hosts", async ({ page }) => {
    await page.goto("/hosts", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.hosts-page")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    // Two host sections
    const sections = page.locator(".host-section");
    expect(await sections.count(), "Should have 2 host sections").toBe(2);

    // Two host avatars with src and alt
    const avatars = await page.locator("img.host-avatar").all();
    expect(avatars.length, "Should have 2 host avatars").toBe(2);
    for (const avatar of avatars) {
      const src = await avatar.getAttribute("src");
      const alt = await avatar.getAttribute("alt");
      expect(src, "Avatar should have src").toBeTruthy();
      expect(alt, "Avatar should have alt text").toBeTruthy();
    }
  });

  test("CTAs and external links", async ({ page }) => {
    await page.goto("/hosts", { waitUntil: "domcontentloaded" });

    // CTA buttons
    await expect(page.locator('a.btn-primary[href="/apply"]')).toBeVisible();
    await expect(page.locator('a.btn-outline[href="/tickets"]')).toBeVisible();

    // Host name links in h2 should be external
    const hostLinks = await page
      .locator(".host-section h2 a[target='_blank']")
      .all();
    expect(hostLinks.length, "Should have external host links").toBe(2);
    for (const link of hostLinks) {
      const href = await link.getAttribute("href");
      expect(href, "Host link should have href").toBeTruthy();
      expect(
        await link.getAttribute("rel"),
        "External link should have rel attribute",
      ).toContain("noopener");
    }
  });
});

// =============================================
// SECTION H: LINKS PAGE DEEP
// =============================================

test.describe("Links page deep", () => {
  test("Structure and social links", async ({ page }) => {
    await page.goto("/links", { waitUntil: "domcontentloaded" });

    // Primary CTA
    await expect(page.locator('a.primary-link[href="/apply"]')).toBeVisible();

    // Glass links
    const glassLinks = page.locator(".glass-link");
    expect(
      await glassLinks.count(),
      "Should have multiple glass links",
    ).toBeGreaterThan(3);

    // Social icons row
    const socialIcons = page.locator(".social-row .social-icon");
    expect(await socialIcons.count(), "Should have 7 social icons").toBe(7);

    // Each social icon has aria-label
    const icons = await socialIcons.all();
    for (const icon of icons) {
      const label = await icon.getAttribute("aria-label");
      expect(label, "Social icon should have aria-label").toBeTruthy();
    }
  });

  test("Events modal opens and closes", async ({ page }) => {
    await page.goto("/links", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("#events-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator("dialog#events-modal");
    await expect(dialog).toHaveAttribute("open", { timeout: 3000 });

    const title = dialog.locator(".modal-title");
    await expect(title).toHaveText(/Upcoming Shows/);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", { timeout: 3000 });
  });

  test("Press modal opens and closes", async ({ page }) => {
    await page.goto("/links", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("#press-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.locator("dialog#press-modal");
    await expect(dialog).toHaveAttribute("open", { timeout: 3000 });

    const title = dialog.locator(".modal-title");
    await expect(title).toHaveText(/As Seen In/);

    const pressItems = dialog.locator(".press-item");
    expect(
      await pressItems.count(),
      "Press modal should have items",
    ).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", { timeout: 3000 });
  });
});

// =============================================
// SECTION I: JOURNAL INDEX + POSTS
// =============================================

test.describe("Journal", () => {
  test("Journal index page", async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto("/journal", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.journal-page")).toBeVisible();
    await expect(page.locator("h1.journal-title")).toBeVisible();

    const cards = page.locator(".journal-list .journal-card");
    expect(
      await cards.count(),
      "Journal should have post cards",
    ).toBeGreaterThan(0);

    // Each card is a link to /journal/{slug}
    const allCards = await cards.all();
    for (const card of allCards) {
      const href = await card.getAttribute("href");
      expect(href, "Journal card should link to a post").toMatch(
        /^\/journal\/.+/,
      );
      // Card has title
      const title = card.locator(".journal-card-title");
      expect(await title.count()).toBe(1);
      const titleText = await title.textContent();
      expect(
        titleText?.trim().length,
        "Card title should not be empty",
      ).toBeGreaterThan(0);
      // Card has date
      expect(await card.locator(".journal-card-date").count()).toBe(1);
    }

    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("Every live journal post loads correctly", async ({ page }) => {
    // Discover all live posts from the index page
    await page.goto("/journal", { waitUntil: "domcontentloaded" });
    const hrefs = await page
      .locator(".journal-list .journal-card")
      .evaluateAll(
        (els) =>
          els.map((el) => el.getAttribute("href")).filter(Boolean) as string[],
      );
    expect(hrefs.length, "Should have live journal posts").toBeGreaterThan(0);

    for (const href of hrefs) {
      const errors = setupConsoleCollector(page);
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${href} should return 200`).toBe(200);

      await expect(page.locator("main.post-page")).toBeVisible();
      const title = page.locator("h1.post-title");
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(
        titleText?.trim().length,
        `Post title empty on ${href}`,
      ).toBeGreaterThan(0);

      const body = page.locator("article.post-body");
      await expect(body).toBeVisible();
      expect(
        await body.locator(".post-p").count(),
        `No paragraphs on ${href}`,
      ).toBeGreaterThan(0);

      await expect(page.locator('a.post-back[href="/journal"]')).toBeVisible();

      const bodyLinks = await body.locator("a[href]").all();
      for (const link of bodyLinks) {
        const linkHref = await link.getAttribute("href");
        expect(linkHref, `Invalid link in ${href}`).toBeTruthy();
        expect(linkHref).not.toBe("#");
      }

      await assertSeoMeta(page);
      await assertJsonLd(page);
      await assertNoHorizontalOverflow(page);
      expect(errors, `Console errors on ${href}`).toEqual([]);
    }
  });
});

// =============================================
// SECTION J: TIPS INDEX + POSTS
// =============================================

test.describe("Dating tips", () => {
  test("Tips index page", async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto("/south-asian-dating-tips", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("main.tips-page")).toBeVisible();
    await expect(page.locator("h1.tips-title")).toBeVisible();

    const cards = page.locator(".tips-list .tips-card");
    expect(await cards.count(), "Tips should have post cards").toBeGreaterThan(
      0,
    );

    // Each card links to a tip post
    const allCards = await cards.all();
    for (const card of allCards) {
      const href = await card.getAttribute("href");
      expect(href).toMatch(/^\/south-asian-dating-tips\/.+/);
    }

    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("Every live tip post loads correctly", async ({ page }) => {
    // Discover all live tips from the index page
    await page.goto("/south-asian-dating-tips", {
      waitUntil: "domcontentloaded",
    });
    const hrefs = await page
      .locator(".tips-list .tips-card")
      .evaluateAll(
        (els) =>
          els.map((el) => el.getAttribute("href")).filter(Boolean) as string[],
      );
    expect(hrefs.length, "Should have live tip posts").toBeGreaterThan(0);

    for (const href of hrefs) {
      const errors = setupConsoleCollector(page);
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${href} should return 200`).toBe(200);

      await expect(page.locator("main.tip-post-page")).toBeVisible();
      const title = page.locator("h1.tip-post-title");
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(
        titleText?.trim().length,
        `Tip title empty on ${href}`,
      ).toBeGreaterThan(0);

      await expect(page.locator("article.tip-post-body")).toBeVisible();
      await expect(
        page.locator('a.tip-post-back[href="/south-asian-dating-tips"]'),
      ).toBeVisible();
      await expect(page.locator('a[href="/apply"]')).toBeVisible();

      await assertSeoMeta(page);
      await assertJsonLd(page);
      await assertNoHorizontalOverflow(page);
      expect(errors, `Console errors on ${href}`).toEqual([]);
    }
  });
});

// =============================================
// SECTION K: CITY HUB + CITY PAGES
// =============================================

test.describe("Cities", () => {
  test("Cities hub page", async ({ page }) => {
    const errors = setupConsoleCollector(page);
    await page.goto("/cities", { waitUntil: "domcontentloaded" });

    await expect(page.locator("main.cities-page")).toBeVisible();
    await expect(page.locator("h1.cities-h1")).toBeVisible();

    // Region nav links
    const regionLinks = page.locator("a.region-nav__link");
    expect(
      await regionLinks.count(),
      "Should have region jump links",
    ).toBeGreaterThan(0);

    // City cards
    const cityCards = page.locator("a.city-card");
    expect(await cityCards.count(), "Should have city cards").toBeGreaterThan(
      10,
    );

    // Cards link to /cities/{slug}
    const allCards = await cityCards.all();
    for (const card of allCards.slice(0, 20)) {
      const href = await card.getAttribute("href");
      expect(href).toMatch(/^\/cities\/.+/);
    }

    // Back link
    await expect(page.locator('a.cities-footer__back[href="/"]')).toBeVisible();

    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  for (const slug of ALL_CITIES) {
    test(`City page: ${slug}`, async ({ page }) => {
      const errors = setupConsoleCollector(page);
      const path = `/cities/${slug}`;
      const response = await page.goto(path, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${path} should return 200`).toBe(200);

      // Structure
      await expect(page.locator("main.city-page")).toBeVisible();

      const h1 = page.locator("h1.city-h1");
      await expect(h1).toBeVisible();
      const h1Text = await h1.textContent();
      expect(
        h1Text?.trim().length,
        "City h1 should not be empty",
      ).toBeGreaterThan(0);

      // Body paragraphs
      const body = page.locator(".city-body");
      await expect(body).toBeVisible();
      const paragraphs = body.locator(".city-paragraph");
      expect(
        await paragraphs.count(),
        "City should have body paragraphs",
      ).toBeGreaterThan(0);

      // CTAs
      const ctas = page.locator(".city-ctas .city-cta");
      expect(
        await ctas.count(),
        "City should have at least one CTA",
      ).toBeGreaterThan(0);

      // CTA links/buttons are valid
      const ctaLinks = await page.locator(".city-ctas a.city-cta").all();
      for (const cta of ctaLinks) {
        const href = await cta.getAttribute("href");
        expect(href, "City CTA link should have href").toBeTruthy();
      }

      // Back to all cities
      await expect(
        page.locator('a.city-footer__link[href="/cities"]'),
      ).toBeVisible();

      // Nearby cities (if present) should be valid links
      const nearbyLinks = await page.locator("a.city-nearby__link").all();
      for (const link of nearbyLinks) {
        const href = await link.getAttribute("href");
        expect(href).toMatch(/^\/cities\/.+/);
      }

      await assertSeoMeta(page);
      await assertJsonLd(page);
      await assertNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("Waitlist modal on coming-soon city", async ({ page }) => {
    // Use chicago (coming-soon city)
    await page.goto("/cities/chicago", { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-waitlist-trigger]");
    const triggerCount = await trigger.count();

    if (triggerCount > 0) {
      await trigger.first().click();

      const dialog = page.locator("dialog#waitlist-modal");
      await expect(dialog).toHaveAttribute("open", { timeout: 3000 });

      // Modal contents
      await expect(page.locator("#waitlist-email")).toBeVisible();
      await expect(dialog.locator('button[type="submit"]')).toBeVisible();

      // Close
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", {
        timeout: 3000,
      });
    }
  });
});

// =============================================
// SECTION L: 404 PAGE
// =============================================

test.describe("404 page", () => {
  test("Custom 404 renders correctly", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "Should return 404").toBe(404);

    // 404 code
    const code = page.locator(".not-found-code");
    await expect(code).toHaveText("404");

    // Heading
    const h1 = page.locator("h1");
    const h1Text = await h1.textContent();
    expect(h1Text?.toLowerCase()).toContain("ghosted");

    // Navigation links (use specific classes to avoid strict mode violation)
    await expect(
      page.locator("a.not-found-btn--primary[href='/']"),
    ).toBeVisible();
    await expect(
      page.locator("a.not-found-btn--outline[href='/tickets']"),
    ).toBeVisible();

    // Footer still present
    await assertFooter(page);

    await assertNoHorizontalOverflow(page);
  });
});

// =============================================
// SECTION M: ADMIN PAGE
// =============================================

test.describe("Admin page", () => {
  test("Admin loads without 500", async ({ page }) => {
    const response = await page.goto("/admin", {
      waitUntil: "domcontentloaded",
    });
    const status = response?.status() ?? 500;
    expect(status, "Admin should not return 500").not.toBe(500);

    // Should have noindex
    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) {
      const content = await robots.getAttribute("content");
      expect(content).toContain("noindex");
    }
  });
});

// =============================================
// SECTION N: FOOTER DEEP
// =============================================

test.describe("Footer deep", () => {
  test("Footer has all sections and links", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const footer = page.locator('footer[role="contentinfo"]');
    await expect(footer).toBeVisible();

    // Logo
    const logo = footer.locator("img.footer-logo");
    expect(await logo.count()).toBeGreaterThan(0);
    const logoSrc = await logo.first().getAttribute("src");
    expect(logoSrc).toBeTruthy();

    // Social links (6 platforms)
    const socialLinks = footer.locator(".footer-social a");
    expect(await socialLinks.count(), "Footer should have 6 social links").toBe(
      6,
    );
    const socials = await socialLinks.all();
    for (const link of socials) {
      const label = await link.getAttribute("aria-label");
      expect(label, "Social link should have aria-label").toBeTruthy();
      const href = await link.getAttribute("href");
      expect(href, "Social link should have href").toBeTruthy();
    }

    // Get Involved column
    expect(await footer.locator('a[href="/apply"]').count()).toBeGreaterThan(0);
    expect(await footer.locator('a[href="/tickets"]').count()).toBeGreaterThan(
      0,
    );
    expect(await footer.locator('a[href="/links"]').count()).toBeGreaterThan(0);

    // Explore column
    expect(await footer.locator('a[href="/faq"]').count()).toBeGreaterThan(0);
    expect(await footer.locator('a[href="/journal"]').count()).toBeGreaterThan(
      0,
    );
    expect(await footer.locator('a[href="/hosts"]').count()).toBeGreaterThan(0);

    // Shows column
    expect(
      await footer.locator('a[href="/cities/manhattan"]').count(),
    ).toBeGreaterThan(0);
    expect(
      await footer.locator('a[href="/cities/jersey-city"]').count(),
    ).toBeGreaterThan(0);
    expect(
      await footer.locator('a[href="/cities/los-angeles"]').count(),
    ).toBeGreaterThan(0);
    expect(
      await footer.locator('a[href="/cities/san-francisco"]').count(),
    ).toBeGreaterThan(0);
    expect(
      await footer.locator('a[href="/cities/san-diego"]').count(),
    ).toBeGreaterThan(0);
    expect(await footer.locator('a[href="/cities"]').count()).toBeGreaterThan(
      0,
    );

    // Legal links
    expect(await footer.locator('a[href="/privacy"]').count()).toBeGreaterThan(
      0,
    );
    expect(await footer.locator('a[href="/terms"]').count()).toBeGreaterThan(0);

    // Copyright
    const copyright = footer.locator(".footer-copy");
    const copyrightText = await copyright.textContent();
    expect(copyrightText).toContain("Garam Masala Dating");
  });
});

// =============================================
// SECTION O: NOTIFY MODAL
// =============================================

test.describe("Notify modal", () => {
  test("Notify modal opens from TBA card", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Find a TBA card with data-notify-city
    const notifyBtn = page.locator("button[data-notify-city]").first();
    const count = await page.locator("button[data-notify-city]").count();

    if (count > 0) {
      await notifyBtn.click();

      const dialog = page.locator("dialog#notify-modal");
      await expect(dialog).toHaveAttribute("open", { timeout: 3000 });

      // Email input
      await expect(page.locator("#notify-email")).toBeVisible();

      // Submit button
      const submit = dialog.locator('button[type="submit"]');
      await expect(submit).toBeVisible();
      const submitText = await submit.textContent();
      expect(submitText).toContain("Notify Me");

      // Close
      await page.keyboard.press("Escape");
      await expect(dialog).not.toHaveAttribute("open", { timeout: 3000 });
    }
  });
});
