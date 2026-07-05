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

  it("readConsent returns null once the record is older than one year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T00:00:00Z"));
    writeConsent({ analytics: true, marketing: true });

    vi.setSystemTime(new Date("2027-07-06T00:00:01Z"));
    expect(readConsent()).toBeNull();
  });

  it("readConsent returns a record still within its one year TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T00:00:00Z"));
    writeConsent({ analytics: false, marketing: true });

    vi.setSystemTime(new Date("2027-07-04T00:00:00Z"));
    expect(readConsent()?.marketing).toBe(true);
  });

  it("readConsent returns null for corrupt JSON", () => {
    localStorage.setItem(CONSENT_KEY, "{not json");
    expect(readConsent()).toBeNull();
  });
});
