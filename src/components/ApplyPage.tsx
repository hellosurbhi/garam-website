import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          size?: "normal" | "invisible" | "compact";
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    __gmd_turnstile_load?: () => void;
  }
}
import { ErrorBoundary } from "./ErrorBoundary";
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";
import styles from "./ApplyPage.module.css";
import { SOCIAL_URLS } from "@/data/socials";
import Spinner from "./ui/Spinner";
import { APPLY_PAGE, submissionDisclaimer } from "@/data/copy";
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
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

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
        "Submit an application to appear as a contestant on Garam Masala Dating, America's #1 live desi comedy dating show. Collects personal details, Instagram handle, location, and optional pitch.",
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
          email: {
            type: "string",
            format: "email",
            description: "Email address for the contestant",
          },
          pitch: {
            type: "string",
            description: "Why they would be great on the show (optional)",
          },
          type: {
            type: "string",
            description: "Application channel or type (e.g. casting, organic)",
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
          "email",
        ],
      },
    });
    return () => {
      tool?.unregister?.();
    };
  }, []);

  const {
    form,
    photoPreviews,
    errors,
    submitting,
    submitted,
    isValid,
    termsAgreed,
    nominationConsent,
    handleNominationConsentChange,
    showTermsModal,
    setShowTermsModal,
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
    handleBlur,
    setTurnstileToken,
    turnstileWidgetIdRef,
  } = useApplyForm();

  useEffect(() => {
    const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as
      string | undefined;
    if (!siteKey) return;

    function renderWidget() {
      if (
        !turnstileContainerRef.current ||
        !window.turnstile ||
        turnstileWidgetIdRef.current
      )
        return;
      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: siteKey!,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
          size: "invisible",
        },
      );
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      window.__gmd_turnstile_load = renderWidget;
    }

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = undefined;
      }
      delete window.__gmd_turnstile_load;
    };
  }, [setTurnstileToken, turnstileWidgetIdRef]);

  const isNomination = form.applicationType === "Nomination";

  return (
    <>
      <div
        className={styles.page}
        data-apply-root
        data-submitted={submitted || undefined}
      >
        <div className={styles.container}>
          {submitted ? (
            <ApplySuccessPanel />
          ) : (
            <div className={styles.panel}>
              {/* ── Selectivity banner ─────────────────────── */}
              <div className={styles.selectivityNote}>
                <p>{APPLY_PAGE.selectivityNote}</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <fieldset
                  disabled={submitting}
                  className={styles.formFieldset}
                  data-application-type={form.applicationType}
                >
                  {/* ── Mode heading + toggle ──────────────── */}
                  <div className={styles.typeSection}>
                    <p className={styles.applicationModeHeading}>
                      {isNomination
                        ? APPLY_PAGE.headingNomination
                        : APPLY_PAGE.headingSelf}
                    </p>
                    <p className={styles.typeLabel}>I am applying…</p>
                    <div className={styles.typeButtonGroup}>
                      {(["Self", "Nomination"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => set("applicationType", type)}
                          className={styles.typeButton}
                          data-active={
                            form.applicationType === type || undefined
                          }
                          data-for={type}
                          aria-pressed={form.applicationType === type}
                        >
                          {type === "Self" ? "For myself" : "For a friend"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Nomination intro message ───────────── */}
                  {isNomination && (
                    <div className={styles.nominationNotice}>
                      <p>
                        All contact info you fill in below is your{" "}
                        <strong>friend's</strong>, not yours.{" "}
                        {APPLY_PAGE.nominationContactNote}
                      </p>
                    </div>
                  )}

                  <div className={styles.section}>
                    <SectionTitle>
                      {isNomination ? "About Your Friend" : "About You"}
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
                          onBlur={() => handleBlur("name")}
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
                          onBlur={() => handleBlur("age")}
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

                    <fieldset className={styles.seenShowSection}>
                      <legend className={styles.consentQuestion}>
                        {isNomination
                          ? "Has your friend attended a Garam Masala Dating show before?"
                          : "Have you attended a Garam Masala Dating show before?"}
                      </legend>
                      <div className={styles.radioGroup}>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            name="seenShowBefore"
                            value="yes"
                            checked={form.seenShowBefore === "yes"}
                            onChange={() => set("seenShowBefore", "yes")}
                            className={styles.radioInput}
                          />
                          Yes
                        </label>
                        <label className={styles.radioLabel}>
                          <input
                            type="radio"
                            name="seenShowBefore"
                            value="no"
                            checked={form.seenShowBefore === "no"}
                            onChange={() => set("seenShowBefore", "no")}
                            className={styles.radioInput}
                          />
                          No
                        </label>
                      </div>
                      {form.seenShowBefore === "yes" && (
                        <p className={styles.seenYes}>
                          Fantastic. That always helps.
                        </p>
                      )}
                      {form.seenShowBefore === "no" && (
                        <p className={styles.seenNo}>
                          Almost every contestant we cast came to a show as a
                          Stealer first. Without that,{" "}
                          {isNomination
                            ? "they likely won't be selected."
                            : "you likely won't be selected."}{" "}
                          Use code <strong>STEALER</strong> for 20% off (only
                          valid for Garam Masala produced events).{" "}
                          <a href="/tickets" className={styles.seenNudgeLink}>
                            Come Steal &rarr;
                          </a>
                        </p>
                      )}
                    </fieldset>

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
                      label={
                        isNomination
                          ? "Instagram handle @ we wanna stalk them 👀"
                          : "Instagram handle @ we wanna stalk you 👀"
                      }
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
                          onBlur={() => handleBlur("instagram")}
                          placeholder={
                            isNomination ? "yourfriendshandle" : "yourhandle"
                          }
                          className={styles.igInput}
                          required
                          aria-invalid={!!errors.instagram}
                          aria-describedby={
                            errors.instagram
                              ? "field-instagram-error"
                              : undefined
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

                    {/* ── Contact accuracy note ────────────── */}
                    <div className={styles.contactAccuracyNote}>
                      <p>{APPLY_PAGE.contactAccuracyNote}</p>
                    </div>

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
                        onBlur={() => handleBlur("email")}
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

                    <FieldGroup
                      label="Phone Number (optional)"
                      htmlFor="field-phone"
                    >
                      <input
                        id="field-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder={
                          isNomination
                            ? "Friend's phone number"
                            : "+1 (555) 000-0000"
                        }
                        className={styles.input}
                        autoComplete="tel"
                        inputMode="tel"
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

                  {/* ── Nominator info section ─────────────── */}
                  {isNomination && (
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
                          onBlur={() => handleBlur("referrerName")}
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

                      {/* ── Nomination consent checkbox ──────── */}
                      <div
                        className={styles.consentSection}
                        {...(errors.nominationConsent
                          ? { "data-error": "true" }
                          : {})}
                      >
                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={nominationConsent}
                            onChange={(e) =>
                              handleNominationConsentChange(e.target.checked)
                            }
                            className={styles.checkInput}
                            required
                            aria-describedby={
                              errors.nominationConsent
                                ? "nomination-consent-error"
                                : undefined
                            }
                          />
                          <span>
                            {APPLY_PAGE.nominationConsentLabel}
                            <span className={styles.requiredMark}>*</span>
                          </span>
                        </label>
                        {errors.nominationConsent && (
                          <p
                            id="nomination-consent-error"
                            className={styles.errorText}
                            role="alert"
                          >
                            {errors.nominationConsent}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <PhotoUploadField
                    photoPreviews={photoPreviews}
                    error={errors.photo}
                    onAddPhotos={handleAddPhotos}
                    onRemovePhoto={handleRemovePhoto}
                  />

                  <div className={styles.sectionLarge}>
                    <SectionTitle className={styles.anythingElse}>
                      Make Your Case
                    </SectionTitle>
                    <FieldGroup
                      label={
                        isNomination
                          ? "What's your friend's type... (we will do our best to match them)"
                          : "What's your type... (we will do our best to match you)"
                      }
                      htmlFor="field-type"
                    >
                      <input
                        id="field-type"
                        type="text"
                        value={form.type}
                        onChange={(e) => set("type", e.target.value)}
                        placeholder="e.g. funny, ambitious, loves spice"
                        className={styles.input}
                        maxLength={200}
                      />
                    </FieldGroup>
                    <FieldGroup
                      label={
                        isNomination
                          ? "Why would your friend be a great fit? (optional)"
                          : "Why would you be a great fit?"
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

                  {/* ── Marketing consent ──────────────────── */}
                  <fieldset
                    className={styles.consentSection}
                    {...(errors.marketingConsent
                      ? { "data-error": "true" }
                      : {})}
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
                    {form.marketingConsent === "no" && (
                      <p className={styles.noConsentWarning} role="alert">
                        {APPLY_PAGE.noConsentWarning}
                      </p>
                    )}
                  </fieldset>

                  {/* ── Terms & Conditions ─────────────────── */}
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

                  {/* Cloudflare Turnstile invisible widget — rendered via useEffect */}
                  <div ref={turnstileContainerRef} aria-hidden="true" />

                  <button
                    type="submit"
                    disabled={submitting || !isValid}
                    data-submitting={submitting || undefined}
                    className={styles.submitButton}
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" label="Submitting..." />
                        Submitting…
                      </>
                    ) : isNomination ? (
                      "Submit Nomination"
                    ) : (
                      "Submit Application"
                    )}
                  </button>

                  <p className={styles.disclaimer}>{submissionDisclaimer}</p>
                </fieldset>
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
