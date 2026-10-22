import { describe, it, expect, vi } from "vitest";

vi.mock("./firestoreAdmin", () => ({
  getFirestoreAccessToken: vi.fn(async () => "token"),
}));

const { assertSafePath, fsGet, fsPatch, fsAdd, fsListAll, fsDeleteFields } =
  await import("./firestoreRest");

describe("assertSafePath", () => {
  it("accepts normal document and collection paths", () => {
    expect(() => assertSafePath("applications")).not.toThrow();
    expect(() => assertSafePath("applications/abc123/events")).not.toThrow();
  });

  it.each(["../leads/target", "applications/../leads", "a/./b", "a//b", ""])(
    "rejects %j",
    (bad) => {
      expect(() => assertSafePath(bad)).toThrow(/Unsafe Firestore path/);
    },
  );
});

describe("path-accepting helpers reject traversal before any network call", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  it("blocks every exported helper", async () => {
    const bad = "invites/../../leads/target";
    await expect(fsGet(bad)).rejects.toThrow(/Unsafe/);
    await expect(fsPatch(bad, { a: 1 })).rejects.toThrow(/Unsafe/);
    await expect(fsAdd(bad, { a: 1 })).rejects.toThrow(/Unsafe/);
    await expect(fsListAll("../leads")).rejects.toThrow(/Unsafe/);
    await expect(fsDeleteFields(bad, ["a"])).rejects.toThrow(/Unsafe/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
