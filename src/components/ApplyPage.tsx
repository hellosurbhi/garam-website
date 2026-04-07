import { useState, useEffect, useId, useMemo, type ChangeEvent } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
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
import { SOCIAL_URLS } from "@/data/socials";

/* ─── Shared sub-components ──────────────────────────────────── */

function FieldGroup({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div className={styles.fieldGroup} {...(error ? { "data-error": "true" } : {})}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required && <span className={styles.requiredMark}>*</span>}
      </label>
      {children}
      {error && <p id={errorId} className={styles.errorText} role="alert">{error}</p>}
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
  marketingConsent: "yes" | "no" | "";
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
  marketingConsent: "",
};

type SelectOption = { value: string; label: string };

export default function ApplyPage() {
  return (
    <ErrorBoundary>
      <ApplyPageInner />
    </ErrorBoundary>
  );
}

function ApplyPageInner() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "photo" | "termsAgreed", string>>>({});
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

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
  }

  const nextShow = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return events.find((e) => !e.hidden && e.isoDate && e.isoDate >= today) ?? null;
  }, []);

  const { loading: geoLoading, failed: geoFailed, retry: retryGeo, countryOptions, stateOptions, cityOptions } = useGeoData(form.country, form.state);

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
    if (!photoFile) errs.photo = "A photo is required";
    if (form.applicationType === "Nomination" && !form.referrerName.trim()) {
      errs.referrerName = "Required";
    }
    if (!form.marketingConsent) errs.marketingConsent = "Please select Yes or No";
    if (!termsAgreed) errs.termsAgreed = "You must agree to the Terms & Conditions";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast("Please fill in all required fields", false);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>("[data-error]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
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
        marketingConsent: form.marketingConsent,
        termsAgreedAt: serverTimestamp(),
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
      setTermsAgreed(false);
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
                <p className={styles.subtitle}>NYC&apos;s hottest live South Asian dating show 🌶️</p>
                <div className={styles.divider} />
              </>
            )}
          </div>

          {submitted ? (
            <div className={styles.successPanel} role="status" aria-live="polite">
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
                    href={SOCIAL_URLS.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.successLink}
                  >
                    @garammasaladating
                  </a>{" "}
                  on Instagram. We tend to pick contestants who are already part of the community.
                </p>
              </div>

              <div className={styles.successCard}>
                <h3 className={styles.successCardTitle}>Come steal the show</h3>
                <p className={styles.successCardText}>
                  Most of our contestants started as audience members. Come to a show, be a Stealer,
                  and show us what you&apos;ve got. It seriously increases your odds.
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
                    Get Tickets | {nextShow.date} in {nextShow.city}
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
                      aria-pressed={form.applicationType === type}
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
                  <FieldGroup label="Full Name" required error={errors.name} htmlFor="field-name">
                    <input
                      id="field-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Name"
                      className={styles.input}
                      required
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "field-name-error" : undefined}
                    />
                  </FieldGroup>

                  <FieldGroup label="Age" required error={errors.age} htmlFor="field-age">
                    <input
                      id="field-age"
                      type="number"
                      value={form.age}
                      onChange={(e) => set("age", e.target.value)}
                      placeholder="Age"
                      min={18}
                      max={99}
                      className={styles.input}
                      required
                      aria-invalid={!!errors.age}
                      aria-describedby={errors.age ? "field-age-error" : undefined}
                    />
                  </FieldGroup>
                </div>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Gender" required error={errors.gender} htmlFor="field-gender">
                    <select id="field-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)} className={styles.select} required aria-invalid={!!errors.gender} aria-describedby={errors.gender ? "field-gender-error" : undefined}>
                      <option value="">Select…</option>
                      {["Man", "Woman", "Non-binary", "Other"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Orientation" required error={errors.orientation} htmlFor="field-orientation">
                    <select id="field-orientation" value={form.orientation} onChange={(e) => set("orientation", e.target.value)} className={styles.select} required aria-invalid={!!errors.orientation} aria-describedby={errors.orientation ? "field-orientation-error" : undefined}>
                      <option value="">Select…</option>
                      {["Straight", "Gay", "Bisexual", "Other"].map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>

                <div className={styles.gridThree}>
                  <FieldGroup label="Country" required error={errors.country}>
                    {geoFailed ? (
                      <button type="button" onClick={retryGeo} className={styles.retryButton}>
                        Failed to load countries — tap to retry
                      </button>
                    ) : (
                      <Select<SelectOption>
                        options={countryOptions}
                        value={countryOptions.find((o) => o.value === form.country) ?? null}
                        onChange={handleCountryChange}
                        placeholder={geoLoading ? "Loading…" : "Select…"}
                        styles={formSelectStyles}
                        isSearchable
                        isLoading={geoLoading}
                        isDisabled={geoLoading}
                        aria-label="Country"
                      />
                    )}
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
                        aria-label="State"
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
                        aria-label="City"
                      />
                    </FieldGroup>
                  )}
                </div>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Height" error={errors.height} htmlFor="field-height">
                    <input
                      id="field-height"
                      type="text"
                      value={form.height}
                      onChange={(e) => set("height", e.target.value)}
                      placeholder={`5'8"`}
                      className={styles.input}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Instagram Handle" required error={errors.instagram} htmlFor="field-instagram">
                  <div className={styles.igWrapper}>
                    <span className={styles.igPrefix} aria-hidden="true">@</span>
                    <input
                      id="field-instagram"
                      type="text"
                      value={form.instagram}
                      onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))}
                      placeholder={form.applicationType === "Nomination" ? "yourfriendshandle" : "yourhandle"}
                      className={styles.igInput}
                      required
                      aria-invalid={!!errors.instagram}
                      aria-describedby={errors.instagram ? "field-instagram-error" : undefined}
                    />
                  </div>
                  <p className={styles.igHint}>
                    Follow{" "}
                    <a
                      href={SOCIAL_URLS.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.igHintLink}
                    >
                      @garammasaladating
                    </a>{" "}
                    and DM us for a faster response.
                  </p>
                </FieldGroup>

                <div className={styles.gridTwo}>
                  <FieldGroup label="Community" error={errors.community} htmlFor="field-community">
                    <select id="field-community" value={form.community} onChange={(e) => set("community", e.target.value)} className={styles.select}>
                      <option value="">Select…</option>
                      {COMMUNITY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Income" error={errors.income} htmlFor="field-income">
                    <select id="field-income" value={form.income} onChange={(e) => set("income", e.target.value)} className={styles.select}>
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
                  <FieldGroup label="Your Name" required error={errors.referrerName} htmlFor="field-referrer">
                    <input
                      id="field-referrer"
                      type="text"
                      value={form.referrerName}
                      onChange={(e) => set("referrerName", e.target.value)}
                      placeholder="So we know who nominated them"
                      className={styles.input}
                      required
                      autoComplete="name"
                      aria-invalid={!!errors.referrerName}
                      aria-describedby={errors.referrerName ? "field-referrer-error" : undefined}
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

                {errors.photo && <p className={styles.photoError} role="alert">{errors.photo}</p>}
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
                    id="field-pitch"
                    value={form.pitch}
                    onChange={(e) => set("pitch", e.target.value)}
                    placeholder="Tell us something fun, bold, or irresistible…"
                    className={styles.textarea}
                  />
                </FieldGroup>
              </div>

              {/* ─── Marketing consent ──────────────────────── */}
              <div className={styles.consentSection} {...(errors.marketingConsent ? { "data-error": "true" } : {})}>
                <p className={styles.consentQuestion}>
                  I grant Garam Masala Dating permission to use any of these responses and casting submissions for marketing purposes.<span className={styles.requiredMark}>*</span>
                </p>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="marketingConsent"
                      value="yes"
                      checked={form.marketingConsent === "yes"}
                      onChange={() => { set("marketingConsent", "yes"); }}
                      className={styles.radioInput}
                    />
                    Yes
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="marketingConsent"
                      value="no"
                      checked={form.marketingConsent === "no"}
                      onChange={() => { set("marketingConsent", "no"); }}
                      className={styles.radioInput}
                    />
                    No
                  </label>
                </div>
                {errors.marketingConsent && (
                  <p className={styles.errorText} role="alert">{errors.marketingConsent}</p>
                )}
              </div>

              {/* ─── Terms & Conditions ─────────────────────── */}
              <div className={styles.consentSection} {...(errors.termsAgreed ? { "data-error": "true" } : {})}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => {
                      setTermsAgreed(e.target.checked);
                      if (e.target.checked) setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
                    }}
                    className={styles.checkInput}
                    aria-describedby={errors.termsAgreed ? "terms-error" : undefined}
                  />
                  <span>
                    I agree to the{" "}
                    <button
                      type="button"
                      className={styles.termsLink}
                      onClick={() => setShowTermsModal(true)}
                    >
                      Terms &amp; Conditions
                    </button>
                    <span className={styles.requiredMark}>*</span>
                  </span>
                </label>
                {errors.termsAgreed && (
                  <p id="terms-error" className={styles.errorText} role="alert">{errors.termsAgreed}</p>
                )}
              </div>

              <button type="submit" disabled={submitting} className={styles.submitButton}>
                {submitting ? (
                  <>
                    <span className={styles.spinner} />
                    Submitting…
                  </>
                ) : (
                  "Submit Application"
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

      {/* ─── Terms & Conditions Modal ───────────────────── */}
      {showTermsModal && (
        <div className={styles.termsOverlay} onClick={() => setShowTermsModal(false)} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
          <div className={styles.termsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.termsModalHeader}>
              <h2 id="terms-modal-title" className={styles.termsModalTitle}>Appearance Release &amp; Voluntary Participation Agreement</h2>
              <button type="button" className={styles.termsModalClose} onClick={() => setShowTermsModal(false)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className={styles.termsModalBody}>
              <p>1. I understand that Garam Masala Dating (&ldquo;Producer&rdquo;) is producing the live dating and comedy show entitled &ldquo;Garam Masala Dating&rdquo; (&ldquo;Program&rdquo;), and that Producer would like for me to voluntarily participate in the production of the Program and engage in all activities associated with my participation in the Program, including without limitation activities such as dating in front of a live audience that may be hazardous or damaging (&ldquo;Activity&rdquo;). In connection with my participation in the Activity, I hereby grant to Producer and any third party given permission by Producer the right to take motion and still pictures of me and record my voice and any sounds made by me, and to obtain other information about me, including but not limited to my name, likeness, photograph, voice, dialogue, sounds, biographical information, social media posts, blogs/vlogs, personal characteristics and other personal identification (&ldquo;Footage and Materials&rdquo;), and to use the Footage and Materials in and in connection with the development, production, distribution and exploitation of the Program and any other production, and in the advertisements, merchandising, publicity, and promotions for the Program, any other production and for any entity that may sponsor, advertise in or exhibit in any manner the Program, the Footage and Materials, or any other production (&ldquo;Advertisements&rdquo;). The Footage and Materials, the Program, and the Advertisements may be exploited throughout the universe at any time, in perpetuity, in any and all media, now known and hereafter devised, without any monetary compensation to me whatsoever. The rights granted herein shall also include the right to edit, delete, dub and fictionalize the Footage and Materials, the Program, and the Advertisements as Producer sees fit in Producer&rsquo;s sole discretion. I further understand and agree that third parties, including without limitation, news sources, may take motion and still pictures of me and record my voice and any sounds made by me, or otherwise use the Footage and Materials, the Program, and the Advertisements and my likeness as they see fit. Producer bears no responsibility for such third party use.</p>

              <p>2. I agree to participate in connection with the production of the Program and related materials as and to the extent requested by Producer on such dates and at such locations as Producer shall designate in its sole discretion, and which dates and locations Producer may change in its sole discretion. The Footage and Materials shall also include any and all material that I may create, write, provide or contribute to in connection with the Program at any time, including, without limitation, personal journals, photographs, webisodes, vlogs, blogs, video diaries, social media posts, emails, text/picture messages, and promotional/advertising spots for the Program, the exhibitor of the Program, its advertisers and sponsors, news sources and any of their respective products and services. Producer shall be the sole and exclusive owner of all rights (including without limitation all copyrights) in and to the Footage and Materials. Any and all such Footage and Materials shall be deemed &ldquo;works made for hire&rdquo; specially ordered as part of a motion picture or other audio-visual work, and I waive the exercise of any &ldquo;moral rights,&rdquo; &ldquo;droit moral,&rdquo; and any analogous rights, however denominated, in any jurisdiction of the world. To the extent I retain any interest in the Footage and Materials, I hereby grant and assign to Producer all rights of any nature in and to all such Footage and Materials. Furthermore, the rights granted to Producer include any so-called &ldquo;rental and lending&rdquo; or similar rights and any and all allied, ancillary and subsidiary rights (including, without limitation, remake, sequel, theatrical, digital, television, radio, publishing, merchandising, soundtrack album and other similar rights) for any purpose, by and in any media whether now known or hereafter devised, throughout the universe, in perpetuity, as part of the Program or otherwise.</p>

              <p>3. Producer has no obligation to me whatsoever. Without in any way limiting the foregoing, I acknowledge and agree that Producer is under no obligation to select me to participate in the Activity or to include the Activity or the Footage and Materials in the Program. If Producer deems necessary, I agree to negotiate in good faith additional waivers and release agreements, as requested by Producer.</p>

              <p>4. I represent and warrant the following: (a) I am over eighteen (18) years of age, in good health and have no medical, physical, or emotional condition that might interfere with my engaging in the Activity; (b) I am not a registered sex offender and have not been accused, indicted or convicted of any crime or committed any act of moral turpitude; (c) I will not be under the influence of any medication or drugs that might impair my physical or mental ability to engage in the Activity or that might impair my judgment while engaging in the Activity; (d) I am not currently, and during one (1) year from today do not intend to be, a candidate for any public office; (e) I have all necessary licenses, permits and other consents (if any) required to participate in the Activity and/or the Program; (f) my appearance in the Program is not a performance and is not employment and is not subject to any union or guild collective bargaining agreement, and does not entitle me to wages, salary, corporate benefits, unemployment or workers&rsquo; compensation benefits, or other compensation under any such collective bargaining agreement or otherwise; (g) I will follow and obey all local, city, state and federal laws in connection with my participation in the Program; (h) that I will not, nor will I assist, partner with, permit, or otherwise encourage others to, use, copy, distribute or otherwise exploit the Program and any elements thereof, in whole or in part, for any purpose, in any medium, throughout the world, in perpetuity; and (i) that I will not create any materials or programs which are substantially or confusingly similar to the Program or Activity or any elements thereof. I will not stalk, abuse, harass, threaten, intimidate, assault, rape, injure or damage any person or property and shall refrain from use of violence and other inappropriate behavior at all times.</p>

              <p>5. I understand that it may be a federal offense, unless disclosed to Producer prior to the exhibition of the Program, to give or agree to give any member of the production staff anything of value to arrange my appearance in the Program, or to accept anything of value to promote any product or service on air. I represent and warrant that I gave nothing of value nor did I agree to give anything of value to anyone so I could appear in the Program.</p>

              <p>6. I understand that I will not be paid for participating in the Activity, for appearing in the Program or Advertisements, or for giving Producer the rights listed in this Agreement. I hereby waive any and all rights I may have to any compensation whatsoever. I acknowledge that I am a volunteer and shall not be deemed to be an employee of Producer.</p>

              <p>7. I understand that in and in connection with the Program, I may reveal or relate, and other parties may reveal or relate, information about me of a personal, private, surprising, defamatory, disparaging, embarrassing or unfavorable nature. I further understand that my appearance, depiction, and portrayal in and in connection with the Program, and my actions and the actions of others displayed therein, may be disparaging, defamatory, embarrassing or of an otherwise unfavorable nature, and may expose me to public ridicule, humiliation or condemnation. I acknowledge and agree that Producer shall have the right (but not the obligation) to include any such information and any such appearance, depiction, portrayal, actions and statements in the Program or in any other exhibition or exploitation of the Footage and Materials and Advertisements.</p>

              <p>8. I understand that subsequent to the Program, it is my choice whether or not to continue any interaction, dating or relationship which arises out of the Program, and that any such interaction, dating and/or relationship bears inherent risks, including without limitation the risk of emotional or physical harm. I agree that such activity is solely and entirely at my own risk.</p>

              <p>9. I shall keep in strictest confidence and shall not disclose to any third party at any time any information or materials of any kind that I read, hear or otherwise acquire or learn in connection with or as a result of my participation on the Program (&ldquo;Confidential Information&rdquo;), including without limitation information concerning the Program, the Program participants, the venues or locations, the events contained in the Program or the outcome of any event. My obligations with respect to confidentiality shall continue in perpetuity or until terminated by Producer in writing.</p>

              <p>10. I agree not to make any commercial use of the fact that I appeared in the Program or that Producer used the Footage and Materials. Neither I nor anyone acting on my behalf shall at any time use any of Producer&rsquo;s names, logos, trade names or trademarks, including the title of the Program, for any purpose.</p>

              <p>11. In the event of a breach or default of this Release by Producer, I agree that my sole remedy shall be the right to seek money damages. I shall not seek injunctive or other equitable relief, or to rescind this Release or the rights granted herein, or to restrain in any manner the production, distribution, exhibition, advertising or any other exploitation of the Program. In no event shall Producer be liable for consequential, exemplary or punitive damages, or lost or anticipated profits.</p>

              <p>12. RELEASE, AGREEMENT NOT TO SUE AND INDEMNITY. I understand that my participation in the Activity and any subsequent interaction, dating and relationship is at my own risk. To the maximum extent permitted by law, I, for myself and on behalf of my heirs, executors, agents, successors or assigns, hereby release, hold harmless, and forever discharge Producer and each of their respective parent, subsidiary, related and affiliated entities, licensees, successors, assigns, sponsors and advertisers, and each of their respective officers, directors, principals, executives, agents, contractors, partners, shareholders, representatives and employees (&ldquo;Released Parties&rdquo;), from any and all claims, actions, damages, losses, liabilities, costs, expenses, injuries or causes of action whatsoever that in any way are caused by, arise out of or result from this Agreement, my appearance and participation in the Activity, the Footage and Materials, the Program, or in the Advertisements (including, but not limited to, personal injury, rights of privacy and publicity, defamation, or false light), regardless of whether caused by the negligence or willful misconduct of the Released Parties. I will defend, indemnify and hold the Released Parties harmless from any and all such claims and from any breach or alleged breach by me of any of the representations or warranties made in this Agreement.</p>

              <p>13. To the maximum extent permitted by law, I waive any and all rights I may have under Section 1542 of the Civil Code of California, and every like provision in any foreign jurisdiction. Section 1542 provides: A GENERAL RELEASE DOES NOT EXTEND TO CLAIMS THAT THE CREDITOR OR RELEASING PARTY DOES NOT KNOW OR SUSPECT TO EXIST IN HIS OR HER FAVOR AT THE TIME OF EXECUTING THE RELEASE AND THAT, IF KNOWN BY HIM OR HER, WOULD HAVE MATERIALLY AFFECTED HIS OR HER SETTLEMENT WITH THE DEBTOR OR RELEASED PARTY.</p>

              <p>14. This Agreement shall be governed by and construed in accordance with the laws of the State of New York without regard to its rules on conflict of laws. Any disputes arising under this Agreement shall be resolved by binding arbitration in New York, New York pursuant to JAMS Arbitration Rules and Procedures.</p>

              <p>15. This is the complete and binding agreement between Producer and me, and it supersedes all prior understandings and communications with respect to its subject matter. The illegality, invalidity or unenforceability of any provision shall in no way affect the validity or enforceability of the remainder. This Agreement cannot be terminated, rescinded or amended except by a written agreement signed by both Producer and me.</p>
            </div>
            <div className={styles.termsModalFooter}>
              <button
                type="button"
                className={styles.termsAgreeButton}
                onClick={() => {
                  setTermsAgreed(true);
                  setErrors((prev) => ({ ...prev, termsAgreed: undefined }));
                  setShowTermsModal(false);
                }}
              >
                I Agree
              </button>
              <button
                type="button"
                className={styles.termsDismissButton}
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={styles.toast}
          data-status={toast.ok ? "success" : "error"}
          role="alert"
          aria-live="assertive"
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
