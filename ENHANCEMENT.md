# Enhancements

Future improvements that are logged but not currently prioritized.

---

## Prefetch/preload key pages + skeleton loaders to eliminate CLS

**Priority:** High  
**Logged:** 2026-04-07

### Problem

The Apply and Get Tickets pages take noticeable time to load on first navigation. There is no skeleton or placeholder UI, so the page jumps from blank → content (CLS). These are the two highest-traffic destinations from the homepage nav.

### What to do

**1. Prefetch Apply and Tickets on homepage load**

Add `<link rel="prefetch">` tags in `BaseLayout.astro` (or the homepage `index.astro`) so the browser fetches those pages in the background while the user is on the homepage:

```html
<link rel="prefetch" href="/apply" />
<link rel="prefetch" href="/tickets" />
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

| # | Location | Trigger | Fix |
|---|----------|---------|-----|
| 1 | `src/pages/apply.astro` + `ApplyPage.tsx` | React island hydrates after static HTML → form renders below a blank stub | Add height-reserving CSS skeleton in `apply.astro` Astro shell; switch to `client:visible` |
| 2 | `src/components/admin/ApplicantModal.tsx` | Error message inserted above form fields when validation fires → shifts fields down | Reserve space with `min-height` on the error container; always render it (empty), toggle visibility only |
| 3 | `src/pages/apply.astro` (photo upload) | Photo thumbnail appears after upload → section height changes | Pre-reserve thumbnail slot with a fixed-size placeholder div before upload completes |
| 4 | `src/pages/apply.astro` (nomination section) | Nomination fields revealed via `data-reveal` / `hidden` toggle → content below shifts | Use `max-height` / `overflow: hidden` transition instead of `hidden` attribute; reserve max possible height |
| 5 | `src/hooks/useGeoData.ts` → apply form geo dropdowns | State dropdown populates after country selected → city dropdown appears after state → double CLS cascade | Render all three dropdowns always (empty/disabled state); never insert new DOM nodes on selection |
| 6 | Apply page terms modal | `document.body` scroll-lock (`overflow: hidden`) removes scrollbar → body shifts right | Add `padding-right: var(--scrollbar-width)` to body when locking; measure with `window.innerWidth - document.documentElement.clientWidth` |
| 7 | Any `<dialog>` open (NotifyModal, RequestCity, etc.) | Same scroll-lock issue as above | Same fix — apply scrollbar-width compensation on `dialog.showModal()` |

### MEDIUM — Address in next polish pass

| # | Location | Trigger | Fix |
|---|----------|---------|-----|
| 8 | `src/components/admin/AdminDashboard.tsx` | "Deleted" toggle reveals replacement text → row height changes | Reserve row height; use `opacity`/`pointer-events` toggle instead of content replacement |
| 9 | `src/components/admin/AdminDashboard.tsx` | Loading spinner replaced by content on fetch complete → height jump | Render skeleton rows with fixed heights matching content rows |
| 10 | `src/pages/contestant-prep.astro` | Gender-reveal section animates in via JS → pushes content below | Pre-reserve section height; use transform/opacity animation only (no height change) |
| 11 | Any admin modal | Same scroll-lock body-shift as item 6 | Same scrollbar-width fix |

### LOW — Nice to have

| # | Location | Trigger | Fix |
|---|----------|---------|-----|
| 12 | `src/layouts/BaseLayout.astro` skip-link | Skip-link rendered `position: absolute` shifts to `fixed` on focus → minor repaint | Use `position: fixed` always with negative `top` offset; transition `top` on focus |
| 13 | `src/components/home/HomeShows.astro` + `HomeStats.astro` etc. | `data-reveal` adds `.revealed` class via IntersectionObserver → opacity + translateY transition | Already progressive-enhancement (only active if JS+IntersectionObserver available) but translateY can cause subpixel repaints on some browsers; switch to `will-change: transform` on observed elements |

### Already fixed in this branch

- Email form step transitions (HomeSignup, popup, NotifyModal, city notify) — wrapped in `min-height` containers (220–260px) so step 1→2 swap never shifts content below.

---

## Later Later

Low-priority ideas that only make sense at significant scale. Revisit when the product warrants it.

### International phone input with country selector

**Logged:** 2026-04-08

Right now we accept any phone number and auto-format US numbers to E.164 (`+1XXXXXXXXXX`). International numbers are stored as-is with basic digit cleanup. This works fine at current scale.

When we start actually texting international numbers (via Twilio/MessageBird/etc.), add a proper country-code dropdown + phone input that validates per-country format. Packages like `react-phone-number-input` or `intl-tel-input` handle this well — country flag dropdown, auto-formatting, per-country length validation.

**Why not now:**
- We don't have an international texting service yet
- No confirmed international show dates
- The npm package adds bundle weight to every page with a phone field
- Current approach (accept anything, clean up later) is good enough for lead capture
