import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type React from "react";

const controller = vi.hoisted(() => ({
  setField: vi.fn(),
  finalize: vi.fn(),
  setOnPersistentFailure: vi.fn(),
  flushOnExit: vi.fn(),
  onDraftReset: vi.fn(() => () => {}),
  epoch: 0,
}));
const settleForSubmit = vi.hoisted(() => vi.fn());
const buildLeadAttribution = vi.hoisted(() => vi.fn());
const reportFailure = vi.hoisted(() => vi.fn());

vi.mock("@/lib/applyAutosave", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/applyAutosave")>()),
  AutosaveController: class {
    setField = controller.setField;
    finalize = controller.finalize;
    setOnPersistentFailure = controller.setOnPersistentFailure;
    flushOnExit = controller.flushOnExit;
    onDraftReset = controller.onDraftReset;
    epoch = 0;
  },
}));
vi.mock("@/components/apply/usePhotoUploads", () => ({
  usePhotoUploads: () => ({
    items: [],
    addPhotos: vi.fn(),
    removePhoto: vi.fn(),
    settleForSubmit,
    reset: vi.fn(),
  }),
}));
vi.mock("@/components/apply/applyFormModel", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/apply/applyFormModel")
  >()),
  // The form's own validation rules are covered elsewhere; this file tests
  // what happens after a valid submit.
  getFieldErrors: () => ({}),
}));
vi.mock("@/lib/analytics", () => ({
  trackError: vi.fn(),
  trackLeadEvent: vi.fn(),
  identifyLead: vi.fn(),
}));
vi.mock("@/lib/leadAttribution", () => ({ buildLeadAttribution }));
vi.mock("@/lib/failureAlert", () => ({ reportFailure }));

import { useApplyForm } from "@/components/apply/useApplyForm";

const submitEvent = {
  preventDefault: () => {},
} as unknown as React.FormEvent<HTMLFormElement>;

beforeEach(() => {
  vi.clearAllMocks();
  settleForSubmit.mockResolvedValue([]);
  buildLeadAttribution.mockResolvedValue({});
  controller.finalize.mockResolvedValue({ ok: true });
  window.scrollTo = vi.fn();
});

describe("useApplyForm: submit", () => {
  it("settles photos and queues every field inside finalize, then shows success", async () => {
    controller.finalize.mockImplementation(
      async (settle: () => Promise<void>) => {
        await settle();
        return { ok: true };
      },
    );
    const { result } = renderHook(() => useApplyForm());
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(settleForSubmit).toHaveBeenCalledTimes(1);
    expect(controller.setField).toHaveBeenCalledWith("name", "");
    expect(result.current.submitted).toBe(true);
  });

  it("runs settle again when finalize asks for another round after a draft reset", async () => {
    controller.finalize.mockImplementation(
      async (settle: () => Promise<void>) => {
        await settle();
        await settle();
        return { ok: true };
      },
    );
    const { result } = renderHook(() => useApplyForm());
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(settleForSubmit).toHaveBeenCalledTimes(2);
  });

  it("an analytics failure after the application is filed still shows success", async () => {
    buildLeadAttribution.mockRejectedValue(new Error("analytics down"));
    const { result } = renderHook(() => useApplyForm());
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(result.current.submitted).toBe(true);
    expect(result.current.toast).toBeNull();
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("a failed finalize shows the cause, alerts and leaves the form open", async () => {
    controller.finalize.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useApplyForm());
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(result.current.submitted).toBe(false);
    expect(result.current.toast?.ok).toBe(false);
    expect(reportFailure).toHaveBeenCalledTimes(1);
  });
});
