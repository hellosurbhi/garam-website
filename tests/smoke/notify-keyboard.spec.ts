import { test, expect } from "@playwright/test";

// Exercise the real modal script, including triggers inserted after it initializes.
// Never submit a lead or allow an unmocked mutation, even against a remote preview.
test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", (route) =>
    ["GET", "HEAD", "OPTIONS"].includes(route.request().method())
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  await page.goto("/tickets");
});

for (const tag of ["button", "div", "a"] as const) {
  for (const key of ["Enter", "Space"]) {
    test(`${key} opens a late ${tag} trigger once and restores focus`, async ({
      page,
    }) => {
      await page.evaluate((tag) => {
        const trigger = document.createElement(tag);
        trigger.id = "late-notify-trigger";
        trigger.dataset.notifyCity = "Keyboard City";
        trigger.dataset.notifyCitySlug = "keyboard-city";
        trigger.textContent = "Notify Me";
        if (trigger instanceof HTMLButtonElement) trigger.type = "button";
        else {
          trigger.setAttribute("role", "button");
          trigger.tabIndex = 0;
        }
        if (trigger instanceof HTMLAnchorElement)
          trigger.href = "#must-not-navigate";
        document.body.prepend(trigger);
        const dialog =
          document.querySelector<HTMLDialogElement>("#notify-modal")!;
        const showModal = dialog.showModal.bind(dialog);
        dialog.dataset.openCalls = "0";
        dialog.showModal = () => {
          dialog.dataset.openCalls = String(
            Number(dialog.dataset.openCalls) + 1,
          );
          showModal();
        };
      }, tag);
      const trigger = page.locator("#late-notify-trigger");
      const dialog = page.locator("#notify-modal");
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("data-open-calls", "1");
      await expect(dialog).toBeFocused();
      await expect(page.locator("#notify-city")).toHaveValue("Keyboard City");
      await expect(page.locator("#notify-city-slug")).toHaveValue(
        "keyboard-city",
      );
      expect(new URL(page.url()).hash).toBe("");
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await page.keyboard.press(key);
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("data-open-calls", "2");
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
}

for (const path of ["/events/manhattan-tba"]) {
  test(`existing triggers on ${path} use native buttons and support both keys`, async ({
    page,
  }) => {
    await page.goto(path);
    const triggers = page.locator("[data-notify-city]");
    expect(await triggers.count()).toBeGreaterThan(0);
    expect(
      await triggers.evaluateAll((elements) =>
        elements.every(
          (el) => el instanceof HTMLButtonElement && el.type === "button",
        ),
      ),
    ).toBe(true);
    const trigger = triggers.first();
    for (const key of ["Enter", "Space"]) {
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(page.locator("#notify-modal")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
  });
}

test("nested click restores the actual opener, rather than previously focused content", async ({
  page,
}) => {
  await page.evaluate(() => {
    const trigger = document.createElement("button");
    trigger.id = "nested-notify-trigger";
    trigger.type = "button";
    trigger.dataset.notifyCity = "Nested City";
    trigger.innerHTML = "<span>Notify Me</span>";
    document.body.prepend(trigger);
    document.querySelector<HTMLElement>("a[href]")!.focus();
    // Safari and programmatic clicks need not focus the clicked button first.
    trigger.querySelector("span")!.click();
  });
  const dialog = page.locator("#notify-modal");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#nested-notify-trigger")).toBeFocused();
});

test("Enter on an ordinary ticket link still follows its destination", async ({
  page,
  context,
}) => {
  const link = page.locator("a[data-go-ticket]:visible").first();
  await expect(link).toBeVisible();
  await link.evaluate((el) => el.setAttribute("target", "_self"));
  await context.route("**/api/go/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Ticket destination</h1>",
    }),
  );
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Ticket destination" }),
  ).toBeVisible();
});
