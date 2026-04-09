# Enhancements Backlog

Items from the GMD website audit checklists (site audit, codebase cleanup, conversion audit, mobile audit) that need content, design decisions, or external work. Sorted by impact.

## Critical (Needs Content Assets)

### Add video section on homepage

- **Why:** Site claims "10M+ Views" but embeds zero videos. A 60-second clip converts more skeptics than 1,000 words of copy.
- **How:** Create `src/components/home/HomeVideo.astro` with YouTube facade pattern (thumbnail + play button, load iframe on click). Position between Experience and Shows sections. Add VideoObject JSON-LD.
- **Needs:** YouTube video URL / show footage clip

## High Impact

### Optimize surbhi.png to AVIF/WebP

- **File:** `public/images/surbhi.png` (595 KB)
- **Why:** Only host photo without modern format. AVIF version would be ~30KB.
- **How:** Run through squoosh.app or `sharp` to generate surbhi.avif and surbhi.webp. Update references in HomeCreators.astro and hosts.astro.

## Medium Impact

### IMDb listing for the show

- **Why:** Triggers Google Knowledge Panel recognition. Establishes GMD as a distinct entertainment entity.
- **How:** Create IMDb listing with: show name, seasons, episodes, Surbhi and Wyatt as hosts.

### Wikidata entry

- **Why:** Further reinforces entity recognition in Google Knowledge Graph. Disambiguates from the spice blend.
- **How:** Create Wikidata entry for "Garam Masala Dating" as a live comedy dating show.

### Google Business Profile

- **Why:** Enables local search visibility, reviews, and Knowledge Panel.
- **How:** Set up and verify at business.google.com.

### LinkedIn Company Page

- **Why:** Cross-links improve entity recognition.
- **How:** Create page at linkedin.com/company, link to garammasaladating.com.

### Add redirect rules for old URLs

- **File:** `vercel.json`
- **Why:** If any URLs changed during the Astro migration, old links will 404.
- **How:** Audit old sitemap vs new sitemap, add redirects for any changed paths.

## Low Impact

### Cross-browser testing checklist

- Test in: Chrome, Safari (iOS/macOS), Firefox, Samsung Internet, Instagram in-app browser
- Instagram in-app browser is highest priority — most traffic comes from IG bio link
- Check: backdrop-filter, sticky positioning, smooth scrolling, font rendering

### AggregateRating schema on testimonials

- **Why:** Could trigger rich result stars in search.
- **How:** Add AggregateRating JSON-LD to the testimonials section if enough data points exist.

### Astro Content Collections for blog/journal

- **Why:** Blog data is currently in `src/data/journal.ts` as inline objects. Content Collections (`src/content/`) would give type-safe frontmatter, auto slug generation, and better build perf.
- **How:** Create `src/content/journal/` with .md files, define collection schema, update `[slug].astro` to use `getCollection()`.

### Astro Image component for auto-optimization

- **Why:** `astro:assets` `<Image>` auto-generates responsive sizes, converts to WebP/AVIF, adds width/height. Eliminates manual image optimization.
- **How:** Replace `<img>` tags in Astro components with `<Image>` imports. React islands would still use `<img>`.

### Shared UI components + field config data file (apply form)

- **Why:** Apply form fields (labels, placeholders, option lists) are hardcoded in JSX. A `src/data/applyForm.ts` config + shared input primitives in `components/ui/` would follow the workspace pattern of separating content from markup.
- **How:** Extract field metadata (labels, placeholders, options for gender/orientation/community/income) to `src/data/applyForm.ts`. Create `components/ui/Input.tsx`, `components/ui/Select.tsx`, `components/ui/RadioGroup.tsx` used by the apply form and any future forms. Low urgency — current split into `apply/` modules is already a significant improvement.

### Shared UI components (Button, Section wrapper)

- **Why:** Buttons and section wrappers are duplicated across pages with scoped styles. A shared component would reduce drift.
- **How:** Create `src/components/ui/Button.astro` with primary/outline/white variants. Low urgency — current duplication is manageable since each page has scoped styles.

### Prettier configuration

- **Why:** ESLint handles lint rules but not opinionated formatting (trailing commas, quote style, line width). Prettier would enforce consistency.
- **How:** `npm i -D prettier`, add `.prettierrc`, add to lint-staged. Optional — ESLint `--fix` already handles most formatting.

### Unify FAQ content between home page and /faq

- **Why:** HomeFAQ (from `copy.ts`) and /faq page have overlapping questions with different answer wording.
- **How:** Share a data source or intentionally differentiate (short on home, detailed on /faq).

# From PR #11 — Site Rewrite

## Add loading="lazy" to admin photo images

