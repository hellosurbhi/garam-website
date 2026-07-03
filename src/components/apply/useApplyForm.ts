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
import { validateEmail } from "@/utils/validateEmail";

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
};

export type FormErrors = Partial<
  Record<
    keyof FormState | "photo" | "termsAgreed" | "nominationConsent",
    string
  >
>;
export type SelectOption = { value: string; label: string };

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function getUrlCityParams() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");
  const state = params.get("state");
  return city ? { city, state: state ?? "" } : null;
}

function computeIsValid(
  form: FormState,
  photoFiles: File[],
  termsAgreed: boolean,
  nominationConsent: boolean,
): boolean {
  if (!form.name.trim()) return false;
  const ageNum = parseInt(form.age, 10);
  if (!form.age || Number.isNaN(ageNum) || ageNum < 18) return false;
  if (!form.gender) return false;
  if (!form.orientation) return false;
  if (!form.city.trim()) return false;
  if (validateEmail(form.email)) return false;
  if (!form.instagram.trim().replace(/^@/, "")) return false;
  if (photoFiles.length === 0) return false;
  if (form.applicationType === "Nomination") {
    if (!form.referrerName.trim()) return false;
    if (!nominationConsent) return false;
  }
  if (!form.marketingConsent || form.marketingConsent === "no") return false;
  if (!termsAgreed) return false;
  return true;
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
    () => computeIsValid(form, photoFiles, termsAgreed, nominationConsent),
    [form, photoFiles, termsAgreed, nominationConsent],
  );

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
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
    setErrors((prev) => ({ ...prev, city: undefined, country: undefined }));
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

    const ALLOWED_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
    ]);

    const invalidType = incoming.filter((f) => !ALLOWED_TYPES.has(f.type));
    if (invalidType.length > 0) {
      setErrors((prev) => ({
        ...prev,
        photo: "Only JPEG, PNG and WEBP files are allowed",
      }));
      e.target.value = "";
      return;
    }

    const oversized = incoming.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized.length > 0) {
      setErrors((prev) => ({
        ...prev,
        photo: "Photo must be under 5 MB",
      }));
    }

    const valid = incoming.filter(
      (f) => f.size <= MAX_PHOTO_BYTES && ALLOWED_TYPES.has(f.type),
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
    if (checked) setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
  }

  function handleNominationConsentChange(checked: boolean) {
    setNominationConsent(checked);
    if (checked)
      setErrors((prev) => ({ ...prev, nominationConsent: undefined }));
  }

  function agreeToTerms() {
    setTermsAgreed(true);
    setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
    setShowTermsModal(false);
  }

  function validate(): boolean {
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
    if (form.applicationType === "Nomination") {
      if (!form.referrerName.trim()) errs.referrerName = "Required";
      if (!nominationConsent)
        errs.nominationConsent =
          "Please confirm you have permission to nominate this person";
    }
    if (!form.marketingConsent) {
      errs.marketingConsent = "Please select Yes or No.";
    } else if (form.marketingConsent === "no") {
      errs.marketingConsent = "You must select Yes to apply.";
    }
    if (!termsAgreed)
      errs.termsAgreed = "You must agree to the Terms & Conditions";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast({ msg: "Please fill in all required fields", ok: false });
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>("[data-error]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Verify Turnstile token when the feature is configured
    const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
    if (turnstileSiteKey) {
      if (!turnstileToken) {
        setToast({
          msg: "Please wait a moment while we verify your submission, then try again.",
          ok: false,
        });
        setSubmitting(false);
        return;
      }
      try {
        const verifyRes = await fetch("/api/verify-turnstile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        // Token is one-time-use — clear it and request a new challenge regardless
        setTurnstileToken("");
        if (window.turnstile && turnstileWidgetIdRef.current) {
          window.turnstile.reset(turnstileWidgetIdRef.current);
        }
        if (!verifyRes.ok) {
          setToast({
            msg: "Verification failed. Please refresh the page and try again.",
            ok: false,
          });
          setSubmitting(false);
          return;
        }
      } catch {
        // Network error — allow submission through rather than hard-blocking
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
        { ref, uploadBytesResumable, getDownloadURL },
        storage,
      ] = await Promise.all([
        import("firebase/auth"),
        getFirebaseAuth(),
        import("firebase/storage"),
        getFirebaseStorage(),
      ]);

      await signInAnonymously(auth);

      const photoUrls = await Promise.all(
        photoFiles.map(async (file, i) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const photoRef = ref(storage, `photos/${crypto.randomUUID()}.${ext}`);
          uploadedRefs[i] = photoRef;
          const task = uploadBytesResumable(photoRef, file);
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
          return getDownloadURL(photoRef);
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
        photoUrls,
        ...(form.seenShowBefore !== ""
          ? { seenShowBefore: form.seenShowBefore === "yes" }
          : {}),
      };

      const [{ collection, addDoc, serverTimestamp }, db] = await Promise.all([
        import("firebase/firestore"),
        getFirebaseDb(),
      ]);
      await addDoc(collection(db, "applications"), {
        ...applicationData,
        emailNormalized: form.email.trim().toLowerCase(),
        marketingConsent: form.marketingConsent,
        termsAgreedAt: serverTimestamp(),
        status: "New",
        notes: "",
        submittedAt: serverTimestamp(),
      });
      // All uploaded — no cleanup needed
      uploadedRefs.fill(null);

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

      // Fire-and-forget: email notification (does not affect submission)
      fetch("/api/notify-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applicationData),
      }).catch(() => {});

      setForm(INITIAL);
      setCityInput("");
      setTermsAgreed(false);
      setNominationConsent(false);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setErrors({});
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    agreeToTerms,
    handleSubmit,
    setTurnstileToken,
    turnstileWidgetIdRef,
  };
}
