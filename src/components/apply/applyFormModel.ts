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
  if (!form.name.trim()) errs.name = "Required";
  const ageNum = parseInt(form.age, 10);
  if (!form.age || Number.isNaN(ageNum) || ageNum < 18)
    errs.age = "Must be 18 or older";
  if (!form.gender) errs.gender = "Required";
  if (!form.orientation) errs.orientation = "Required";
  if (!form.city.trim()) errs.city = "Required";
  const emailErr = validateEmail(form.email);
  if (emailErr) errs.email = emailErr;
  if (!form.instagram.trim().replace(/^@/, "")) errs.instagram = "Required";
  if (photoCount === 0) errs.photo = "A photo is required";
  const isNomination = form.applicationType === "Nomination";
  const friendFirstName = isNomination
    ? getFriendFirstName(form.name)
    : undefined;
  if (isNomination) {
    if (!form.referrerName.trim()) errs.referrerName = "Required";
    if (!nominationConsent)
      errs.nominationConsent = friendFirstName
        ? `Please confirm you have permission to nominate ${friendFirstName}`
        : "Please confirm you have permission to nominate this person";
  }
  if (!form.marketingConsent) {
    errs.marketingConsent = "Please select Yes or No.";
  } else if (form.marketingConsent === "no") {
    errs.marketingConsent = isNomination
      ? `${friendFirstName ?? "Your friend"} must select Yes to apply.`
      : "You must select Yes to apply.";
  }
  if (!termsAgreed)
    errs.termsAgreed = "You must agree to the Terms & Conditions";
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
): FieldMap {
  return {
    ...form,
    nominationConsent,
    termsAgreed,
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
