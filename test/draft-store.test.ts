import { describe, it, expect } from "vitest";
import { applyPatch } from "@/lib/draftStore";

/**
 * applyPatch predicts what Firestore stores after a masked PATCH. A wrong
 * prediction means the route's cap checks run against a document that does not
 * exist, so these pin Firestore's updateMask rules.
 */
describe("applyPatch follows updateMask semantics", () => {
  it("a dotted key sets one nested field and keeps its siblings", () => {
    const after = applyPatch(
      { photoReservations: { a: 1, b: 2 }, name: "Priya" },
      { "photoReservations.c": 3 },
    );
    expect(after).toEqual({
      photoReservations: { a: 1, b: 2, c: 3 },
      name: "Priya",
    });
  });

  it("a plain key holding a map replaces the whole map", () => {
    const after = applyPatch(
      { photoReservations: { a: 1, b: 2 } },
      { photoReservations: { c: 3 } },
    );
    expect(after).toEqual({ photoReservations: { c: 3 } });
  });

  it("never mutates the stored document it was given", () => {
    const before = { photoReservations: { a: 1 } };
    applyPatch(before, { "photoReservations.b": 2 });
    expect(before).toEqual({ photoReservations: { a: 1 } });
  });

  it("creates missing parents for a dotted key on an empty document", () => {
    expect(applyPatch(null, { "a.b.c": 1 })).toEqual({ a: { b: { c: 1 } } });
  });
});
