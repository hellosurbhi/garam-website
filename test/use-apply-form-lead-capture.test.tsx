import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  captureLead: vi.fn(),
  updateLeadFields: vi.fn(),
}));

vi.mock("@/lib/leadSubmission", () => ({
  captureLead: mocks.captureLead,
  updateLeadFields: mocks.updateLeadFields,
}));
vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(),
  getFirebaseStorage: vi.fn(),
  getFirebaseAuth: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({
  trackError: vi.fn(),
  trackLeadEvent: vi.fn(),
  identifyLead: vi.fn(),
}));
vi.mock("@/lib/leadAttribution", () => ({
  buildLeadAttribution: vi.fn(async ({ source }: { source: string }) => ({
    source,
    sourcePage: "/apply",
  })),
}));
vi.mock("@/lib/syntheticMonitor", () => ({
  isSyntheticSubmission: vi.fn((email: string | undefined) =>
    Boolean(email?.includes("synthetic")),
  ),
}));
vi.mock("@/lib/failureAlert", () => ({
  reportFailure: vi.fn(),
}));
vi.mock("@/utils/compressImage", () => ({
  compressImage: vi.fn(),
}));

import { useApplyForm } from "@/components/apply/useApplyForm";

beforeEach(() => {
  mocks.captureLead
    .mockReset()
    .mockResolvedValue({ id: "lead-1", updateToken: "tok" });
  mocks.updateLeadFields.mockReset().mockResolvedValue(undefined);
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("progressive lead capture (abandoned apply form still leaves a lead)", () => {
  it("captures a lead on email blur with whatever contact fields exist", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      result.current.set("email", "Priya@Example.com");
      result.current.set("phone", "+1 (555) 010-0000");
    });
    act(() => {
      result.current.handleBlur("email");
    });

    await waitFor(() => expect(mocks.captureLead).toHaveBeenCalledTimes(1));
    expect(mocks.captureLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "priya@example.com",
        phone: "+1 (555) 010-0000",
        source: "apply_form_partial",
      }),
    );
    expect(mocks.updateLeadFields).not.toHaveBeenCalled();
  });

  it("updates the same lead as instagram and name get filled, never resending unchanged fields", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      result.current.set("email", "priya@example.com");
      result.current.set("phone", "+1 (555) 010-0000");
    });
    act(() => {
      result.current.handleBlur("email");
    });
    await waitFor(() => expect(mocks.captureLead).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.set("instagram", "@priya_applies");
      result.current.set("name", "Priya Sharma");
    });
    act(() => {
      result.current.handleBlur("instagram");
    });

    await waitFor(() =>
      expect(mocks.updateLeadFields).toHaveBeenCalledTimes(1),
    );
    expect(mocks.updateLeadFields).toHaveBeenCalledWith(
      { id: "lead-1", updateToken: "tok" },
      // The leading @ is stripped before the lead is stored; the unchanged
      // phone must not be resent.
      { instagram: "priya_applies", name: "Priya Sharma" },
    );

    act(() => {
      result.current.handleBlur("name");
    });
    await flush();
    expect(mocks.updateLeadFields).toHaveBeenCalledTimes(1);
    expect(mocks.captureLead).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the email is missing or invalid", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      result.current.handleBlur("email");
    });
    await flush();

    act(() => {
      result.current.set("email", "not-an-email");
    });
    act(() => {
      result.current.handleBlur("email");
    });
    await flush();

    expect(mocks.captureLead).not.toHaveBeenCalled();
  });

  it("never turns the synthetic monitor submission into a lead", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      result.current.set("email", "apply-synthetic@example.com");
    });
    act(() => {
      result.current.handleBlur("email");
    });
    await flush();

    expect(mocks.captureLead).not.toHaveBeenCalled();
  });

  it("swallows capture failures silently and retries on the next blur", async () => {
    mocks.captureLead.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      result.current.set("email", "priya@example.com");
    });
    act(() => {
      result.current.handleBlur("email");
    });
    await waitFor(() => expect(mocks.captureLead).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.handleBlur("email");
    });
    await waitFor(() => expect(mocks.captureLead).toHaveBeenCalledTimes(2));
    expect(mocks.updateLeadFields).not.toHaveBeenCalled();
  });
});
