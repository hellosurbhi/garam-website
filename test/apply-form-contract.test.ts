import { describe, it, expect } from "vitest";
import { FORM_FIELD_KEYS, sanitizeFields } from "@/lib/applicationDraft";
import { INITIAL, toDraftFields } from "@/components/apply/applyFormModel";

/**
 * Form-to-server contract. The apply form can only lose a field in one way:
 * the UI sends it and the server does not know it. This fails CI the moment a
 * field is added to the form without server support, or the reverse.
 */
describe("apply form contract", () => {
  const sent = Object.keys(toDraftFields(INITIAL, false, false));

  it("every field the form sends is a field the server stores", () => {
    const known = new Set<string>(FORM_FIELD_KEYS);
    const dropped = sent.filter((key) => !known.has(key));
    expect(dropped).toEqual([]);
  });

  it("every field the server accepts is one the form actually sends", () => {
    const orphans = FORM_FIELD_KEYS.filter((key) => !sent.includes(key));
    expect(orphans).toEqual([]);
  });

  it("a fully filled form round-trips with every field present in the saved document", () => {
    const filled = Object.fromEntries(
      sent.map((key) => [key, key === "age" ? "29" : `value-${key}`]),
    );
    filled.applicationType = "Nomination";
    filled.nominationConsent = true as unknown as string;
    filled.termsAgreed = true as unknown as string;
    const { values, keys } = sanitizeFields(filled);
    expect([...keys].sort()).toEqual([...FORM_FIELD_KEYS].sort());
    for (const key of FORM_FIELD_KEYS) {
      expect(values, `field ${key} was not stored`).toHaveProperty(key);
    }
  });

  it("an empty form still writes every field, so clearing a field clears it", () => {
    const { keys } = sanitizeFields(toDraftFields(INITIAL, false, false));
    expect([...keys].sort()).toEqual([...FORM_FIELD_KEYS].sort());
  });
});
