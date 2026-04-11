import { useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";
import styles from "./ApplyPage.module.css";
import { SOCIAL_URLS } from "@/data/socials";
import { FieldGroup, SectionTitle } from "./apply/FieldGroup";
import { TermsModal } from "./apply/TermsModal";
import { ApplySuccessPanel } from "./apply/ApplySuccessPanel";
import { PhotoUploadField } from "./apply/PhotoUploadField";
import { useApplyForm } from "./apply/useApplyForm";

type NavWithMC = Navigator & {
  modelContext: {
    registerTool: (def: object) => { unregister?: () => void };
  };
};

export default function ApplyPage() {
  return (
    <ErrorBoundary>
      <ApplyPageInner />
    </ErrorBoundary>
  );
}

function ApplyPageInner() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mc =
      "modelContext" in navigator
        ? (navigator as unknown as NavWithMC).modelContext
        : undefined;
    if (typeof mc?.registerTool !== "function") return;
    const tool = mc.registerTool({
      name: "submit-contestant-application",
      description:
        "Submit an application to appear as a contestant on Garam Masala Dating, NYC's #1 live South Asian comedy dating show. Collects personal details, Instagram handle, location, and optional pitch.",
      inputSchema: {
        type: "object",
        properties: {
          applicationType: {
            type: "string",
            enum: ["self", "nomination"],
            description: "Applying for yourself or nominating someone else",
          },
          fullName: {
            type: "string",
            description: "Full name of the contestant",
          },
          age: {
            type: "integer",
            minimum: 18,
            maximum: 99,
            description: "Age in years",
          },
          gender: { type: "string", description: "Gender identity" },
          sexualOrientation: {
            type: "string",
            description: "Sexual orientation",
          },
          city: {
            type: "string",
            description: "City where the contestant lives",
          },
          instagram: {
            type: "string",
            description: "Instagram handle (without @)",
          },
          pitch: {
            type: "string",
            description: "Why they would be great on the show (optional)",
          },
        },
        required: [
          "applicationType",
          "fullName",
          "age",
          "gender",
          "sexualOrientation",
          "city",
          "instagram",
        ],
      },
    });
    return () => {
      tool?.unregister?.();
    };
  }, []);

  const {
    form,
    photoPreview,
    errors,
    submitting,
    submitted,
    termsAgreed,
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
  } = useApplyForm();

  return (
    <>
      <div className={styles.page} data-apply-root>
        <div className={styles.container}>
          <div className={styles.headerArea}>
            <button
              type="button"
              onClick={() => window.history.back()}
              className={styles.backButton}
              disabled={!canGoBack}
            >
              ← Back
            </button>
          </div>

          <div className={styles.titleArea}>
            {!submitted && (
              <>
                <h1 className={styles.title}>
                  Apply to Be on Garam Masala Dating
                </h1>
                <p className={styles.subtitle}>
                  NYC&apos;s #1 live South Asian dating show 🌶️
                </p>
                <div className={styles.divider} />
              </>
            )}
          </div>

          {submitted ? (
            <ApplySuccessPanel />
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
                    {form.applicationType === "Self"
                      ? "About You"
                      : "About Your Friend"}
                  </SectionTitle>

                  <div className={styles.gridTwo}>
                    <FieldGroup
                      label="Full Name"
                      required
                      error={errors.name}
                      htmlFor="field-name"
                    >
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
                        aria-describedby={
                          errors.name ? "field-name-error" : undefined
                        }
                      />
                    </FieldGroup>

                    <FieldGroup
                      label="Age"
                      required
                      error={errors.age}
                      htmlFor="field-age"
                    >
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
                        aria-describedby={
                          errors.age ? "field-age-error" : undefined
                        }
                      />
                    </FieldGroup>
                  </div>

                  <div className={styles.gridTwo}>
                    <FieldGroup
                      label="Gender"
                      required
                      error={errors.gender}
                      htmlFor="field-gender"
                    >
                      <select
                        id="field-gender"
                        value={form.gender}
                        onChange={(e) => set("gender", e.target.value)}
                        className={styles.select}
                        required
                        aria-invalid={!!errors.gender}
                        aria-describedby={
                          errors.gender ? "field-gender-error" : undefined
                        }
                      >
                        <option value="">Select…</option>
                        {["Man", "Woman", "Non-binary", "Other"].map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>

                    <FieldGroup
                      label="Orientation"
                      required
                      error={errors.orientation}
                      htmlFor="field-orientation"
                    >
                      <select
                        id="field-orientation"
                        value={form.orientation}
                        onChange={(e) => set("orientation", e.target.value)}
                        className={styles.select}
                        required
                        aria-invalid={!!errors.orientation}
                        aria-describedby={
                          errors.orientation
                            ? "field-orientation-error"
                            : undefined
                        }
                      >
                        <option value="">Select…</option>
                        {["Straight", "Gay", "Bisexual", "Other"].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                  </div>

                  <div className={styles.gridTwo}>
                    <FieldGroup
                      label="Metropolitan Area"
                      required
                      error={errors.city}
                      htmlFor="geo-place"
                    >
                      <input
                        id="geo-place"
                        type="text"
                        value={cityInput}
                        onChange={handleCityInputChange}
                        placeholder="(Ex. Chicago)"
                        className={styles.input}
                        required
                        autoComplete="address-level2"
                        aria-invalid={!!errors.city}
                        aria-describedby={
                          errors.city ? "geo-place-error" : undefined
                        }
                      />
                    </FieldGroup>
                  </div>

                  <div className={styles.gridTwo}>
                    <FieldGroup
                      label="Height"
                      error={errors.height}
                      htmlFor="field-height"
                    >
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

                  <FieldGroup
                    label="Instagram Handle"
                    required
                    error={errors.instagram}
                    htmlFor="field-instagram"
                  >
                    <div className={styles.igWrapper}>
                      <span className={styles.igPrefix} aria-hidden="true">
                        @
                      </span>
                      <input
                        id="field-instagram"
                        type="text"
                        value={form.instagram}
                        onChange={(e) =>
                          set("instagram", e.target.value.replace(/^@/, ""))
                        }
                        placeholder={
                          form.applicationType === "Nomination"
                            ? "yourfriendshandle"
                            : "yourhandle"
                        }
                        className={styles.igInput}
                        required
                        aria-invalid={!!errors.instagram}
                        aria-describedby={
                          errors.instagram ? "field-instagram-error" : undefined
                        }
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

                  <FieldGroup
                    label="Email"
                    required
                    error={errors.email}
                    htmlFor="field-email"
                  >
                    <input
                      id="field-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@example.com"
                      className={styles.input}
                      required
                      autoComplete="email"
                      inputMode="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={
                        errors.email ? "field-email-error" : undefined
                      }
                    />
                  </FieldGroup>

                  <div className={styles.gridTwo}>
                    <FieldGroup
                      label="Community"
                      error={errors.community}
                      htmlFor="field-community"
                    >
                      <select
                        id="field-community"
                        value={form.community}
                        onChange={(e) => set("community", e.target.value)}
                        className={styles.select}
                      >
                        <option value="">Select…</option>
                        {COMMUNITY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>

                    <FieldGroup
                      label="Income"
                      error={errors.income}
                      htmlFor="field-income"
                    >
                      <select
                        id="field-income"
                        value={form.income}
                        onChange={(e) => set("income", e.target.value)}
                        className={styles.select}
                      >
                        <option value="">Select…</option>
                        {INCOME_OPTIONS.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </FieldGroup>
                  </div>
                </div>

                {form.applicationType === "Nomination" && (
                  <div className={styles.section}>
                    <SectionTitle>Your Info</SectionTitle>
                    <FieldGroup
                      label="Your Name"
                      required
                      error={errors.referrerName}
                      htmlFor="field-referrer"
                    >
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
                        aria-describedby={
                          errors.referrerName
                            ? "field-referrer-error"
                            : undefined
                        }
                      />
                    </FieldGroup>
                  </div>
                )}

                <PhotoUploadField
                  photoPreview={photoPreview}
                  error={errors.photo}
                  onChange={handlePhotoChange}
                />

                <div className={styles.sectionLarge}>
                  <SectionTitle className={styles.anythingElse}>
                    Anything else?
                  </SectionTitle>
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
                <fieldset
                  className={styles.consentSection}
                  {...(errors.marketingConsent ? { "data-error": "true" } : {})}
                  aria-describedby={
                    errors.marketingConsent
                      ? "marketing-consent-error"
                      : undefined
                  }
                >
                  <legend className={styles.consentQuestion}>
                    I grant Garam Masala Dating permission to use any of these
                    responses and casting submissions for marketing purposes.
                    <span className={styles.requiredMark}>*</span>
                  </legend>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="marketingConsent"
                        value="yes"
                        checked={form.marketingConsent === "yes"}
                        onChange={() => set("marketingConsent", "yes")}
                        className={styles.radioInput}
                        aria-invalid={!!errors.marketingConsent}
                      />
                      Yes
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="marketingConsent"
                        value="no"
                        checked={form.marketingConsent === "no"}
                        onChange={() => set("marketingConsent", "no")}
                        className={styles.radioInput}
                        aria-invalid={!!errors.marketingConsent}
                      />
                      No
                    </label>
                  </div>
                  {errors.marketingConsent && (
                    <p
                      id="marketing-consent-error"
                      className={styles.errorText}
                      role="alert"
                    >
                      {errors.marketingConsent}
                    </p>
                  )}
                </fieldset>

                {/* ─── Terms & Conditions ─────────────────────── */}
                <div
                  className={styles.consentSection}
                  {...(errors.termsAgreed ? { "data-error": "true" } : {})}
                >
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => handleTermsCheckbox(e.target.checked)}
                      className={styles.checkInput}
                      aria-describedby={
                        errors.termsAgreed ? "terms-error" : undefined
                      }
                    />
                    <span>
                      I agree to the{" "}
                      <button
                        type="button"
                        className={styles.termsLink}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTermsModal(true);
                        }}
                      >
                        Terms &amp; Conditions
                      </button>
                      <span className={styles.requiredMark}>*</span>
                    </span>
                  </label>
                  {errors.termsAgreed && (
                    <p
                      id="terms-error"
                      className={styles.errorText}
                      role="alert"
                    >
                      {errors.termsAgreed}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.submitButton}
                >
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
                  By submitting, you agree to be contacted by the Garam Masala
                  Dating team.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>

      {showTermsModal && (
        <TermsModal
          onClose={() => setShowTermsModal(false)}
          onAgree={agreeToTerms}
        />
      )}

      {toast && (
        <div
          className={styles.toast}
          data-status={toast.ok ? "success" : "error"}
          role="alert"
          aria-live="assertive"
        >
          <span>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className={styles.toastDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
