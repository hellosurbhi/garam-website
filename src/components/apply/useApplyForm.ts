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
import { reportFailure } from "@/lib/failureAlert";
import { FIELD_LIMITS, overLimitMessage } from "@/lib/applicationFieldLimits";
import {
  captureLead,
  updateLeadFields,
  type LeadCaptureResult,
  type LeadUpdateFields,
} from "@/lib/leadSubmission";
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

export const INITIAL: FormState = {
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
  // Invisible anti-bot ceilings (see applicationFieldLimits.ts). No maxLength,
  // no counters: the only user-visible surface is this inline error in the
  // rare case a ceiling is actually crossed, so a rejection reason is always
  // named on the field that caused it and submit stays disabled until fixed.
  // Over-limit implies non-empty, so these never mask a "Required" error;
  // for email the over-limit message intentionally wins over format checks.
  if (form.name.length > FIELD_LIMITS.freeText)
    errs.name = overLimitMessage(FIELD_LIMITS.freeText);
  if (form.city.length > FIELD_LIMITS.freeText)
    errs.city = overLimitMessage(FIELD_LIMITS.freeText);
  if (form.height.length > FIELD_LIMITS.freeText)
    errs.height = overLimitMessage(FIELD_LIMITS.freeText);
  if (form.type.length > FIELD_LIMITS.freeText)
    errs.type = overLimitMessage(FIELD_LIMITS.freeText);
  if (form.referrerName.length > FIELD_LIMITS.freeText)
    errs.referrerName = overLimitMessage(FIELD_LIMITS.freeText);
  if (form.pitch.length > FIELD_LIMITS.pitch)
    errs.pitch = overLimitMessage(FIELD_LIMITS.pitch);
  if (form.email.length > FIELD_LIMITS.email)
    errs.email = overLimitMessage(FIELD_LIMITS.email);
  if (form.phone.length > FIELD_LIMITS.phone)
    errs.phone = overLimitMessage(FIELD_LIMITS.phone);
  if (form.instagram.length > FIELD_LIMITS.instagram)
    errs.instagram = overLimitMessage(FIELD_LIMITS.instagram);
  return errs;
}

// WHY: optional string fields are OMITTED when blank, never written as "".
// firestore.rules enforces size() > 0 on each of these whenever the key is
// present, so sending height: "" (or referrerName: "" on every Self
// application, which the old inline payload did) makes Firestore reject the
// whole document with "Missing or insufficient permissions" — the Aug 2026
// apply outage. The omit-when-empty spread mirrors the pre-existing phone
// pattern. pitch stays unconditional: the rules allow it to be empty.
export function buildApplicationData(
  form: FormState,
  photoPaths: string[],
  nominationConsent: boolean,
  photoUploadFailed = false,
) {
  const isNomination = form.applicationType === "Nomination";
  return {
    applicationType: form.applicationType,
    name: form.name.trim(),
    age: parseInt(form.age),
    gender: form.gender,
    orientation: form.orientation,
    ...(form.country ? { country: form.country } : {}),
    ...(form.state ? { state: form.state } : {}),
    city: form.city.trim(),
    email: form.email.trim().toLowerCase(),
    ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    ...(form.height.trim() ? { height: form.height.trim() } : {}),
    instagram: form.instagram.trim().replace(/^@/, ""),
    ...(form.community ? { community: form.community } : {}),
    ...(form.income ? { income: form.income } : {}),
    ...(isNomination && form.referrerName.trim()
      ? { referrerName: form.referrerName.trim() }
      : {}),
    ...(isNomination ? { nominationConsent } : {}),
    pitch: form.pitch.trim(),
    ...(form.type.trim() ? { type: form.type.trim() } : {}),
    photoPaths,
    // WHY: a photo-upload failure must never cost the applicant. The document
    // is written anyway (photoPaths possibly empty) with this flag so the
    // admin dashboard can chase them for photos. Only ever sent as true.
    ...(photoUploadFailed ? { photoUploadFailed: true } : {}),
    ...(isSyntheticSubmission(form.email) ? { isSynthetic: true } : {}),
    ...(form.seenShowBefore !== ""
      ? { seenShowBefore: form.seenShowBefore === "yes" }
      : {}),
    ...(form.howHeard ? { howHeard: form.howHeard } : {}),
  };
}

