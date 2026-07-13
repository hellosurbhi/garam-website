import type React from "react";
import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import type { StorageReference } from "firebase/storage";
import {
  getFirebaseDb,
  getFirebaseStorage,
  getFirebaseAuth,
} from "@/lib/firebase";
import { trackError, trackLeadEvent, identifyLead } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import { isSyntheticSubmission } from "@/lib/syntheticMonitor";
import { reportApplyFailure } from "@/lib/applyFailureAlert";
import { validateEmail } from "@/utils/validateEmail";
import { withTimeout } from "@/utils/withTimeout";
import { compressImage } from "@/utils/compressImage";
import { getFriendFirstName } from "@/utils/nomination";

export interface FormState {
  applicationType: "Self" | "Nomination";
  name: string;
  age: string;
  gender: string;
  orientation: string;
  country: string;
  state: string;
  city: string;
  email: string;
  phone: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
  type: string;
  marketingConsent: "yes" | "no" | "";
  seenShowBefore: "" | "yes" | "no";
  howHeard: string;
}

const INITIAL: FormState = {
  applicationType: "Self",
  name: "",
  age: "",
  gender: "",
  orientation: "",
  country: "",
  state: "",
  city: "",
  email: "",
  phone: "",
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
  type: "",
  marketingConsent: "",
  seenShowBefore: "",
  howHeard: "",
};

export type FormErrors = Partial<
  Record<
    keyof FormState | "photo" | "termsAgreed" | "nominationConsent",
    string
  >
>;
export type SelectOption = { value: string; label: string };

const MAX_PHOTOS = 10;
// Industry-standard upload posture: accept any image the phone produces, at
// generous original sizes, and normalize client-side (compressImage → ~2048px
// JPEG) before upload. 50 MB covers ProRAW-era originals.
const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
// The rare fallback path (compressImage could not decode the format) uploads
// the ORIGINAL file, so it must fit storage.rules' 25 MB create limit. Must
// stay aligned with storage.rules (strict less-than).
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function getUrlCityParams() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");
  const state = params.get("state");
  return city ? { city, state: state ?? "" } : null;
}

/** Single source of truth for all required-field validation rules. */
function getFieldErrors(
  form: FormState,
  photoFiles: File[],
  termsAgreed: boolean,
  nominationConsent: boolean,
): FormErrors {
  const errs: FormErrors = {};
  if (!form.name.trim()) errs.name = "Required";
  const ageNum = parseInt(form.age, 10);
  if (!form.age || Number.isNaN(ageNum) || ageNum < 18)
    errs.age = "Must be 18 or older";
  if (!form.gender) errs.gender = "Required";
  if (!form.orientation) errs.orientation = "Required";
  if (!form.city.trim()) errs.city = "Required";
  const emailErr = validateEmail(form.email);
  if (emailErr) errs.email = emailErr;
  if (!form.instagram.trim().replace(/^@/, "")) errs.instagram = "Required";
  if (photoFiles.length === 0) errs.photo = "A photo is required";
  const isNomination = form.applicationType === "Nomination";
  const friendFirstName = isNomination
    ? getFriendFirstName(form.name)
    : undefined;
  if (isNomination) {
    if (!form.referrerName.trim()) errs.referrerName = "Required";
    if (!nominationConsent)
      errs.nominationConsent = friendFirstName
        ? `Please confirm you have permission to nominate ${friendFirstName}`
        : "Please confirm you have permission to nominate this person";
  }
  if (!form.marketingConsent) {
    errs.marketingConsent = "Please select Yes or No.";
  } else if (form.marketingConsent === "no") {
    errs.marketingConsent = isNomination
      ? `${friendFirstName ?? "Your friend"} must select Yes to apply.`
      : "You must select Yes to apply.";
  }
  if (!termsAgreed)
    errs.termsAgreed = "You must agree to the Terms & Conditions";
  return errs;
}

