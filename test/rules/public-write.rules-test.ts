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

  // WHY these exist as rules tests rather than an end-to-end signup test:
  // capture-lead.ts builds its Firestore payload one addStringField() call at
  // a time, so an unexpected key never reaches the database from the form and
  // a "post a weird field through the real endpoint" test passes whatever the
  // rules say. Only the emulator can prove the allowlist itself. These cases
  // are the gate that lets the market-stamping writer ship: if they fail, the
  // deployed rule rejects every signup carrying market fields and the lead is
  // lost, not queued.
  it("lead carrying all three market fields is accepted", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: "nyc",
        marketConfidence: "high",
        marketSource: "self-reported",
      }),
    );
  });

  it("market fields stay optional (a lead with none is still accepted)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, "leads"), "lead-1"), validLead),
    );
  });

  it("every marketConfidence and marketSource value the resolver emits is accepted", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const confidences = ["high", "medium", "low"];
    const sources = ["self-reported", "source-city", "geo"];
    for (const [i, marketConfidence] of confidences.entries()) {
      await assertSucceeds(
        setDoc(doc(collection(db, "leads"), `conf-${i}`), {
          ...validLead,
          market: "nyc",
          marketConfidence,
        }),
      );
    }
    for (const [i, marketSource] of sources.entries()) {
      await assertSucceeds(
        setDoc(doc(collection(db, "leads"), `src-${i}`), {
          ...validLead,
          market: "nyc",
          marketSource,
        }),
      );
    }
  });

  it("marketConfidence outside the closed set is rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: "nyc",
        marketConfidence: "probably",
      }),
    );
  });

  it("marketSource outside the closed set is rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: "nyc",
        marketSource: "vibes",
      }),
    );
  });

  it("non-string market is rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: 42,
      }),
    );
  });

  it("oversized market is rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: "x".repeat(101),
      }),
    );
  });

  it("REGRESSION: widening the allowlist for market did not open it generally", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(collection(db, "leads"), "lead-1"), {
        ...validLead,
        market: "nyc",
        marketConfidence: "high",
        marketSource: "self-reported",
        isAdminMaybe: true,
      }),
    );
  });
});

describe("firestore.rules: server-only collections stay closed to clients", () => {
  const cases: Array<{ name: string; data: Record<string, unknown> }> = [
    { name: "contestants", data: { firstName: "X", createdAt: "now" } },
    { name: "stage_waivers", data: { firstName: "X", createdAt: "now" } },
    { name: "orders", data: { total: 1 } },
    // The announcement system's three collections. suppressions and
    // copyLedger decide who is allowed to be emailed and what they have
    // already seen, so a client write here would let a visitor un-suppress
    // someone or erase their copy history and cause a duplicate send.
    { name: "suppressions", data: { email: "x@example.com", reason: "reply" } },
    { name: "announcements", data: { eventSlug: "nyc-2026-11-01" } },
    { name: "copyLedger", data: { fingerprints: [] } },
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

  // WHY admin writes are denied too: approval and suppression go through
  // admin-gated API routes that write with the service account, which bypasses
  // rules entirely. Leaving a client-side admin write open would mean a stolen
  // admin session could approve copy or clear a suppression straight from the
  // browser, skipping the server's validation of both.
  it("announcements, suppressions and copyLedger: even admins cannot write", async () => {
    const adminDb = adminContext().firestore();
    for (const name of ["announcements", "suppressions", "copyLedger"]) {
      await assertFails(
        setDoc(doc(collection(adminDb, name), "x"), { touched: true }),
      );
    }
  });

  it("announcements, suppressions and copyLedger: admins CAN read (dashboard)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      for (const name of ["announcements", "suppressions", "copyLedger"]) {
        await setDoc(doc(collection(ctx.firestore(), name), "x"), {
          seeded: true,
        });
      }
    });
    const adminDb = adminContext().firestore();
    for (const name of ["announcements", "suppressions", "copyLedger"]) {
      await assertSucceeds(getDoc(doc(collection(adminDb, name), "x")));
    }
  });

  it("announcement milestone subcollections are closed to clients", async () => {
    const anonDb = anonContext("anon-1").firestore();
    await assertFails(
      setDoc(
        doc(collection(anonDb, "announcements/nyc-2026-11-01/events"), "e1"),
        { kind: "sent" },
      ),
    );
    await assertFails(
      getDoc(
        doc(collection(anonDb, "announcements/nyc-2026-11-01/events"), "e1"),
      ),
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
