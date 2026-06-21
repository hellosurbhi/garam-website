# Pitch Your Friend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/pitch-your-friend` page (nomination-only form), phone field to both apply forms, and fix admin modal to show email and phone.

**Architecture:** Extract shared form JSX into `ContestantFormFields`, which both `ApplyPage` and the new `PitchFriendPage` consume. `useApplyForm` gets an `initialType` option and a `phone` field. Admin modal adds email (mailto link) and phone to the detail view.

**Tech Stack:** Astro SSG, React (client:only islands), Firebase Firestore, Vitest + Testing Library, Resend email API.

---

## File Map

| Action | File                                            | Responsibility                                                |
| ------ | ----------------------------------------------- | ------------------------------------------------------------- |
| Modify | `src/types/application.ts`                      | Add `phone?: string` to Application interface                 |
| Modify | `src/components/apply/useApplyForm.ts`          | Add `initialType` option + `phone` to FormState/submit        |
| Create | `src/components/apply/ContestantFormFields.tsx` | Shared form field JSX; `showTypeToggle` + `submitLabel` props |
| Modify | `src/components/ApplyPage.tsx`                  | Use ContestantFormFields; pass `showTypeToggle`               |
| Modify | `src/components/admin/ApplicantModal.tsx`       | Show email (mailto) + phone in info grid                      |
| Modify | `src/pages/api/notify-application.ts`           | Add phone to email notification                               |
| Modify | `src/data/copy.ts`                              | Add PITCH_FRIEND_PAGE copy block                              |
| Create | `src/components/PitchFriendPage.tsx`            | React island for /pitch-your-friend; Nomination-locked        |
| Create | `src/pages/pitch-your-friend.astro`             | Astro page wrapper with nomination-specific copy              |
| Modify | `src/components/apply/useApplyForm.test.ts`     | Tests for initialType + phone field                           |
| Modify | `src/components/admin/ApplicantModal.test.tsx`  | Tests for email/phone display                                 |
| Modify | `test/notify-application.test.ts`               | Tests for phone in email HTML                                 |

---

### Task 1: Add phone to Application type

**Files:**

- Modify: `src/types/application.ts`

- [ ] **Step 1: Add phone field to Application interface**

In `src/types/application.ts`, add `phone?: string` after the `email` field:

```ts
export interface Application {
  id: string;
  name: string;
  age: number;
  gender: string;
  orientation: string;
  city: string;
  country?: string;
  state?: string;
  email?: string;
  phone?: string; // ← add this line
  height: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName?: string;
  pitch?: string;
  type?: string;
  seenShowBefore?: boolean;
  marketingConsent?: "yes" | "no";
  termsAgreedAt?: Timestamp;
  photoUrl: string;
  deletedAt?: Timestamp | null;
  status: "New" | "Contacted" | "Cast" | "Rejected";
  notes?: string;
  submittedAt: Timestamp;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/application.ts
git commit -m "feat(types): add optional phone field to Application interface"
```

---

### Task 2: Add phone + initialType option to useApplyForm

**Files:**

- Modify: `src/components/apply/useApplyForm.ts`
- Modify: `src/components/apply/useApplyForm.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the bottom of the `describe("useApplyForm")` block in `src/components/apply/useApplyForm.test.ts`:

```ts
/* ── initialType option ────────────────────────────────── */

it("defaults applicationType to Self when no initialType provided", () => {
  const { result } = renderHook(() => useApplyForm());
  expect(result.current.form.applicationType).toBe("Self");
});

it("starts with applicationType Nomination when initialType is Nomination", () => {
  const { result } = renderHook(() =>
    useApplyForm({ initialType: "Nomination" }),
  );
  expect(result.current.form.applicationType).toBe("Nomination");
});

/* ── phone field ──────────────────────────────────────── */

it("starts with phone as empty string", () => {
  const { result } = renderHook(() => useApplyForm());
  expect(result.current.form.phone).toBe("");
});

it("submit includes phone in Firestore doc", async () => {
  const { result } = renderHook(() => useApplyForm());
  act(() => {
    fillRequired(
      result.current.set,
      result.current.handleTermsCheckbox,
      result.current.handlePhotoChange,
    );
    result.current.set("phone", "+1 555 123 4567");
  });
  await act(async () => {
    await result.current.handleSubmit(makeSubmitEvent());
  });
  const docData = mockAddDoc.mock.calls[0][1];
  expect(docData.phone).toBe("+1 555 123 4567");
});

it("submit includes phone in notification body", async () => {
  const { result } = renderHook(() => useApplyForm());
  act(() => {
    fillRequired(
      result.current.set,
      result.current.handleTermsCheckbox,
      result.current.handlePhotoChange,
    );
    result.current.set("phone", "+1 555 999 0000");
  });
  await act(async () => {
    await result.current.handleSubmit(makeSubmitEvent());
  });
  const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
    .calls[0];
  const body = JSON.parse(fetchCall[1].body as string);
  expect(body.phone).toBe("+1 555 999 0000");
});

