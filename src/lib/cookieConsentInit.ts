import { readConsent, writeConsent, type ConsentRecord } from "@/lib/consent";

export function initCookieConsent(): void {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

  const dialog = document.getElementById(
    "cookie-prefs-dialog",
  ) as HTMLDialogElement | null;
  const analyticsCheck = document.getElementById(
    "cookie-analytics",
  ) as HTMLInputElement | null;
  const marketingCheck = document.getElementById(
    "cookie-marketing",
  ) as HTMLInputElement | null;
  const acceptBtn = document.getElementById("cookie-accept");
  const rejectBtn = document.getElementById("cookie-reject");
  const manageBtn = document.getElementById("cookie-manage");
  const saveBtn = document.getElementById("cookie-save");
  const modalAcceptBtn = document.getElementById("cookie-modal-accept");
  const modalCloseBtn = document.getElementById("cookie-modal-close");

  if (
    !dialog ||
    !analyticsCheck ||
    !marketingCheck ||
    !acceptBtn ||
    !rejectBtn ||
    !manageBtn ||
    !saveBtn ||
    !modalAcceptBtn ||
    !modalCloseBtn
  )
    return;

  function loadPrefs(): void {
    const consent = readConsent();
    analyticsCheck!.checked = consent?.analytics ?? false;
    marketingCheck!.checked = consent?.marketing ?? false;
  }

  function dispatchConsentEvent(record: ConsentRecord): void {
    window.dispatchEvent(
      new CustomEvent("gmd:consent-updated", { detail: record }),
    );
  }

  function handleAcceptAll(): void {
    const record = writeConsent({ analytics: true, marketing: true });
    dispatchConsentEvent(record);
    banner!.hidden = true;
    dialog!.close();
  }

  function handleRejectAll(): void {
    const record = writeConsent({ analytics: false, marketing: false });
    dispatchConsentEvent(record);
    banner!.hidden = true;
  }

  function handleSave(): void {
    const record = writeConsent({
      analytics: analyticsCheck!.checked,
      marketing: marketingCheck!.checked,
    });
    dispatchConsentEvent(record);
    banner!.hidden = true;
    dialog!.close();
  }

  acceptBtn.addEventListener("click", handleAcceptAll);
  rejectBtn.addEventListener("click", handleRejectAll);
  manageBtn.addEventListener("click", () => {
    loadPrefs();
    dialog!.showModal();
  });
  saveBtn.addEventListener("click", handleSave);
  modalAcceptBtn.addEventListener("click", handleAcceptAll);
  modalCloseBtn.addEventListener("click", () => dialog!.close());

  window.__gmdOpenCookiePrefs = () => {
    loadPrefs();
    dialog!.showModal();
  };

  // The banner ships hidden in the static HTML. Consent lives in
  // localStorage, which only exists in the browser, so the decision to
  // show the banner must happen here and not at build time.
  if (!readConsent()) banner.hidden = false;
}
