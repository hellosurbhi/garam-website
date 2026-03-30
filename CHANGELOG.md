# Changelog

## fix: events below the fold on mobile

On mobile, the event dates in the TableOfContents were pushed below the visible viewport due to `align-items: flex-end` pinning content to the bottom of a `min-height: 100vh` container with 100px top padding. Changed mobile wrapper to `align-items: center` and reduced top padding to 60px so events are immediately visible. Also bumped mobile font sizes for date (0.88rem) and city (0.82rem) for readability.

**Files:**
- `src/components/CenterBox/CenterBox.module.css` — mobile wrapper alignment and padding
- `src/components/TableOfContents/TableOfContents.module.css` — mobile font sizes

## feat: add NYC 4/19 event, remove roman numerals

Added "420 Blazin' in Love" New York City event on April 19 with Eventbrite ticket link. Removed the roman numeral labels (I, II, III…) from all events since past events make the sequential numbering meaningless.

**Files:**
- `src/data/events.ts` — new event entry, removed `numeral` field from interface and all objects
- `src/pages/LinksPage.tsx` — removed numeral `<span>` elements, switched keys from `event.numeral` to `event.date`
- `src/components/TableOfContents/TableOfContents.tsx` — removed numeral span
- `src/components/TableOfContents/TableOfContents.module.css` — removed `.numeral` class

## feat: password-protected contestant prep guide at /contestant-prep

Added a full contestant prep guide page for show contestants, gated by a weekly-rotating password.

**Password system:**
- Deterministic weekly password generated via HMAC-SHA256 from current week's Monday date (ET timezone) + a secret salt. Rotates automatically every Sunday 11:59 PM ET without needing a cron job.
- Two new Vercel Serverless Functions: `api/contestant-prep-auth.ts` (validates password, returns session token) and `api/contestant-prep-password.ts` (returns current password for admin use).
- Session stored in localStorage with auto-expiration each Sunday night.

**Page content:** Welcome message, Golden Rules, 13 questions contestants will be asked, "Come Prepared With" checklist, wardrobe guidance, arrival times, and notes for guys/girls. Styled with the site's dark/warm design system.

**Admin integration:** AdminDashboard now shows the current week's contestant prep password with a "Copy" button, fetched from the serverless API.

**New env var:** `CONTESTANT_PREP_SALT` (server-only, no VITE_ prefix) — must be set in Vercel dashboard for production.

**Files:**
- New: `api/lib/weekly-password.ts`, `api/contestant-prep-auth.ts`, `api/contestant-prep-password.ts`, `src/pages/ContestantPrepPage.tsx`
- Modified: `src/App.tsx`, `src/components/admin/AdminDashboard.tsx`, `.env.local`, `package.json`

## feat: add Vercel Analytics

Wired up the `@vercel/analytics` React component (package was already installed but unused). Imported `Analytics` from `@vercel/analytics/react` and added `<Analytics />` inside `BrowserRouter` in `App.tsx`. Automatically tracks page views and web vitals on Vercel deployments.

**Files:** `src/App.tsx`

## fix: links page title hyperlink, cursor pointer, press order

Three UX fixes on the `/links` page:

1. **Title now links home:** Wrapped "Garam Masala Dating" `<h1>` in `<Link to="/">` so clicking it navigates back to the landing page.
2. **Cursor pointer on title:** Added `cursor: pointer` and `textDecoration: none` to the link wrapper.
3. **Press items newest-first:** Kept `press.ts` in chronological order (oldest first, append new items at end) and added `[...pressItems].reverse()` at render time so the modal displays newest first.

**Files:** `src/pages/LinksPage.tsx`, `src/data/press.ts`

## fix: backdrop dismiss navigates back instead of always to landing page

Clicking the dark backdrop area outside the Apply form now calls `navigate(-1)` instead of `navigate("/")`, matching the "Back" button behavior. Users arriving from `/links` return to `/links`, not `/`.

Also replaced remaining hardcoded hex colors with CSS variables across inline styles:
- `#22C55E` → `var(--success)` in ApplyPage, AdminDashboard, ApplicantModal
- `#4A0E1B` → `var(--surface-dark)` in ApplyPage
- `#F5EDE4` → `var(--text-ivory)` in ApplyPage, Nav.module.css, CenterBox.module.css
- `#E2C97E` → `var(--gold-accent)` in CenterBox.module.css

**Files:** `src/pages/ApplyPage.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/Nav/Nav.module.css`, `src/components/CenterBox/CenterBox.module.css`

## chore: full code cleanup, bug fixes, and CSS consolidation

Systematic cleanup pass across the entire codebase addressing bugs, dead code, inconsistent patterns, and duplicated logic.

