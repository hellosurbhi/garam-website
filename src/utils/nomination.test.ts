import { describe, it, expect } from "vitest";
import { getFriendFirstName } from "./nomination";

describe("getFriendFirstName", () => {
  it("returns undefined for empty or whitespace-only input", () => {
    expect(getFriendFirstName("")).toBeUndefined();
    expect(getFriendFirstName("   ")).toBeUndefined();
  });

  it("returns the first token of a full name", () => {
    expect(getFriendFirstName("Priya Sharma")).toBe("Priya");
    expect(getFriendFirstName("  Priya   Sharma  ")).toBe("Priya");
  });

  it("returns the whole value when only one name is given", () => {
    expect(getFriendFirstName("Priya")).toBe("Priya");
  });
});