- **File:** `src/components/admin/ApplicantModal.tsx:97`
- **Source:** CodeRabbit PR #11
- **Comment:** Both `<img>` elements (lines 97 and 111) for user-uploaded photos are missing `loading="lazy"`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3046995940

## Move HomeShows copy into src/data/

- **File:** `src/components/home/HomeShows.astro:26`
- **Source:** CodeRabbit PR #11
- **Comment:** Section heading, CTA labels, fallback strings, modal copy, placeholders, and aria labels are all hardcoded — should be sourced from a data module.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304629

## Split request-city flow out of HomeShows

- **File:** `src/components/home/HomeShows.astro:209`
- **Source:** CodeRabbit PR #11
- **Comment:** HomeShows.astro exceeds 150-line cap — the request-city dialog/script/styles are a clean extraction point.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304637

## Add aria-hidden to HomeShows close icon SVG

- **File:** `src/components/home/HomeShows.astro:72`
- **Source:** CodeRabbit PR #11
- **Comment:** Close button already has `aria-label="Close"`, so the SVG should be `aria-hidden="true"` (decorative only).
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304649

## Replace hardcoded colors with CSS tokens in HomeShows

- **File:** `src/components/home/HomeShows.astro:231`
- **Source:** CodeRabbit PR #11
- **Comment:** Component CSS uses `white` and `rgba(...)` literals instead of shared design tokens from `:root`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304673

## Increase HomeShows modal close button hit area

- **File:** `src/components/home/HomeShows.astro:405`
- **Source:** CodeRabbit PR #11
- **Comment:** 20x20 icon with 4px padding yields ~28x28 effective target — below the 48x48 minimum for touch.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304678

## Add :focus-visible to HomeShows modal inputs

- **File:** `src/components/home/HomeShows.astro:431`
- **Source:** CodeRabbit PR #11
- **Comment:** `outline: none` removes browser focus indicator with only a subtle border-color change on `:focus` — needs explicit `:focus-visible` treatment.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304684

## Replace hardcoded white in HomeVideo

- **File:** `src/components/home/HomeVideo.astro:84`
- **Source:** CodeRabbit PR #11
- **Comment:** `background: white` should use `var(--off-white)` or another CSS custom property.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304694

## Move ApplyPage form copy into src/data/

- **File:** `src/components/ApplyPage.tsx:78`
- **Source:** CodeRabbit PR #11
- **Comment:** Titles, labels, placeholders, option text, helper copy, consent copy, and CTA strings are hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341272

## FieldGroup/react-select accessibility wiring

- **File:** `src/components/ApplyPage.tsx:256`
- **Source:** CodeRabbit PR #11
- **Comment:** FieldGroup and react-select controls need proper accessibility attribute wiring.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341275

## Add aria-invalid/aria-describedby to remaining apply form fields

- **File:** `src/components/ApplyPage.tsx:275`
- **Source:** CodeRabbit PR #11
- **Comment:** Height, Community, and Income fields pass `error` to FieldGroup but never set `aria-invalid`/`aria-describedby` like the earlier inputs do.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341283

## Move HomeHero hardcoded text into src/data/

- **File:** `src/components/home/HomeHero.astro:37`
- **Source:** CodeRabbit PR #11
- **Comment:** Hero eyebrow, headline, subtext, and CTA labels are all hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341285

## Use nyOffset utility for timezone-aware event end times

- **File:** `src/components/home/HomeHero.astro:85`
- **Source:** CodeRabbit PR #11
- **Comment:** `getEventEnd` parses dates as local time, but events are in Eastern Time — for users outside ET the pill may hide at the wrong time.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341289

## Fix font-size below 16px on interactive elements (iOS auto-zoom)

- **File:** `src/components/home/HomeHero.astro:224`
- **Source:** CodeRabbit PR #11
- **Comment:** `.next-show-pill` is 13px (12px at narrow), `.btn` drops to 14px at <=390px — all below the 16px minimum for interactive elements to avoid iOS auto-zoom.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341294

## Split HomeVideo component (>150 lines)

- **File:** `src/components/home/HomeVideo.astro:184`
- **Source:** CodeRabbit PR #11
- **Comment:** File is 184 lines — extract reels block and client script into smaller components/modules.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341297

## Move HomeVideo user-facing copy into src/data/

- **File:** `src/components/home/HomeVideo.astro:10`
- **Source:** CodeRabbit PR #11
- **Comment:** "Watch" text, heading, aria-label, alt text, and "Watch on Instagram" are hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341298

## Add aria-describedby to request-city form fields

- **File:** `src/components/home/HomeShows.astro:83`
- **Source:** CodeRabbit PR #11
- **Comment:** Neither city input references `#city-form-error` via `aria-describedby` — validation message is disconnected from the field.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901235

## Guard city autocomplete against API failure + disable submit during write

