import { useCallback, useEffect, useRef } from "react";
import { WAIVER_PANEL } from "@/data/contestantPortal";
import { WaiverDocument } from "@/components/WaiverDocument";
import styles from "@/components/ContestantPortal.module.css";

interface WaiverPanelProps {
  waiverText: string;
  scrolled: boolean;
  onScrolledToEnd: () => void;
  signature: string;
  onSignatureChange: (value: string) => void;
  signatureValid: boolean;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
}

/**
 * Clickwrap waiver panel. Fully controlled: the parent form owns all state
 * (signature, agreement, scroll unlock) because canSubmit and the submit
 * payload are computed there. Only the scroll detection mechanics live here.
 */
export function WaiverPanel({
  waiverText,
  scrolled,
  onScrolledToEnd,
  signature,
  onSignatureChange,
  signatureValid,
  agreed,
  onAgreedChange,
}: WaiverPanelProps) {
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const unlockedRef = useRef(false);

  const unlockOnce = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    onScrolledToEnd();
  }, [onScrolledToEnd]);

  // Unlock when the document fits without scrolling, otherwise reaching the
  // bottom would be impossible. A ResizeObserver rechecks on container or
  // content size changes (viewport resize, font load) instead of a one-shot
  // mount check.
  useEffect(() => {
    // Keep the once-guard in sync with the parent's state so a parent-side
    // reset (scrolled back to false) re-arms the unlock instead of being
    // permanently blocked by a stale ref.
    unlockedRef.current = scrolled;
    if (scrolled) return;
    const el = scrollElRef.current;
    if (!el) return;

    const checkFit = () => {
      // WHY: clientHeight of 0 means the box has not been laid out yet
      // (hidden ancestor or pre-style hydration). scrollHeight <= clientHeight
      // passes trivially then (0 <= 4) and would unlock signing without the
      // waiver ever being readable. Skip; the observer rechecks after layout.
      if (el.clientHeight === 0) return;
      if (el.scrollHeight <= el.clientHeight + 4) {
        unlockOnce();
      }
    };

    checkFit();
    const observer = new ResizeObserver(checkFit);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [scrolled, unlockOnce]);

  function handleScroll(el: HTMLDivElement) {
    if (scrolled) return;
    const canScroll = el.scrollHeight > el.clientHeight + 4;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (canScroll && reachedBottom) {
      unlockOnce();
    }
  }

  const showMismatch =
    scrolled && signature.trim().length > 0 && !signatureValid;

  return (
    <section className={styles.waiverPanel} aria-label="Waiver agreement">
      <p id="waiver-panel-instruction" className={styles.waiverInstruction}>
        {WAIVER_PANEL.instruction}
      </p>

      <div
        className={`${styles.waiverScrollWrap}${scrolled ? ` ${styles.isRead}` : ""}`}
      >
        <div
          ref={scrollElRef}
          className={styles.waiverScroll}
          role="region"
          aria-label="Waiver document"
          aria-describedby="waiver-panel-instruction"
          tabIndex={0}
          onScroll={(e) => handleScroll(e.currentTarget)}
        >
          <WaiverDocument text={waiverText} />
        </div>
        <div className={styles.waiverFade} aria-hidden="true" />
        <p className={styles.waiverHint} aria-hidden="true">
          {WAIVER_PANEL.scrollHint}
          <span className={styles.waiverHintArrow}>↓</span>
        </p>
      </div>

      {/* Both mutually exclusive messages (locked hint / unlock
          confirmation) stay laid out in one stacked slot; visibility picks
          the visible one. The slot is always as tall as the TALLER message
          at the current width, so the swap cannot move the controls below
          even where one message wraps and the other does not. The visually
          hidden live region announces the swap for screen readers and is
          the aria-describedby target while locked. */}
      <div className={styles.messageSlot} aria-hidden="true">
        <p
          className={`${styles.waiverStatus}${scrolled ? ` ${styles.slotHidden}` : ""}`}
        >
          {WAIVER_PANEL.signatureLockedHint}
        </p>
        <p
          className={`${styles.waiverStatus}${scrolled ? "" : ` ${styles.slotHidden}`}`}
        >
          ✓ {WAIVER_PANEL.endReached}
        </p>
      </div>
      <p id="waiver-locked-hint" role="status" className={styles.srOnly}>
        {scrolled
          ? `✓ ${WAIVER_PANEL.endReached}`
          : WAIVER_PANEL.signatureLockedHint}
      </p>

      <div>
        <label className={styles.label} htmlFor="portal-signature">
          {WAIVER_PANEL.signatureLabel}
        </label>
        <input
          id="portal-signature"
          type="text"
          placeholder={WAIVER_PANEL.signaturePlaceholder}
          required
          disabled={!scrolled}
          value={signature}
          onChange={(e) => onSignatureChange(e.target.value)}
          className={`${styles.input} ${styles.inputSig}`}
          aria-describedby={
            !scrolled
              ? "waiver-locked-hint"
              : showMismatch
                ? "portal-signature-error"
                : undefined
          }
        />
        {/* An invisible twin of the mismatch message keeps its full wrapped
            height reserved at every width; the alert twin carries the
            announcement. Appearing text can therefore never push the
            checkbox down. */}
        <div className={styles.messageSlot}>
          <p
            className={`${styles.errorInline} ${styles.slotHidden}`}
            aria-hidden="true"
          >
            {WAIVER_PANEL.signatureMismatch}
          </p>
          <p
            id="portal-signature-error"
            role="alert"
            className={styles.errorInline}
          >
            {showMismatch ? WAIVER_PANEL.signatureMismatch : ""}
          </p>
        </div>
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={agreed}
          disabled={!scrolled}
          aria-describedby={!scrolled ? "waiver-locked-hint" : undefined}
          onChange={(e) => onAgreedChange(e.target.checked)}
        />
        <span>{WAIVER_PANEL.checkboxLabel}</span>
      </label>
    </section>
  );
}
