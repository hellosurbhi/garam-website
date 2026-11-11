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

// WHY: must differ from apply-flow.rules-test.ts's PROJECT_ID. Vitest runs
// test files in parallel by default; if both files shared one emulator
// project, one file's beforeEach(clearFirestore) could wipe the other's
// just-seeded doc mid-test, evaluating rules against a null resource.data.
// A distinct "demo-"-prefixed project ID gives each file its own isolated
// data namespace inside the one running emulator, so file-level parallelism
// stays safe with no coordination between the files needed.
const PROJECT_ID = "demo-garam-masala-public-write";

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

  it.each([
    "smoketest@example.com",
    "SmokeTest@Example.com",
    "  smoketest@example.com  ",
  ])(
    "rejects the reserved smoke identity on direct client writes: %s",
    async (email) => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(collection(db, "leads"), "smoke-blocked"), {
          ...validLead,
          email,
        }),
      );
    },
  );

  it.each([
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002,
    0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028,
    0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
  ])(
    "rejects the smoke identity wrapped in JS trim whitespace code point %i",
    async (codePoint) => {
      const space = String.fromCodePoint(codePoint);
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        setDoc(doc(collection(db, "leads"), "unicode-smoke-blocked"), {
          ...validLead,
          email: `${space}smoketest@example.com${space}`,
        }),
      );
    },
  );

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
    // WHY 1300: the rules email cap is 1280 (4x the client's 320, the RFC
    // maximum, to absorb rules-vs-JS multi-byte counting differences). The
    // fixture must exceed the RULES cap, not the client cap, to stay a
    // meaningful rejection test.
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        email: `${"a".repeat(1300)}@example.com`,
      }),
    );
  });

  it("progressive apply capture lead (name, instagram and phone) is accepted", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, "leads"), "lead-2"), {
        ...validLead,
        source: "apply_form_partial",
        name: "Priya Sharma",
        instagram: "priya_applies",
        phone: "+1 (555) 010-0000",
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

  it("step-2 contact update can add instagram, name and source (progressive capture)", async () => {
    await seedLead();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      updateDoc(doc(collection(db, "leads"), "lead-1"), {
        phone: "+1 (555) 010-0000",
        instagram: "priya_applies",
        name: "Priya Sharma",
        source: "apply_form_completed",
      }),
    );
  });

  it("oversized contact update values are rejected", async () => {
    await seedLead();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(collection(db, "leads"), "lead-1"), {
        instagram: "x".repeat(500),
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

describe("synthetic marker and private cleanup ledger", () => {
  it.each([
    "synthetic-monitor@garammasaladating.com",
    "synthetic-monitor+01234567-89ab-4cde-8fab-0123456789ab@garammasaladating.com",
  ])("allows reserved production monitoring identity %s", async (email) => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(db, "leads", "synthetic"), {
        ...validLead,
        email,
        isSynthetic: true,
      }),
    );
  });
  it.each([
    "customer@example.com",
    "synthetic-monitor+not-a-uuid@garammasaladating.com",
    "synthetic-monitor@garammasaladating.com.evil",
  ])("rejects a synthetic flag for %s", async (email) => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "leads", "forged"), {
        ...validLead,
        email,
        isSynthetic: true,
      }),
    );
  });
  it("denies browser access to cleanup evidence, including admin browsers", async () => {
    for (const context of [
      testEnv.unauthenticatedContext(),
      anonContext("test-uploader"),
      adminContext(),
    ]) {
      const ref = doc(context.firestore(), "syntheticRuns", "attempt");
      await assertFails(setDoc(ref, { email: validLead.email }));
      await assertFails(getDoc(ref));
    }
  });
});
