import { useCallback, useEffect, useRef } from "react";
import { WAIVER_PANEL } from "@/data/contestantPortal";
import { WaiverDocument } from "@/components/WaiverDocument";

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
    <section className="waiver-panel" aria-label="Waiver agreement">
      <p id="waiver-panel-instruction" className="waiver-panel-instruction">
        {WAIVER_PANEL.instruction}
      </p>

      <div className={`waiver-scroll-wrap${scrolled ? " is-read" : ""}`}>
        <div
          ref={scrollElRef}
          className="portal-waiver-scroll"
          role="region"
          aria-label="Waiver document"
          aria-describedby="waiver-panel-instruction"
          tabIndex={0}
          onScroll={(e) => handleScroll(e.currentTarget)}
        >
          <WaiverDocument text={waiverText} />
        </div>
        <div className="waiver-scroll-fade" aria-hidden="true" />
        <p className="waiver-scroll-hint" aria-hidden="true">
          {WAIVER_PANEL.scrollHint}
          <span className="waiver-scroll-hint-arrow">↓</span>
        </p>
      </div>

      {/* Rendered from first paint so the unlock text change is announced
          politely by screen readers without a layout shift. */}
      <p role="status" className="waiver-status">
        {scrolled ? `✓ ${WAIVER_PANEL.endReached}` : ""}
      </p>

      <div>
        <label className="portal-label" htmlFor="portal-signature">
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
          className="portal-input portal-input-sig"
          aria-label="Signature"
          aria-describedby={
            !scrolled
              ? "waiver-locked-hint"
              : showMismatch
                ? "portal-signature-error"
                : undefined
          }
        />
        {showMismatch && (
          <p
            id="portal-signature-error"
            role="alert"
            className="portal-error-inline"
          >
            {WAIVER_PANEL.signatureMismatch}
          </p>
        )}
      </div>

      <label className="portal-checkbox">
        <input
          type="checkbox"
          checked={agreed}
          disabled={!scrolled}
          aria-describedby={!scrolled ? "waiver-locked-hint" : undefined}
          onChange={(e) => onAgreedChange(e.target.checked)}
        />
        <span>{WAIVER_PANEL.checkboxLabel}</span>
      </label>

      {!scrolled && (
        <p id="waiver-locked-hint" className="waiver-locked-hint">
          {WAIVER_PANEL.signatureLockedHint}
        </p>
      )}
    </section>
  );
}
