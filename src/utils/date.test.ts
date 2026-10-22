import { describe, it, expect } from "vitest";
import { toMs } from "@/utils/date";

describe("toMs", () => {
  it("parses an ISO string", () => {
    expect(toMs("2026-01-01T00:00:00.000Z")).toBe(Date.UTC(2026, 0, 1));
  });

  it("reads a Firestore Timestamp-like object", () => {
    const ts = { toDate: () => new Date("2026-01-01T00:00:00.000Z") };
    expect(toMs(ts)).toBe(Date.UTC(2026, 0, 1));
  });

  it("returns null for unset, empty and unparseable values", () => {
    expect(toMs(undefined)).toBeNull();
    expect(toMs(null)).toBeNull();
    expect(toMs("")).toBeNull();
    expect(toMs("not a date")).toBeNull();
    expect(toMs(42)).toBeNull();
    expect(toMs({})).toBeNull();
  });
});
