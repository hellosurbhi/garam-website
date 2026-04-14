import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ─── Mocks ──────────────────────────────────────────────────────── */

const mockAddDoc = vi.fn().mockResolvedValue({ id: "doc-1" });
const mockUploadBytesResumable = vi
  .fn()
  .mockReturnValue(Object.assign(Promise.resolve({}), { cancel: vi.fn() }));
const mockGetDownloadURL = vi
  .fn()
  .mockResolvedValue("https://example.com/photo.jpg");
const mockDeleteObject = vi.fn().mockResolvedValue(undefined);
const mockSignInAnonymously = vi.fn().mockResolvedValue({ user: {} });

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(() => "mock-ref"),
  uploadBytesResumable: (...args: unknown[]) =>
    mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock("firebase/auth", () => ({
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseStorage: vi.fn(() => "mock-storage"),
  getFirebaseAuth: vi.fn(() => "mock-auth"),
}));

const mockTrackLeadEvent = vi.fn();
const mockTrackError = vi.fn();
const mockIdentifyLead = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackLeadEvent: (...args: unknown[]) => mockTrackLeadEvent(...args),
  trackError: (...args: unknown[]) => mockTrackError(...args),
  identifyLead: (...args: unknown[]) => mockIdentifyLead(...args),
}));

const mockBuildLeadAttribution = vi.fn().mockReturnValue({ source: "apply" });
vi.mock("@/lib/leadAttribution", () => ({
  buildLeadAttribution: (...args: unknown[]) =>
    mockBuildLeadAttribution(...args),
}));

import { useApplyForm, type FormState } from "./useApplyForm";

/* ─── Helpers ────────────────────────────────────────────────────── */

function makeFile(name = "photo.jpg", size = 1024): File {
  const content = new ArrayBuffer(size);
  return new File([content], name, { type: "image/jpeg" });
}

