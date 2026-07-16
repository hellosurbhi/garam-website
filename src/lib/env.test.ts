import { afterEach, describe, expect, it } from "vitest";
import { readPrivateKeyEnv, readTrimmedEnv } from "@/lib/env";

describe("env helpers", () => {
  afterEach(() => {
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
  });

  it("returns undefined for missing or blank values", () => {
    expect(readTrimmedEnv(undefined)).toBeUndefined();
    expect(readTrimmedEnv("  ")).toBeUndefined();
  });

  it("trims configured string values", () => {
    expect(readTrimmedEnv(" garam-masala-9f15b ")).toBe("garam-masala-9f15b");
  });

  it("normalizes escaped private key newlines", () => {
    expect(
      readPrivateKeyEnv(
        " -----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n ",
      ),
    ).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
  });
});
