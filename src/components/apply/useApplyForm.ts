import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ChangeEvent,
} from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, type StorageReference } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { useCitySearch } from "@/hooks/useCitySearch";
import {
  resolveCityOption,
  type CitySearchOption,
} from "@/lib/citySearch";
import {
  getFirebaseDb,
  getFirebaseStorage,
  getFirebaseAuth,
} from "@/lib/firebase";
import { trackLeadEvent } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";

export interface FormState {
  applicationType: "Self" | "Nomination";
  name: string;
  age: string;
  gender: string;
  orientation: string;
  country: string;
  state: string;
  city: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
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
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
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
    if (window.history.length > 1) setCanGoBack(true);
    const params = new URLSearchParams(window.location.search);
    const urlCity = params.get("city");
    const urlState = params.get("state");
    if (urlCity || urlState) {
      setForm((prev) => ({
        ...prev,
        ...(urlState ? { state: urlState } : {}),
        ...(urlCity ? { city: urlCity } : {}),
      }));
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const [geoLoadTriggered, setGeoLoadTriggered] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const triggerGeoLoad = useCallback(() => setGeoLoadTriggered(true), []);

  const citySearch = useCitySearch(placeQuery, geoLoadTriggered);
  const [selectedPlace, setSelectedPlace] = useState<CitySearchOption | null>(null);
  const placeOptions = useMemo(
    () =>
      selectedPlace &&
      !citySearch.options.some((option) => option.value === selectedPlace.value)
        ? [selectedPlace, ...citySearch.options].slice(0, 5)
        : citySearch.options,
    [citySearch.options, selectedPlace],
  );

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handlePlaceInputChange(value: string) {
    setPlaceQuery(value);
    if (selectedPlace && value !== selectedPlace.label) {
      setSelectedPlace(null);
    }
  }

  function handlePlaceChange(option: CitySearchOption | null) {
    setSelectedPlace(option);
    setForm((prev) => ({
      ...prev,
      city: option?.city ?? "",
      state: option?.state ?? "",
      country: option?.countryCode ?? "",
    }));
    setPlaceQuery(option?.label ?? "");
    setErrors((prev) => ({
      ...prev,
      country: undefined,
      state: undefined,
      city: undefined,
    }));
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
    if (!form.age || Number.isNaN(ageNum) || ageNum < 18) errs.age = "Must be 18 or older";
    if (!form.gender) errs.gender = "Required";
    if (!form.orientation) errs.orientation = "Required";
    if (!form.city) errs.city = "Required";
    if (!form.country) errs.country = "Required";
    if (!form.instagram.trim()) errs.instagram = "Required";
    if (!photoFile) errs.photo = "A photo is required";
    if (form.applicationType === "Nomination" && !form.referrerName.trim()) {
      errs.referrerName = "Required";
    }
    if (!form.marketingConsent)
      errs.marketingConsent = "Please select Yes or No";
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

  useEffect(() => {
    if (selectedPlace) {
      setPlaceQuery(selectedPlace.label);
      return;
    }

    if (form.city) {
      const fallbackLabel = [form.city, form.state, form.country]
        .filter(Boolean)
        .join(", ");
      setPlaceQuery(fallbackLabel);
      return;
    }

    setPlaceQuery("");
  }, [form.city, form.country, form.state, selectedPlace]);

  useEffect(() => {
    if (selectedPlace || !citySearch.options.length || !form.city) return;

    const seededValue = [form.city, form.state].filter(Boolean).join(", ");
    const resolved = resolveCityOption(seededValue || form.city, citySearch.options);
    if (!resolved) return;

    setSelectedPlace(resolved);
    setForm((prev) => ({
      ...prev,
      city: resolved.city,
      state: resolved.state,
      country: resolved.countryCode,
    }));
  }, [citySearch.options, form.city, form.state, selectedPlace]);

  async function handleSubmit(e: React.FormEvent) {
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
      await uploadBytes(storageRef, photoFile!);
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
        height: form.height.trim(),
        instagram: form.instagram.trim().replace(/^@/, ""),
        community: form.community,
        income: form.income,
        referrerName:
          form.applicationType === "Nomination" ? form.referrerName.trim() : "",
        pitch: form.pitch.trim(),
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
      setTermsAgreed(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setErrors({});
      setSubmitted(true);
    } catch {
      // Clean up orphaned photo if upload succeeded but Firestore write failed
      if (storageRef) deleteObject(storageRef).catch(() => {});
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
    geo: {
      ...citySearch,
      placeOptions,
      placeQuery,
      selectedPlace,
    },
    triggerGeoLoad,
    set,
    handlePlaceInputChange,
    handlePlaceChange,
    handlePhotoChange,
    handleTermsCheckbox,
    agreeToTerms,
    handleSubmit,
  };
}
