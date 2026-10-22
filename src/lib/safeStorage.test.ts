import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safeLocalStorage, safeSessionStorage } from "./safeStorage";

describe("safeStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips through safeLocalStorage on a healthy browser", () => {
    safeLocalStorage.setItem("gmd-test", "value");
    expect(safeLocalStorage.getItem("gmd-test")).toBe("value");
    safeLocalStorage.removeItem("gmd-test");
    expect(safeLocalStorage.getItem("gmd-test")).toBeNull();
  });

  it("round-trips through safeSessionStorage on a healthy browser", () => {
    safeSessionStorage.setItem("gmd-test", "value");
    expect(safeSessionStorage.getItem("gmd-test")).toBe("value");
    safeSessionStorage.removeItem("gmd-test");
    expect(safeSessionStorage.getItem("gmd-test")).toBeNull();
  });

  it("getItem returns null instead of throwing when storage access is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => safeLocalStorage.getItem("gmd-test")).not.toThrow();
    expect(safeLocalStorage.getItem("gmd-test")).toBeNull();
  });

  it("setItem swallows the error instead of throwing when storage access is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => safeLocalStorage.setItem("gmd-test", "value")).not.toThrow();
  });

  it("removeItem swallows the error instead of throwing when storage access is blocked", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(() => safeLocalStorage.removeItem("gmd-test")).not.toThrow();
  });
});
