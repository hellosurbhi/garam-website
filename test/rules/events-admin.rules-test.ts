/**
 * Security-rules tests for the admin Shows tab collections (issue 337), run
 * against the Firebase emulator (npm run test:rules).
 *
 * The rules contract (plan section 3): `eventsPublished` is public read,
 * `eventsDraft` and `eventVersions` are admin read, and nobody writes any of
 * them from a client, admins included. Writes go only through the admin API
 * routes with the service account, so the server-side validator is the one
 * way in and the version history can never be rewritten.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// WHY: must differ from the other rules-test files' PROJECT_IDs; see
// public-write.rules-test.ts for the cross-file clearFirestore() race.
const PROJECT_ID = "demo-garam-masala-events-admin";

const PUBLISHED = "eventsPublished/current";
const DRAFT = "eventsDraft/current";
const VERSION = "eventVersions/v000001";
const ALL_PATHS = [PUBLISHED, DRAFT, VERSION];

let testEnv: RulesTestEnvironment;

const contexts: Record<string, () => RulesTestContext> = {
  unauthenticated: () => testEnv.unauthenticatedContext(),
  anonymous: () =>
    testEnv.authenticatedContext("anon-uid", {
      firebase: { sign_in_provider: "anonymous" },
    }),
  "signed-in non-admin": () =>
    testEnv.authenticatedContext("user-uid", {
      email: "someone@example.com",
      firebase: { sign_in_provider: "password" },
    }),
  "anonymous session claiming the admin flag": () =>
    testEnv.authenticatedContext("anon-admin-uid", {
      admin: true,
      firebase: { sign_in_provider: "anonymous" },
    }),
};

const admins: Record<string, () => RulesTestContext> = {
  "allowlisted admin email": () =>
    testEnv.authenticatedContext("admin-uid", {
      email: "messagesurbhi@gmail.com",
      firebase: { sign_in_provider: "password" },
    }),
  "admin custom claim": () =>
    testEnv.authenticatedContext("claim-admin-uid", {
      email: "helper@example.com",
      admin: true,
      firebase: { sign_in_provider: "google.com" },
    }),
};

const seed: Record<string, Record<string, unknown>> = {
  [PUBLISHED]: {
    version: 1,
    snapshotJson: '{"events":[],"tbaCities":[]}',
    publishedAt: "2026-11-11T12:00:00.000Z",
    rebuild: null,
  },
  [DRAFT]: {
    snapshotJson: '{"events":[],"tbaCities":[]}',
    basedOnVersion: 1,
    updatedAt: "2026-11-11T12:00:00.000Z",
    updatedBy: "messagesurbhi@gmail.com",
  },
  [VERSION]: {
    version: 1,
    kind: "migration",
    snapshotJson: '{"events":[],"tbaCities":[]}',
    note: "Baseline",
    authorUid: "seed",
    authorEmail: "messagesurbhi@gmail.com",
    createdAt: "2026-11-11T12:00:00.000Z",
    changes: { added: [], changed: [], canceled: [] },
  },
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    for (const [path, data] of Object.entries(seed)) {
      await setDoc(doc(ctx.firestore(), path), data);
    }
  });
});

async function assertNoClientWrites(ctx: RulesTestContext) {
  const db = ctx.firestore();
  for (const path of ALL_PATHS) {
    await assertFails(setDoc(doc(db, path), { version: 99 }));
    await assertFails(updateDoc(doc(db, path), { note: "tampered" }));
    await assertFails(deleteDoc(doc(db, path)));
  }
  await assertFails(
    setDoc(doc(db, "eventVersions/v000002"), { ...seed[VERSION], version: 2 }),
  );
  await assertFails(setDoc(doc(db, "eventsDraft/other"), seed[DRAFT]));
}

describe("firestore.rules: eventsPublished (public read)", () => {
  for (const [name, ctx] of Object.entries({ ...contexts, ...admins })) {
    it(`${name} can read the live snapshot`, async () => {
      await assertSucceeds(getDoc(doc(ctx().firestore(), PUBLISHED)));
    });
  }
});

describe("firestore.rules: non-admins", () => {
  for (const [name, ctx] of Object.entries(contexts)) {
    it(`${name} cannot read the draft or the version history`, async () => {
      const db = ctx().firestore();
      await assertFails(getDoc(doc(db, DRAFT)));
      await assertFails(getDoc(doc(db, VERSION)));
      await assertFails(getDocs(collection(db, "eventVersions")));
      await assertFails(getDocs(collection(db, "eventsDraft")));
    });

    it(`${name} cannot write any shows collection`, async () => {
      await assertNoClientWrites(ctx());
    });
  }
});

describe("firestore.rules: admins", () => {
  for (const [name, ctx] of Object.entries(admins)) {
    it(`${name} can read the draft and the version history`, async () => {
      const db = ctx().firestore();
      await assertSucceeds(getDoc(doc(db, DRAFT)));
      await assertSucceeds(getDoc(doc(db, VERSION)));
      await assertSucceeds(getDocs(collection(db, "eventVersions")));
    });

    // Admin edits go through the API routes (validated, atomic), never
    // straight from the browser; and published versions are immutable.
    it(`${name} cannot write any shows collection from the client`, async () => {
      await assertNoClientWrites(ctx());
    });
  }
});
