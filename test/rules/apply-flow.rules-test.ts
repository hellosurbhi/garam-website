/**
 * Security-rules tests for the apply flow, run against the Firebase emulator
 * (npm run test:rules).
 *
 * The apply form no longer touches Firestore or Storage from the browser: it
 * posts to /api/save-application and uploads photos with signed URLs, both of
 * which use the service account and bypass these rules. So the contract this
 * suite pins is the OPPOSITE of the old one: no client (anonymous, signed-out
 * or a signed-in non-admin) can write applications or photos, and nobody but
 * an admin can read them. Rules rejections of real applicants caused the
 * Jul, Aug, Sep and Nov 2026 outages; a rule that lets clients write is how
 * that class comes back.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";

// WHY: must differ from public-write.rules-test.ts's PROJECT_ID so the two
// files' clearFirestore() calls cannot race inside one emulator.
const PROJECT_ID = "demo-garam-masala-apply-flow";

let testEnv: RulesTestEnvironment;

function anonContext(uid: string) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  });
}

function signedInStranger() {
  return testEnv.authenticatedContext("stranger-uid", {
    email: "someone@example.com",
    firebase: { sign_in_provider: "password" },
  });
}

function adminContext() {
  return testEnv.authenticatedContext("admin-uid", {
    email: "messagesurbhi@gmail.com",
    firebase: { sign_in_provider: "password" },
  });
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const NEW_PHOTO = "photos/0123456789abcdef0123456789abcdef/0.jpg";
const LEGACY_PHOTO = "photos/0f8b3a52.jpg";

/** The widest, ugliest payload the server accepts: nothing a rule could like. */
const ANYTHING = {
  name: "",
  age: 7,
  pitch: "x".repeat(50000),
  surprise: { nested: [1, 2, 3] },
};

async function seedPhoto(path: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), JPEG_BYTES, {
      contentType: "image/jpeg",
    });
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

describe("storage.rules: applicant photos are server-written, admin-read", () => {
  it("an anonymous session cannot upload a photo", async () => {
    const storage = anonContext("anon-1").storage();
    await assertFails(
      uploadBytes(ref(storage, NEW_PHOTO), JPEG_BYTES, {
        contentType: "image/jpeg",
        customMetadata: { owner: "anon-1" },
      }),
    );
  });

  it("a signed-out visitor cannot upload a photo", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, NEW_PHOTO), JPEG_BYTES, {
        contentType: "image/jpeg",
      }),
    );
  });

  it("a signed-in non-admin cannot upload a photo", async () => {
    const storage = signedInStranger().storage();
    await assertFails(
      uploadBytes(ref(storage, LEGACY_PHOTO), JPEG_BYTES, {
        contentType: "image/jpeg",
      }),
    );
  });

  it("an admin can read both the new nested path and a legacy photo", async () => {
    await seedPhoto(NEW_PHOTO);
    await seedPhoto(LEGACY_PHOTO);
    const storage = adminContext().storage();
    await assertSucceeds(getBytes(ref(storage, NEW_PHOTO)));
    await assertSucceeds(getBytes(ref(storage, LEGACY_PHOTO)));
  });

  it("an anonymous session and a non-admin cannot read a photo", async () => {
    await seedPhoto(NEW_PHOTO);
    await assertFails(
      getBytes(ref(anonContext("anon-1").storage(), NEW_PHOTO)),
    );
    await assertFails(getBytes(ref(signedInStranger().storage(), NEW_PHOTO)));
  });

  it("only an admin can delete a photo", async () => {
    await seedPhoto(NEW_PHOTO);
    await assertFails(
      deleteObject(ref(anonContext("anon-1").storage(), NEW_PHOTO)),
    );
    await assertSucceeds(
      deleteObject(ref(adminContext().storage(), NEW_PHOTO)),
    );
  });
});

describe("firestore.rules: applications are server-written, admin-managed", () => {
  it("an anonymous session cannot create an application, however valid", async () => {
    const db = anonContext("anon-1").firestore();
    await assertFails(
      setDoc(doc(collection(db, "applications"), "app-1"), {
        name: "Priya Sharma",
        age: 27,
        status: "New",
        submittedAt: new Date(),
      }),
    );
  });

  it("a signed-out visitor and a signed-in non-admin cannot create one either", async () => {
    await assertFails(
      setDoc(
        doc(
          collection(
            testEnv.unauthenticatedContext().firestore(),
            "applications",
          ),
          "app-1",
        ),
        ANYTHING,
      ),
    );
    await assertFails(
      setDoc(
        doc(
          collection(signedInStranger().firestore(), "applications"),
          "app-1",
        ),
        ANYTHING,
      ),
    );
  });

  it("the server's accepts-anything contract is not a client contract: no ugly payload sneaks in", async () => {
    const db = anonContext("anon-1").firestore();
    await assertFails(
      setDoc(doc(collection(db, "applications"), "app-1"), ANYTHING),
    );
  });

  it("anonymous sessions and non-admins cannot read applications (PII)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(collection(ctx.firestore(), "applications"), "app-1"), {
        name: "Priya Sharma",
      });
    });
    await assertFails(
      getDoc(
        doc(
          collection(anonContext("anon-1").firestore(), "applications"),
          "app-1",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          collection(signedInStranger().firestore(), "applications"),
          "app-1",
        ),
      ),
    );
  });

  it("an admin can read and update applications (dashboard)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(collection(ctx.firestore(), "applications"), "app-1"), {
        name: "Priya Sharma",
        status: "Draft",
      });
    });
    const db = adminContext().firestore();
    await assertSucceeds(getDoc(doc(collection(db, "applications"), "app-1")));
    await assertSucceeds(
      setDoc(
        doc(collection(db, "applications"), "app-1"),
        { status: "Reviewed" },
        { merge: true },
      ),
    );
  });
});

describe("firestore.rules: monitoring collections", () => {
  it("incidents: admin can read, nobody can write from a client", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(collection(ctx.firestore(), "incidents"), "i-1"), {
        subject: "APPLY FAILED: example",
      });
    });
    await assertSucceeds(
      getDoc(doc(collection(adminContext().firestore(), "incidents"), "i-1")),
    );
    await assertFails(
      getDoc(
        doc(collection(anonContext("anon-1").firestore(), "incidents"), "i-1"),
      ),
    );
    await assertFails(
      setDoc(doc(collection(adminContext().firestore(), "incidents"), "i-2"), {
        subject: "forged",
      }),
    );
  });

  it("_canary: closed to every client, admins included", async () => {
    await assertFails(
      setDoc(doc(collection(adminContext().firestore(), "_canary"), "c-1"), {
        name: "CANARY",
      }),
    );
    await assertFails(
      getDoc(doc(collection(adminContext().firestore(), "_canary"), "c-1")),
    );
  });

  it("systemConfig (digest cursor) is admin-only", async () => {
    await assertFails(
      setDoc(
        doc(
          collection(anonContext("anon-1").firestore(), "systemConfig"),
          "digest",
        ),
        { lastDateKey: "2026-11-10" },
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(collection(adminContext().firestore(), "systemConfig"), "digest"),
        {
          lastDateKey: "2026-11-10",
        },
      ),
    );
  });
});
