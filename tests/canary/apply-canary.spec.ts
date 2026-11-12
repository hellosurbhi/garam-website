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
import { SYNTHETIC_MONITOR_EMAIL } from "../../src/lib/syntheticMonitor";
import {
  canarySignature,
  deriveDraftSecret,
  isCanaryKey,
} from "../../src/lib/draftSecret";

/** True for the Storage upload host itself, judged by parsed hostname. */
function isStorageHost(url: string): boolean {
  const host = new URL(url).hostname;
  return (
    host === "storage.googleapis.com" ||
    host.endsWith(".storage.googleapis.com")
  );
}

const RUN_ID = process.env.CANARY_RUN_ID ?? "local";

function canaryHeaders(key: string): Record<string, string> {
  if (!isCanaryKey(key)) throw new Error(`Unknown canary profile: ${key}`);
  const secret = deriveDraftSecret(
    process.env.DRAFT_TOKEN_SECRET,
    // WHY the replace: GitHub secrets hold the PEM with literal "\n" pairs and
    // the server reads the key the same way (see firestoreAdmin.ts).
    process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    "x-canary-key": key,
    "x-canary-ts": String(timestamp),
    "x-canary-sig": canarySignature(secret, key, timestamp),
  };
}

test("a phone applicant can file an application with photos on the live stack", async ({
  page,
}, testInfo) => {
  const profile = testInfo.project.name;
  // Fail on a bad profile or missing secret before the browser opens.
  canaryHeaders(profile);

  await page.route(
    /\/api\/(save-application|upload-application-photo)/,
    (route) =>
      // Signed per request: the server only accepts a fresh timestamp.
      route.continue({
        headers: { ...route.request().headers(), ...canaryHeaders(profile) },
      }),
  );

  // WHY: the relay fallback lets a photo succeed even when the direct upload
  // to the bucket is blocked (CSP, bucket CORS), so a green run proved nothing
  // about the path real phones use. Record both and assert below.
  const storagePuts: { url: string; status: number }[] = [];
  const relayCalls: string[] = [];
  page.on("response", (res) => {
    const req = res.request();
    if (req.method() === "PUT" && isStorageHost(res.url())) {
      storagePuts.push({ url: res.url(), status: res.status() });
    }
    if (res.url().includes("/api/upload-application-photo?relay=1")) {
      relayCalls.push(res.url());
    }
  });
  const failedPuts: string[] = [];
  page.on("requestfailed", (req) => {
    if (req.method() === "PUT" && isStorageHost(req.url())) {
      failedPuts.push(`${req.url()} ${req.failure()?.errorText ?? ""}`);
    }
  });

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
  await page.fill("#field-email", SYNTHETIC_MONITOR_EMAIL);
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
    // Random 8px blocks: solid shapes compress to a few KB, which would skip
    // the multi-megabyte path this canary exists to exercise.
    for (let y = 0; y < 4000; y += 8) {
      for (let x = 0; x < 3000; x += 8) {
        ctx.fillStyle = `rgb(${Math.random() * 256}, ${Math.random() * 256}, ${Math.random() * 256})`;
        ctx.fillRect(x, y, 8, 8);
      }
    }
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  expect(
    jpeg.length,
    "the JPEG fixture must be large enough to reach compression",
  ).toBeGreaterThan(1_000_000);
  // WHY: a HEIC the browser cannot decode must still upload as the original.
  // The "ftypheic" brand header is what iPhones produce. It is above
  // compressImage's 400 KiB early return, otherwise the decode failure and its
  // fall back to the original file would never run.
  const heic = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypheic", "ascii"),
    Buffer.alloc(600_000, 7),
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

  // Both photos went straight to the bucket from the browser: this is also the
  // live CORS and CSP check, since the browser blocks a PUT the bucket or the
  // site's policy does not allow.
  expect(failedPuts, "direct upload to the bucket was blocked").toEqual([]);
  expect(relayCalls, "a photo fell back to the server relay").toEqual([]);
  expect(storagePuts.length).toBeGreaterThanOrEqual(2);
  expect(storagePuts.every((p) => p.status >= 200 && p.status < 300)).toBe(
    true,
  );
});