// The COMPLETE Firestore document the apply flow writes, shared with the
// emulator rules tests (test/rules/apply-flow.rules-test.ts) so the tested
// payload can never drift from the client again — the hand-rolled fixture it
// replaces filled every optional field and masked the empty-string bug.
// Timestamps are injected because the browser writes serverTimestamp()
// sentinels while the rules tests write Date instances.
export function buildApplicationDocument<T>(
  form: FormState,
  photoPaths: string[],
  nominationConsent: boolean,
  timestamps: { termsAgreedAt: T; submittedAt: T },
  photoUploadFailed = false,
) {
  return {
    ...buildApplicationData(
      form,
      photoPaths,
      nominationConsent,
      photoUploadFailed,
    ),
    emailNormalized: form.email.trim().toLowerCase(),
    marketingConsent: form.marketingConsent,
    termsAgreedAt: timestamps.termsAgreedAt,
    status: "New",
    notes: "",
    submittedAt: timestamps.submittedAt,
  };
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
  // True when the application saved but one or more photos did not upload;
  // drives the note on the success panel.
  const [photosFailed, setPhotosFailed] = useState(false);
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  // Progressive contact capture state: one partial lead per email typed into
  // the form, plus the contact fields already synced to it (so blur events
  // only send changes). Refs, not state: nothing here renders.
  const partialLeadRef = useRef<LeadCaptureResult | null>(null);
  const partialLeadEmailRef = useRef("");
  const syncedContactRef = useRef<LeadUpdateFields>({});
  const partialCaptureBusyRef = useRef(false);
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

  // Progressive contact capture (owner mandate 2026-08-30): the moment a
  // valid email is typed, even an abandoned form leaves a recoverable lead.
  // Silent by design: any failure in here must never disturb the applicant,
  // so every path swallows. Synthetic monitor emails never become leads.
  async function syncPartialLead() {
    if (submitting || submitted) return;
    const email = form.email.trim().toLowerCase();
    if (!email || validateEmail(email)) return;
    if (email.length > FIELD_LIMITS.email) return;
    if (isSyntheticSubmission(email)) return;

    const phone = form.phone.trim();
    const instagram = form.instagram.trim().replace(/^@/, "");
    const name = form.name.trim();

    if (!partialLeadRef.current || partialLeadEmailRef.current !== email) {
      if (partialCaptureBusyRef.current) return;
      partialCaptureBusyRef.current = true;
      try {
        const attribution = await buildLeadAttribution({
          source: "apply_form_partial",
        });
        const contact: LeadUpdateFields = {
          ...(phone ? { phone } : {}),
          ...(instagram ? { instagram } : {}),
          ...(name ? { name } : {}),
        };
        partialLeadRef.current = await captureLead({
          ...attribution,
          email,
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...contact,
        });
        partialLeadEmailRef.current = email;
        syncedContactRef.current = contact;
      } catch {
        // Progressive capture is a bonus, never a gate.
      } finally {
        partialCaptureBusyRef.current = false;
      }
      return;
    }

    const updates: LeadUpdateFields = {};
    if (phone && phone !== syncedContactRef.current.phone)
      updates.phone = phone;
    if (instagram && instagram !== syncedContactRef.current.instagram)
      updates.instagram = instagram;
    if (name && name !== syncedContactRef.current.name) updates.name = name;
    if (Object.keys(updates).length === 0) return;
    try {
      await updateLeadFields(partialLeadRef.current, updates);
      syncedContactRef.current = { ...syncedContactRef.current, ...updates };
    } catch {
      // Progressive capture is a bonus, never a gate.
    }
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
    if (
      field === "email" ||
      field === "phone" ||
      field === "instagram" ||
      field === "name"
    ) {
      void syncPartialLead();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setPhotosFailed(false);

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
      // allSettled, not all: Promise.all rejects on the FIRST failure while
      // sibling uploads may still be compressing or uploading. The outer
      // catch then reads uploadedRefs before a late sibling finishes, and
      // that sibling's object would be orphaned PII in Storage. Waiting for
      // every operation to settle makes the cleanup list complete.
      const settled = await Promise.allSettled(
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
          // Sanitize the extension: a dotless or unicode filename must never
          // produce a Storage path the rules reject (compressImage output is
          // JPEG in the normal path anyway).
          const rawExt = uploadFile.name.split(".").pop() ?? "";
          const ext = /^[A-Za-z0-9]{1,10}$/.test(rawExt) ? rawExt : "jpg";
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
      // WHY: photo failures no longer throw away the application. Until Aug
      // 2026 a single failed upload aborted the whole submission and the
      // applicant was lost. Now every upload that DID land is kept, the
      // document is written anyway (photoPaths possibly empty) with
      // photoUploadFailed: true, and ops gets paged so the applicant can be
      // chased for photos. Failed slots keep their refs in uploadedRefs: if
      // the Firestore write below also fails, the outer catch still cleans
      // up every object that exists.
      const failures = settled.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      const photoPaths = settled
        .filter(
          (r): r is PromiseFulfilledResult<string> => r.status === "fulfilled",
        )
        .map((r) => r.value);
      const photoUploadFailed = failures.length > 0;
      if (photoUploadFailed) {
        const reason = failures[0].reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        trackError({
          error_message: message,
          error_type: "form_submission",
          component: "useApplyForm",
          form_step: "photo_upload_partial",
          application_type: form.applicationType,
          failed_photo_count: failures.length,
          total_photo_count: photoFiles.length,
        });
        reportFailure({
          flow: "apply",
          stage: "photo_upload",
          errorMessage: `Application saved but ${failures.length} of ${photoFiles.length} photos failed to upload: ${message}`,
          contact: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            instagram: form.instagram,
          },
        });
      }

      const applicationData = buildApplicationData(
        form,
        photoPaths,
        nominationConsent,
        photoUploadFailed,
      );

      const [{ collection, addDoc, serverTimestamp }, db] = await withTimeout(
        Promise.all([import("firebase/firestore"), getFirebaseDb()]),
        12_000,
        "Firestore init",
      );
      await withTimeout(
        addDoc(
          collection(db, "applications"),
          buildApplicationDocument(
            form,
            photoPaths,
            nominationConsent,
            {
              termsAgreedAt: serverTimestamp(),
              submittedAt: serverTimestamp(),
            },
            photoUploadFailed,
          ),
        ),
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
        // A completed application supersedes its partial lead: flip the
        // source so the admin dashboard can tell abandoned forms from
        // completed ones. Fire-and-forget, failure changes nothing.
        // Guard on the captured email: if the applicant corrected their email
        // and submitted before the new capture settled, the ref can still
        // point at the OLD email's lead, which must stay partial.
        if (
          partialLeadRef.current &&
          partialLeadEmailRef.current === form.email.trim().toLowerCase()
        ) {
          updateLeadFields(partialLeadRef.current, {
            source: "apply_form_completed",
          }).catch(() => {});
        }
      }

      // Fire-and-forget: email notification (does not affect submission outcome)
      fetch("/api/notify-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applicationData),
      })
        .then((res) => {
          // fetch only rejects on network failure; a 500 resolves. Both mean
          // the admin email never went out, and both must page.
          if (!res.ok) throw new Error(`notify-application HTTP ${res.status}`);
        })
        .catch((err: unknown) => {
          trackError({
            error_message: err instanceof Error ? err.message : String(err),
            error_type: "api_error",
            component: "useApplyForm",
          });
          // The application IS saved at this point; alert so the admin email
          // silently not arriving never hides an applicant.
          reportFailure({
            flow: "apply",
            stage: "notify_email",
            errorMessage: err instanceof Error ? err.message : String(err),
            contact: {
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
      setPhotosFailed(photoUploadFailed);
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
      const isPermissionDenied =
        typeof err === "object" &&
        err !== null &&
        (err as { code?: unknown }).code === "permission-denied";
      trackError({
        error_message: error.message,
        error_stack: (error.stack ?? "").slice(0, 2000),
        error_type: "form_submission",
        component: "useApplyForm",
        form_step: "auth_or_upload_or_firestore",
        application_type: form.applicationType,
        // On a rules rejection, report every text field's LENGTH (never its
        // value) so the next client/rules drift names the offending field
        // instead of hiding behind "Missing or insufficient permissions".
        ...(isPermissionDenied
          ? {
              field_lengths: JSON.stringify({
                name: form.name.length,
                city: form.city.length,
                email: form.email.length,
                phone: form.phone.length,
                height: form.height.length,
                instagram: form.instagram.length,
                referrerName: form.referrerName.length,
                pitch: form.pitch.length,
                type: form.type.length,
                howHeard: form.howHeard.length,
              }),
            }
          : {}),
      });
      // Real-time page: one failed submission = one immediate email, with the
      // applicant's contact info so they can be recovered even though the
      // application never reached Firestore.
      reportFailure({
        flow: "apply",
        stage: "submit",
        errorMessage: error.message,
        contact: {
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
    photosFailed,
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