it("submit trims phone in Firestore doc", async () => {
  const { result } = renderHook(() => useApplyForm());
  act(() => {
    fillRequired(
      result.current.set,
      result.current.handleTermsCheckbox,
      result.current.handlePhotoChange,
    );
    result.current.set("phone", "  +1 555 000 0000  ");
  });
  await act(async () => {
    await result.current.handleSubmit(makeSubmitEvent());
  });
  const docData = mockAddDoc.mock.calls[0][1];
  expect(docData.phone).toBe("+1 555 000 0000");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/apply/useApplyForm.test.ts 2>&1 | tail -20
```

Expected: 5 tests fail ("phone" and "Nomination" tests).

- [ ] **Step 3: Update useApplyForm**

Replace the top of `src/components/apply/useApplyForm.ts` — the `FormState` interface and `INITIAL` constant and function signature:

```ts
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
  phone: string; // ← new
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
  type: string;
  marketingConsent: "yes" | "no" | "";
  seenShowBefore: "" | "yes" | "no";
}

const INITIAL: FormState = {
  applicationType: "Self",
  name: "",
  age: "",
  gender: "",
  orientation: "",
  country: "",
  state: "",
  city: "",
  email: "",
  phone: "", // ← new
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
  type: "",
  marketingConsent: "",
  seenShowBefore: "",
};
```

Change the function signature and `useState` initializer:

```ts
export function useApplyForm(options?: { initialType?: "Self" | "Nomination" }) {
  const initialType = options?.initialType ?? "Self";
  const [form, setForm] = useState<FormState>(() => {
    const urlParams = getUrlCityParams();
    const base = { ...INITIAL, applicationType: initialType };
    if (!urlParams) return base;
    return {
      ...base,
      city: urlParams.city,
      state: urlParams.state,
      country: "",
    };
  });
```

In `handleSubmit`, add `phone` to `applicationData` (after `referrerName`):

```ts
const applicationData = {
  applicationType: form.applicationType,
  name: form.name.trim(),
  age: parseInt(form.age),
  gender: form.gender,
  orientation: form.orientation,
  country: form.country,
  state: form.state,
  city: form.city,
  email: form.email.trim().toLowerCase(),
  phone: form.phone.trim(), // ← new
  height: form.height.trim(),
  instagram: form.instagram.trim().replace(/^@/, ""),
  community: form.community,
  income: form.income,
  referrerName:
    form.applicationType === "Nomination" ? form.referrerName.trim() : "",
  pitch: form.pitch.trim(),
  type: form.type.trim(),
  photoUrl,
  ...(form.seenShowBefore !== ""
    ? { seenShowBefore: form.seenShowBefore === "yes" }
    : {}),
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/apply/useApplyForm.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/apply/useApplyForm.ts src/components/apply/useApplyForm.test.ts
git commit -m "feat(apply): add phone field and initialType option to useApplyForm"
```

---

### Task 3: Extract ContestantFormFields + add phone input

**Files:**

- Create: `src/components/apply/ContestantFormFields.tsx`
- Modify: `src/components/ApplyPage.tsx`

- [ ] **Step 1: Create ContestantFormFields.tsx**

Create `src/components/apply/ContestantFormFields.tsx` with the following content. This is the complete form field JSX moved out of `ApplyPage.tsx`, with `showTypeToggle`, `submitLabel`, and the new phone field:

```tsx
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";
import styles from "@/components/ApplyPage.module.css";
import { SOCIAL_URLS } from "@/data/socials";
import { APPLY_PAGE, submissionDisclaimer } from "@/data/copy";
import Spinner from "@/components/ui/Spinner";
import { FieldGroup, SectionTitle } from "./FieldGroup";
import { PhotoUploadField } from "./PhotoUploadField";
import type { FormState, FormErrors } from "./useApplyForm";
import type React from "react";

interface ContestantFormFieldsProps {
  form: FormState;
  photoPreview: string | null;
  errors: FormErrors;
  submitting: boolean;
  termsAgreed: boolean;
  cityInput: string;
  handleCityInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (field: keyof FormState, value: string) => void;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTermsCheckbox: (checked: boolean) => void;
  setShowTermsModal: (v: boolean) => void;
  showTypeToggle?: boolean;
  submitLabel?: string;
}

export function ContestantFormFields({
  form,
  photoPreview,
  errors,
  submitting,
  termsAgreed,
  cityInput,
  handleCityInputChange,
  set,
  handlePhotoChange,
  handleTermsCheckbox,
  setShowTermsModal,
  showTypeToggle = false,
  submitLabel = "Submit Application",
}: ContestantFormFieldsProps) {
  const isNomination = form.applicationType === "Nomination";

  return (
    <>
      {showTypeToggle && (
        <div className={styles.typeSection}>
          <p className={styles.typeLabel}>I am applying…</p>
          <div className={styles.typeButtonGroup}>
            {(["Self", "Nomination"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set("applicationType", type)}
                className={styles.typeButton}
                data-active={form.applicationType === type || undefined}
                aria-pressed={form.applicationType === type}
              >
                {type === "Self" ? "For myself" : "For a friend"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <SectionTitle>
          {isNomination ? "About Your Friend" : "About You"}
        </SectionTitle>

        <div className={styles.gridTwo}>
          <FieldGroup
            label="Full Name"
            required
            error={errors.name}
            htmlFor="field-name"
          >
            <input
              id="field-name"
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Name"
              className={styles.input}
              required
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "field-name-error" : undefined}
            />
          </FieldGroup>

          <FieldGroup
            label="Age"
            required
            error={errors.age}
            htmlFor="field-age"
          >
            <input
              id="field-age"
              type="number"
              value={form.age}
              onChange={(e) => set("age", e.target.value)}
              placeholder="Age"
              min={18}
              max={99}
              className={styles.input}
              required
              aria-invalid={!!errors.age}
              aria-describedby={errors.age ? "field-age-error" : undefined}
            />
          </FieldGroup>
        </div>

        <div className={styles.gridTwo}>
          <FieldGroup
            label="Gender"
            required
            error={errors.gender}
            htmlFor="field-gender"
          >
            <select
              id="field-gender"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              className={styles.select}
              required
              aria-invalid={!!errors.gender}
              aria-describedby={
                errors.gender ? "field-gender-error" : undefined
              }
            >
              <option value="">Select…</option>
              {["Man", "Woman", "Non-binary", "Other"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup
            label="Orientation"
            required
            error={errors.orientation}
            htmlFor="field-orientation"
          >
            <select
              id="field-orientation"
              value={form.orientation}
              onChange={(e) => set("orientation", e.target.value)}
              className={styles.select}
              required
              aria-invalid={!!errors.orientation}
              aria-describedby={
                errors.orientation ? "field-orientation-error" : undefined
              }
            >
              <option value="">Select…</option>
              {["Straight", "Gay", "Bisexual", "Other"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </FieldGroup>
        </div>

        <fieldset className={styles.seenShowSection}>
          <legend className={styles.consentQuestion}>
            {isNomination
              ? "Has your friend attended a Garam Masala Dating show before?"
              : "Have you attended a Garam Masala Dating show before?"}
          </legend>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="seenShowBefore"
                value="yes"
                checked={form.seenShowBefore === "yes"}
                onChange={() => set("seenShowBefore", "yes")}
                className={styles.radioInput}
              />
              Yes
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="seenShowBefore"
                value="no"
                checked={form.seenShowBefore === "no"}
                onChange={() => set("seenShowBefore", "no")}
                className={styles.radioInput}
              />
              No
            </label>
          </div>
          {form.seenShowBefore === "yes" && (
            <p className={styles.seenYes}>Fantastic. That always helps.</p>
          )}
          {form.seenShowBefore === "no" && (
            <p className={styles.seenNo}>
              Almost every contestant we cast came to a show as a Stealer first.
              Without that, you likely won&apos;t be selected. Use code{" "}
              <strong>STEALER</strong> for 20% off (only valid for Garam Masala
              produced events).{" "}
              <a href="/tickets" className={styles.seenNudgeLink}>
                Come Steal &rarr;
              </a>
            </p>
          )}
        </fieldset>

        <div className={styles.gridTwo}>
          <FieldGroup
            label="Metropolitan Area"
            required
            error={errors.city}
            htmlFor="geo-place"
          >
            <input
              id="geo-place"
              type="text"
              value={cityInput}
              onChange={handleCityInputChange}
              placeholder="(Ex. Chicago)"
              className={styles.input}
              required
              autoComplete="address-level2"
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? "geo-place-error" : undefined}
            />
          </FieldGroup>
        </div>

        <div className={styles.gridTwo}>
          <FieldGroup
            label="Height"
            error={errors.height}
            htmlFor="field-height"
          >
            <input
              id="field-height"
              type="text"
              value={form.height}
              onChange={(e) => set("height", e.target.value)}
              placeholder={`5'8"`}
              className={styles.input}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          label="Instagram handle @ we wanna stalk you 👀"
          required
          error={errors.instagram}
          htmlFor="field-instagram"
        >
          <div className={styles.igWrapper}>
            <span className={styles.igPrefix} aria-hidden="true">
              @
            </span>
            <input
              id="field-instagram"
              type="text"
              value={form.instagram}
              onChange={(e) =>
                set("instagram", e.target.value.replace(/^@/, ""))
              }
              placeholder={isNomination ? "yourfriendshandle" : "yourhandle"}
              className={styles.igInput}
              required
              aria-invalid={!!errors.instagram}
              aria-describedby={
                errors.instagram ? "field-instagram-error" : undefined
              }
            />
          </div>
          <p className={styles.igHint}>
            Follow{" "}
            <a
              href={SOCIAL_URLS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.igHintLink}
            >
              @garammasaladating
            </a>{" "}
            and DM us for a faster response.
          </p>
        </FieldGroup>

        <FieldGroup
          label="Email"
          required
          error={errors.email}
          htmlFor="field-email"
        >
          <input
            id="field-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
            className={styles.input}
            required
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "field-email-error" : undefined}
          />
        </FieldGroup>

        <FieldGroup
          label="Phone Number (optional)"
          error={errors.phone}
          htmlFor="field-phone"
        >
          <input
            id="field-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 (555) 000-0000"
            className={styles.input}
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "field-phone-error" : undefined}
          />
        </FieldGroup>

        <div className={styles.gridTwo}>
          <FieldGroup
            label="Community"
            error={errors.community}
            htmlFor="field-community"
          >
            <select
              id="field-community"
              value={form.community}
              onChange={(e) => set("community", e.target.value)}
              className={styles.select}
            >
              <option value="">Select…</option>
              {COMMUNITY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup
            label="Income"
            error={errors.income}
            htmlFor="field-income"
          >
            <select
              id="field-income"
              value={form.income}
              onChange={(e) => set("income", e.target.value)}
              className={styles.select}
            >
              <option value="">Select…</option>
              {INCOME_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </FieldGroup>
        </div>
      </div>

      {isNomination && (
        <div className={styles.section}>
          <SectionTitle>Your Info</SectionTitle>
          <FieldGroup
            label="Your Name"
            required
            error={errors.referrerName}
            htmlFor="field-referrer"
          >
            <input
              id="field-referrer"
              type="text"
              value={form.referrerName}
              onChange={(e) => set("referrerName", e.target.value)}
              placeholder="So we know who nominated them"
              className={styles.input}
              required
              autoComplete="name"
              aria-invalid={!!errors.referrerName}
              aria-describedby={
                errors.referrerName ? "field-referrer-error" : undefined
              }
            />
          </FieldGroup>
        </div>
      )}

      <PhotoUploadField
        photoPreview={photoPreview}
        error={errors.photo}
        onChange={handlePhotoChange}
      />

      <div className={styles.sectionLarge}>
        <SectionTitle className={styles.anythingElse}>
          Make Your Case
        </SectionTitle>
        <FieldGroup
          label="What's your type... (we will do our best to match you)"
          htmlFor="field-type"
        >
          <input
            id="field-type"
            type="text"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            placeholder="e.g. funny, ambitious, loves spice"
            className={styles.input}
            maxLength={200}
          />
        </FieldGroup>
        <FieldGroup
          label={
            isNomination
              ? "Why would your friend be a great fit? (optional)"
              : "Why would you be a great fit?"
          }
        >
          <textarea
            id="field-pitch"
            value={form.pitch}
            onChange={(e) => set("pitch", e.target.value)}
            placeholder="Tell us something fun, bold, or irresistible…"
            className={styles.textarea}
          />
        </FieldGroup>
      </div>

      <fieldset
        className={styles.consentSection}
        {...(errors.marketingConsent ? { "data-error": "true" } : {})}
        aria-describedby={
          errors.marketingConsent ? "marketing-consent-error" : undefined
        }
      >
        <legend className={styles.consentQuestion}>
          I grant Garam Masala Dating permission to use any of these responses
          and casting submissions for marketing purposes.
          <span className={styles.requiredMark}>*</span>
        </legend>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="marketingConsent"
              value="yes"
              checked={form.marketingConsent === "yes"}
              onChange={() => set("marketingConsent", "yes")}
              className={styles.radioInput}
              aria-invalid={!!errors.marketingConsent}
            />
            Yes
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="marketingConsent"
              value="no"
              checked={form.marketingConsent === "no"}
              onChange={() => set("marketingConsent", "no")}
              className={styles.radioInput}
              aria-invalid={!!errors.marketingConsent}
            />
            No
          </label>
        </div>
        {errors.marketingConsent && (
          <p
            id="marketing-consent-error"
            className={styles.errorText}
            role="alert"
          >
            {errors.marketingConsent}
          </p>
        )}
        {form.marketingConsent === "no" && (
          <p className={styles.noConsentWarning} role="alert">
            {APPLY_PAGE.noConsentWarning}
          </p>
        )}
      </fieldset>

      <div
        className={styles.consentSection}
        {...(errors.termsAgreed ? { "data-error": "true" } : {})}
      >
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => handleTermsCheckbox(e.target.checked)}
            className={styles.checkInput}
            aria-describedby={errors.termsAgreed ? "terms-error" : undefined}
          />
          <span>
            I agree to the{" "}
            <button
              type="button"
              className={styles.termsLink}
              onClick={(e) => {
                e.stopPropagation();
                setShowTermsModal(true);
              }}
            >
              Terms &amp; Conditions
            </button>
            <span className={styles.requiredMark}>*</span>
          </span>
        </label>
        {errors.termsAgreed && (
          <p id="terms-error" className={styles.errorText} role="alert">
            {errors.termsAgreed}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || form.marketingConsent !== "yes" || !termsAgreed}
        className={styles.submitButton}
      >
        {submitting ? (
          <>
            <Spinner size="sm" label="Submitting..." />
            Submitting…
          </>
        ) : (
          submitLabel
        )}
      </button>

      <p className={styles.disclaimer}>{submissionDisclaimer}</p>
    </>
  );
}
```

- [ ] **Step 2: Replace ApplyPage.tsx with the refactored version**

Replace the entire contents of `src/components/ApplyPage.tsx`. This is identical in behavior — only the form JSX is moved to ContestantFormFields:

```tsx
import { useEffect } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./ApplyPage.module.css";
import { TermsModal } from "./apply/TermsModal";
import { ApplySuccessPanel } from "./apply/ApplySuccessPanel";
import { ContestantFormFields } from "./apply/ContestantFormFields";
import { useApplyForm } from "./apply/useApplyForm";

type NavWithMC = Navigator & {
  modelContext: {
    registerTool: (def: object) => { unregister?: () => void };
  };
};

export default function ApplyPage() {
  return (
    <ErrorBoundary>
      <ApplyPageInner />
    </ErrorBoundary>
  );
}

function ApplyPageInner() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mc =
      "modelContext" in navigator
        ? (navigator as unknown as NavWithMC).modelContext
        : undefined;
    if (typeof mc?.registerTool !== "function") return;
    const tool = mc.registerTool({
      name: "submit-contestant-application",
      description:
        "Submit an application to appear as a contestant on Garam Masala Dating, NYC's #1 live desi comedy dating show. Collects personal details, Instagram handle, location, and optional pitch.",
      inputSchema: {
        type: "object",
        properties: {
          applicationType: {
            type: "string",
            enum: ["self", "nomination"],
            description: "Applying for yourself or nominating someone else",
          },
          fullName: {
            type: "string",
            description: "Full name of the contestant",
          },
          age: {
            type: "integer",
            minimum: 18,
            maximum: 99,
            description: "Age in years",
          },
          gender: { type: "string", description: "Gender identity" },
          sexualOrientation: {
            type: "string",
            description: "Sexual orientation",
          },
          city: {
            type: "string",
            description: "City where the contestant lives",
          },
          instagram: {
            type: "string",
            description: "Instagram handle (without @)",
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address for the contestant",
          },
          phone: { type: "string", description: "Phone number (optional)" },
          pitch: {
            type: "string",
            description: "Why they would be great on the show (optional)",
          },
          type: { type: "string", description: "Application channel or type" },
        },
        required: [
          "applicationType",
          "fullName",
          "age",
          "gender",
          "sexualOrientation",
          "city",
          "instagram",
          "email",
        ],
      },
    });
    return () => {
      tool?.unregister?.();
    };
  }, []);

  const formProps = useApplyForm();

  return (
    <>
      <div
        className={styles.page}
        data-apply-root
        data-submitted={formProps.submitted || undefined}
      >
        <div className={styles.container}>
          {formProps.submitted ? (
            <ApplySuccessPanel />
          ) : (
            <div className={styles.panel}>
              <form onSubmit={formProps.handleSubmit} noValidate>
                <fieldset
                  disabled={formProps.submitting}
                  className={styles.formFieldset}
                >
                  <ContestantFormFields {...formProps} showTypeToggle />
                </fieldset>
              </form>
            </div>
          )}
        </div>
      </div>

      {formProps.showTermsModal && (
        <TermsModal
          onClose={() => formProps.setShowTermsModal(false)}
          onAgree={formProps.agreeToTerms}
        />
      )}

      {formProps.toast && (
        <div
          className={styles.toast}
          data-status={formProps.toast.ok ? "success" : "error"}
          role="alert"
          aria-live="assertive"
        >
          <span>{formProps.toast.msg}</span>
          <button
            onClick={() => formProps.setToast(null)}
            className={styles.toastDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Run existing ApplyPage tests to confirm no regressions**

```bash
npx vitest run src/components/ApplyPage.test.tsx 2>&1 | tail -20
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/apply/ContestantFormFields.tsx src/components/ApplyPage.tsx
git commit -m "refactor(apply): extract ContestantFormFields; add phone field to form"
```

---

### Task 4: Fix admin modal — show email and phone

**Files:**

- Modify: `src/components/admin/ApplicantModal.tsx`
- Modify: `src/components/admin/ApplicantModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/components/admin/ApplicantModal.test.tsx` inside the `describe("ApplicantModal")` block:

```ts
it("displays email as a mailto link", () => {
  render(
    <ApplicantModal
      app={makeApp({ email: "priya@example.com" })}
      {...defaultProps}
    />,
  );
  const link = screen.getByRole("link", { name: "priya@example.com" });
  expect(link).toHaveAttribute("href", "mailto:priya@example.com");
});

it("hides email section when email is not present", () => {
  render(
    <ApplicantModal app={makeApp({ email: undefined })} {...defaultProps} />,
  );
  expect(screen.queryByText("Email")).not.toBeInTheDocument();
});

it("displays phone number when present", () => {
  render(
    <ApplicantModal
      app={makeApp({ phone: "+1 555 123 4567" })}
      {...defaultProps}
    />,
  );
  expect(screen.getByText("+1 555 123 4567")).toBeInTheDocument();
});

it("hides phone section when phone is not present", () => {
  render(
    <ApplicantModal app={makeApp({ phone: undefined })} {...defaultProps} />,
  );
  expect(screen.queryByText("Phone")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/admin/ApplicantModal.test.tsx 2>&1 | tail -20
```

Expected: 4 new tests fail.

- [ ] **Step 3: Update ApplicantModal**

In `src/components/admin/ApplicantModal.tsx`, update the `InfoRow` component to accept an optional `href` prop for link rendering:

```tsx
function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | number;
  href?: string;
}) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className={styles.infoLabel}>{label}</p>
      {href ? (
        <a href={href} className={styles.igLink}>
          {value}
        </a>
      ) : (
        <p className={styles.infoValue}>{value}</p>
      )}
    </div>
  );
}
```

In the `infoGrid` div, add email and phone rows after the existing `InfoRow` entries. Place them after the Location row and before Community:

```tsx
<div className={styles.infoGrid}>
  <InfoRow label="Age" value={app.age} />
  <InfoRow label="Gender" value={app.gender} />
  <InfoRow label="Orientation" value={app.orientation} />
  <InfoRow label="Location" value={formatLocation(app)} />
  <InfoRow
    label="Email"
    value={app.email}
    href={app.email ? `mailto:${app.email}` : undefined}
  />
  <InfoRow label="Phone" value={app.phone} />
  <InfoRow label="Height" value={app.height} />
  <InfoRow label="Community" value={app.community} />
  <InfoRow label="Income" value={app.income} />
  <InfoRow label="Application Type" value={app.applicationType} />
  {app.applicationType === "Nomination" && (
    <InfoRow label="Referred by" value={app.referrerName} />
  )}
  {app.seenShowBefore !== undefined && (
    <InfoRow
      label="Seen Show Before"
      value={app.seenShowBefore ? "Yes" : "No"}
    />
  )}
  {app.type && <InfoRow label="Their Type" value={app.type} />}
  {app.marketingConsent && (
    <InfoRow
      label="Marketing Consent"
      value={app.marketingConsent === "yes" ? "Yes" : "No"}
    />
  )}
  <div>
    <p className={styles.infoLabel}>Instagram</p>
    <a
      href={`https://instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.igLink}
    >
      @{handle}
    </a>
  </div>
</div>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/admin/ApplicantModal.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ApplicantModal.tsx src/components/admin/ApplicantModal.test.tsx
git commit -m "feat(admin): show email and phone in applicant modal"
```

---

### Task 5: Add phone to email notification

**Files:**

- Modify: `src/pages/api/notify-application.ts`
- Modify: `test/notify-application.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `test/notify-application.test.ts` inside the `describe` block:

```ts
it("includes phone in email HTML when provided", async () => {
  const res = await POST(
    makeContext(makeRequest({ ...validBody, phone: "+1 555 123 4567" })),
  );
  expect(res.status).toBe(200);
  const sendCall = mockSend.mock.calls[0][0];
  expect(sendCall.html).toContain("+1 555 123 4567");
});

it("omits phone row from email HTML when phone is not provided", async () => {
  const res = await POST(makeContext(makeRequest(validBody)));
  expect(res.status).toBe(200);
  const sendCall = mockSend.mock.calls[0][0];
  expect(sendCall.html).not.toContain("Phone");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run test/notify-application.test.ts 2>&1 | tail -20
```

Expected: 2 new tests fail.

- [ ] **Step 3: Update notify-application.ts**

In `src/pages/api/notify-application.ts`, add `phone` to the `ApplicationNotification` interface:

```ts
interface ApplicationNotification {
  name: string;
  age: number;
  gender: string;
  orientation: string;
  city: string;
  state: string;
  country: string;
  email: string;
  phone?: string; // ← new
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName: string;
  pitch: string;
  photoUrl: string;
}
```

In `buildEmailHtml`, add a phone row after the email row. Replace the existing `rows` array with:

```ts
const rows: [string, string][] = [
  ["Name", escapeHtml(data.name)],
  ["Age", String(data.age)],
  ["Gender", escapeHtml(data.gender)],
  ["Orientation", escapeHtml(data.orientation)],
  ["Location", location],
  [
    "Email",
    data.email
      ? `<a href="mailto:${escapeHtml(data.email)}" style="color:#DC2626;">${escapeHtml(data.email)}</a>`
      : "",
  ],
  ...(data.phone
    ? ([["Phone", escapeHtml(data.phone)]] as [string, string][])
    : []),
  [
    "Instagram",
    `<a href="https://instagram.com/${escapeHtml(data.instagram)}" style="color:#DC2626;">@${escapeHtml(data.instagram)}</a>`,
  ],
  ["Community", escapeHtml(data.community)],
  ["Income", escapeHtml(data.income)],
];
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run test/notify-application.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/notify-application.ts test/notify-application.test.ts
git commit -m "feat(api): add phone field to application email notification"
```

---

### Task 6: Add PITCH_FRIEND_PAGE copy

**Files:**

- Modify: `src/data/copy.ts`

- [ ] **Step 1: Add PITCH_FRIEND_PAGE export**

In `src/data/copy.ts`, add this block directly after the `APPLY_PAGE` export:

```ts
export const PITCH_FRIEND_PAGE = {
  title: "Know Someone Who'd Be Perfect?",
  subtitle: "Nominate a friend for NYC's #1 live desi dating show",
  introText:
    "Think your friend would light up a stage, flirt under pressure, and maybe fall in love in front of 250 people? Fill out the form below and make their case. We'll take it from there.",
  requirements: [
    "18+",
    "Comfortable on camera",
    "Single (for the night 👀)",
  ] as readonly string[],
} as const;
```

- [ ] **Step 2: Verify no build errors**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/copy.ts
git commit -m "feat(copy): add PITCH_FRIEND_PAGE copy block"
```

---

### Task 7: Create PitchFriendPage component

**Files:**

- Create: `src/components/PitchFriendPage.tsx`

- [ ] **Step 1: Create PitchFriendPage.tsx**

Create `src/components/PitchFriendPage.tsx`:

```tsx
import { ErrorBoundary } from "./ErrorBoundary";
import styles from "./ApplyPage.module.css";
import { TermsModal } from "./apply/TermsModal";
import { ApplySuccessPanel } from "./apply/ApplySuccessPanel";
import { ContestantFormFields } from "./apply/ContestantFormFields";
import { useApplyForm } from "./apply/useApplyForm";

export default function PitchFriendPage() {
  return (
    <ErrorBoundary>
      <PitchFriendPageInner />
    </ErrorBoundary>
  );
}

function PitchFriendPageInner() {
  const formProps = useApplyForm({ initialType: "Nomination" });

  return (
    <>
      <div
        className={styles.page}
        data-apply-root
        data-submitted={formProps.submitted || undefined}
      >
        <div className={styles.container}>
          {formProps.submitted ? (
            <ApplySuccessPanel />
          ) : (
            <div className={styles.panel}>
              <form onSubmit={formProps.handleSubmit} noValidate>
                <fieldset
                  disabled={formProps.submitting}
                  className={styles.formFieldset}
                >
                  <ContestantFormFields
                    {...formProps}
                    submitLabel="Submit Nomination"
                  />
                </fieldset>
              </form>
            </div>
          )}
        </div>
      </div>

      {formProps.showTermsModal && (
        <TermsModal
          onClose={() => formProps.setShowTermsModal(false)}
          onAgree={formProps.agreeToTerms}
        />
      )}

      {formProps.toast && (
        <div
          className={styles.toast}
          data-status={formProps.toast.ok ? "success" : "error"}
          role="alert"
          aria-live="assertive"
        >
          <span>{formProps.toast.msg}</span>
          <button
            onClick={() => formProps.setToast(null)}
            className={styles.toastDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PitchFriendPage.tsx
git commit -m "feat(pitch): add PitchFriendPage React island (nomination-locked)"
```

---

### Task 8: Create pitch-your-friend.astro page

**Files:**

- Create: `src/pages/pitch-your-friend.astro`

- [ ] **Step 1: Create the Astro page**

Create `src/pages/pitch-your-friend.astro`:

```astro
---
import BaseLayout from "@/layouts/BaseLayout.astro";
import { buildBreadcrumbJsonLd } from "@/utils/breadcrumbs";
import PitchFriendPage from "@/components/PitchFriendPage";
import { PITCH_FRIEND_PAGE } from "@/data/copy";

const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "Home", url: "https://garammasaladating.com/" },
  { name: "Nominate a Friend" },
]);
---

<BaseLayout
  title="Nominate a Friend | Garam Masala Dating"
  description="Know someone who'd be perfect on a live comedy dating show? Nominate them for Garam Masala Dating."
>
  <Fragment slot="head">
    <script type="application/ld+json" set:html={breadcrumbJsonLd} />
  </Fragment>

  <main id="main-content" class="apply-main">
    <img
      class="apply-bg"
      src="/images/hero/hero.webp"
      alt=""
      width="1200"
      height="800"
      aria-hidden="true"
      loading="eager"
    />

    <div class="apply-static-wrapper">
      <div class="apply-skeleton-container">
        <div class="apply-static-header">
          <div class="apply-skeleton-header">
            <button class="apply-back-btn" onclick="history.back()"
              >← Back</button
            >
          </div>
          <div class="apply-skeleton-title-area">
            <h1 class="apply-skeleton-title">
              {PITCH_FRIEND_PAGE.title}
            </h1>
            <p class="apply-skeleton-subtitle">
              {PITCH_FRIEND_PAGE.subtitle}
            </p>
          </div>
        </div>

        <div class="apply-intro-static">
          <div class="apply-skeleton-intro">
            <p>{PITCH_FRIEND_PAGE.introText}</p>
            <p class="apply-skeleton-must-be">The ideal candidate:</p>
            <ul class="apply-skeleton-reqs">
              {PITCH_FRIEND_PAGE.requirements.map((r) => <li>{r}</li>)}
            </ul>
          </div>
        </div>

        <div class="apply-skeleton-form" aria-hidden="true">
          <h2 class="apply-skeleton-section">About Your Friend</h2>

          <div class="apply-skeleton-shimmer">
            <div class="shimmer-bar"></div>
            <div class="shimmer-bar shimmer-bar--medium"></div>
            <div class="shimmer-bar"></div>
            <div class="shimmer-bar shimmer-bar--short"></div>
          </div>
        </div>
      </div>

      <PitchFriendPage client:only="react" />
    </div>
  </main>
</BaseLayout>

<style is:global>
  .apply-main:has([data-apply-root]) .apply-skeleton-form {
    display: none;
  }
  .apply-main:has([data-submitted]) .apply-static-header,
  .apply-main:has([data-submitted]) .apply-intro-static {
    display: none;
  }
</style>

<style>
  .apply-main {
    position: relative;
    overflow: hidden;
    min-height: 100vh;
  }

  .apply-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
    display: block;
    z-index: 0;
    opacity: 0.06;
    pointer-events: none;
  }

  .apply-static-wrapper {
    position: relative;
    z-index: 1;
  }

  .apply-skeleton-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .apply-static-header {
    padding-top: 20px;
  }

  .apply-skeleton-header {
    margin-bottom: 8px;
    min-height: var(--touch-target);
    display: flex;
    align-items: center;
  }

  .apply-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--charcoal);
    font-family: var(--font-body);
    font-size: 16px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    min-height: var(--touch-target);
  }

  .apply-skeleton-title-area {
    text-align: center;
    margin-bottom: 24px;
  }

  .apply-skeleton-title {
    font-family: var(--font-playfair);
    font-size: clamp(36px, 5vw, 48px);
    font-weight: 700;
    color: var(--charcoal);
    line-height: 1.1;
    margin: 0 0 10px;
  }

  .apply-skeleton-subtitle {
    font-family: var(--font-body);
    font-size: 18px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .apply-skeleton-intro {
    margin-bottom: 32px;
    font-family: var(--font-body);
    font-size: 15px;
    color: #3d3532;
    line-height: 1.6;
    text-align: center;
  }

  .apply-skeleton-intro p {
    margin: 0 0 12px;
  }

  .apply-skeleton-must-be {
    font-weight: 700;
    margin-bottom: 4px;
  }

  .apply-skeleton-reqs {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .apply-skeleton-reqs li::before {
    content: "• ";
    color: var(--brand-red);
    font-weight: 700;
  }

  .apply-skeleton-section {
    font-family: var(--font-playfair);
    font-size: 28px;
    font-weight: 600;
    color: var(--charcoal);
    margin: 0 0 20px;
    padding-bottom: 12px;
  }

  .apply-skeleton-section::after {
    content: "";
    display: block;
    width: 48px;
    height: 1px;
    background: rgba(var(--brand-red-rgb), 0.3);
    margin-top: 12px;
  }

  @keyframes shimmer-sweep {
    0% {
      background-position: -400px 0;
    }
    100% {
      background-position: 400px 0;
    }
  }

  .apply-skeleton-shimmer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shimmer-bar {
    height: 52px;
    width: 100%;
    border-radius: 12px;
    background-color: #ebebeb;
    background-image: linear-gradient(
      90deg,
      #ebebeb 0px,
      #f5f5f5 40px,
      #ebebeb 80px
    );
    background-size: 400px 100%;
    background-repeat: no-repeat;
    animation: shimmer-sweep 1.4s ease-in-out infinite;
  }

  .shimmer-bar--medium {
    width: 75%;
  }
  .shimmer-bar--short {
    width: 55%;
  }

  @media (prefers-reduced-motion: reduce) {
    .shimmer-bar {
      animation: none;
      background-image: none;
    }
  }
</style>
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/pitch-your-friend.astro src/components/PitchFriendPage.tsx
git commit -m "feat(pages): add /pitch-your-friend nomination page"
```

---

## Spec Coverage Check

| Spec requirement                                         | Task |
| -------------------------------------------------------- | ---- |
| `/pitch-your-friend` URL                                 | 8    |
| No Self/Nomination toggle on pitch page                  | 7    |
| Nomination mode locked (initialType)                     | 2    |
| Phone field in both apply forms                          | 3    |
| Phone stored in Firestore                                | 2    |
| Phone in email notification                              | 5    |
| Admin modal shows email                                  | 4    |
| Admin modal shows phone                                  | 4    |
| `seenShowBefore` question relabeled for nominations      | 3    |
| "About Your Friend" section always visible on pitch page | 7    |
| "Your Info" section always visible on pitch page         | 7    |
| Instagram placeholder "yourfriendshandle" on pitch page  | 3    |
| Submit button says "Submit Nomination" on pitch page     | 7    |
| PITCH_FRIEND_PAGE copy in data/copy.ts                   | 6    |
| Different meta title/description/OG                      | 8    |
| Breadcrumb JSON-LD: Home → Nominate a Friend             | 8    |
| apply.astro untouched                                    | All  |
| No dashes in user-facing copy                            | 6/8  |
