# Bugs

## Open

### [MEDIUM] No rate limiting on API endpoints

- **Date:** 2026-04-04
- **File:** `api/notify-application.ts`, `api/contestant-prep-auth.ts`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** No rate limiting on any API endpoint. A bot can trigger unlimited Resend emails (incurring cost) or brute-force the contestant prep auth endpoint.
- **What should happen:** Endpoints should be rate-limited.
- **Fix:** Use Vercel Edge Rate Limiting or Upstash Redis for per-IP rate limits.

### [MEDIUM] CORS config allows all origins with DELETE method

- **Date:** 2026-04-04
- **File:** `cors.json`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Firebase Storage CORS allows `origin: ["*"]` with all HTTP methods including DELETE. This is overly permissive.
- **What should happen:** Restrict to production domain and only needed methods (GET, PUT for upload).
- **Fix:** Update cors.json with specific origin and reduced method list.

### [LOW] CSP uses unsafe-inline weakening XSS protection

- **Date:** 2026-04-04
- **File:** `vercel.json`
- **Status:** Open
- **Severity:** Low
- **What's happening:** Both script-src and style-src include 'unsafe-inline', weakening CSP XSS protection.
- **What should happen:** Use CSP nonces to eliminate unsafe-inline from script-src.
- **Fix:** Migrate to Astro CSP nonce middleware. Lower priority since the site has minimal user-generated content.

### [MEDIUM] No server-side file-type validation on photo uploads

- **Date:** 2026-04-04
- **File:** `src/components/ApplyPage.tsx`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Photos are uploaded directly to Firebase Storage from the client. The `accept="image/*"` HTML attribute is trivially bypassed. An attacker could upload SVGs with embedded scripts or other malicious file types.
- **What should happen:** File type should be validated server-side via MIME type / magic bytes.
- **Fix:** Create a Firebase Cloud Function trigger on `storage.object.finalize` that checks `contentType` and deletes non-image files. Or use a server API endpoint as an upload proxy.

### [MEDIUM] No CAPTCHA or rate limiting on application form

- **Date:** 2026-04-04
- **File:** `src/components/ApplyPage.tsx`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The form submits directly to Firestore from the browser with no bot protection. A script could submit thousands of fake applications.
- **What should happen:** Bot submissions should be blocked or rate-limited.
- **Fix:** Add Firebase App Check with reCAPTCHA v3 and enforce in Firestore security rules.

### [LOW] No pagination in AdminDashboard

- **Date:** 2026-04-04
- **File:** `src/components/admin/AdminDashboard.tsx`
- **Status:** Open
- **Severity:** Low
- **What's happening:** All applications are fetched in a single `getDocs` call. With 500+ records this will be slow and expensive.
- **What should happen:** Applications should be paginated with Firestore cursor-based pagination.
- **Fix:** Use `query()` with `limit()`, `orderBy()`, and `startAfter()` for pagination when app count grows.

### [HIGH] Color contrast: #888 (--muted) fails WCAG AA on #FFF8F0

- **Date:** 2026-04-06
- **File:** Multiple — `links.astro`, `privacy.astro`, `terms.astro`, `faq.astro`, city pages
- **Status:** Open
- **Severity:** High
- **What's happening:** `#888` on `#FFF8F0` is 2.98:1 contrast ratio, fails WCAG AA minimum of 4.5:1 for normal text.
- **What should happen:** Replace `#888` with `#666` minimum, or `#595959` for safe AA compliance.
- **Fix:** Update `--muted` in `:root` to a darker value. Affects footer text, badge icons, social icons, modal close buttons, date labels.

### [HIGH] Color contrast: #666 (--text-light) borderline on #FFF8F0

- **Date:** 2026-04-06
- **File:** Multiple — `tickets.astro`, `faq.astro`, `hosts.astro`, `links.astro`, `index.astro`
- **Status:** Open
- **Severity:** High
- **What's happening:** `#666` on `#FFF8F0` is 4.14:1 — passes WCAG AA for large text (18pt+) but fails for normal text (<4.5:1).
- **What should happen:** Use `#595959` or darker for normal-size text, or keep `#666` only on large/bold text.
- **Fix:** Update `--text-light` or use it only for text that qualifies as large text per WCAG.

### [MEDIUM] outline:none on form inputs without visible focus replacement

