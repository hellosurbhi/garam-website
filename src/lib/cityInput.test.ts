import { describe, expect, it } from "vitest";
import { trackEnteredCity } from "./cityInput";

describe("city entry evidence", () => {
  it("does not label an untouched programmatic prefill as entered", () => {
    const input = document.createElement("input");
    const source = trackEnteredCity(input);
    input.value = "Washington, DC";
    expect(source()).toBeUndefined();
  });
  it("tracks actual input, including entering the same city, but not clearing it", () => {
    const input = document.createElement("input");
    const source = trackEnteredCity(input);
    input.value = "Washington, DC";
    input.dispatchEvent(new Event("input"));
    expect(source()).toBe("entered");
    input.value = " ";
    input.dispatchEvent(new Event("input"));
    expect(source()).toBeUndefined();
    input.value = "Chicago";
    input.dispatchEvent(new Event("input"));
    expect(source()).toBe("entered");
  });
  it("rejects a delayed geo prefill after the visitor edits and clears the field", () => {
    const input = document.createElement("input");
    const source = trackEnteredCity(input);
    input.value = "Chicago";
    input.dispatchEvent(new Event("input"));
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.value = "Washington, DC";
    expect(source()).toBeUndefined();
    input.dispatchEvent(new Event("input"));
    expect(source()).toBe("entered");
  });
  it("does not claim input evidence when the optional field is absent", () => {
    expect(trackEnteredCity(null)()).toBeUndefined();
  });
});
