import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initCookieConsent } from "./cookieConsentInit";
import * as consent from "./consent";

vi.mock("./consent", () => ({
  readConsent: vi.fn(),
  writeConsent: vi.fn(),
}));

const mockReadConsent = vi.mocked(consent.readConsent);
const mockWriteConsent = vi.mocked(consent.writeConsent);

function buildDOM() {
  document.body.innerHTML = `
    <div id="cookie-banner" hidden>
      <button id="cookie-accept"></button>
      <button id="cookie-reject"></button>
      <button id="cookie-manage"></button>
    </div>
    <dialog id="cookie-prefs-dialog">
      <input type="checkbox" id="cookie-analytics" />
      <input type="checkbox" id="cookie-marketing" />
      <button id="cookie-save"></button>
      <button id="cookie-modal-accept"></button>
      <button id="cookie-modal-close"></button>
    </dialog>
  `;
}

describe("initCookieConsent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    buildDOM();
    // Provide a minimal showModal/close on the dialog element (jsdom stub)
    const dialog = document.getElementById(
      "cookie-prefs-dialog",
    ) as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete (window as Window & { __gmdOpenCookiePrefs?: () => void })
      .__gmdOpenCookiePrefs;
  });

  it("does nothing when #cookie-banner is absent", () => {
    document.body.innerHTML = "";
    // Should not throw
    expect(() => initCookieConsent()).not.toThrow();
  });

  it("reveals banner when no consent is stored", () => {
    mockReadConsent.mockReturnValue(null);
    initCookieConsent();
    const banner = document.getElementById("cookie-banner")!;
    expect(banner.hidden).toBe(false);
  });

  it("keeps banner hidden when consent is already stored", () => {
    mockReadConsent.mockReturnValue({
      v: 1,
      analytics: true,
      marketing: true,
      ts: Date.now(),
    });
    initCookieConsent();
    const banner = document.getElementById("cookie-banner")!;
    expect(banner.hidden).toBe(true);
  });

  it("accept button writes full consent and hides banner", () => {
    mockReadConsent.mockReturnValue(null);
    const record = { v: 1 as const, analytics: true, marketing: true, ts: 1 };
    mockWriteConsent.mockReturnValue(record);

    initCookieConsent();
    document.getElementById("cookie-accept")!.click();

    expect(mockWriteConsent).toHaveBeenCalledWith({
      analytics: true,
      marketing: true,
    });
    expect(document.getElementById("cookie-banner")!.hidden).toBe(true);
  });

  it("reject button writes empty consent and hides banner", () => {
    mockReadConsent.mockReturnValue(null);
    const record = {
      v: 1 as const,
      analytics: false,
      marketing: false,
      ts: 1,
    };
    mockWriteConsent.mockReturnValue(record);

    initCookieConsent();
    document.getElementById("cookie-reject")!.click();

    expect(mockWriteConsent).toHaveBeenCalledWith({
      analytics: false,
      marketing: false,
    });
    expect(document.getElementById("cookie-banner")!.hidden).toBe(true);
  });

  it("save button writes current checkbox state and hides banner", () => {
    mockReadConsent.mockReturnValue(null);
    const record = {
      v: 1 as const,
      analytics: true,
      marketing: false,
      ts: 1,
    };
    mockWriteConsent.mockReturnValue(record);

    initCookieConsent();
    (document.getElementById("cookie-analytics") as HTMLInputElement).checked =
      true;
    (document.getElementById("cookie-marketing") as HTMLInputElement).checked =
      false;
    document.getElementById("cookie-save")!.click();

    expect(mockWriteConsent).toHaveBeenCalledWith({
      analytics: true,
      marketing: false,
    });
    expect(document.getElementById("cookie-banner")!.hidden).toBe(true);
  });

  it("manage button opens the dialog", () => {
    mockReadConsent.mockReturnValue(null);
    initCookieConsent();
    document.getElementById("cookie-manage")!.click();

    const dialog = document.getElementById(
      "cookie-prefs-dialog",
    ) as HTMLDialogElement;
    expect(dialog.showModal).toHaveBeenCalled();
  });

  it("modal close button closes the dialog", () => {
    mockReadConsent.mockReturnValue(null);
    initCookieConsent();
    document.getElementById("cookie-modal-close")!.click();

    const dialog = document.getElementById(
      "cookie-prefs-dialog",
    ) as HTMLDialogElement;
    expect(dialog.close).toHaveBeenCalled();
  });

  it("modal accept button writes full consent and hides banner", () => {
    mockReadConsent.mockReturnValue(null);
    const record = { v: 1 as const, analytics: true, marketing: true, ts: 1 };
    mockWriteConsent.mockReturnValue(record);

    initCookieConsent();
    document.getElementById("cookie-modal-accept")!.click();

    expect(mockWriteConsent).toHaveBeenCalledWith({
      analytics: true,
      marketing: true,
    });
    expect(document.getElementById("cookie-banner")!.hidden).toBe(true);
  });

  it("exposes window.__gmdOpenCookiePrefs that opens the dialog", () => {
    mockReadConsent.mockReturnValue(null);
    initCookieConsent();

    expect(typeof window.__gmdOpenCookiePrefs).toBe("function");
    window.__gmdOpenCookiePrefs!();

    const dialog = document.getElementById(
      "cookie-prefs-dialog",
    ) as HTMLDialogElement;
    expect(dialog.showModal).toHaveBeenCalled();
  });

  it("dispatches gmd:consent-updated event on accept", () => {
    mockReadConsent.mockReturnValue(null);
    const record = { v: 1 as const, analytics: true, marketing: true, ts: 1 };
    mockWriteConsent.mockReturnValue(record);

    const listener = vi.fn();
    window.addEventListener("gmd:consent-updated", listener);
    initCookieConsent();
    document.getElementById("cookie-accept")!.click();
    window.removeEventListener("gmd:consent-updated", listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual(record);
  });
});
