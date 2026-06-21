# Pitch Your Friend Page — Design Spec

Date: 2026-06-20

## Goal

Add `/pitch-your-friend` — a dedicated nomination page where someone fills out a form
about their friend to be cast on Garam Masala Dating. The form submits to the same
Firestore collection and email API as `/apply`. The `/apply` page is not changed.

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

| File                                   | Change                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/components/ApplyPage.tsx`         | Replace inline form JSX with `<ContestantFormFields {...formProps} showTypeToggle />`. Zero behavior change. |
| `src/components/apply/useApplyForm.ts` | Add optional `{ initialType?: "Self" \| "Nomination" }` param, default `"Self"`.                             |
| `src/data/copy.ts`                     | Add `PITCH_FRIEND_PAGE` copy block.                                                                          |

### Untouched

- `src/pages/apply.astro` — not modified at all
- `src/pages/api/notify-application.ts` — already handles both applicationType values
- `src/components/ApplyPage.module.css` — reused by both components, no changes
- Firestore schema — no change

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