- **File:** `src/components/home/HomeShows.astro:170`
- **Source:** CodeRabbit PR #11
- **Comment:** If `/api/city-search` 500s or user is offline, submit rejects before the manual fallback, and the still-enabled button can create duplicate leads docs on repeat clicks.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901240

## Add aria-describedby on newsletter signup fields

- **File:** `src/components/home/HomeSignup.astro:14`
- **Source:** CodeRabbit PR #11
- **Comment:** Error alerts are rendered but neither `#nl-email` nor `#nl-phone` points back to them via `aria-describedby`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901261

## Move NotifyModal copy into src/data/ + split component

- **File:** `src/components/NotifyModal.astro:184`
- **Source:** CodeRabbit PR #11
- **Comment:** Labels, placeholders, and error strings are inline. Component carries copy, Firestore/analytics behavior, and styles — should be split.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901270

## Finish NotifyModal inline error accessibility wiring

- **File:** `src/components/NotifyModal.astro:11`
- **Source:** CodeRabbit PR #11
- **Comment:** Close button SVG needs `aria-hidden`, inputs need `aria-describedby` for error text, error elements should use `role="alert"`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901276

## Reset NotifyModal state on reopen

- **File:** `src/components/NotifyModal.astro:76`
- **Source:** CodeRabbit PR #11
- **Comment:** Only `#notify-error` and visibility flags are reset — email, phone, and phone-error keep previous state, so reopening shows stale input.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901287

---

# From CLS Audit & Performance (formerly ENHANCEMENT.md)

## Prefetch/preload key pages + skeleton loaders to eliminate CLS

**Priority:** High
**Logged:** 2026-04-07

### Problem

The Apply and Get Tickets pages take noticeable time to load on first navigation. There is no skeleton or placeholder UI, so the page jumps from blank → content (CLS). These are the two highest-traffic destinations from the homepage nav.

### What to do

**1. Prefetch Apply and Tickets on homepage load**

Add `<link rel="prefetch">` tags in `BaseLayout.astro` (or the homepage `index.astro`) so the browser fetches those pages in the background while the user is on the homepage:

```html
<link rel="prefetch" href="/apply" /> <link rel="prefetch" href="/tickets" />
```

For Astro pages, `prefetch` is enough — no JS chunk prefetching needed since both pages are SSG.

Alternatively, use Astro's built-in prefetch:

- Enable `prefetch: true` in `astro.config.mjs`
- Add `data-astro-prefetch` to the nav links in `HomeNav.astro` and `PageNav.astro`

**2. Skeleton loaders on Apply page**

The Apply page hydrates a React island (`ApplyPage.tsx`) — there's a gap between HTML arriving and the form being interactive. Add a CSS skeleton that matches the form layout:

- Show the skeleton in the static Astro shell (`apply.astro`) until React hydrates
- Use `client:visible` or `client:idle` directive instead of `client:load` to defer hydration if above-the-fold content doesn't need it immediately
- Skeleton should reserve the exact height of the form to prevent CLS

**3. Skeleton on Tickets page**

Similar to Apply — if any dynamic content loads after HTML, add a skeleton placeholder that reserves layout space.

### Files to touch

- `src/layouts/BaseLayout.astro` — add prefetch link tags
- `src/components/home/HomeNav.astro` and `src/components/layout/PageNav.astro` — add `data-astro-prefetch` to Apply and Tickets links
- `src/pages/apply.astro` — add skeleton shell / adjust client directive
- `src/pages/tickets.astro` — add skeleton shell if needed
- `astro.config.mjs` — enable prefetch integration

### Notes

