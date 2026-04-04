import { useState, useEffect, useMemo, type ChangeEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import Select from "react-select";
import { useGeoData } from "@/hooks/useGeoData";
import { getFirebaseDb, getFirebaseStorage, getFirebaseAuth } from "@/lib/firebase";
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";
import { events } from "@/data/events";
import { formSelectStyles } from "@/utils/reactSelectStyles";
import styles from "./ApplyPage.module.css";

/* ─── Shared sub-components ──────────────────────────────────── */

function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.fieldGroup} {...(error ? { "data-error": "true" } : {})}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.requiredMark}>*</span>}
      </label>
      {children}
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

/* ─── Main form ──────────────────────────────────────────────── */

interface FormState {
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
}

const INITIAL: FormState = {
  applicationType: "Self",
  name: "",
  age: "",
  gender: "",
  orientation: "",
  country: "US",
  state: "",
  city: "",
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
};

type SelectOption = { value: string; label: string };

export default function ApplyPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "photo", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (window.history.length > 1) setCanGoBack(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
  }

  const nextShow = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return events.find((e) => !e.hidden && e.isoDate && e.isoDate >= today) ?? null;
  }, []);

  const { loading: geoLoading, failed: geoFailed, countryOptions, stateOptions, cityOptions } = useGeoData(form.country, form.state);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleCountryChange(option: SelectOption | null) {
    setForm((prev) => ({ ...prev, country: option?.value ?? "", state: "", city: "" }));
    setErrors((prev) => ({ ...prev, country: undefined, state: undefined, city: undefined }));
  }

  function handleStateChange(option: SelectOption | null) {
    setForm((prev) => ({ ...prev, state: option?.value ?? "", city: "" }));
    setErrors((prev) => ({ ...prev, state: undefined, city: undefined }));
  }

  function handleCityChange(option: SelectOption | null) {
    setForm((prev) => ({ ...prev, city: option?.value ?? "" }));
    setErrors((prev) => ({ ...prev, city: undefined }));
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
      setErrors((prev) => ({ ...prev, photo: "Failed to read file. Please try again." }));
      setPhotoFile(null);
      setPhotoPreview(null);
    };
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.age || parseInt(form.age) < 18) errs.age = "Must be 18 or older";
    if (!form.gender) errs.gender = "Required";
    if (!form.orientation) errs.orientation = "Required";
    if (!form.country) errs.country = "Required";
    if (!form.state) errs.state = "Required";
    if (!form.city) errs.city = "Required";
    if (!form.instagram.trim()) errs.instagram = "Required";
    if (!form.community) errs.community = "Required";
    if (!form.income) errs.income = "Required";
    if (!photoFile) errs.photo = "A photo is required";
    if (form.applicationType === "Nomination" && !form.referrerName.trim()) {
      errs.referrerName = "Required";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast("Please fill in all required fields", false);
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>("[data-error]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signInAnonymously(getFirebaseAuth());
      const ext = photoFile!.name.split(".").pop() ?? "jpg";
      const storageRef = ref(getFirebaseStorage(), `photos/${crypto.randomUUID()}.${ext}`);
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
        referrerName: form.applicationType === "Nomination" ? form.referrerName.trim() : "",
        pitch: form.pitch.trim(),
        photoUrl,
      };

      await addDoc(collection(getFirebaseDb(), "applications"), {
        ...applicationData,
        status: "New",
        notes: "",
        submittedAt: serverTimestamp(),
      });

      // Fire-and-forget: email notification (does not affect submission)
      fetch("/api/notify-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applicationData),
      }).catch(() => {});

      setForm(INITIAL);
      setPhotoFile(null);
      setPhotoPreview(null);
      setErrors({});
      setSubmitted(true);
    } catch {
      showToast("Sorry, the form isn't working right now. DM us on @garammasaladating on Instagram and we'll sort it out!", false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.page} onClick={() => window.history.back()}>
        <div className={styles.container} onClick={(e) => e.stopPropagation()}>
          <div className={styles.headerArea}>
            {canGoBack && (
              <button type="button" onClick={() => window.history.back()} className={styles.backButton}>
                ← Back
              </button>
            )}
          </div>

          <div className={styles.titleArea}>
            {!submitted && (
              <>
                <h1 className={styles.title}>Apply to Be on Garam Masala Dating</h1>
                <p className={styles.subtitle}>NYC&apos;s hottest live comedy dating show 🌶️</p>
                <div className={styles.divider} />
              </>
            )}
          </div>

          {submitted ? (
            <div className={styles.successPanel}>
              <div className={styles.successEmoji}>🌶️</div>
              <h1 className={styles.successTitle}>Thanks for applying!</h1>
              <p className={styles.successText}>
                We review every application and will reach out if you&apos;re selected.
              </p>

              <div className={styles.successCard}>
                <h3 className={styles.successCardTitle}>Want to boost your chances?</h3>
                <p className={styles.successCardText}>
                  Follow{" "}
                  <a
                    href="https://instagram.com/garammasaladating"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.successLink}
                  >
                    @garammasaladating
                  </a>{" "}
                  on Instagram — we tend to pick contestants who are already part of the community.
                </p>
              </div>

              <div className={styles.successCard}>
                <h3 className={styles.successCardTitle}>Come steal the show</h3>
                <p className={styles.successCardText}>
                  Most of our contestants started as audience members. Come to a show, be a Stealer,
                  and show us what you&apos;ve got — it seriously increases your odds.
                </p>
                <p className={styles.successCoupon}>
                  Use code <strong>STEALER</strong> for 20% off your next ticket.
                </p>
                {nextShow && (
                  <a
                    href={nextShow.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.successTicketButton}
                  >
                    Get Tickets — {nextShow.date} in {nextShow.city}
                  </a>
                )}
              </div>
            </div>
          ) : (
          <div className={styles.panel}>
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.typeSection}>
                <p className={styles.typeLabel}>I am applying…</p>
                <div className={styles.typeButtonGroup}>
                  {(["Self", "Nomination"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => set("applicationType", type)}
                      className={styles.typeButton}
                      data-active={form.applicationType === type || undefined}
                    >
                      {type === "Self" ? "For myself" : "For a friend"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.section}>
                <SectionTitle>
                  {form.applicationType === "Self" ? "About You" : "About Your Friend"}
                </SectionTitle>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Full Name" required error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Name"
                      className={styles.input}
                    />
                  </FieldGroup>

                  <FieldGroup label="Age" required error={errors.age}>
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => set("age", e.target.value)}
                      placeholder="Age"
                      min={18}
                      max={99}
                      className={styles.input}
                    />
                  </FieldGroup>
                </div>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Gender" required error={errors.gender}>
                    <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={styles.select}>
                      <option value="">Select…</option>
                      {["Man", "Woman", "Non-binary", "Other"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Orientation" required error={errors.orientation}>
                    <select value={form.orientation} onChange={(e) => set("orientation", e.target.value)} className={styles.select}>
                      <option value="">Select…</option>
                      {["Straight", "Gay", "Bisexual", "Other"].map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>

                <div className={styles.gridThree}>
                  <FieldGroup label="Country" required error={errors.country}>
                    <Select<SelectOption>
                      options={countryOptions}
                      value={countryOptions.find((o) => o.value === form.country) ?? null}
                      onChange={handleCountryChange}
                      placeholder={geoLoading ? "Loading…" : geoFailed ? "Type your country" : "Select…"}
                      styles={formSelectStyles}
                      isSearchable
                      isLoading={geoLoading}
                      isDisabled={geoLoading}
                    />
                  </FieldGroup>

                  {form.country && (
                    <FieldGroup label="State" required error={errors.state}>
                      <Select<SelectOption>
                        options={stateOptions}
                        value={stateOptions.find((o) => o.value === form.state) ?? null}
                        onChange={handleStateChange}
                        placeholder="Select…"
                        styles={formSelectStyles}
                        isSearchable
                      />
                    </FieldGroup>
                  )}

                  {form.country && form.state && (
                    <FieldGroup label="City" required error={errors.city}>
                      <Select<SelectOption>
                        options={cityOptions}
                        value={cityOptions.find((o) => o.value === form.city) ?? null}
                        onChange={handleCityChange}
                        placeholder="Select…"
                        styles={formSelectStyles}
                        isSearchable
                      />
                    </FieldGroup>
                  )}
                </div>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Height" error={errors.height}>
                    <input
                      type="text"
                      value={form.height}
                      onChange={(e) => set("height", e.target.value)}
                      placeholder={`5'8"`}
                      className={styles.input}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Instagram Handle" required error={errors.instagram}>
                  <div className={styles.igWrapper}>
                    <span className={styles.igPrefix}>@</span>
                    <input
                      type="text"
                      value={form.instagram}
                      onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))}
                      placeholder={form.applicationType === "Nomination" ? "yourfriendshandle" : "yourhandle"}
                      className={styles.igInput}
                    />
                  </div>
                </FieldGroup>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Community" required error={errors.community}>
                    <select value={form.community} onChange={(e) => set("community", e.target.value)} className={styles.select}>
                      <option value="">Select…</option>
                      {COMMUNITY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Income" required error={errors.income}>
                    <select value={form.income} onChange={(e) => set("income", e.target.value)} className={styles.select}>
                      <option value="">Select…</option>
                      {INCOME_OPTIONS.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>
              </div>

              {form.applicationType === "Nomination" && (
                <div className={styles.section}>
                  <SectionTitle>Your Info</SectionTitle>
                  <FieldGroup label="Your Name" required error={errors.referrerName}>
                    <input
                      type="text"
                      value={form.referrerName}
                      onChange={(e) => set("referrerName", e.target.value)}
                      placeholder="So we know who nominated them"
                      className={styles.input}
                    />
                  </FieldGroup>
                </div>
              )}

              <div className={styles.section}>
                <SectionTitle>Photo</SectionTitle>
                <p className={styles.photoLabel}>
                  Best recent photo
                  <span className={styles.requiredMark}>*</span>
                </p>

                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                />

                <label
                  htmlFor="photo-input"
                  className={errors.photo ? styles.photoDropzoneError : styles.photoDropzone}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className={styles.photoPreview} />
                  ) : (
                    <>
                      <p className={styles.photoEmoji}>📸</p>
                      <p className={styles.photoPrompt}>Tap to upload a photo</p>
                    </>
                  )}
                </label>

                {photoPreview && (
                  <label htmlFor="photo-input" className={styles.changePhoto}>
                    Change photo
                  </label>
                )}

                {errors.photo && <p className={styles.photoError}>{errors.photo}</p>}
              </div>

              <div className={styles.sectionLarge}>
                <SectionTitle>Anything else?</SectionTitle>
                <FieldGroup
                  label={
                    form.applicationType === "Self"
                      ? "Why would you be a great fit? (optional)"
                      : "Why would your friend be a great fit? (optional)"
                  }
                >
                  <textarea
                    value={form.pitch}
                    onChange={(e) => set("pitch", e.target.value)}
                    placeholder="Tell us something fun, bold, or irresistible…"
                    className={styles.textarea}
                  />
                </FieldGroup>
              </div>

              <button type="submit" disabled={submitting} className={styles.submitButton}>
                {submitting ? (
                  <>
                    <span className={styles.spinner} />
                    Submitting…
                  </>
                ) : (
                  "Submit Application 🌶️"
                )}
              </button>

              <p className={styles.disclaimer}>
                By submitting, you agree to be contacted by the Garam Masala Dating team.
              </p>
            </form>
          </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={styles.toast}
          data-status={toast.ok ? "success" : "error"}
        >
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className={styles.toastDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
