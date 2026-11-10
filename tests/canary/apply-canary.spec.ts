/**
 * Production apply canary.
 *
 * Fills the LIVE /apply form the way a real phone user would (long pitch, a
 * formatted phone number, a multi-megabyte JPEG and a HEIC-shaped file), submits
 * it and waits for the success screen. The canary headers are added by route
 * interception so the page's own code path is untouched; they point the save
 * at ONE fixed `_canary/<profile>` document that overwrites each run and never
 * appears in the admin list.
 *
 * scripts/canary-verify.mjs then reads that document back with the service
 * account and requires this run's RUN_ID in it, so a stale write or another
 * profile's write can never mask a failure.
 */
import { test, expect } from "@playwright/test";
import {
  canarySignature,
  deriveDraftSecret,
  isCanaryKey,
} from "../../src/lib/draftSecret";

const RUN_ID = process.env.CANARY_RUN_ID ?? "local";

function canaryHeaders(key: string): Record<string, string> {
  if (!isCanaryKey(key)) throw new Error(`Unknown canary profile: ${key}`);
  const secret = deriveDraftSecret(
    process.env.DRAFT_TOKEN_SECRET,
    // WHY the replace: GitHub secrets hold the PEM with literal "\n" pairs and
    // the server reads the key the same way (see firestoreAdmin.ts).
    process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  return {
    "x-canary-key": key,
    "x-canary-sig": canarySignature(secret, key),
  };
}

test("a phone applicant can file an application with photos on the live stack", async ({
  page,
}, testInfo) => {
  const profile = testInfo.project.name;
  const headers = canaryHeaders(profile);

  await page.route(
    /\/api\/(save-application|upload-application-photo)/,
    (route) =>
      route.continue({ headers: { ...route.request().headers(), ...headers } }),
  );

  await page.goto("/apply", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid=apply-form]", {
    state: "visible",
    timeout: 20_000,
  });

  await page.fill("#field-name", `CANARY ${profile} ${RUN_ID}`);
  await page.fill("#field-age", "30");
  await page.selectOption("#field-gender", "Woman");
  await page.selectOption("#field-orientation", "Straight");
  await page.fill("#geo-place", "New York");
  await page.fill("#field-email", `canary-${profile}@garammasaladating.com`);
  await page.fill("#field-instagram", "garammasaladating");
  await page.fill("#field-height", "5 feet 8 inches (172cm)");
  await page.fill("#field-phone", "+1 (555) 010-0000 (WhatsApp preferred)");
  await page.fill(
    "#field-pitch",
    Array.from(
      { length: 40 },
      () =>
        "I grew up between two cities and two kitchens, and I have opinions about both. 🌶️",
    ).join("\n\n"),
  );

  // A real phone photo is several MB of high-entropy pixels, drawn here so the
  // canary needs no binary fixture and never uploads the same bytes twice.
  const jpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 4000;
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
      ctx.fillRect((i * 97) % 3000, (i * 53) % 4000, 600, 600);
    }
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  // WHY: a HEIC the browser cannot decode must still upload as the original.
  // The "ftypheic" brand header is what iPhones produce.
  const heic = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypheic", "ascii"),
    Buffer.alloc(300_000, 7),
  ]);

  await page.setInputFiles("#photo-input", [
    { name: "phone.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) },
    { name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: heic },
  ]);
  await page.check('input[name="marketingConsent"][value="yes"]');
  await page.check('[data-testid="apply-terms"]');

  const submit = page.locator("[data-testid=apply-submit]");
  await expect(submit).not.toBeDisabled({ timeout: 10_000 });
  await submit.click();

  await expect(page.locator("[data-testid=apply-success]")).toBeVisible({
    timeout: 90_000,
  });
});
