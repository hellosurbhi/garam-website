import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaiverSignature } from "./useWaiverSignature";

describe("useWaiverSignature", () => {
  it("signature is valid only when it matches the full legal name (case-insensitive)", () => {
    const { result } = renderHook(() => useWaiverSignature("Priya Sharma"));
    expect(result.current.signatureValid).toBe(false);

    act(() => result.current.setSignature("priya sharma"));
    expect(result.current.signatureValid).toBe(true);

    act(() => result.current.setSignature("Priya S"));
    expect(result.current.signatureValid).toBe(false);
  });

  it("an empty signature never validates, even against an empty name", () => {
    const { result } = renderHook(() => useWaiverSignature(""));
    expect(result.current.signatureValid).toBe(false);
  });

  it("marks the waiver read immediately when the panel does not scroll", () => {
    const { result } = renderHook(() => useWaiverSignature("Priya Sharma"));
    expect(result.current.waiverScrolled).toBe(false);
    act(() =>
      result.current.waiverRef({
        scrollHeight: 100,
        clientHeight: 100,
      } as HTMLDivElement),
    );
    expect(result.current.waiverScrolled).toBe(true);
  });

  it("requires reaching the bottom when the panel scrolls", () => {
    const { result } = renderHook(() => useWaiverSignature("Priya Sharma"));
    act(() =>
      result.current.waiverRef({
        scrollHeight: 1000,
        clientHeight: 300,
      } as HTMLDivElement),
    );
    expect(result.current.waiverScrolled).toBe(false);

    act(() =>
      result.current.handleWaiverScroll({
        scrollHeight: 1000,
        clientHeight: 300,
        scrollTop: 100,
      } as HTMLDivElement),
    );
    expect(result.current.waiverScrolled).toBe(false);

    act(() =>
      result.current.handleWaiverScroll({
        scrollHeight: 1000,
        clientHeight: 300,
        scrollTop: 700,
      } as HTMLDivElement),
    );
    expect(result.current.waiverScrolled).toBe(true);
  });
});
