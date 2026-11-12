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
  saved: {} as Record<string, string | boolean>,
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
    get savedFields() {
      return controller.saved;
    }
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
import { identifyLead, trackLeadEvent } from "@/lib/analytics";

const submitEvent = {
  preventDefault: () => {},
} as unknown as React.FormEvent<HTMLFormElement>;

beforeEach(() => {
  vi.clearAllMocks();
  settleForSubmit.mockResolvedValue([]);
  buildLeadAttribution.mockResolvedValue({});
  controller.finalize.mockResolvedValue({ ok: true });
  controller.saved = {};
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

  it("a city in the link replaces the saved location, country included", () => {
    controller.saved = {
      city: "Austin",
      state: "TX",
      country: "United States",
    };
    window.history.pushState({}, "", "/apply?city=Mumbai&state=MH");
    try {
      const { result } = renderHook(() => useApplyForm());
      expect(result.current.form.city).toBe("Mumbai");
      expect(result.current.form.state).toBe("MH");
      expect(result.current.form.country).toBe("");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("a reload refills the form from the saved answers instead of starting blank", () => {
    controller.saved = {
      name: "Priya",
      pitch: "Saved earlier",
      city: "Austin",
      state: "TX",
      termsAgreed: true,
      photoUploadFailed: false,
    };
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.form.name).toBe("Priya");
    expect(result.current.form.pitch).toBe("Saved earlier");
    expect(result.current.cityInput).toBe("Austin, TX");
    expect(result.current.termsAgreed).toBe(true);
    expect(result.current.nominationConsent).toBe(false);
  });

  it("a real applicant is identified and counted in the funnel", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("email", "priya@example.com"));
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(identifyLead).toHaveBeenCalledTimes(1);
    expect(trackLeadEvent).toHaveBeenCalledWith(
      "apply_submitted",
      expect.anything(),
    );
  });

  it("the synthetic canary identity never reaches analytics but still succeeds", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.set("email", "synthetic-monitor@garammasaladating.com"),
    );
    await act(async () => result.current.handleSubmit(submitEvent));
    expect(result.current.submitted).toBe(true);
    expect(identifyLead).not.toHaveBeenCalled();
    expect(trackLeadEvent).not.toHaveBeenCalledWith(
      "apply_submitted",
      expect.anything(),
    );
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
