import { APPLY_PAGE } from "@/data/copy";
import { validateEmail } from "@/utils/validateEmail";
import { getFriendFirstName } from "@/utils/nomination";
import type { FieldMap } from "@/lib/applyAutosave";

export interface FormState {
  applicationType: "Self" | "Nomination";
  name: string;
  age: string;
  gender: string;
  orientation: string;
  country: string;
  state: string;
  city: string;
  email: string;
  phone: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
  type: string;
  marketingConsent: "yes" | "no" | "";
  seenShowBefore: "" | "yes" | "no";
  howHeard: string;
}

export const INITIAL: FormState = {
  applicationType: "Self",
  name: "",
  age: "",
  gender: "",
  orientation: "",
  country: "",
  state: "",
  city: "",
  email: "",
  phone: "",
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
  type: "",
  marketingConsent: "",
  seenShowBefore: "",
  howHeard: "",
};

export type FormErrors = Partial<
  Record<
    keyof FormState | "photo" | "termsAgreed" | "nominationConsent",
    string
  >
>;
export type SelectOption = { value: string; label: string };

export const MAX_PHOTOS = 10;

/**
 * Single source of truth for required-field rules. These only decide whether
 * the Submit button is enabled; nothing here is ever sent to the server as a
 * reason to refuse someone, and there are no length limits (autosave has
 * already filed whatever was typed).
 */
export function getFieldErrors(
  form: FormState,
  photoCount: number,
  termsAgreed: boolean,
  nominationConsent: boolean,
): FormErrors {
  const errs: FormErrors = {};
  const msg = APPLY_PAGE.fieldErrors;
  if (!form.name.trim()) errs.name = msg.required;
  const ageNum = parseInt(form.age, 10);
  if (!form.age || Number.isNaN(ageNum) || ageNum < 18) errs.age = msg.underage;
  if (!form.gender) errs.gender = msg.required;
  if (!form.orientation) errs.orientation = msg.required;
  if (!form.city.trim()) errs.city = msg.required;
  const emailErr = validateEmail(form.email);
  if (emailErr) errs.email = emailErr;
  if (!form.instagram.trim().replace(/^@/, "")) errs.instagram = msg.required;
  if (photoCount === 0) errs.photo = msg.photoRequired;
  const isNomination = form.applicationType === "Nomination";
  const friendFirstName = isNomination
    ? getFriendFirstName(form.name)
    : undefined;
  if (isNomination) {
    if (!form.referrerName.trim()) errs.referrerName = msg.required;
    if (!nominationConsent)
      errs.nominationConsent = msg.nominationConsent(friendFirstName);
  }
  if (!form.marketingConsent) {
    errs.marketingConsent = msg.marketingUnanswered;
  } else if (form.marketingConsent === "no") {
    errs.marketingConsent = msg.marketingDeclined(
      isNomination,
      friendFirstName,
    );
  }
  if (!termsAgreed) errs.termsAgreed = msg.termsAgreed;
  return errs;
}

/**
 * Every form value in the shape /api/save-application accepts. Sent in full at
 * submit so the final document never depends on an earlier autosave landing.
 */
export function toDraftFields(
  form: FormState,
  termsAgreed: boolean,
  nominationConsent: boolean,
  photoUploadFailed = false,
): FieldMap {
  return {
    ...form,
    nominationConsent,
    termsAgreed,
    photoUploadFailed,
  };
}

/** The form, consents included, rebuilt from the answers autosave kept. */
export function restoredForm(saved: FieldMap): {
  form: FormState;
  termsAgreed: boolean;
  nominationConsent: boolean;
} {
  // WHY the choice check: three fields only hold fixed values, and a stale or
  // hand-edited draft must not put a value the form cannot render into them.
  const choices: Partial<Record<keyof FormState, readonly string[]>> = {
    applicationType: ["Self", "Nomination"],
    marketingConsent: ["yes", "no", ""],
    seenShowBefore: ["yes", "no", ""],
  };
  const answers: Record<string, string> = {};
  for (const key of Object.keys(INITIAL) as (keyof FormState)[]) {
    const value = saved[key];
    if (typeof value !== "string") continue;
    const allowed = choices[key];
    if (allowed && !allowed.includes(value)) continue;
    answers[key] = value;
  }
  const form = { ...INITIAL, ...answers } as FormState;
  return {
    form,
    termsAgreed: saved.termsAgreed === true,
    nominationConsent: saved.nominationConsent === true,
  };
}

/** Contact fields for failure alerts, so a failed applicant is reachable. */
export function contactOf(form: FormState) {
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    instagram: form.instagram,
  };
}

/** Length of every text field (never the value), for exact-detail alerts. */
export function fieldLengthDetails(form: FormState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(form)) {
    if (typeof value === "string" && value.length > 0) {
      out[`length.${key}`] = String(value.length);
    }
  }
  return out;
}
