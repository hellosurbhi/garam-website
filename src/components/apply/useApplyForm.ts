import type React from "react";
import { useState, useEffect, type ChangeEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type StorageReference,
} from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
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
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
  type: string;
  marketingConsent: "yes" | "no" | "";
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
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
  type: "",
  marketingConsent: "",
};

export type FormErrors = Partial<
  Record<keyof FormState | "photo" | "termsAgreed", string>
>;
export type SelectOption = { value: string; label: string };

export function useApplyForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) setCanGoBack(true);
    const params = new URLSearchParams(window.location.search);
    const urlCity = params.get("city");
    const urlState = params.get("state");
    if (urlCity) {
      const label = urlState ? `${urlCity}, ${urlState}` : urlCity;
      setCityInput(label);
      setForm((prev) => ({
        ...prev,
        city: urlCity,
        state: urlState ?? "",
        country: "",
      }));
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const [formStarted, setFormStarted] = useState(false);
  const [cityInput, setCityInput] = useState("");

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

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "Photo must be under 5 MB" }));
      setPhotoFile(null);
      setPhotoPreview(null);
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    setErrors((prev) => ({ ...prev, photo: undefined }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.onerror = () => {
      setErrors((prev) => ({
        ...prev,
        photo: "Failed to read file. Please try again.",
      }));
      setPhotoFile(null);
      setPhotoPreview(null);
    };
    reader.readAsDataURL(file);
  }

  function handleTermsCheckbox(checked: boolean) {
    setTermsAgreed(checked);
    if (checked) setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
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
    if (!form.instagram.trim()) errs.instagram = "Required";
    if (!photoFile) errs.photo = "A photo is required";
    if (form.applicationType === "Nomination" && !form.referrerName.trim()) {
      errs.referrerName = "Required";
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
    let storageRef: StorageReference | null = null;
    try {
      await signInAnonymously(getFirebaseAuth());
      const ext = photoFile!.name.split(".").pop() ?? "jpg";
      storageRef = ref(
        getFirebaseStorage(),
        `photos/${crypto.randomUUID()}.${ext}`,
      );
      const task = uploadBytesResumable(storageRef, photoFile!);
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
      const photoUrl = await getDownloadURL(storageRef);

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
        height: form.height.trim(),
        instagram: form.instagram.trim().replace(/^@/, ""),
        community: form.community,
        income: form.income,
        referrerName:
          form.applicationType === "Nomination" ? form.referrerName.trim() : "",
        pitch: form.pitch.trim(),
        type: form.type.trim(),
        photoUrl,
      };

      await addDoc(collection(getFirebaseDb(), "applications"), {
        ...applicationData,
        marketingConsent: form.marketingConsent,
        termsAgreedAt: serverTimestamp(),
        status: "New",
        notes: "",
        submittedAt: serverTimestamp(),
      });
      storageRef = null; // committed — no cleanup needed

      const attribution = buildLeadAttribution({ source: "apply" });
      const igHandle = form.instagram.trim().replace(/^@/, "");
      if (igHandle) {
        identifyLead(igHandle, {
          name: form.name,
          city: form.city,
          country: form.country,
          applicationType: form.applicationType,
          instagram: igHandle,
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
      }).catch(console.error);

      setForm(INITIAL);
      setCityInput("");
      setTermsAgreed(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setErrors({});
      setSubmitted(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Clean up orphaned photo if upload succeeded but Firestore write failed
      if (storageRef) deleteObject(storageRef).catch(() => {});
      trackError({
        error_message: error.message,
        error_stack: (error.stack ?? "").slice(0, 2000),
        error_type: "form_submission",
        component: "useApplyForm",
        form_step: storageRef ? "firestore_write" : "auth_or_upload",
        application_type: form.applicationType,
      });
      setToast({
        msg: "Sorry, the form isn't working right now. DM us on @garammasaladating on Instagram and we'll sort it out!",
        ok: false,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    form,
    photoPreview,
    errors,
    submitting,
    submitted,
    termsAgreed,
    setTermsAgreed,
    showTermsModal,
    setShowTermsModal,
    canGoBack,
    toast,
    setToast,
    cityInput,
    handleCityInputChange,
    set,
    handlePhotoChange,
    handleTermsCheckbox,
    agreeToTerms,
    handleSubmit,
  };
}
