# Bugs

## Deferred

### [MEDIUM] Home creators avatars not upgraded to larger host photos

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeCreators.astro`
- **Severity:** Medium
- **Deferred:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Note if revisited: `hosts/wyatt.avif` source is 269x290, which caps avatars at about 160px before visible upscaling. Need a higher-res Wyatt photo before this can be fixed regardless of redesign.

### [MEDIUM] Hosts page still uses small individual avatar images

- **Date:** 2026-04-08
- **File:** `src/pages/hosts.astro`
- **Severity:** Medium
- **Deferred:** Blocked on higher-res Wyatt photo (same constraint as HomeCreators above).

### [MEDIUM] Experience section photo placement was missed

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeExperience.astro`
- **Severity:** Medium
- **Deferred:** Address in the active rebrand when the Experience section layout is finalized.

### [MEDIUM] Testimonials accent photo was not added

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeTestimonials.astro`
- **Severity:** Medium
- **Deferred:** Address in the active rebrand when the Testimonials section layout is finalized.

### [MEDIUM] Journal decorative cupid artwork not implemented

- **Date:** 2026-04-08
- **File:** `src/pages/journal/index.astro`
- **Severity:** Medium
- **Deferred:** `ai-art/cupid-garden.webp` asset exists unused. Wire into journal index hero area. Not homepage-specific; can be done independently of the rebrand.

### [LOW] Popup CTA copy uses weaker pre-audit wording

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`
- **Severity:** Low
- **Blocked:** No final offer exists yet. Once the actual incentive is confirmed, replace popup headline, supporting copy and CTA with offer-based wording (e.g. "Get My 15% Off Code").

## Won't fix / Resolved by design

### [MEDIUM] Home hero photo background

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeHero.astro`
- **Resolution:** Won't fix. Owner directive: hero shader plus gradient is intentional and stays as designed. No photo layer will be added.

### [LOW] Leads collection allows unauthenticated phone updates

- **Date:** 2026-04-09
- **File:** `firestore.rules:45`
- **Resolution:** Resolved by design. The step-2 phone capture runs from the browser without auth — the caller needs the Firestore doc ID returned by `/api/capture-lead` to reach this path. Doc ID as implicit ownership proof plus field-only restriction. Comment added to `firestore.rules` explaining the design.

### [LOW] Contact email usage is inconsistent across pages

- **Date:** 2026-04-08
- **File:** `src/pages/faq.astro`, `src/pages/links.astro`
- **Resolution:** Resolved by design. `contact@garammasaladating.com` is the canonical public contact (schema, legal, socials, llms.txt, FAQ footer). `press@garammasaladating.com` is intentionally used only in press/partnership-specific contexts (FAQ collaboration answer, links page press section). The two-inbox model is deliberate.
