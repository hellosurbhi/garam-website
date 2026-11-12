import { describe, it, expect } from "vitest";
import { INITIAL, restoredForm } from "@/components/apply/applyFormModel";

describe("restoredForm", () => {
  it("rebuilds the answers and consents autosave kept", () => {
    const out = restoredForm({
      name: "Priya",
      applicationType: "Nomination",
      termsAgreed: true,
      nominationConsent: true,
    });
    expect(out.form.name).toBe("Priya");
    expect(out.form.applicationType).toBe("Nomination");
    expect(out.termsAgreed).toBe(true);
    expect(out.nominationConsent).toBe(true);
  });

  it("ignores a value a fixed-choice field cannot hold", () => {
    const out = restoredForm({
      applicationType: "Robot",
      marketingConsent: "maybe",
      name: 42,
    });
    expect(out.form.applicationType).toBe(INITIAL.applicationType);
    expect(out.form.marketingConsent).toBe(INITIAL.marketingConsent);
    expect(out.form.name).toBe(INITIAL.name);
    expect(out.termsAgreed).toBe(false);
  });
});