**Critical bug fixed:** Admin login compared against hardcoded `"secret"` instead of the `VITE_ADMIN_PASSWORD` env var — no one could log in with the intended password. Now reads from env.

**Medium bugs fixed:**
- `var(--font-dm)` typo in LinksPage (non-existent CSS variable) → `var(--font-dm-sans)`
- Debug `console.log` in AdminDashboard leaked all applicant PII to browser console — removed
- Admin dashboard showed infinite "Loading..." on fetch error — added error state with retry button

**Dead code removed:**
- Unused `searchableLocation()` export from `locationDisplay.ts`
- Pointless `sortedPress = pressItems` alias in LinksPage
- All `console.log`/`console.error` statements (toasts already handle user feedback)

**CSS variable consolidation:**
- Added `--success`, `--accent-pink`, `--text-ivory`, `--gold-accent`, `--surface-dark` to `:root`
- Replaced hardcoded `#ff2d9b`, `#C9A84C`, font-family strings in Nav.module.css and CenterBox.module.css with CSS variables
- `::selection` now uses `var(--accent-pink)` instead of hardcoded hex

**Shared constants extracted:**
- Created `src/data/socials.ts` — single source of truth for social URLs and creator links (was duplicated across Nav, LinksPage, CenterBox)
- Created `src/utils/reactSelectStyles.ts` — shared react-select style configs with proper `CSSObjectWithLabel` types replacing `Record<string, unknown>`

**ESLint fixes:**
- Ternary-as-statement in ApplicantCard → if/else
- `useCallback` self-reference in useMouseParallax → moved `animate` inside useEffect
- `setState` in useEffect body in AdminPage → lazy state initializer
- Removed dead `href !== "#"` checks that TS now catches as unreachable

**Files:**
- `src/components/admin/AdminLogin.tsx` — env var password
- `src/components/admin/AdminDashboard.tsx` — remove console, add error state, use shared styles
- `src/components/admin/ApplicantCard.tsx` — fix lint
- `src/pages/ApplyPage.tsx` — remove console, use shared styles
- `src/pages/LinksPage.tsx` — fix font typo, remove alias, use shared socials
- `src/pages/AdminPage.tsx` — lazy state initializer
- `src/components/Nav/Nav.tsx` — use shared socials
- `src/components/CenterBox/CenterBox.tsx` — use shared socials
- `src/components/Nav/Nav.module.css` — CSS variables
- `src/components/CenterBox/CenterBox.module.css` — CSS variables
- `src/index.css` — new CSS variables
- `src/hooks/useMouseParallax.ts` — fix lint
- `src/utils/locationDisplay.ts` — remove dead export
- `src/data/socials.ts` — **new** shared social URLs
- `src/utils/reactSelectStyles.ts` — **new** shared react-select styles
- `BUGS.md` — **new** bug tracker

## refactor: remove dates from press items

Removed the `date` field from the `PressItem` interface and all press data objects. The "As Seen In" modal no longer displays dates — items appear in array order (newest first by convention). The date-based sort was replaced with a direct reference to `pressItems`.

**Files:** `src/data/press.ts`, `src/pages/LinksPage.tsx`

## feat: consolidate press appearances into "As Seen In" modal

Replaced the individual Gen Zenophobic and Big Silly World podcast buttons on the links page with a single "As Seen In" button that opens a modal listing all press appearances in reverse chronological order. Each entry shows a type badge (podcast/article/press), source name, formatted date, and external link. Renamed "Press & Collaborations" to "Booking & Press Inquiries" to clarify it's for new inquiries. Press items are stored in a simple array in `src/data/press.ts` for easy addition. Also added body scroll lock and Escape-to-close for both modals.

**Files:** `src/data/press.ts` (new), `src/pages/LinksPage.tsx`

## feat: location migration script for legacy freetext city records

Added `scripts/migrate-locations.ts` — a one-time migration that backfills legacy Firestore applications (freetext `city` only) with structured `country`/`state`/`city` fields. Uses `country-state-city` package to build a reverse index, resolves common aliases (NYC → New York City, SF → San Francisco, etc.), and disambiguates multi-state cities via a preference map (e.g. San Diego → CA, not TX). Defaults to dry-run; pass `--execute` to write. No schema or app code changes needed — the three-field structure was already in place.

**Files:** `scripts/migrate-locations.ts`, `package.json` (added `migrate:locations` script)

## simplify: replace admin filters with Gender + City multi-select

Stripped the admin Applications filter bar from 7 filters (sort, location text, gender, orientation, community, income, status) down to two `react-select` multi-select dropdowns: **Gender** and **City**. City options are derived dynamically from existing application data. Both filters AND together. Removed unused imports (`COMMUNITY_OPTIONS`, `INCOME_OPTIONS`, `searchableLocation`), the `SortOption` type, and `FILTER_STYLE` const. Default sort remains newest-first with rejected pushed to bottom.