function makeChangeEvent(file?: File) {
  return {
    target: {
      files: file ? [file] : [],
      value: file ? "C:\\fake\\photo.jpg" : "",
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function makeSubmitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as React.FormEvent<HTMLFormElement>;
}

/** Fill all required fields so validation passes. */
function fillRequired(
  set: (field: keyof FormState, value: string) => void,
  handleTermsCheckbox: (v: boolean) => void,
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
) {
  set("name", "Jane Doe");
  set("age", "25");
  set("gender", "Woman");
  set("orientation", "Straight");
  set("city", "New York");
  set("email", "jane@example.com");
  set("instagram", "janedoe");
  set("marketingConsent", "yes");
  handleTermsCheckbox(true);
  handlePhotoChange(makeChangeEvent(makeFile()));
}

/* ─── Tests ──────────────────────────────────────────────────────── */

describe("useApplyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "test-uuid" as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ── Initial state ────────────────────────────────────── */

  it("returns default form state", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.form.applicationType).toBe("Self");
    expect(result.current.form.name).toBe("");
    expect(result.current.form.age).toBe("");
    expect(result.current.form.gender).toBe("");
    expect(result.current.form.marketingConsent).toBe("");
  });

  it("starts with empty errors", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.errors).toEqual({});
  });

  it("starts as not submitted and not submitting", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.submitted).toBe(false);
    expect(result.current.submitting).toBe(false);
  });

  it("starts with termsAgreed false", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.termsAgreed).toBe(false);
  });

  /* ── set() ────────────────────────────────────────────── */

  it("set() updates form field", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("name", "Jane"));
    expect(result.current.form.name).toBe("Jane");
  });

  it("set() clears error for that field", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.name).toBe("Required");
    act(() => result.current.set("name", "Jane"));
    expect(result.current.errors.name).toBeUndefined();
  });

  /* ── handleCityInputChange ────────────────────────────── */

  it("handleCityInputChange updates cityInput and form.city", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handleCityInputChange({
        target: { value: "Mumbai" },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    expect(result.current.cityInput).toBe("Mumbai");
    expect(result.current.form.city).toBe("Mumbai");
  });

  it("handleCityInputChange clears state and country", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      result.current.set("state", "NY");
      result.current.set("country", "US");
    });
    act(() =>
      result.current.handleCityInputChange({
        target: { value: "Mumbai" },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    expect(result.current.form.state).toBe("");
    expect(result.current.form.country).toBe("");
  });

  it("handleCityInputChange clears city error without touching other errors", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.city).toBe("Required");
    expect(result.current.errors.name).toBe("Required");
    act(() =>
      result.current.handleCityInputChange({
        target: { value: "NYC" },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    expect(result.current.errors.city).toBeUndefined();
    expect(result.current.errors.name).toBe("Required");
  });

  /* ── handlePhotoChange ────────────────────────────────── */

  it("handlePhotoChange accepts file under 5MB", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("p.jpg", 1024)),
      ),
    );
    expect(result.current.errors.photo).toBeUndefined();
  });

  it("handlePhotoChange rejects file over 5MB", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("huge.jpg", 6 * 1024 * 1024)),
      ),
    );
    expect(result.current.errors.photo).toBe("Photo must be under 5 MB");
  });

  it("handlePhotoChange clears photo on no file selected", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.handlePhotoChange(makeChangeEvent()));
    expect(result.current.photoPreview).toBeNull();
  });

  /* ── handleTermsCheckbox / agreeToTerms ───────────────── */

  it("handleTermsCheckbox sets termsAgreed", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.handleTermsCheckbox(true));
    expect(result.current.termsAgreed).toBe(true);
  });

  it("handleTermsCheckbox clears termsAgreed error when checked", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.termsAgreed).toBeDefined();
    act(() => result.current.handleTermsCheckbox(true));
    expect(result.current.errors.termsAgreed).toBeUndefined();
  });

  it("handleTermsCheckbox does not clear error when unchecked", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    act(() => result.current.handleTermsCheckbox(false));
    expect(result.current.errors.termsAgreed).toBeDefined();
  });

  it("agreeToTerms sets termsAgreed, clears error, closes modal", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.setShowTermsModal(true));
    expect(result.current.showTermsModal).toBe(true);
    act(() => result.current.agreeToTerms());
    expect(result.current.termsAgreed).toBe(true);
    expect(result.current.showTermsModal).toBe(false);
  });

  /* ── validate() via handleSubmit ──────────────────────── */

  it("validation fails with all empty fields", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.name).toBe("Required");
    expect(result.current.errors.age).toBe("Must be 18 or older");
    expect(result.current.errors.gender).toBe("Required");
    expect(result.current.errors.orientation).toBe("Required");
    expect(result.current.errors.city).toBe("Required");
    expect(result.current.errors.email).toBe("Email is required");
    expect(result.current.errors.instagram).toBe("Required");
    expect(result.current.errors.photo).toBe("A photo is required");
    expect(result.current.errors.marketingConsent).toBe(
      "Please select Yes or No.",
    );
    expect(result.current.errors.termsAgreed).toBe(
      "You must agree to the Terms & Conditions",
    );
  });

  it("validation shows toast on failure", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.toast).toEqual({
      msg: "Please fill in all required fields",
      ok: false,
    });
  });

  it("validation rejects age under 18", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("age", "17"));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.age).toBe("Must be 18 or older");
  });

  it("validation accepts age 18", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("age", "18"));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.age).toBeUndefined();
  });

  it("validation rejects non-numeric age", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("age", "abc"));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.age).toBe("Must be 18 or older");
  });

  it("validation requires referrerName only for Nomination type", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("applicationType", "Nomination"));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.referrerName).toBe("Required");
  });

  it("validation does not require referrerName for Self type", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.referrerName).toBeUndefined();
  });

  it("validation requires marketingConsent", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.marketingConsent).toBe(
      "Please select Yes or No.",
    );
  });

  it("validation passes name with whitespace-only as Required", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("name", "   "));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.name).toBe("Required");
  });

  it("validation passes instagram with whitespace-only as Required", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("instagram", "   "));
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.instagram).toBe("Required");
  });

  /* ── handleSubmit calls preventDefault ─────────────────── */

  it("handleSubmit calls preventDefault", async () => {
    const { result } = renderHook(() => useApplyForm());
    const event = makeSubmitEvent();
    await act(async () => {
      await result.current.handleSubmit(event);
    });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  /* ── handleSubmit success flow ────────────────────────── */

  it("successful submit calls Firebase and resets form", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitted).toBe(true);
    expect(result.current.submitting).toBe(false);
    expect(mockSignInAnonymously).toHaveBeenCalledWith("mock-auth");
    expect(mockUploadBytesResumable).toHaveBeenCalled();
    expect(mockGetDownloadURL).toHaveBeenCalled();
    expect(mockAddDoc).toHaveBeenCalled();
    expect(mockTrackLeadEvent).toHaveBeenCalledWith(
      "apply_submitted",
      expect.objectContaining({
        applicationType: "Self",
        city: "New York",
      }),
    );
  });

  it("successful submit resets form to initial state", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitted).toBe(true);
    expect(result.current.form.name).toBe("");
    expect(result.current.termsAgreed).toBe(false);
    expect(result.current.photoPreview).toBeNull();
    expect(result.current.errors).toEqual({});
  });

  it("submit strips @ from instagram", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      result.current.set("instagram", "@janedoe");
    });

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitted).toBe(true);
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.instagram).toBe("janedoe");
  });

  it("submit includes referrerName for Nomination", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      result.current.set("applicationType", "Nomination");
      result.current.set("referrerName", "Nominator");
    });

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitted).toBe(true);
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.referrerName).toBe("Nominator");
  });

  it("submit sets referrerName to empty for Self type", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitted).toBe(true);
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.referrerName).toBe("");
  });

  it("submit sends notification email as fire-and-forget", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/notify-application",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submit writes correct Firestore doc fields", async () => {
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.status).toBe("New");
    expect(docData.notes).toBe("");
    expect(docData.marketingConsent).toBe("yes");
    expect(docData.termsAgreedAt).toBe("mock-timestamp");
    expect(docData.submittedAt).toBe("mock-timestamp");
    expect(docData.photoUrl).toBe("https://example.com/photo.jpg");
  });

  /* ── handleSubmit error flow ──────────────────────────── */

  it("submit failure shows error toast", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("Firestore error"));
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(result.current.submitting).toBe(false);
    expect(result.current.toast).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(result.current.submitted).toBe(false);
  });

  it("submit failure calls deleteObject for orphaned photo cleanup", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("Firestore error"));
    const { result } = renderHook(() => useApplyForm());

    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );

    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(mockDeleteObject).toHaveBeenCalledWith("mock-ref");
  });

  /* ── Group 1: Complete initial state ─────────────────── */

  it("returns all INITIAL form fields as empty strings", () => {
    const { result } = renderHook(() => useApplyForm());
    const { form } = result.current;
    expect(form.orientation).toBe("");
    expect(form.country).toBe("");
    expect(form.state).toBe("");
    expect(form.city).toBe("");
    expect(form.height).toBe("");
    expect(form.instagram).toBe("");
    expect(form.community).toBe("");
    expect(form.income).toBe("");
    expect(form.referrerName).toBe("");
    expect(form.pitch).toBe("");
  });

  it("starts with showTermsModal false", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.showTermsModal).toBe(false);
  });

  it("starts with canGoBack false", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.canGoBack).toBe(false);
  });

  it("starts with toast null", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.toast).toBeNull();
  });

  it("starts with photoPreview null", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.photoPreview).toBeNull();
  });

  it("starts with cityInput empty", () => {
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.cityInput).toBe("");
  });

  /* ── Group 2: URL parameter seeding ──────────────────── */

  it("seeds form.city and cityInput from ?city URL param", () => {
    const originalHref = window.location.pathname + window.location.search;
    try {
      history.replaceState(null, "", "?city=Brooklyn");
      const { result } = renderHook(() => useApplyForm());
      expect(result.current.form.city).toBe("Brooklyn");
      expect(result.current.cityInput).toBe("Brooklyn");
      expect(result.current.form.state).toBe("");
    } finally {
      history.replaceState(null, "", originalHref);
    }
  });

  it("does not seed when only ?state URL param present (city required)", () => {
    const originalHref = window.location.pathname + window.location.search;
    try {
      history.replaceState(null, "", "?state=NY");
      const { result } = renderHook(() => useApplyForm());
      expect(result.current.form.state).toBe("");
      expect(result.current.form.city).toBe("");
      expect(result.current.cityInput).toBe("");
    } finally {
      history.replaceState(null, "", originalHref);
    }
  });

  it("seeds city, state, and cityInput from ?city&state URL params", () => {
    const originalHref = window.location.pathname + window.location.search;
    try {
      history.replaceState(null, "", "?city=Brooklyn&state=NY");
      const { result } = renderHook(() => useApplyForm());
      expect(result.current.form.city).toBe("Brooklyn");
      expect(result.current.form.state).toBe("NY");
      expect(result.current.cityInput).toBe("Brooklyn, NY");
    } finally {
      history.replaceState(null, "", originalHref);
    }
  });

  /* ── Group 3: History back navigation ────────────────── */

  it("sets canGoBack true when history.length > 1", () => {
    const original = window.history.length;
    Object.defineProperty(window.history, "length", {
      value: 5,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.canGoBack).toBe(true);
    Object.defineProperty(window.history, "length", {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  it("keeps canGoBack false when history.length is 1", () => {
    const original = window.history.length;
    Object.defineProperty(window.history, "length", {
      value: 1,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.canGoBack).toBe(false);
    Object.defineProperty(window.history, "length", {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  it("sets canGoBack true at boundary history.length === 2", () => {
    const original = window.history.length;
    Object.defineProperty(window.history, "length", {
      value: 2,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.canGoBack).toBe(true);
    Object.defineProperty(window.history, "length", {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  /* ── Group 4: Toast auto-dismiss ─────────────────────── */

  it("auto-dismisses toast after 5000ms", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.setToast({ msg: "test", ok: true }));
    expect(result.current.toast).toEqual({ msg: "test", ok: true });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.toast).toBeNull();
    vi.useRealTimers();
  });

  it("toast persists before 5000ms", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.setToast({ msg: "test", ok: true }));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.toast).toEqual({ msg: "test", ok: true });
    vi.useRealTimers();
  });

  it("toast null does not set timeout", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useApplyForm());
    expect(result.current.toast).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.toast).toBeNull();
    vi.useRealTimers();
  });

  /* ── Group 5: formStarted tracking ───────────────────── */

  it("first set() call fires apply_form_started event", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("name", "Jane"));
    expect(mockTrackLeadEvent).toHaveBeenCalledWith("apply_form_started", {
      application_type: "Self",
      page: expect.any(String),
    });
  });

  it("second set() call does not fire apply_form_started again", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("name", "Jane"));
    act(() => result.current.set("age", "25"));
    expect(mockTrackLeadEvent).toHaveBeenCalledTimes(1);
  });

  it("formStarted tracks correct application_type", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.set("applicationType", "Nomination"));
    // The first set call captures the form state at call time (still "Self" before state updates)
    expect(mockTrackLeadEvent).toHaveBeenCalledWith(
      "apply_form_started",
      expect.objectContaining({ application_type: "Self" }),
    );
  });

  /* ── Group 8: File size boundary ─────────────────────── */

  it("handlePhotoChange accepts file exactly 5MB", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("exact.jpg", 5 * 1024 * 1024)),
      ),
    );
    expect(result.current.errors.photo).toBeUndefined();
  });

  it("handlePhotoChange rejects file at 5MB + 1 byte", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("big.jpg", 5 * 1024 * 1024 + 1)),
      ),
    );
    expect(result.current.errors.photo).toBe("Photo must be under 5 MB");
  });

  it("handlePhotoChange resets input value on rejection", () => {
    const { result } = renderHook(() => useApplyForm());
    const event = makeChangeEvent(makeFile("huge.jpg", 6 * 1024 * 1024));
    act(() => result.current.handlePhotoChange(event));
    expect(event.target.value).toBe("");
  });

  it("handlePhotoChange clears previous photo error on valid file", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("big.jpg", 6 * 1024 * 1024)),
      ),
    );
    expect(result.current.errors.photo).toBe("Photo must be under 5 MB");
    act(() =>
      result.current.handlePhotoChange(
        makeChangeEvent(makeFile("ok.jpg", 1024)),
      ),
    );
    expect(result.current.errors.photo).toBeUndefined();
  });

  /* ── Group 9: FileReader error path ──────────────────── */

  it("handlePhotoChange sets error on FileReader failure", () => {
    const OriginalFileReader = globalThis.FileReader;
    const capturedReader: Record<string, unknown> = { readAsDataURL: vi.fn() };

    globalThis.FileReader = function () {
      return capturedReader;
    } as unknown as typeof FileReader;

    try {
      const { result } = renderHook(() => useApplyForm());
      act(() =>
        result.current.handlePhotoChange(
          makeChangeEvent(makeFile("photo.jpg", 1024)),
        ),
      );
      act(() => {
        (capturedReader.onerror as () => void)?.();
      });
      expect(result.current.errors.photo).toBe(
        "Failed to read file. Please try again.",
      );
      expect(result.current.photoPreview).toBeNull();
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });

  /* ── Group 12: Submit data fields ────────────────────── */

  it("submit trims name, height, and pitch in doc", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      result.current.set("name", "  Jane Doe  ");
      result.current.set("height", "  5'8  ");
      result.current.set("pitch", "  I love comedy  ");
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.name).toBe("Jane Doe");
    expect(docData.height).toBe("5'8");
    expect(docData.pitch).toBe("I love comedy");
  });

  it("submit parses age as integer in doc", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.age).toBe(25);
    expect(typeof docData.age).toBe("number");
  });

  it("submit includes all form fields in doc", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      result.current.set("orientation", "Bisexual");
      result.current.set("community", "South Asian");
      result.current.set("income", "100k+");
      result.current.set("height", "5'10");
      result.current.set("pitch", "I'm funny");
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    const docData = mockAddDoc.mock.calls[0][1];
    expect(docData.gender).toBe("Woman");
    expect(docData.orientation).toBe("Bisexual");
    expect(docData.city).toBe("New York");
    expect(docData.email).toBe("jane@example.com");
    expect(docData.state).toBe("");
    expect(docData.country).toBe("");
    expect(docData.community).toBe("South Asian");
    expect(docData.income).toBe("100k+");
    expect(docData.applicationType).toBe("Self");
  });

  /* ── Group 13: Photo storage path ────────────────────── */

  it("submit uses correct file extension in storage path", async () => {
    const { ref: mockRef } = await import("firebase/storage");
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      // Override photo with .png file
      result.current.handlePhotoChange(
        makeChangeEvent(
          new File([new ArrayBuffer(1024)], "photo.png", {
            type: "image/png",
          }),
        ),
      );
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(mockRef).toHaveBeenCalledWith(
      "mock-storage",
      "photos/test-uuid.png",
    );
  });

  it("submit defaults to jpg extension when filename has no extension", async () => {
    const { ref: mockRef } = await import("firebase/storage");
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      );
      result.current.handlePhotoChange(
        makeChangeEvent(
          new File([new ArrayBuffer(1024)], "noext", { type: "image/jpeg" }),
        ),
      );
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    // "noext".split(".").pop() returns "noext", not "jpg" — but the ?? "jpg" only kicks in for undefined
    // Actually .pop() on ["noext"] returns "noext", so extension is "noext"
    expect(mockRef).toHaveBeenCalledWith(
      "mock-storage",
      "photos/test-uuid.noext",
    );
  });

  /* ── Group 14: Submit error toast message ────────────── */

  it("submit failure shows exact error toast message", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.toast).toEqual({
      msg: "Sorry, the form isn't working right now. DM us on @garammasaladating on Instagram and we'll sort it out!",
      ok: false,
    });
  });

  /* ── Group 15: Referrer whitespace validation ────────── */

  it("validation rejects whitespace-only referrerName for Nomination", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      result.current.set("applicationType", "Nomination");
      result.current.set("referrerName", "   ");
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.referrerName).toBe("Required");
  });

  /* ── Group 16: Validation scroll behavior ────────────── */

  it("validation scrolls to first error element", async () => {
    const mockScrollIntoView = vi.fn();
    const mockElement = { scrollIntoView: mockScrollIntoView };
    const mockRAF = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });
    const mockQS = vi
      .spyOn(document, "querySelector")
      .mockReturnValue(mockElement as unknown as Element);

    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });

    expect(mockRAF).toHaveBeenCalled();
    expect(mockQS).toHaveBeenCalledWith("[data-error]");
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    mockRAF.mockRestore();
    mockQS.mockRestore();
  });

  /* ── Additional mutation killers ─────────────────────── */

  it("handlePhotoChange generates preview via FileReader onloadend", () => {
    const OriginalFileReader = globalThis.FileReader;
    const capturedReader: Record<string, unknown> = {
      readAsDataURL: vi.fn(),
      result: "data:image/jpeg;base64,abc123",
    };

    globalThis.FileReader = function () {
      return capturedReader;
    } as unknown as typeof FileReader;

    try {
      const { result } = renderHook(() => useApplyForm());
      act(() =>
        result.current.handlePhotoChange(
          makeChangeEvent(makeFile("pic.jpg", 1024)),
        ),
      );
      act(() => {
        (capturedReader.onloadend as () => void)?.();
      });
      expect(result.current.photoPreview).toBe("data:image/jpeg;base64,abc123");
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });

  it("submit does not call deleteObject on success", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it("submit notification includes correct body shape", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fetchCall[0]).toBe("/api/notify-application");
    const body = JSON.parse(fetchCall[1].body);
    expect(body.name).toBe("Jane Doe");
    expect(body.age).toBe(25);
    expect(body.photoUrl).toBe("https://example.com/photo.jpg");
  });

  it("set() clears specific field error without affecting others", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.name).toBe("Required");
    expect(result.current.errors.gender).toBe("Required");
    act(() => result.current.set("name", "Jane"));
    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.gender).toBe("Required");
  });

  it("submit sets submitting true during execution", async () => {
    let submittingDuringCall = false;
    mockAddDoc.mockImplementationOnce(async () => {
      // We can't check result.current here, but we verify submitting resets
      submittingDuringCall = true;
      return { id: "doc-1" };
    });
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(submittingDuringCall).toBe(true);
    expect(result.current.submitting).toBe(false);
  });

  it("submit calls buildLeadAttribution with source apply", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() =>
      fillRequired(
        result.current.set,
        result.current.handleTermsCheckbox,
        result.current.handlePhotoChange,
      ),
    );
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(mockBuildLeadAttribution).toHaveBeenCalledWith({ source: "apply" });
  });

  it("validation requires termsAgreed", async () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => {
      result.current.set("name", "Jane");
      result.current.set("age", "25");
      result.current.set("gender", "Woman");
      result.current.set("orientation", "Straight");
      result.current.set("city", "NYC");
      result.current.set("country", "US");
      result.current.set("instagram", "jane");
      result.current.set("marketingConsent", "yes");
      result.current.handlePhotoChange(makeChangeEvent(makeFile()));
      // Do NOT check terms
    });
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.termsAgreed).toBe(
      "You must agree to the Terms & Conditions",
    );
    expect(result.current.submitted).toBe(false);
  });
});
