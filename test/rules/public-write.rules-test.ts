/**
 * Security-rules tests for the remaining public-write surfaces (leads) and
 * pins for server-only collections, run against the Firebase emulator
 * (npm run test:rules).
 *
 * Companion to apply-flow.rules-test.ts: the July 2026 outage proved that a
 * rules/client mismatch is invisible to every other test layer. These cases
 * cover the lead capture flow's REAL operations and pin that collections
 * written exclusively through the service account (contestants,
 * stage_waivers, orders) stay closed to clients: they have NO match blocks,
 * so access is default-deny, and a future rules edit must not accidentally
 * open them.
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

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

const validLead = {
  email: "lead@example.com",
  source: "homepage-signup",
  sourcePage: "/",
  createdAt: new Date().toISOString(),
  city: "New York",
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
});

async function seedLead(id = "lead-1") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(collection(ctx.firestore(), "leads"), id), validLead);
  });
}

describe("firestore.rules: leads", () => {
  it("unauthenticated visitor can create a valid lead (capture flow)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, "leads"), "lead-1"), validLead),
    );
  });

  it("unknown fields are rejected (hasOnly allowlist)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        isAdminMaybe: true,
      }),
    );
  });

  it("missing required fields are rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const withoutSource: Partial<typeof validLead> = { ...validLead };
    delete withoutSource.source;
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), withoutSource),
    );
  });

  it("oversized field values are rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        email: `${"a".repeat(320)}@example.com`,
      }),
    );
  });

  it("step-2 phone update may touch ONLY the phone field", async () => {
    await seedLead();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      updateDoc(doc(collection(db, "leads"), "lead-1"), {
        phone: "+15550100",
      }),
    );
  });

  it("non-admin update touching any other field is rejected", async () => {
    await seedLead();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(collection(db, "leads"), "lead-1"), {
        phone: "+15550100",
        email: "hijacked@example.com",
      }),
    );
  });

  it("leads can never be read or enumerated by visitors, only admins", async () => {
    await seedLead();
    const anonDb = anonContext("anon-1").firestore();
    await assertFails(getDoc(doc(collection(anonDb, "leads"), "lead-1")));
    const adminDb = adminContext().firestore();
    await assertSucceeds(getDoc(doc(collection(adminDb, "leads"), "lead-1")));
  });
});

describe("firestore.rules: server-only collections stay closed to clients", () => {
  const cases: Array<{ name: string; data: Record<string, unknown> }> = [
    { name: "contestants", data: { firstName: "X", createdAt: "now" } },
    { name: "stage_waivers", data: { firstName: "X", createdAt: "now" } },
    { name: "orders", data: { total: 1 } },
  ];

  for (const { name, data } of cases) {
    it(`${name}: client create and read are denied`, async () => {
      const anonDb = anonContext("anon-1").firestore();
      await assertFails(setDoc(doc(collection(anonDb, name), "x"), data));
      await assertFails(getDoc(doc(collection(anonDb, name), "x")));
    });
  }

  it("orders: even admins cannot write (service-account only)", async () => {
    const adminDb = adminContext().firestore();
    await assertFails(
      setDoc(doc(collection(adminDb, "orders"), "x"), { total: 1 }),
    );
  });
});

describe("firestore.rules: applications invalid creates", () => {
  const validApplication = {
    name: "Priya Sharma",
    age: 27,
    gender: "Female",
    orientation: "Straight",
    city: "New York",
    email: "priya@example.com",
    emailNormalized: "priya@example.com",
    height: `5'6"`,
    instagram: "applicant_fixture_1",
    community: "Hindu",
    income: "$50k to $100k",
    applicationType: "Self",
    photoPaths: ["photos/0f8b3a52.jpg"],
    status: "New",
    submittedAt: new Date(),
  };

  it("missing required field is rejected", async () => {
    const db = anonContext("anon-1").firestore();
    const withoutCity: Partial<typeof validApplication> = {
      ...validApplication,
    };
    delete withoutCity.city;
    await assertFails(
      setDoc(doc(collection(db, "applications"), "app-1"), withoutCity),
    );
  });

  it("emailNormalized must equal email.lower()", async () => {
    const db = anonContext("anon-1").firestore();
    await assertFails(
      setDoc(doc(collection(db, "applications"), "app-1"), {
        ...validApplication,
        emailNormalized: "different@example.com",
      }),
    );
  });
});