export function useApplyForm() {
  const [form, setForm] = useState<FormState>(() => {
    const urlParams = getUrlCityParams();
    if (!urlParams) return INITIAL;
    return {
      ...INITIAL,
      city: urlParams.city,
      state: urlParams.state,
      country: "",
    };
  });
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [nominationConsent, setNominationConsent] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [canGoBack] = useState(
    () => typeof window !== "undefined" && window.history.length > 1,
  );
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [formStarted, setFormStarted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const [cityInput, setCityInput] = useState(() => {
    const urlParams = getUrlCityParams();
    if (!urlParams) return "";
    return urlParams.state
      ? `${urlParams.city}, ${urlParams.state}`
      : urlParams.city;
  });

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const isValid = useMemo(
    () =>
      Object.keys(
        getFieldErrors(form, photoFiles, termsAgreed, nominationConsent),
      ).length === 0,
    [form, photoFiles, termsAgreed, nominationConsent],
  );
  const [touched, setTouched] = useState<
    Partial<Record<keyof FormErrors, true>>
  >({});

  function set(field: keyof FormState, value: string) {
    // Functional updater so batched set() calls chain correctly.
    setForm((prev) => ({ ...prev, [field]: value }));
    const fieldKey = field as keyof FormErrors;
    if (touched[fieldKey]) {
      // Evaluate this field's error against the new value; other fields use
      // current form (safe because error eval is per-field, not cross-field).
      const approxForm = { ...form, [field]: value };
      const errs = getFieldErrors(
        approxForm,
        photoFiles,
        termsAgreed,
        nominationConsent,
      );
      setErrors((prev) => ({ ...prev, [field]: errs[fieldKey] }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (!formStarted) {
      setFormStarted(true);
      trackLeadEvent("apply_form_started", {
        application_type: form.applicationType,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
    }
  }

  function handleCityInputChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCityInput(value);
    setForm((prev) => ({ ...prev, city: value, state: "", country: "" }));
    if (touched.city) {
      const approxForm = { ...form, city: value, state: "", country: "" };
      const errs = getFieldErrors(
        approxForm,
        photoFiles,
        termsAgreed,
        nominationConsent,
      );
      setErrors((prev) => ({ ...prev, city: errs.city, country: undefined }));
    } else {
      setErrors((prev) => ({ ...prev, city: undefined, country: undefined }));
    }
    if (!formStarted) {
      setFormStarted(true);
      trackLeadEvent("apply_form_started", {
        application_type: form.applicationType,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
    }
  }

  function handleAddPhotos(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;

    // Accept anything the phone calls an image (HEIC, AVIF, WebP, GIF...);
    // compressImage normalizes everything to JPEG before upload.
    const isImage = (f: File) => f.type.startsWith("image/");

    const invalidType = incoming.filter((f) => !isImage(f));
    if (invalidType.length > 0) {
      setErrors((prev) => ({
        ...prev,
        photo: "Please choose photo files (JPEG, HEIC, PNG and similar)",
      }));
      e.target.value = "";
      return;
    }

    const oversized = incoming.filter((f) => f.size >= MAX_PHOTO_BYTES);
    if (oversized.length > 0) {
      setErrors((prev) => ({
        ...prev,
        photo: "Photo must be under 50 MB",
      }));
    }

    const valid = incoming.filter(
      (f) => f.size < MAX_PHOTO_BYTES && isImage(f),
    );
    if (valid.length === 0) {
      e.target.value = "";
      return;
    }

    setPhotoFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, MAX_PHOTOS);
      return combined;
    });
    setErrors((prev) => ({ ...prev, photo: undefined }));

    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews((prev) => {
          const next = [...prev, reader.result as string].slice(0, MAX_PHOTOS);
          return next;
        });
      };
      reader.onerror = () => {
        setErrors((prev) => ({
          ...prev,
          photo: "Failed to read file. Please try again.",
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  }

  function handleRemovePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTermsCheckbox(checked: boolean) {
    setTermsAgreed(checked);
    setTouched((prev) => ({ ...prev, termsAgreed: true }));
    const errs = getFieldErrors(form, photoFiles, checked, nominationConsent);
    setErrors((prev) => ({ ...prev, termsAgreed: errs.termsAgreed }));
  }

  function handleNominationConsentChange(checked: boolean) {
    setNominationConsent(checked);
    setTouched((prev) => ({ ...prev, nominationConsent: true }));
    const errs = getFieldErrors(form, photoFiles, termsAgreed, checked);
    setErrors((prev) => ({
      ...prev,
      nominationConsent: errs.nominationConsent,
    }));
  }

  function handleMarketingConsentChange(value: "yes" | "no") {
    setForm((prev) => ({ ...prev, marketingConsent: value }));
    setTouched((prev) => ({ ...prev, marketingConsent: true }));
    const newForm = { ...form, marketingConsent: value };
    const errs = getFieldErrors(
      newForm,
      photoFiles,
      termsAgreed,
      nominationConsent,
    );
    setErrors((prev) => ({ ...prev, marketingConsent: errs.marketingConsent }));
    if (!formStarted) {
      setFormStarted(true);
      trackLeadEvent("apply_form_started", {
        application_type: form.applicationType,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
    }
  }

  function agreeToTerms() {
    setTermsAgreed(true);
    setTouched((prev) => ({ ...prev, termsAgreed: true }));
    setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
    setShowTermsModal(false);
  }

  function validate(): boolean {
    const errs = getFieldErrors(
      form,
      photoFiles,
      termsAgreed,
      nominationConsent,
    );
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleBlur(field: keyof FormErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = getFieldErrors(
      form,
      photoFiles,
      termsAgreed,
      nominationConsent,
    );
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Best-effort bot check: verify token when available, fail open when not.
    // The real security gate is Firestore auth (signInAnonymously + rules).
    const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
    if (turnstileSiteKey && turnstileToken) {
      try {
        const ctrl = new AbortController();
        const timerId = setTimeout(() => ctrl.abort(), 8_000);
        try {
          await fetch("/api/verify-turnstile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: turnstileToken }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timerId);
        }
        // Token is one-time-use — reset widget regardless of result
        setTurnstileToken("");
        if (window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        // Allow through even on verify failure — widget issues must not block real applicants
      } catch {
        // Network error or timeout — allow submission through
        setTurnstileToken("");
        if (window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
      }
    }

    const uploadedRefs: (StorageReference | null)[] = [];
    try {
      const [
        { signInAnonymously },
        auth,
        { ref, uploadBytesResumable },
        storage,
      ] = await withTimeout(
        Promise.all([
          import("firebase/auth"),
          getFirebaseAuth(),
          import("firebase/storage"),
          getFirebaseStorage(),
        ]),
        12_000,
        "Firebase init",
      );

      const credential = await withTimeout(
        signInAnonymously(auth),
        10_000,
        "Firebase auth",
      );

      // WHY: we store storage PATHS, never getDownloadURL() results. Photo
      // reads are admin-only in storage.rules (applicant photos are PII), and
      // getDownloadURL is a READ: calling it from this anonymous session gets
      // denied and killed every submission in July 2026. The admin dashboard
      // resolves paths with its own authenticated session instead.
      const photoPaths = await Promise.all(
        photoFiles.map(async (file, i) => {
          // Normalize to ~2048px JPEG so 3 iPhone originals never blow the
          // upload timeout on cellular; falls back to the original file when
          // the browser cannot decode the format.
          const uploadFile = await compressImage(file);
          if (uploadFile.size >= MAX_UPLOAD_BYTES) {
            throw new Error(
              "One of your photos could not be optimized and is too large to upload. Please pick a version under 25 MB.",
            );
          }
          const ext = uploadFile.name.split(".").pop() ?? "jpg";
          const photoRef = ref(storage, `photos/${crypto.randomUUID()}.${ext}`);
          uploadedRefs[i] = photoRef;
          // The owner tag is what authorizes this session's failure cleanup
          // (storage.rules only lets the uploader delete their own object).
          const task = uploadBytesResumable(photoRef, uploadFile, {
            customMetadata: { owner: credential.user.uid },
          });
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              task.cancel();
              reject(new Error("Upload timed out after 30 seconds"));
            }, 30_000);
            task
              .then(() => {
                clearTimeout(timer);
                resolve();
              })
              .catch((err: unknown) => {
                clearTimeout(timer);
                reject(err);
              });
          });
          return photoRef.fullPath;
        }),
      );

      const applicationData = {
        applicationType: form.applicationType,
        name: form.name.trim(),
        age: parseInt(form.age),
        gender: form.gender,
        orientation: form.orientation,
        country: form.country,
        state: form.state,
        city: form.city,
        email: form.email.trim().toLowerCase(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        height: form.height.trim(),
        instagram: form.instagram.trim().replace(/^@/, ""),
        community: form.community,
        income: form.income,
        referrerName:
          form.applicationType === "Nomination" ? form.referrerName.trim() : "",
        ...(form.applicationType === "Nomination" ? { nominationConsent } : {}),
        pitch: form.pitch.trim(),
        type: form.type.trim(),
        photoPaths,
        ...(isSyntheticSubmission(form.email) ? { isSynthetic: true } : {}),
        ...(form.seenShowBefore !== ""
          ? { seenShowBefore: form.seenShowBefore === "yes" }
          : {}),
        ...(form.howHeard ? { howHeard: form.howHeard } : {}),
      };

      const [{ collection, addDoc, serverTimestamp }, db] = await withTimeout(
        Promise.all([import("firebase/firestore"), getFirebaseDb()]),
        12_000,
        "Firestore init",
      );
      await withTimeout(
        addDoc(collection(db, "applications"), {
          ...applicationData,
          emailNormalized: form.email.trim().toLowerCase(),
          marketingConsent: form.marketingConsent,
          termsAgreedAt: serverTimestamp(),
          status: "New",
          notes: "",
          submittedAt: serverTimestamp(),
        }),
        15_000,
        "Firestore write",
      );
      // All uploaded — no cleanup needed
      uploadedRefs.fill(null);

      // The synthetic monitor submits 4x/day; keeping it out of analytics at
      // the source means conversion metrics never depend on dashboard filters.
      if (!isSyntheticSubmission(form.email)) {
        const attribution = await buildLeadAttribution({ source: "apply" });
        const igHandle = form.instagram.trim().replace(/^@/, "");
        const identifier = form.email.trim();
        if (identifier) {
          identifyLead(identifier, {
            name: form.name,
            city: form.city,
            country: form.country,
            applicationType: form.applicationType,
            ...(igHandle ? { instagram: igHandle } : {}),
            ...attribution,
          });
        }
        trackLeadEvent("apply_submitted", {
          ...attribution,
          applicationType: form.applicationType,
          city: form.city,
          country: form.country,
        });
      }

      // Fire-and-forget: email notification (does not affect submission outcome)
      fetch("/api/notify-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applicationData),
      }).catch((err: unknown) => {
        trackError({
          error_message: err instanceof Error ? err.message : String(err),
          error_type: "api_error",
          component: "useApplyForm",
        });
        // The application IS saved at this point; alert so the admin email
        // silently not arriving never hides an applicant.
        reportApplyFailure({
          stage: "notify_email",
          errorMessage: err instanceof Error ? err.message : String(err),
          applicant: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            instagram: form.instagram,
          },
        });
      });

      setForm(INITIAL);
      setCityInput("");
      setTermsAgreed(false);
      setNominationConsent(false);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setErrors({});
      // Instant scroll before state swap — single frame, imperceptible.
      // Prevents the height collapse from leaving the viewport past end-of-content.
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      setSubmitted(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Cleanup any photos that were successfully uploaded before the failure
      // firebase/storage is already cached if any upload started
      if (uploadedRefs.some(Boolean)) {
        const { deleteObject } = await import("firebase/storage");
        await Promise.allSettled(
          uploadedRefs
            .filter(Boolean)
            .map((r) => deleteObject(r!).catch(() => {})),
        );
      }
      trackError({
        error_message: error.message,
        error_stack: (error.stack ?? "").slice(0, 2000),
        error_type: "form_submission",
        component: "useApplyForm",
        form_step: "auth_or_upload_or_firestore",
        application_type: form.applicationType,
      });
      // Real-time page: one failed submission = one immediate email, with the
      // applicant's contact info so they can be recovered even though the
      // application never reached Firestore.
      reportApplyFailure({
        stage: "submit",
        errorMessage: error.message,
        applicant: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          instagram: form.instagram,
        },
      });
      setToast({
        msg: "Sorry, the form isn't working right now. DM us on @garammasaladating on Instagram and we'll sort it out!",
        ok: false,
      });
      // Spent token — reset so the next retry gets a fresh challenge
      setTurnstileToken("");
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
    form,
    photoPreviews,
    photoFiles,
    errors,
    submitting,
    submitted,
    isValid,
    termsAgreed,
    setTermsAgreed,
    nominationConsent,
    handleNominationConsentChange,
    handleMarketingConsentChange,
    showTermsModal,
    setShowTermsModal,
    canGoBack,
    toast,
    setToast,
    cityInput,
    handleCityInputChange,
    set,
    handleAddPhotos,
    handleRemovePhoto,
    handleTermsCheckbox,
    handleBlur,
    agreeToTerms,
    handleSubmit,
    setTurnstileToken,
    turnstileWidgetIdRef,
  };
}
