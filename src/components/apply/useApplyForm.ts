import type React from "react";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
import { trackError, trackLeadEvent, identifyLead } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import { isSyntheticSubmission } from "@/lib/syntheticMonitor";
import { reportFailure } from "@/lib/failureAlert";
import { APPLY_PAGE } from "@/data/copy";
import {
  ApplyRequestError,
  AutosaveController,
  type FieldValue,
} from "@/lib/applyAutosave";
import {
  INITIAL,
  contactOf,
  fieldLengthDetails,
  getFieldErrors,
  restoredForm,
  toDraftFields,
  type FormErrors,
  type FormState,
} from "./applyFormModel";
import { usePhotoUploads, type PhotoItem } from "./usePhotoUploads";
import { verifyTurnstileBestEffort } from "./verifyTurnstile";

function getUrlCityParams() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const city = params.get("city");
  const state = params.get("state");
  return city ? { city, state: state ?? "" } : null;
}

function describeError(err: unknown): {
  stage: string;
  message: string;
  status: string;
} {
  if (err instanceof ApplyRequestError) {
    return {
      stage: err.stage,
      message: err.message,
      status: err.status === null ? "no response" : String(err.status),
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { stage: "submit", message, status: "no response" };
}

export function useApplyForm() {
  const [autosave] = useState(() => new AutosaveController());
  // WHY the saved answers seed the form: autosave restores them after a reload
  // but the inputs used to start empty, and the submit resends every field, so
  // an optional answer filed earlier was overwritten with a blank. A city in
  // the URL still wins because the link was an explicit choice.
  const [saved] = useState(() => restoredForm(autosave.savedFields));
  const [form, setForm] = useState<FormState>(() => {
    const urlParams = getUrlCityParams();
    if (!urlParams) return saved.form;
    // The saved country belonged to the saved city, so it is cleared with it.
    return {
      ...saved.form,
      country: "",
      city: urlParams.city,
      state: urlParams.state,
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(saved.termsAgreed);
  const [nominationConsent, setNominationConsent] = useState(
    saved.nominationConsent,
  );
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
  const [cityInput, setCityInput] = useState(() => {
    const urlParams = getUrlCityParams();
    if (!urlParams) {
      return saved.form.state
        ? `${saved.form.city}, ${saved.form.state}`
        : saved.form.city;
    }
    return urlParams.state
      ? `${urlParams.city}, ${urlParams.state}`
      : urlParams.city;
  });
  const [touched, setTouched] = useState<
    Partial<Record<keyof FormErrors, true>>
  >({});

  // Alert callbacks fire from long-lived controller/upload closures, so they
  // read the latest form through a ref instead of capturing a stale one.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    autosave.setOnPersistentFailure((error, attempts) => {
      reportFailure({
        flow: "apply",
        stage: error.stage,
        errorMessage: error.message,
        contact: contactOf(formRef.current),
        details: {
          failedAttempts: String(attempts),
          httpStatus:
            error.status === null ? "no response" : String(error.status),
          savedAnyway: "no: autosave has not been acknowledged by the server",
          ...fieldLengthDetails(formRef.current),
        },
      });
    });
  }, [autosave]);

  const onPhotoFailed = useCallback((error: Error, item: PhotoItem) => {
    const info = describeError(error);
    trackError({
      error_message: error.message,
      error_type: "form_submission",
      component: "useApplyForm",
      form_step: "photo_upload",
    });
    reportFailure({
      flow: "apply",
      stage: info.stage,
      errorMessage: info.message,
      contact: contactOf(formRef.current),
      details: {
        httpStatus: info.status,
        photoName: item.file.name,
        photoType: item.file.type || "unknown",
        photoBytes: String(item.file.size),
        savedAnyway:
          "form answers are filed; this photo will be retried at submit",
      },
    });
  }, []);

  const photos = usePhotoUploads(autosave, onPhotoFailed);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(id);
  }, [toast]);

  // Last chance to file pending answers when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => autosave.flushOnExit();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [autosave]);

  const isValid = useMemo(
    () =>
      Object.keys(
        getFieldErrors(
          form,
          photos.items.length,
          termsAgreed,
          nominationConsent,
        ),
      ).length === 0,
    [form, photos.items.length, termsAgreed, nominationConsent],
  );

  function errorsFor(
    nextForm: FormState,
    terms = termsAgreed,
    consent = nominationConsent,
  ) {
    return getFieldErrors(nextForm, photos.items.length, terms, consent);
  }

  function markStarted(applicationType: string) {
    if (formStarted) return;
    setFormStarted(true);
    trackLeadEvent("apply_form_started", {
      application_type: applicationType,
      page: typeof window !== "undefined" ? window.location.pathname : "/",
    });
  }

  function save(key: string, value: FieldValue) {
    autosave.setField(key, value);
  }

  function set(field: keyof FormState, value: string) {
    // Functional updater so batched set() calls chain correctly.
    setForm((prev) => ({ ...prev, [field]: value }));
    save(field, value);
    const fieldKey = field as keyof FormErrors;
    if (touched[fieldKey]) {
      const errs = errorsFor({ ...form, [field]: value });
      setErrors((prev) => ({ ...prev, [field]: errs[fieldKey] }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    markStarted(form.applicationType);
  }

  function handleCityInputChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setCityInput(value);
    setForm((prev) => ({ ...prev, city: value, state: "", country: "" }));
    save("city", value);
    save("state", "");
    save("country", "");
    if (touched.city) {
      const errs = errorsFor({ ...form, city: value, state: "", country: "" });
      setErrors((prev) => ({ ...prev, city: errs.city, country: undefined }));
    } else {
      setErrors((prev) => ({ ...prev, city: undefined, country: undefined }));
    }
    markStarted(form.applicationType);
  }

  function handleRemovePhoto(index: number) {
    const item = photos.items[index];
    if (item) photos.removePhoto(item.id);
  }

  function handleTermsCheckbox(checked: boolean) {
    setTermsAgreed(checked);
    save("termsAgreed", checked);
    setTouched((prev) => ({ ...prev, termsAgreed: true }));
    const errs = errorsFor(form, checked, nominationConsent);
    setErrors((prev) => ({ ...prev, termsAgreed: errs.termsAgreed }));
  }

  function handleNominationConsentChange(checked: boolean) {
    setNominationConsent(checked);
    save("nominationConsent", checked);
    setTouched((prev) => ({ ...prev, nominationConsent: true }));
    const errs = errorsFor(form, termsAgreed, checked);
    setErrors((prev) => ({
      ...prev,
      nominationConsent: errs.nominationConsent,
    }));
  }

  function handleMarketingConsentChange(value: "yes" | "no") {
    setForm((prev) => ({ ...prev, marketingConsent: value }));
    save("marketingConsent", value);
    setTouched((prev) => ({ ...prev, marketingConsent: true }));
    const errs = errorsFor({ ...form, marketingConsent: value });
    setErrors((prev) => ({ ...prev, marketingConsent: errs.marketingConsent }));
    markStarted(form.applicationType);
  }

  function agreeToTerms() {
    setTermsAgreed(true);
    save("termsAgreed", true);
    setTouched((prev) => ({ ...prev, termsAgreed: true }));
    setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
    setShowTermsModal(false);
  }

  function validate(): boolean {
    const errs = errorsFor(form);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleBlur(field: keyof FormErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = errorsFor(form);
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  async function trackSubmitted() {
    // WHY: the production canary submits as the reserved synthetic identity;
    // without this guard every canary run would identify a fake lead and count
    // an apply_submitted in the real funnel.
    if (isSyntheticSubmission(form.email)) return;
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setPhotosFailed(false);

    const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
    if (turnstileSiteKey && turnstileToken) {
      await verifyTurnstileBestEffort(turnstileToken);
      // Token is one-time-use: reset the widget regardless of the result.
      setTurnstileToken("");
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
    }

    try {
      let settled: PhotoItem[] = [];
      // finalize() runs this again whenever the draft was replaced, so photos
      // are re-filed under the new draft before the application is finished.
      await autosave.finalize(async () => {
        settled = await photos.settleForSubmit();
        const anyFailed = settled.some((p) => p.status === "failed");
        // Send every value, not just unacknowledged ones, so the finished
        // document never depends on an earlier autosave having landed.
        for (const [key, value] of Object.entries(
          toDraftFields(form, termsAgreed, nominationConsent, anyFailed),
        )) {
          autosave.setField(key, value);
        }
      });
      const failedPhotos = settled.filter((p) => p.status === "failed");

      if (failedPhotos.length > 0) {
        reportFailure({
          flow: "apply",
          stage: "photo_upload",
          errorMessage: `Application saved but ${failedPhotos.length} of ${settled.length} photos failed to upload: ${failedPhotos[0].error?.message ?? "unknown error"}`,
          contact: contactOf(form),
          details: {
            savedAnyway: "yes: application is filed, photos are missing",
            photoCount: String(settled.length),
            failedPhotoSizes: failedPhotos.map((p) => p.file.size).join(", "),
            failedPhotoTypes: failedPhotos
              .map((p) => p.file.type || "unknown")
              .join(", "),
          },
        });
      }

      try {
        await trackSubmitted();
      } catch {
        // WHY: the application is already filed here. An analytics failure
        // must not turn it into a "submit failed" screen that invites a
        // second submit.
      }

      setForm(INITIAL);
      setCityInput("");
      setTermsAgreed(false);
      setNominationConsent(false);
      photos.reset();
      setErrors({});
      // Instant scroll before state swap: single frame, imperceptible, and it
      // stops the height collapse leaving the viewport past end-of-content.
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      setPhotosFailed(failedPhotos.length > 0);
      setSubmitted(true);
    } catch (err) {
      const info = describeError(err);
      trackError({
        error_message: info.message,
        error_type: "form_submission",
        component: "useApplyForm",
        form_step: info.stage,
        application_type: form.applicationType,
      });
      reportFailure({
        flow: "apply",
        stage: info.stage,
        errorMessage: info.message,
        contact: contactOf(form),
        details: {
          httpStatus: info.status,
          photoCount: String(photos.items.length),
          savedAnyway:
            "answers were autosaved as typed; the final submit was not acknowledged",
          ...fieldLengthDetails(form),
        },
      });
      setToast({ msg: APPLY_PAGE.submitFailed(info.message), ok: false });
      // Spent token: reset so the next retry gets a fresh challenge.
      setTurnstileToken("");
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const uploading = photos.items.filter((p) => p.status === "uploading").length;
  const retrying = photos.items.filter((p) => p.status === "failed").length;
  const photoStatus =
    photos.items.length === 0
      ? ""
      : uploading > 0
        ? APPLY_PAGE.photoStatusSaving(uploading)
        : retrying > 0
          ? APPLY_PAGE.photoStatusRetrying(retrying)
          : APPLY_PAGE.photoStatusSaved;

  return {
    form,
    photoPreviews: photos.items.map((p) => p.preview),
    photoStatus,
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
    handleAddPhotos: photos.addPhotos,
    handleRemovePhoto,
    handleTermsCheckbox,
    handleBlur,
    agreeToTerms,
    handleSubmit,
    setTurnstileToken,
    turnstileWidgetIdRef,
  };
}
