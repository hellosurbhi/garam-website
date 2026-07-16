import { useCallback, useState } from "react";

/**
 * Shared waiver-signing interaction logic: scroll-through gating (the signer
 * must reach the bottom of the waiver before they can agree) and typed
 * legal-name signature validation. Used by the contestant portal packet gate
 * and the standalone /waiver page so the two legal surfaces can never drift
 * apart in behavior.
 */
export function useWaiverSignature(fullName: string) {
  const [signature, setSignature] = useState("");
  const [waiverScrolled, setWaiverScrolled] = useState(false);

  // Callback ref: set waiverScrolled immediately if no scroll is needed.
  const waiverRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 4) {
      setWaiverScrolled(true);
    }
  }, []);

  function handleWaiverScroll(el: HTMLDivElement) {
    const canScroll = el.scrollHeight > el.clientHeight + 4;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (canScroll && reachedBottom) {
      setWaiverScrolled(true);
    }
  }

  const signatureValid =
    signature.trim().length > 0 &&
    signature.trim().toLowerCase() === fullName.toLowerCase();

  return {
    signature,
    setSignature,
    signatureValid,
    waiverScrolled,
    waiverRef,
    handleWaiverScroll,
  };
}
