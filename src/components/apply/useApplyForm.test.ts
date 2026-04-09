import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ─── Mocks ──────────────────────────────────────────────────────── */

const mockAddDoc = vi.fn().mockResolvedValue({ id: "doc-1" });
const mockUploadBytes = vi.fn().mockResolvedValue({});
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
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
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

vi.mock("@/hooks/useCitySearch", () => ({
  useCitySearch: () => ({
    loading: false,
    failed: false,
    retry: vi.fn(),
    options: [],
  }),
}));

vi.mock("@/lib/citySearch", () => ({
  resolveCityOption: vi.fn(() => null),
}));

const mockTrackLeadEvent = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackLeadEvent: (...args: unknown[]) => mockTrackLeadEvent(...args),
}));

const mockBuildLeadAttribution = vi.fn(() => ({ source: "apply" }));
vi.mock("@/lib/leadAttribution", () => ({
  buildLeadAttribution: (...args: unknown[]) =>
    mockBuildLeadAttribution(...args),
}));

import { useApplyForm } from "./useApplyForm";

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
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

/** Fill all required fields so validation passes. */
function fillRequired(
  set: (field: string, value: string) => void,
  handleTermsCheckbox: (v: boolean) => void,
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
) {
  set("name", "Jane Doe");
  set("age", "25");
  set("gender", "Woman");
  set("orientation", "Straight");
  set("city", "New York");
  set("country", "US");
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

  /* ── handlePlaceChange ────────────────────────────────── */

  it("handlePlaceChange updates city/state/country from option", () => {
    const { result } = renderHook(() => useApplyForm());
    const option = {
      value: "NYC, NY, US",
      label: "NYC, NY, US",
      city: "NYC",
      state: "NY",
      country: "United States",
      countryCode: "US",
      searchText: "nyc ny us",
      boost: 40,
    };
    act(() => result.current.handlePlaceChange(option));
    expect(result.current.form.city).toBe("NYC");
    expect(result.current.form.state).toBe("NY");
    expect(result.current.form.country).toBe("US");
  });

  it("handlePlaceChange with null clears city/state/country", () => {
    const { result } = renderHook(() => useApplyForm());
    act(() => result.current.handlePlaceChange(null));
    expect(result.current.form.city).toBe("");
    expect(result.current.form.state).toBe("");
    expect(result.current.form.country).toBe("");
  });

  it("handlePlaceChange clears city/country/state errors", async () => {
    const { result } = renderHook(() => useApplyForm());
    await act(async () => {
      await result.current.handleSubmit(makeSubmitEvent());
    });
    expect(result.current.errors.city).toBe("Required");
    const option = {
      value: "NYC, NY, US",
      label: "NYC, NY, US",
      city: "NYC",
      state: "NY",
      country: "US",
      countryCode: "US",
      searchText: "nyc",
      boost: 0,
    };
    act(() => result.current.handlePlaceChange(option));
    expect(result.current.errors.city).toBeUndefined();
    expect(result.current.errors.country).toBeUndefined();
    expect(result.current.errors.state).toBeUndefined();
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
    expect(result.current.errors.country).toBe("Required");
    expect(result.current.errors.instagram).toBe("Required");
    expect(result.current.errors.photo).toBe("A photo is required");
    expect(result.current.errors.marketingConsent).toBe(
      "Please select Yes or No",
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
      "Please select Yes or No",
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
    expect(mockUploadBytes).toHaveBeenCalled();
    expect(mockGetDownloadURL).toHaveBeenCalled();
    expect(mockAddDoc).toHaveBeenCalled();
    expect(mockTrackLeadEvent).toHaveBeenCalledWith(
      "apply_submitted",
      expect.objectContaining({
        applicationType: "Self",
        city: "New York",
        country: "US",
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
});