- **Date:** 2026-04-06
- **File:** `ApplyPage.module.css`, `AdminLogin.module.css`, `ApplicantModal.module.css`, `HomeShows.astro`, `HomeSignup.astro`, `index.astro`, `tickets.astro`, `cities/[slug].astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** `outline: none` removes the browser's default focus ring with no replacement `:focus-visible` style. Keyboard users can't see which element has focus.
- **What should happen:** Replace with a visible `:focus-visible` ring (e.g., `outline: 2px solid var(--brand-red); outline-offset: 2px`).
- **Fix:** Add a global `:focus-visible` style in `index.css` for inputs/buttons, or add per-component focus styles.

### [MEDIUM] Social icon touch targets 40x40px (below 44px WCAG minimum)

- **Date:** 2026-04-06
- **File:** `src/pages/links.astro` (lines 407–418)
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Social icons are 40x40px, below the 44x44px WCAG 2.5.8 target size minimum.
- **What should happen:** Increase to 44x44px minimum.
- **Fix:** Change `.social-icon` width/height from 40px to 44px.

### [MEDIUM] Modal close buttons too small (~28px effective area)

- **Date:** 2026-04-06
- **File:** `links.astro` (lines 474–487), `ApplicantModal.module.css` (lines 63–77)
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Close buttons have only 4–6px padding on 20px icons, giving ~28–32px effective target.
- **What should happen:** Minimum 44x44px touch target.
- **Fix:** Add explicit `min-width: 44px; min-height: 44px` or increase padding to reach 44px total.

### [MEDIUM] ApplicantModal: no focus trap, not using native dialog

- **Date:** 2026-04-06
- **File:** `src/components/admin/ApplicantModal.tsx`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Modal uses a custom overlay div, not `<dialog>`. No focus trap — keyboard users can tab to elements behind the modal.
- **What should happen:** Either use native `<dialog>` element or implement focus trap + `aria-modal="true"`.
- **Fix:** Refactor to `<dialog>` or add focus trap via `onKeyDown` handler cycling Tab between first/last focusable elements.

### [MEDIUM] HomeShows: div with role="button" should be a button element

- **Date:** 2026-04-06
- **File:** `src/components/home/HomeShows.astro` (line 44)
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Notify-me show card is a `<div role="button" tabindex="0">` instead of a semantic `<button>`.
- **What should happen:** Replace with `<button>` element and reset default button styling.
- **Fix:** Change to `<button>` with `appearance: none; background: none; border: none; text-align: left; width: 100%`.

### [LOW] No aria-current="page" on active nav links

- **Date:** 2026-04-06
- **File:** `src/components/home/HomeNav.astro`, `src/components/layout/PageNav.astro`
- **Status:** Open
- **Severity:** Low
- **What's happening:** Navigation links don't indicate which page is currently active to screen readers.
- **What should happen:** Active link should have `aria-current="page"`.
- **Fix:** Use `Astro.url.pathname` to conditionally add `aria-current="page"` to matching nav links.

### [LOW] AdminLogin: inputs rely on placeholder instead of visible labels

- **Date:** 2026-04-06
- **File:** `src/components/admin/AdminLogin.tsx`
- **Status:** Open
- **Severity:** Low
- **What's happening:** Email and password inputs use placeholder text as their only visible label. Placeholders disappear when typing, leaving no label context.
- **What should happen:** Add visible `<label>` elements above or beside the inputs.
- **Fix:** Add `<label htmlFor="..." className={styles.label}>` for each input. Currently mitigated by `aria-label` attributes.

## Fixed

### [MEDIUM] Apply page backdrop dismiss always navigates to landing page

- **Date:** 2026-03-13
- **File:** `src/pages/ApplyPage.tsx:308`
- **Status:** Fixed
- **What happened:** Clicking the dark backdrop area outside the form always navigated to `/` (landing page), even when the user came from `/links`. The "Back" button correctly used `navigate(-1)` but the backdrop `onClick` hardcoded `navigate("/")`.
- **Fix:** Changed backdrop `onClick` to `navigate(-1)` to match the "Back" button behavior.

### [CRITICAL] Admin password hardcoded as "secret" instead of env var

- **Date:** 2026-03-12
- **File:** `src/components/admin/AdminLogin.tsx:15`
- **Status:** Fixed
- **What happened:** Password was compared against the literal string `"secret"` instead of reading from `VITE_ADMIN_PASSWORD` env var (which is set to `garammasala2026`). Anyone trying to log in with the intended password would be rejected.
- **Fix:** Changed to `import.meta.env.VITE_ADMIN_PASSWORD`.

### [MEDIUM] Font CSS variable typo — `var(--font-dm)` doesn't exist

- **Date:** 2026-03-12
- **File:** `src/pages/LinksPage.tsx:562,614`
- **Status:** Fixed
- **What happened:** Event date labels in the shows modal and TBA events used `fontFamily: "var(--font-dm)"` which is not defined. The correct variable is `--font-dm-sans`. Browser fell back to default font, causing inconsistent rendering.
- **Fix:** Changed to `var(--font-dm-sans)`.

### [MEDIUM] Debug console.log leaks PII to browser console

- **Date:** 2026-03-12
- **File:** `src/components/admin/AdminDashboard.tsx:76`
- **Status:** Fixed
- **What happened:** `console.log("Snapshot size:", snap.size, snap.docs.map(...))` logged all application data (names, Instagram handles, locations, income) to the browser console on every admin dashboard load.
- **Fix:** Removed the console.log statement.

### [MEDIUM] Admin dashboard shows infinite loading on fetch error

- **Date:** 2026-03-12
- **File:** `src/components/admin/AdminDashboard.tsx`
- **Status:** Fixed
- **What happened:** If Firestore fetch failed, the error was only logged to console. Users saw perpetual "Loading..." with no way to retry.
- **Fix:** Added `fetchError` state with an error message and "Try again" button.

### [LOW] Unused `searchableLocation` export — dead code

- **Date:** 2026-03-12
- **File:** `src/utils/locationDisplay.ts`
- **Status:** Fixed
- **What happened:** `searchableLocation()` was exported but never imported. It was a remnant from the old admin filter that was removed during simplification.
- **Fix:** Removed the function.

### [LOW] Pointless variable alias `sortedPress = pressItems`

- **Date:** 2026-03-12
- **File:** `src/pages/LinksPage.tsx:263`
- **Status:** Fixed
- **What happened:** After removing the date-based sort, `sortedPress` became a pointless alias for `pressItems`.
- **Fix:** Removed alias, use `pressItems` directly.

### [LOW] ESLint error — ternary used as expression statement

- **Date:** 2026-03-12
- **File:** `src/components/admin/ApplicantCard.tsx:40`
- **Status:** Fixed
- **What happened:** `onDelete ? onDelete() : onRestore?.()` used as a statement, which ESLint flags as `no-unused-expressions`.
- **Fix:** Changed to `if/else` statement.

### [LOW] ESLint error — useCallback self-reference ordering

- **Date:** 2026-03-12
- **File:** `src/hooks/useMouseParallax.ts`
- **Status:** Fixed
- **What happened:** `animate` was defined via `useCallback` but referenced itself via `requestAnimationFrame(animate)`, triggering an ESLint error about accessing a variable before declaration.
- **Fix:** Moved `animate` inside the `useEffect` body where it's naturally in scope. Moved `lerp` to module scope.

### [LOW] ESLint error — setState in useEffect body

- **Date:** 2026-03-12
- **File:** `src/pages/AdminPage.tsx`
- **Status:** Fixed
- **What happened:** `setAuthed(sessionStorage.getItem(...))` called synchronously in a useEffect body.
- **Fix:** Replaced with a lazy state initializer `useState(() => ...)`.

## Fixed (continued)

### [LOW] Large bundle size (9.5MB uncompressed JS)

- **Date:** 2026-03-12
- **File:** Build output
- **Status:** Fixed (2026-03-31)
- **What happened:** The `country-state-city` package was statically imported, causing an 8.3MB synchronous chunk load on /apply.
- **Fix:** Created `useGeoData` hook with dynamic `import()`. The geo data now loads asynchronously on mount instead of blocking page render. Removed `vendor-geo` manual chunk from vite config.

### [LOW] Inline styles throughout admin + form pages

- **Date:** 2026-03-12
- **Files:** `ApplyPage.tsx`, `LinksPage.tsx`, `AdminDashboard.tsx`, `ApplicantModal.tsx`, `AdminLogin.tsx`
- **Status:** Fixed (2026-03-31)
- **What happened:** 168 inline `style={{}}` objects across 5 files instead of CSS modules.
- **Fix:** Migrated all 5 files to CSS modules. Created colocated `.module.css` files. Replaced JS hover state management (`useState` + `onMouseEnter`/`onMouseLeave`) with CSS `:hover` pseudo-classes. Moved inline `<style>` keyframes into CSS modules.