- Do NOT add `rel="preload"` (that's for critical resources on the current page). Use `rel="prefetch"` (background, lower priority).
- Test that prefetch doesn't increase LCP on the homepage (it should be fine since prefetch is low-priority).
- The goal is zero visible layout shift when navigating to Apply or Tickets from any page.

---

## Full-site CLS audit

**Priority:** Medium
**Logged:** 2026-04-07

Audit of all Cumulative Layout Shift sources across the site. 13 instances identified.

### HIGH — Fix these first (user-visible, happens in primary flows)

| #   | Location                                             | Trigger                                                                                                  | Fix                                                                                                                                       |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/pages/apply.astro` + `ApplyPage.tsx`            | React island hydrates after static HTML → form renders below a blank stub                                | Add height-reserving CSS skeleton in `apply.astro` Astro shell; switch to `client:visible`                                                |
| 2   | `src/components/admin/ApplicantModal.tsx`            | Error message inserted above form fields when validation fires → shifts fields down                      | Reserve space with `min-height` on the error container; always render it (empty), toggle visibility only                                  |
| 3   | `src/pages/apply.astro` (photo upload)               | Photo thumbnail appears after upload → section height changes                                            | Pre-reserve thumbnail slot with a fixed-size placeholder div before upload completes                                                      |
| 4   | `src/pages/apply.astro` (nomination section)         | Nomination fields revealed via `data-reveal` / `hidden` toggle → content below shifts                    | Use `max-height` / `overflow: hidden` transition instead of `hidden` attribute; reserve max possible height                               |
| 5   | `src/hooks/useGeoData.ts` → apply form geo dropdowns | State dropdown populates after country selected → city dropdown appears after state → double CLS cascade | Render all three dropdowns always (empty/disabled state); never insert new DOM nodes on selection                                         |
| 6   | Apply page terms modal                               | `document.body` scroll-lock (`overflow: hidden`) removes scrollbar → body shifts right                   | Add `padding-right: var(--scrollbar-width)` to body when locking; measure with `window.innerWidth - document.documentElement.clientWidth` |
| 7   | Any `<dialog>` open (NotifyModal, RequestCity, etc.) | Same scroll-lock issue as above                                                                          | Same fix — apply scrollbar-width compensation on `dialog.showModal()`                                                                     |

### MEDIUM — Address in next polish pass

| #   | Location                                  | Trigger                                                             | Fix                                                                                      |
| --- | ----------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 8   | `src/components/admin/AdminDashboard.tsx` | "Deleted" toggle reveals replacement text → row height changes      | Reserve row height; use `opacity`/`pointer-events` toggle instead of content replacement |
| 9   | `src/components/admin/AdminDashboard.tsx` | Loading spinner replaced by content on fetch complete → height jump | Render skeleton rows with fixed heights matching content rows                            |
| 10  | `src/pages/contestant-prep.astro`         | Gender-reveal section animates in via JS → pushes content below     | Pre-reserve section height; use transform/opacity animation only (no height change)      |
| 11  | Any admin modal                           | Same scroll-lock body-shift as item 6                               | Same scrollbar-width fix                                                                 |

### LOW — Nice to have

| #   | Location                                                       | Trigger                                                                                         | Fix                                                                                                                                 |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 12  | `src/layouts/BaseLayout.astro` skip-link                       | Skip-link rendered `position: absolute` shifts to `fixed` on focus → minor repaint              | Use `position: fixed` always with negative `top` offset; transition `top` on focus                                                  |
| 13  | `src/components/home/HomeShows.astro` + `HomeStats.astro` etc. | `data-reveal` adds `.revealed` class via IntersectionObserver → opacity + translateY transition | Already progressive-enhancement but translateY can cause subpixel repaints; switch to `will-change: transform` on observed elements |

### Already fixed in this branch

- Email form step transitions (HomeSignup, popup, NotifyModal, city notify) — wrapped in `min-height` containers (220–260px) so step 1→2 swap never shifts content below.

---

## International phone input with country selector

**Priority:** Low (Later Later)
**Logged:** 2026-04-08

Right now we accept any phone number and auto-format US numbers to E.164 (`+1XXXXXXXXXX`). International numbers are stored as-is with basic digit cleanup. This works fine at current scale.

When we start actually texting international numbers (via Twilio/MessageBird/etc.), add a proper country-code dropdown + phone input that validates per-country format. Packages like `react-phone-number-input` or `intl-tel-input` handle this well.

**Why not now:**

- We don't have an international texting service yet
- No confirmed international show dates
- The npm package adds bundle weight to every page with a phone field
- Current approach (accept anything, clean up later) is good enough for lead capture

---

# Codebase Audit — Review Later

Items flagged during the 2026-04-08 cleanup audit. Not confirmed dead — may have been created for a reason. Check each one and either wire it in or delete it.

## Review: src/utils/instagram.ts

- **What:** Exports `cleanInstagramHandle()` and `instagramUrl()` — utility for stripping `@` prefix and building Instagram profile URLs
- **Current state:** Zero imports. Admin components (`ApplicantCard.tsx`, `ApplicantModal.tsx`) inline `https://instagram.com/${handle}` directly instead of using this utility.
- **Action:** Either import and use these in the admin components, or delete the file.

## Review: scripts/optimize-images.js

- **What:** Image optimization script using sharp (resize, compress, convert to WebP)
- **Current state:** Not referenced in any npm script or GitHub workflow. `scripts/organize-images.js` IS used via `npm run images:organize`.
- **Action:** Check if this is run manually. If not, delete it.

## Review: scripts/migrate-locations.ts

- **What:** One-time Firestore migration — backfills legacy freetext city records with structured country/state/city fields
- **Current state:** Referenced in package.json as `npm run migrate:locations`. Unknown if it's been run.
- **Action:** Run `npm run migrate:locations` (dry run first, then `-- --execute`). Once done, delete the script and remove the npm script entry.
