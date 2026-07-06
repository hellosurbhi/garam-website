import { describe, it, expect } from "vitest";
import { validateEmail } from "./validateEmail";

describe("validateEmail", () => {
  it("requires a non-empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects malformed addresses", () => {
    for (const bad of [
      "nope",
      "no-at-sign.com",
      "missing@domain",
      "@nodomain.com",
      "spaces in@email.com",
      "two@@at.com",
    ]) {
      expect(validateEmail(bad), bad).toBe(
        "Please enter a valid email address",
      );
    }
  });

  it("accepts valid addresses and trims surrounding whitespace", () => {
    expect(validateEmail("a@b.co")).toBeUndefined();
    expect(validateEmail("surbhi@garammasaladating.com")).toBeUndefined();
    expect(validateEmail("  padded@email.com  ")).toBeUndefined();
  });
});
