import { useState, type FormEvent } from "react";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { WAIVER_PAGE } from "@/data/waiverPage";
import { WaiverDocument } from "@/components/WaiverDocument";
import { useWaiverSignature } from "@/components/waiver/useWaiverSignature";
import { reportFailure } from "@/lib/failureAlert";
import styles from "./StandaloneWaiverForm.module.css";

type Phase = "form" | "submitting" | "success";

/**
 * Native signing form for the standalone /waiver page (replaced a
 * third-party JotForm embed that the CSP rightly blocked). Posts to
 * /api/stage-waiver with no show context and mailingListOptIn always false:
 * a waiver page is a legal surface, never a marketing capture.
 */
export default function StandaloneWaiverForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [formError, setFormError] = useState("");

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const {
    signature,
    setSignature,
    signatureValid,
    waiverScrolled,
    waiverRef,
    handleWaiverScroll,
  } = useWaiverSignature(fullName);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    signatureValid &&
    waiverScrolled &&
    agreed &&
    phase !== "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setPhase("submitting");
    setFormError("");
    try {
      const res = await fetch("/api/stage-waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          waiverAgreed: agreed,
          signature: signature.trim(),
          waiverVersion: WAIVER_VERSION,
          mailingListOptIn: false,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const serverMessage =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "";
        throw new Error(serverMessage || WAIVER_PAGE.errorFallback);
      }
      setPhase("success");
    } catch (err) {
      setPhase("form");
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : WAIVER_PAGE.errorFallback,
      );
      // A failed waiver blocks someone from going on stage tonight; page
      // with their contact fields so production can find them at the venue.
      reportFailure({
        flow: "waiver",
        stage: "standalone_submit",
        errorMessage: err instanceof Error ? err.message : String(err),
        contact: { name: fullName, email, phone },
      });
    }
  }

  if (phase === "success") {
    return (
      <div
        className={styles.success}
        role="status"
        data-testid="waiver-success"
      >
        <h2 className={styles.successHeading}>{WAIVER_PAGE.successHeading}</h2>
        <p className={styles.successBody}>{WAIVER_PAGE.successBody}</p>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      data-testid="waiver-form"
    >
      <p className={styles.intro}>{WAIVER_PAGE.intro}</p>

      <div className={styles.nameRow}>
        <input
          id="waiver-first-name"
          type="text"
          placeholder="Legal first name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={styles.input}
          aria-label="Legal first name"
        />
        <input
          id="waiver-last-name"
          type="text"
          placeholder="Legal last name"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className={styles.input}
          aria-label="Legal last name"
        />
      </div>
      <input
        id="waiver-email"
        type="email"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={styles.input}
        aria-label="Email"
      />
      <input
        id="waiver-phone"
        type="tel"
        placeholder="Phone (555) 123-4567"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={styles.input}
        aria-label="Phone number"
      />

      <div
        ref={waiverRef}
        className={styles.waiverScroll}
        aria-label="Waiver text"
        role="region"
        tabIndex={0}
        data-testid="waiver-scroll"
        onScroll={(e) => handleWaiverScroll(e.currentTarget)}
      >
        <WaiverDocument text={WAIVER_TEXT} />
      </div>

      <div>
        <label className={styles.label} htmlFor="waiver-signature">
          {WAIVER_PAGE.signatureLabel}
        </label>
        <input
          id="waiver-signature"
          type="text"
          placeholder="First Last"
          required
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          className={`${styles.input} ${styles.signatureInput}`}
          aria-label="Signature"
          aria-describedby={
            signature.trim() && !signatureValid
              ? "waiver-signature-error"
              : undefined
          }
        />
        {signature.trim() && !signatureValid && (
          <p
            id="waiver-signature-error"
            role="alert"
            className={styles.inlineError}
          >
            {WAIVER_PAGE.signatureMismatch}
          </p>
        )}
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={agreed}
          disabled={!waiverScrolled}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{WAIVER_PAGE.agreeLabel}</span>
      </label>
      {!waiverScrolled && (
        <p className={styles.scrollHint}>{WAIVER_PAGE.scrollHint}</p>
      )}

      {formError && (
        <p role="alert" className={styles.formError}>
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={styles.submit}
        data-testid="waiver-submit"
      >
        {phase === "submitting"
          ? WAIVER_PAGE.submittingLabel
          : WAIVER_PAGE.submitLabel}
      </button>
    </form>
  );
}