**Files:** `src/components/admin/AdminDashboard.tsx`

## ux: Apply page backdrop dismiss and dynamic Instagram placeholder

Two UX improvements to the Apply page:

1. **Click-outside-to-dismiss** — clicking the dark background area outside the form navigates back to `/`, giving a modal-like backdrop dismiss feel. Inner content div stops propagation so form interactions are unaffected.
2. **Dynamic Instagram placeholder** — when "For a friend" tab is selected, the Instagram handle placeholder changes to `yourfriendshandle` (reverts to `yourhandle` for "For myself").

**Files:** `src/pages/ApplyPage.tsx`

## feat: cascading Country/State/City location selector

Replaced the freetext "City" input on the application form with a structured, cascading location selector (Country → State → City). Uses `country-state-city` for geographic data and `react-select` for searchable dropdowns. Country defaults to United States. State appears when country is selected; City appears when state is selected. Stores structured `country`, `state`, and `city` fields in Firestore.

Admin dashboard handles both old freetext records (shows `"New York City"`) and new structured records (shows `"Brooklyn, NY"`). Location filter now searches across city, state, and country fields.

**Files:**
- `package.json` — added `react-select`, `country-state-city`, `@types/react-select`
- `src/types/application.ts` — added optional `country?`, `state?` fields
- `src/utils/locationDisplay.ts` — new file with `formatLocation()` and `searchableLocation()` helpers
- `src/pages/ApplyPage.tsx` — replaced city input with 3 cascading `<Select>`, updated FormState/validation/submission
- `src/components/admin/ApplicantCard.tsx` — uses `formatLocation(app)` instead of `app.city`
- `src/components/admin/ApplicantModal.tsx` — uses `formatLocation(app)`, label changed to "Location"
- `src/components/admin/AdminDashboard.tsx` — uses `searchableLocation(app)` in filter, placeholder changed to "Location…"

**Decisions:**
- `country` and `state` are optional on the `Application` type so old Firestore docs without them still satisfy the type — no data migration needed
- `formatLocation` falls back to `app.city` when `app.state` is missing (legacy compat)
- react-select styles custom-matched to existing ivory/gold design system

## feat: add podcast links to LinksPage

- Added "Gen Zenophobic Podcast" (Wyatt's podcast) and "Big Silly World Podcast" links
- Both link to their YouTube episodes where Garam Masala Dating was promoted
- Placed after YouTube and before "Upcoming Shows & Tickets" with Mic icon
- Imported `Mic` from lucide-react

**Files:** `src/pages/LinksPage.tsx`

## feat: soft-delete & visual hierarchy for admin applications

- Added `deletedAt` field to `Application` type — soft-delete without losing original status
- **ApplicantCard**: trash icon overlay on hover (delete), archive-restore icon (restore), `dimmed` prop for rejected/deleted cards (opacity + desaturation)
- **ApplicantModal**: "DELETED" banner on photo, "Move to Deleted" / "Restore" footer buttons
- **AdminDashboard**: active/deleted partition with rejected apps dimmed & sorted to bottom; collapsible "Deleted Applications" section; header shows active count
- No Firestore migration needed — existing docs without `deletedAt` default to active

**Files:** `src/types/application.ts`, `src/components/admin/ApplicantCard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/admin/AdminDashboard.tsx`

## feat: add email icon to bottom socials row

- Added Mail icon to the SOCIALS array on the Links page
- Links to `mailto:contact@garammasaladating.com`
- Bottom social row now shows: Instagram, TikTok, YouTube, Email

**Files:** `src/pages/LinksPage.tsx`

## update: press email, landing page tagline, and creator hyperlinks

- Changed press/collaborations mailto from `press@` to `contact@garammasaladating.com`
- Rewrote landing page tagline with new copy including creator names and venue
- Added hyperlinks: Surbhi → Instagram, Wyatt Feegrado → Instagram, Top Secret Comedy Club → website
- Links styled in gold (`#E2C97E`) with hover transition

**Files:** `src/pages/LinksPage.tsx`, `src/components/CenterBox/CenterBox.tsx`, `src/components/CenterBox/CenterBox.module.css`

## fix: replace Music2 with TikTok logo and add YouTube to bottom socials

- Created inline `TikTokIcon` SVG component since Lucide doesn't have a TikTok brand icon
- Replaced `Music2` (music note) with the actual TikTok logo in both the LINKS and SOCIALS arrays
- Added YouTube to the bottom social icon row with the existing `Youtube` Lucide icon
- Removed unused `Music2` import

**Files:** `src/pages/LinksPage.tsx`
