import { describe, it, expect, beforeEach } from "vitest";
import {
  FORM_FIELD_KEYS,
  fieldLengths,
  mergeDraft,
  sanitizeFields,
} from "@/lib/applicationDraft";
import {
  isDraftId,
  issueDraftToken,
  newDraftId,
  verifyDraftToken,
} from "@/lib/draftToken";
import { deriveDraftSecret } from "@/lib/draftSecret";

/** Small seeded PRNG (mulberry32) so a fuzz failure reproduces from its seed. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NASTY_STRINGS = [
  "",
  " ",
  "   padded   ",
  "Priya Sharma",
  "👩🏽‍🎤🔥".repeat(50),
  "שלום עולם",
  "محمد",
  "x".repeat(5_000),
  "y".repeat(200_000),
  "\u0000\u0001null\u0000",
  "<script>alert(1)</script>",
  "@handle",
  "https://instagram.com/handle",
  "abc123",
  "-1",
  "1e9",
  "NaN",
];

function randomValue(r: () => number): unknown {
  const pick = Math.floor(r() * 9);
  switch (pick) {
    case 0:
      return NASTY_STRINGS[Math.floor(r() * NASTY_STRINGS.length)];
    case 1:
      return Math.floor(r() * 400) - 100;
    case 2:
      return r() > 0.5;
    case 3:
      return null;
    case 4:
      return undefined;
    case 5:
      return { nested: [1, 2, 3] };
    case 6:
      return [1, "two"];
    case 7:
      return r() * 1e12;
    default:
      return NASTY_STRINGS[Math.floor(r() * NASTY_STRINGS.length)];
  }
}

describe("sanitizeFields: nothing a person types is ever rejected", () => {
  it("never throws and only ever returns known keys, over 5000 random payloads", () => {
    const r = rng(20261110);
    const known = new Set<string>(FORM_FIELD_KEYS);
    for (let i = 0; i < 5000; i++) {
      const raw: Record<string, unknown> = {};
      const n = Math.floor(r() * 12);
      for (let j = 0; j < n; j++) {
        const key =
          r() > 0.3
            ? FORM_FIELD_KEYS[Math.floor(r() * FORM_FIELD_KEYS.length)]
            : `unknown${Math.floor(r() * 5)}`;
        raw[key] = randomValue(r);
      }
      const out = sanitizeFields(raw);
      for (const k of out.keys) expect(known.has(k)).toBe(true);
      for (const [k, v] of Object.entries(out.values)) {
        expect(["string", "number", "boolean", "object"]).toContain(typeof v);
        if (typeof v === "string")
          expect(v.length).toBeLessThanOrEqual(100_000);
        expect(
          known.has(k) || k === "ageUnder18" || k === "emailNormalized",
        ).toBe(true);
      }
    }
  });

  it("returns an empty result for non-object input instead of throwing", () => {
    for (const bad of [null, undefined, 7, "str", [1, 2], true]) {
      expect(sanitizeFields(bad)).toEqual({ values: {}, keys: [] });
    }
  });

  it("drops unknown and server-controlled keys (status, castEventId, photoPaths)", () => {
    const out = sanitizeFields({
      name: "A",
      status: "Cast",
      castEventId: "evt",
      deletedAt: "x",
      isSynthetic: true,
      photoPaths: ["photos/other/0"],
      notes: "hi",
    });
    expect(Object.keys(out.values)).toEqual(["name"]);
  });

  it("keeps every age, with no upper bound, and flags only under 18", () => {
    expect(sanitizeFields({ age: 200 }).values).toMatchObject({
      age: 200,
      ageUnder18: false,
    });
    expect(sanitizeFields({ age: "34" }).values).toMatchObject({
      age: 34,
      ageUnder18: false,
    });
    expect(sanitizeFields({ age: 7 }).values).toMatchObject({
      age: 7,
      ageUnder18: true,
    });
    expect(sanitizeFields({ age: 17 }).values.ageUnder18).toBe(true);
    expect(sanitizeFields({ age: 18 }).values.ageUnder18).toBe(false);
  });

  it("stores an unparseable or cleared age as null (not flagged under 18)", () => {
    for (const age of ["", "abc", null, undefined, {}, NaN]) {
      expect(sanitizeFields({ age }).values).toMatchObject({
        age: null,
        ageUnder18: false,
      });
    }
  });

  it("normalizes email, strips a leading @ from instagram, trims phone", () => {
    const { values } = sanitizeFields({
      email: "  Priya@Example.COM ",
      instagram: " @priya ",
      phone: "  555 123 ",
    });
    expect(values).toMatchObject({
      email: "Priya@Example.COM",
      emailNormalized: "priya@example.com",
      instagram: "priya",
      phone: "555 123",
    });
  });

  it("keeps a 5000 character pitch whole and a 40 page essay under the ceiling", () => {
    expect(
      (sanitizeFields({ pitch: "p".repeat(5_000) }).values.pitch as string)
        .length,
    ).toBe(5_000);
    expect(
      (sanitizeFields({ pitch: "p".repeat(500_000) }).values.pitch as string)
        .length,
    ).toBe(100_000);
  });

  it("lets a person clear a field: an explicit empty value is kept", () => {
    const out = sanitizeFields({ pitch: "", instagram: "" });
    expect(out.keys).toEqual(
      ["instagram", "pitch"].sort(
        (a, b) =>
          FORM_FIELD_KEYS.indexOf(a as never) -
          FORM_FIELD_KEYS.indexOf(b as never),
      ),
    );
    expect(out.values).toMatchObject({ pitch: "", instagram: "" });
  });

  it("coerces consent flags: only a real true counts", () => {
    expect(sanitizeFields({ termsAgreed: "true" }).values.termsAgreed).toBe(
      false,
    );
    expect(sanitizeFields({ termsAgreed: true }).values.termsAgreed).toBe(true);
    expect(
      sanitizeFields({ marketingConsent: "maybe" }).values.marketingConsent,
    ).toBe("");
    expect(
      sanitizeFields({ marketingConsent: "yes" }).values.marketingConsent,
    ).toBe("yes");
    expect(sanitizeFields({ seenShowBefore: "no" }).values.seenShowBefore).toBe(
      false,
    );
    expect(sanitizeFields({ seenShowBefore: "??" }).values.seenShowBefore).toBe(
      null,
    );
  });

  it("forces applicationType to a known value", () => {
    expect(sanitizeFields({ applicationType: "Nomination" }).values).toEqual({
      applicationType: "Nomination",
    });
    expect(sanitizeFields({ applicationType: "<b>" }).values).toEqual({
      applicationType: "Self",
    });
  });
});

describe("mergeDraft: late, duplicate and reordered saves", () => {
  it("applies a field the first time and records its rev", () => {
    const res = mergeDraft({}, sanitizeFields({ name: "A" }), 1);
    expect(res.applied).toEqual(["name"]);
    expect(res.patch).toEqual({ name: "A", "fieldRevs.name": 1 });
  });

  it("ignores a stale request: an older rev never overwrites a newer answer", () => {
    const existing = { name: "Newer", fieldRevs: { name: 5 } };
    const res = mergeDraft(existing, sanitizeFields({ name: "Older" }), 3);
    expect(res.stale).toEqual(["name"]);
    expect(res.applied).toEqual([]);
    expect(res.patch).toEqual({});
  });

  it("re-applies an identical duplicate (same rev) idempotently", () => {
    const first = mergeDraft({}, sanitizeFields({ name: "A" }), 2);
    const second = mergeDraft(
      { name: "A", fieldRevs: { name: 2 } },
      sanitizeFields({ name: "A" }),
      2,
    );
    expect(second.patch).toEqual(first.patch);
  });

  it("merges per field: a stale field does not block a fresh one in the same request", () => {
    const existing = { fieldRevs: { name: 9 } };
    const res = mergeDraft(
      existing,
      sanitizeFields({ name: "old", city: "NYC" }),
      4,
    );
    expect(res.stale).toEqual(["name"]);
    expect(res.applied).toEqual(["city"]);
  });

  it("a field cleared at a newer rev wins over an older non-empty one", () => {
    const res = mergeDraft(
      { pitch: "text", fieldRevs: { pitch: 2 } },
      sanitizeFields({ pitch: "" }),
      3,
    );
    expect(res.patch.pitch).toBe("");
  });

  it("age and email carry their derived fields with them", () => {
    const res = mergeDraft(
      {},
      sanitizeFields({ age: 16, email: "A@B.com" }),
      1,
    );
    expect(res.patch).toMatchObject({
      age: 16,
      ageUnder18: true,
      email: "A@B.com",
      emailNormalized: "a@b.com",
    });
  });

  it("any order of the same revisioned writes converges on the highest rev", () => {
    const r = rng(7);
    const writes = [1, 2, 3, 4, 5].map((rev) => ({ rev, name: `v${rev}` }));
    for (let trial = 0; trial < 200; trial++) {
      const shuffled = [...writes].sort(() => r() - 0.5);
      let doc: Record<string, unknown> = {};
      for (const w of shuffled) {
        const { patch } = mergeDraft(
          doc,
          sanitizeFields({ name: w.name }),
          w.rev,
        );
        doc = {
          ...doc,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          fieldRevs: {
            ...(doc.fieldRevs as Record<string, number> | undefined),
            ...(patch["fieldRevs.name"] !== undefined
              ? { name: patch["fieldRevs.name"] as number }
              : {}),
          },
        };
      }
      expect(doc.name).toBe("v5");
    }
  });
});

describe("fieldLengths", () => {
  it("reports string lengths only, so alerts carry sizes and never values", () => {
    expect(fieldLengths({ name: "Priya", age: 27, pitch: "" })).toEqual({
      name: 5,
      pitch: 0,
    });
  });
});

describe("draft tokens", () => {
  beforeEach(() => {
    import.meta.env.DRAFT_TOKEN_SECRET = "test-secret-for-tokens";
  });

  it("round-trips a draft id", () => {
    const id = newDraftId();
    expect(isDraftId(id)).toBe(true);
    expect(verifyDraftToken(issueDraftToken(id))).toEqual({
      ok: true,
      draftId: id,
    });
  });

  it("says exactly why it failed: malformed, bad_signature, expired", () => {
    const id = newDraftId();
    expect(verifyDraftToken("")).toEqual({ ok: false, reason: "malformed" });
    expect(verifyDraftToken(undefined)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyDraftToken("x".repeat(600))).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyDraftToken("not-a-token")).toEqual({
      ok: false,
      reason: "malformed",
    });

    const token = issueDraftToken(id);
    const decoded = Buffer.from(token, "base64url").toString();
    const tampered = Buffer.from(decoded.replace(id, newDraftId())).toString(
      "base64url",
    );
    expect(verifyDraftToken(tampered)).toEqual({
      ok: false,
      reason: "bad_signature",
    });

    const old = issueDraftToken(id, Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(verifyDraftToken(old)).toEqual({ ok: false, reason: "expired" });
  });

  it("a token for draft A never verifies as draft B", () => {
    const a = newDraftId();
    const b = newDraftId();
    const res = verifyDraftToken(issueDraftToken(a));
    expect(res.ok && res.draftId).toBe(a);
    expect(res.ok && res.draftId).not.toBe(b);
  });

  it("a token signed with a different secret is rejected", () => {
    const id = newDraftId();
    const token = issueDraftToken(id);
    import.meta.env.DRAFT_TOKEN_SECRET = "another-secret";
    expect(verifyDraftToken(token)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects non-hex draft ids (path tricks) inside an otherwise signed token", () => {
    expect(isDraftId("../../etc/passwd")).toBe(false);
    expect(isDraftId("A".repeat(32))).toBe(false);
    expect(isDraftId(123)).toBe(false);
  });
});

describe("deriveDraftSecret", () => {
  it("prefers the explicit secret, else derives from the service-account key", () => {
    expect(deriveDraftSecret(" explicit ", "key")).toBe("explicit");
    const derived = deriveDraftSecret(undefined, "key");
    expect(derived).toMatch(/^[a-f0-9]{64}$/);
    expect(deriveDraftSecret("", "key")).toBe(derived);
    expect(deriveDraftSecret(undefined, "other-key")).not.toBe(derived);
  });

  it("fails loudly with a message naming both env vars when neither exists", () => {
    expect(() => deriveDraftSecret(undefined, undefined)).toThrow(
      /DRAFT_TOKEN_SECRET or FIREBASE_ADMIN_PRIVATE_KEY/,
    );
  });
});
