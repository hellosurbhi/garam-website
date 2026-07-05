import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readConsent, writeConsent, hasConsented } from "./consent";

const CONSENT_KEY = "gmd-cookie-consent";

describe("consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("readConsent returns null when nothing is stored", () => {
    expect(readConsent()).toBeNull();
    expect(hasConsented()).toBe(false);
  });

  it("writeConsent then readConsent round-trips preferences", () => {
    writeConsent({ analytics: true, marketing: false });
    const record = readConsent();
    expect(record).not.toBeNull();
    expect(record?.analytics).toBe(true);
    expect(record?.marketing).toBe(false);
    expect(record?.v).toBe(1);
    expect(hasConsented()).toBe(true);
  });

  it("readConsent returns null for a mismatched version", () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        v: 99,
        analytics: true,
        marketing: true,
        ts: Date.now(),
      }),
    );
    expect(readConsent()).toBeNull();
  });

  it("readConsent returns a record permanently — no expiry regardless of age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    writeConsent({ analytics: true, marketing: true });

    // Jump forward 10 years — consent must still be valid
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const record = readConsent();
    expect(record).not.toBeNull();
    expect(record?.analytics).toBe(true);
    expect(hasConsented()).toBe(true);
  });

  it("readConsent returns null for corrupt JSON", () => {
    localStorage.setItem(CONSENT_KEY, "{not json");
    expect(readConsent()).toBeNull();
  });
});
