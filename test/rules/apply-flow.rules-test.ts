/**
 * Security-rules tests for the REAL apply-flow client operations, run against
 * the Firebase emulator (npm run test:rules).
 *
 * These exist because a July 2026 rules change (photo reads locked to admins)
 * silently broke a client operation (getDownloadURL after upload) and took
 * the apply form down for every applicant for a week. Unit tests mock
 * Firebase entirely, so ONLY this suite can catch a rules/client mismatch.
 * Any change to storage.rules or firestore.rules must keep this green, and
 * any new client Firebase operation in the apply flow must be added here.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  getBytes,
  deleteObject,
} from "firebase/storage";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";

const PROJECT_ID = "demo-garam-masala";

let testEnv: RulesTestEnvironment;

function anonContext(uid: string) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  });
}

function adminContext() {
  return testEnv.authenticatedContext("admin-uid", {
    email: "messagesurbhi@gmail.com",
    firebase: { sign_in_provider: "password" },
  });
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function uploadAsOwner(uid: string, path: string) {
  const storage = anonContext(uid).storage();
  return uploadBytes(ref(storage, path), JPEG_BYTES, {
    contentType: "image/jpeg",
    customMetadata: { owner: uid },
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
});

describe("storage.rules: photos/", () => {
  it("anonymous applicant can upload a photo with owner metadata", async () => {
    await assertSucceeds(uploadAsOwner("anon-1", "photos/a.jpg"));
  });

  it("unauthenticated upload is rejected", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, "photos/a.jpg"), JPEG_BYTES, {
        contentType: "image/jpeg",
      }),
    );
  });

  it("non-image content type is rejected", async () => {
    const storage = anonContext("anon-1").storage();
    await assertFails(
      uploadBytes(ref(storage, "photos/a.txt"), JPEG_BYTES, {
        contentType: "text/plain",
      }),
    );
  });

  it("any image/* content type is accepted (client normalizes to JPEG; fallback uploads originals)", async () => {
    const storage = anonContext("anon-1").storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "photos/a.avif"), JPEG_BYTES, {
        contentType: "image/avif",
      }),
    );
  });

  it("REGRESSION: the apply flow must never call getDownloadURL — reads are admin-only", async () => {
    await uploadAsOwner("anon-1", "photos/a.jpg");
    const storage = anonContext("anon-1").storage();
    // This exact call pattern (uploader reading their own photo) is what
    // silently broke every submission in July 2026. If this ever starts
    // succeeding, the PII lockdown was loosened; if the client ever needs it
    // again, the client is wrong, not the rule.
    await assertFails(getDownloadURL(ref(storage, "photos/a.jpg")));
  });

  it("another anonymous session cannot read an applicant photo", async () => {
    await uploadAsOwner("anon-1", "photos/a.jpg");
    const storage = anonContext("anon-2").storage();
    await assertFails(getBytes(ref(storage, "photos/a.jpg")));
  });

  it("admin can read applicant photos (dashboard getBlob path)", async () => {
    await uploadAsOwner("anon-1", "photos/a.jpg");
    const storage = adminContext().storage();
    await assertSucceeds(getBytes(ref(storage, "photos/a.jpg")));
  });

  it("uploader can delete their own photo (failure cleanup path)", async () => {
    await uploadAsOwner("anon-1", "photos/a.jpg");
    const storage = anonContext("anon-1").storage();
    await assertSucceeds(deleteObject(ref(storage, "photos/a.jpg")));
  });

  it("a different session cannot delete someone else's photo", async () => {
    await uploadAsOwner("anon-1", "photos/a.jpg");
    const storage = anonContext("anon-2").storage();
    await assertFails(deleteObject(ref(storage, "photos/a.jpg")));
  });
});

describe("firestore.rules: applications", () => {
  const validApplication = {
    name: "Priya Sharma",
    age: 27,
    gender: "Female",
    orientation: "Straight",
    city: "New York",
    state: "NY",
    country: "USA",
    email: "priya@example.com",
    emailNormalized: "priya@example.com",
    phone: "+15550100",
    height: `5'6"`,
    instagram: "applicant_fixture_1",
    community: "Hindu",
    income: "$50k to $100k",
    applicationType: "Self",
    pitch: "I love masala chai.",
    photoPaths: ["photos/0f8b3a52.jpg"],
    marketingConsent: "yes",
    termsAgreedAt: new Date(),
    status: "New",
    notes: "",
    submittedAt: new Date(),
  };

  function appDoc(
    ctx: ReturnType<RulesTestEnvironment["authenticatedContext"]>,
  ) {
    return doc(collection(ctx.firestore(), "applications"), "app-1");
  }

  it("anonymous session can create the exact document the apply flow writes", async () => {
    await assertSucceeds(
      setDoc(appDoc(anonContext("anon-1")), validApplication),
    );
  });

  it("synthetic monitor document (isSynthetic flag) is accepted", async () => {
    await assertSucceeds(
      setDoc(appDoc(anonContext("anon-1")), {
        ...validApplication,
        name: "SYNTHETIC MONITOR",
        email: "synthetic-monitor@garammasaladating.com",
        emailNormalized: "synthetic-monitor@garammasaladating.com",
        isSynthetic: true,
      }),
    );
  });

  it("unknown fields are rejected (hasOnly allowlist)", async () => {
    await assertFails(
      setDoc(appDoc(anonContext("anon-1")), {
        ...validApplication,
        surprise: "field",
      }),
    );
  });

  it("anonymous sessions cannot read applications (PII)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(collection(ctx.firestore(), "applications"), "app-1"),
        validApplication,
      );
    });
    await assertFails(getDoc(appDoc(anonContext("anon-2"))));
  });

  it("admin can read applications", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(collection(ctx.firestore(), "applications"), "app-1"),
        validApplication,
      );
    });
    await assertSucceeds(getDoc(appDoc(adminContext())));
  });
});

// Guard against silent skips: this file only runs under `npm run test:rules`
// (firebase emulators:exec), which sets the emulator host env vars.
it("is running against the emulator, never production", () => {
  expect(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  ).toBeTruthy();
});
