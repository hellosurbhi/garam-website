# Pitch Your Friend Page — Design Spec

Date: 2026-06-20

## Goal

1. Add `/pitch-your-friend` — a dedicated nomination page (friend nomination, no self-apply toggle).
2. Add a **phone number field** to both `/apply` and `/pitch-your-friend`.
3. Fix the **admin modal** to show all applicant fields, including email (currently missing) and the new phone field.

## URL

`/pitch-your-friend`

## Architecture

### New files

| File                                            | Purpose                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/pitch-your-friend.astro`             | Astro page: meta, breadcrumb JSON-LD, static header/intro, React island                                                        |
| `src/components/apply/ContestantFormFields.tsx` | Extracted shared form JSX — the toggle, all field groups, consent, submit                                                      |
| `src/components/PitchFriendPage.tsx`            | Thin React island: `useApplyForm({ initialType: "Nomination" })`, renders `ContestantFormFields` with `showTypeToggle={false}` |

### Modified files (minimal)

| File                                      | Change                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/components/ApplyPage.tsx`            | Replace inline form JSX with `<ContestantFormFields {...formProps} showTypeToggle />`. Zero behavior change.           |
| `src/components/apply/useApplyForm.ts`    | Add optional `{ initialType?: "Self" \| "Nomination" }` param, default `"Self"`. Add `phone` to `FormState`/`INITIAL`. |
| `src/data/copy.ts`                        | Add `PITCH_FRIEND_PAGE` copy block.                                                                                    |
| `src/types/application.ts`                | Add `phone?: string` to `Application` interface.                                                                       |
| `src/components/admin/ApplicantModal.tsx` | Add `email` (as mailto link) and `phone` `InfoRow` entries in the info grid.                                           |
| `src/pages/api/notify-application.ts`     | Add `phone` to `ApplicationNotification` and email template rows.                                                      |

### Untouched

- `src/pages/apply.astro` — not modified at all
- `src/components/ApplyPage.module.css` — reused by both components, no changes
- Firestore schema — no migration needed, `phone` is optional and Firestore is schemaless

## ContestantFormFields component

**Props:**

```ts
interface ContestantFormFieldsProps {
  form: FormState;
  photoPreview: string | null;
  errors: FormErrors;
  submitting: boolean;
  termsAgreed: boolean;
  showTermsModal: boolean;
  setShowTermsModal: (v: boolean) => void;
  cityInput: string;
  handleCityInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (field: keyof FormState, value: string) => void;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTermsCheckbox: (checked: boolean) => void;
  agreeToTerms: () => void;
  // Control props
  showTypeToggle?: boolean; // default false — ApplyPage passes true
  submitLabel?: string; // default "Submit Application"
}
```

**Behavior:**

- When `showTypeToggle` is true (ApplyPage): renders the "I am applying… For myself / For a friend" toggle. Section titles and referrer field behave conditionally as today.
- When `showTypeToggle` is false (PitchFriendPage): toggle is not rendered. `form.applicationType` is always `"Nomination"`, so "About Your Friend" and "Your Info" sections are always visible.

## useApplyForm change

```ts
export function useApplyForm(options?: {
  initialType?: "Self" | "Nomination";
}) {
  const initialType = options?.initialType ?? "Self";
  // INITIAL.applicationType replaced with initialType
}
```

Non-breaking. Default is unchanged.

## Page content

### pitch-your-friend.astro

```
<BaseLayout
  title="Nominate a Friend | Garam Masala Dating"
  description="Know someone who'd be perfect on a live comedy dating show? Nominate them for Garam Masala Dating."
>
```

Breadcrumb JSON-LD: Home → Nominate a Friend

Static header (same structure as apply.astro):

- Back button (history.back())
- h1: "Know Someone Who'd Be Perfect?"
- Subtitle: "Nominate a friend for NYC's #1 live desi dating show"

Static intro:

- Intro text: "Think your friend would light up a stage, flirt under pressure, and maybe fall in love in front of 250 people? Fill out the form below and make their case. We'll take it from there."
- "The ideal candidate:" list: same three bullets as /apply (18+, comfortable on camera, single for the night)

Skeleton: same shimmer pattern as apply.astro (but shows "About Your Friend" as the section label, no type toggle in skeleton).

React island: `<PitchFriendPage client:only="react" />`

### Form copy differences vs /apply

| Element                 | /apply                                                                     | /pitch-your-friend                                            |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Type toggle             | Shown                                                                      | Hidden                                                        |
| About section title     | "About You" or "About Your Friend"                                         | Always "About Your Friend"                                    |
| seenShowBefore question | "Have you attended a Garam Masala Dating show before?"                     | "Has your friend attended a Garam Masala Dating show before?" |
| Instagram placeholder   | "yourhandle" or "yourfriendshandle"                                        | Always "yourfriendshandle"                                    |
| Your Info section       | Shown only in nomination mode                                              | Always shown                                                  |
| Pitch label             | "Why would you be a great fit?" or "Why would your friend be a great fit?" | Always "Why would your friend be a great fit?"                |
| Submit button           | "Submit Application"                                                       | "Submit Nomination"                                           |

Submit button label is a prop on `ContestantFormFields`: `submitLabel?: string` (default "Submit Application").

### Success state

Reuses `ApplySuccessPanel` unchanged. The ticket upsell ("come steal the show") is
relevant for the nominator.

## Phone number field

**In the form (both `/apply` and `/pitch-your-friend`):**

- Label: "Phone Number (optional)"
- Input type: `tel`, `inputMode="tel"`, `autoComplete="tel"`
- Placed after the Email field
- Optional — no validation beyond being a non-empty string if provided
- Stored as `phone` on the Firestore document

**In `FormState` / `useApplyForm`:**

```ts
phone: string; // added to FormState, default ""
```

**In `ContestantFormFields`:** renders after the Email `<FieldGroup>`, using the same `styles.input` class.

**In admin modal (`ApplicantModal.tsx`):**

- Add `InfoRow label="Email"` rendered as a `mailto:` anchor (same pattern as the existing Instagram link)
- Add `InfoRow label="Phone"` below email, plain text (no special formatting)
- Both conditionally rendered: only shown when the value exists

**In email notification (`notify-application.ts`):**

- Add `phone?: string` to `ApplicationNotification`
- Add a "Phone" row to the email table, rendered only when `phone` is truthy

## Analytics

`trackLeadEvent("apply_submitted")` payload already includes `applicationType: "Nomination"`,
so PostHog distinguishes nominations from self-applications across both pages.
No additional tracking changes needed.

## SEO

`/pitch-your-friend` is a public page included in the auto-generated sitemap.
It gets its own unique title, description, and OG tags via BaseLayout.

## No-dash rule

All copy must follow the site rule: no em dash, en dash, double dash, or separator dash
anywhere in user-facing text.
