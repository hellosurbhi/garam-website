import { describe, expect, it } from "vitest";
import { publicCause } from "@/lib/publicCause";

describe("publicCause", () => {
  it("names the service and status without echoing the upstream text", () => {
    const cause = publicCause(
      new Error(
        "storage 403: https://storage.googleapis.com/b/secret-project/o/x denied",
      ),
    );
    expect(cause).toBe("storage answered HTTP 403");
    expect(cause).not.toContain("secret-project");
  });

  it("classifies a database status, a timeout and an unreachable host", () => {
    expect(publicCause(new Error("firestore 503: backend busy"))).toBe(
      "database answered HTTP 503",
    );
    expect(publicCause(new Error("Firestore request timed out"))).toBe(
      "database timed out",
    );
    expect(publicCause(new Error("storage fetch failed"))).toBe(
      "storage unreachable",
    );
  });

  it("falls back to a generic cause for anything else, including non-errors", () => {
    expect(publicCause(new Error("boom"))).toBe("server error");
    expect(publicCause("weird")).toBe("server error");
  });
});
