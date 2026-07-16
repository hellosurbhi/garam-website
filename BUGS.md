# Bugs

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
