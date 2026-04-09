# Bugs

## Open

### [HIGH] Firestore applications collection has no field validation on create

- **Date:** 2026-04-09
- **File:** `firestore.rules:36, 40`
- **Status:** Open
- **Severity:** High
- **What's happening:** `allow create: if true;` on the `applications` collection and its subcollections. Unlike the `leads` collection (which has thorough `validLead()` validation with `hasOnly`, `hasAll`, type checks, and length limits), applications accept any document shape from any unauthenticated user. This enables spam flooding, data poisoning, or arbitrary field injection.
- **What should happen:** Applications should have a `validApplication()` function mirroring the `validLead()` pattern — restricting allowed fields, requiring key fields, and enforcing type/length constraints.
- **Fix:** Add a `validApplication()` function to `firestore.rules` with field validation. Consider also requiring `request.auth != null` or adding Firebase App Check.

### [MEDIUM] No runtime input validation on POST API routes

- **Date:** 2026-04-09
- **File:** `src/pages/api/notify-application.ts:105`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** `notify-application.ts` uses an unsafe `as ApplicationNotification` cast with no runtime validation. Only checks that `name` and `instagram` exist — doesn't validate types, lengths, or format of the other 12 fields. Similar pattern in other POST endpoints.
- **What should happen:** All POST endpoints should validate request bodies at runtime using schema validation (e.g., Zod).
- **Fix:** Add Zod schemas for `ApplicationNotification` and other request types. Validate before processing.

### [LOW] Leads collection allows unauthenticated phone updates

- **Date:** 2026-04-09
- **File:** `firestore.rules:45`
- **Status:** Open
- **Severity:** Low
- **What's happening:** `allow update: if validPhoneUpdate() || request.auth != null;` — the `validPhoneUpdate()` branch allows any unauthenticated user to update the `phone` field on existing lead documents. This is likely intentional for the phone capture flow but means anyone with a document ID can overwrite phone numbers.
- **What should happen:** Verify this is the intended behavior. If the phone capture flow requires unauthenticated updates, document it. If not, add `request.auth != null &&` before `validPhoneUpdate()`.
- **Fix:** Review whether the phone capture UX requires unauthenticated updates. If yes, add a comment in `firestore.rules` explaining why. If no, require auth.

### [HIGH] Homepage still emits duplicate FAQPage schema

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`, `src/pages/faq.astro`
- **Status:** Open
- **Severity:** High
- **What's happening:** The homepage still imports `HOME_FAQS`, builds `faqJsonLd`, and emits a `FAQPage` JSON-LD block. The dedicated FAQ page also emits its own `FAQPage` schema with overlapping questions and different answer wording.
- **What should happen:** Only `/faq` should own the `FAQPage` schema. The homepage can keep the visible accordion, but should not emit competing FAQ structured data.
- **Fix:** Remove the homepage FAQ JSON-LD block from `src/pages/index.astro`.

### [MEDIUM] Home hero photo background from audit not implemented

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeHero.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The hero still renders only the shader canvas and gradient background. The planned stage photo layer was never added.
- **What should happen:** The hero should include the optimized show photo behind the shader for depth and stronger visual proof.
- **Fix:** Add a `<picture>` background layer using the new hero asset, placed behind the canvas with reduced opacity.

### [MEDIUM] Home creators avatars were not upgraded to larger host photos

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeCreators.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Creator avatars are still rendered at 96x96 on mobile and desktop. The audit called for larger host photos and updated crops.
- **What should happen:** Home creator cards should use larger images with stronger visual emphasis and updated source assets.
- **Fix:** Increase avatar sizing to the planned 160-200px range and switch to the newer processed host images.

### [MEDIUM] Hosts page still uses small individual avatar images

- **Date:** 2026-04-08
- **File:** `src/pages/hosts.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The hosts page uses a strong action shot banner, but the individual host avatars are still 96x96 and were not upgraded as planned.
- **What should happen:** The hosts page should use larger individual photos to match the rest of the redesign.
- **Fix:** Replace the small avatars with larger cropped host images and adjust layout spacing accordingly.

### [MEDIUM] Experience section photo placement was missed

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeExperience.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The Experience section still has only text plus ambient background images. The planned audience reaction photo in the left column was never added.
- **What should happen:** The section should include the audience photo below the copy to add proof and break up the text block.
- **Fix:** Add the planned `<picture>` element below the body copy and style it per the audit.

### [MEDIUM] Testimonials accent photo was not added

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeTestimonials.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The testimonial section still renders only the three quote cards over a background image. The planned desktop-only image card or accent treatment was not implemented.
- **What should happen:** Testimonials should include the audience reaction photo as added visual proof on desktop.
- **Fix:** Add the fourth desktop grid item or equivalent accent treatment using the processed image.

### [MEDIUM] Journal decorative cupid artwork not implemented

- **Date:** 2026-04-08
- **File:** `src/pages/journal/index.astro`, `src/pages/journal/[slug].astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The journal pages still use the generic background image only. The decorative cupid artwork from the audit was not added to the index header or article layout.
- **What should happen:** Journal pages should include the subtle cupid art accents that were part of the visual refresh plan.
- **Fix:** Add absolutely positioned decorative image elements with the planned opacity and positioning.

### [MEDIUM] Spice List section still double-asks subscribed users for email

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeSignup.astro`
- **Status:** Open
- **Severity:** Medium
- **What's happening:** The section always renders the email signup prompt, even when `localStorage` already contains `gmd-popup-subscribed`. Users who subscribed through the popup still see another email ask at the bottom of the home page.
- **What should happen:** Previously subscribed users should see an alternate CTA, not another email form.
- **Fix:** Detect the subscription flag on load and swap the section content to a follow/apply state.

### [LOW] Popup CTA copy still uses weaker pre-audit wording

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`
- **Status:** Open
- **Severity:** Low
- **What's happening:** The popup still says "Want Cheaper Tickets?" and "Get My Discount Code" rather than the stronger offer-based copy proposed in the audit.
- **What should happen:** Popup copy should use the updated conversion-focused wording once the actual offer is confirmed.
- **Fix:** Replace the popup headline, supporting copy, and CTA with the finalized offer language.

### [LOW] Home nav scrolled state does not emphasize the tickets CTA

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeNav.astro`
- **Status:** Open
- **Severity:** Low
- **What's happening:** The nav changes background and border on scroll, but the tickets button does not get the planned pulse or stronger emphasis.
- **What should happen:** Once the user scrolls and shows intent, the tickets CTA should become more visually assertive.
- **Fix:** Add the planned scrolled-state animation or alternate emphasis style to `.nav-pill.primary`.

### [LOW] Contact email usage is still inconsistent across pages

- **Date:** 2026-04-08
- **File:** `src/pages/faq.astro`, `src/pages/links.astro`
- **Status:** Open
- **Severity:** Low
- **What's happening:** The FAQ footer uses `contact@`, but the FAQ collaboration answer still uses `press@`. The links page also still exposes `hello@` and `press@`, so there is no single consistent public contact address.
- **What should happen:** Public-facing pages should consistently use the chosen primary contact email, with exceptions only where a separate inbox is intentional.
- **Fix:** Standardize all public contact references and keep `press@` only if it is a deliberate press-specific alias.

### [LOW] New image optimization pipeline from the audit was not completed cleanly

- **Date:** 2026-04-08
- **File:** `scripts/optimize-images.js`
- **Status:** Open
- **Severity:** Low
- **What's happening:** The repo has a JS image script instead of the planned shell script, and several source paths in the script point to files that do not exist. This makes the pipeline unreliable if rerun.
- **What should happen:** The repo should contain a working, repeatable asset pipeline for the new show photos.
- **Fix:** Correct the source paths or replace the script with the intended `optimize-new-photos` workflow, then verify it end-to-end.

### [MEDIUM] SVG-only buttons missing aria-label (accessibility)

- **Date:** 2026-04-08
- **File:** Multiple components — found by Playwright smoke test on iPad/desktop viewports
- **Status:** Open
- **Severity:** Medium
- **What's happening:** Some buttons contain only an SVG icon with no `aria-label`, `aria-labelledby`, or `title` attribute. `textContent` is empty for SVG-only buttons, so screen readers announce them as "button" with no context. The smoke test (`assertAllButtonsAccessible`) catches these — buttons that are visible but have no accessible name.
- **What should happen:** Every visible button must have either text content, `aria-label`, `aria-labelledby`, or `title`.
- **Fix:** Audit all `<button>` elements with SVG-only children across the site. Add `aria-label` to each one. Known pattern: close buttons (`.modal-close`), icon buttons, and any button that relies solely on a visual icon. Run `npx playwright test --grep "Static pages smoke"` to find all offending pages.

### [LOW] Contestant-prep page has empty meta description

- **Date:** 2026-04-08
- **File:** `src/pages/contestant-prep.astro`
- **Status:** Open
- **Severity:** Low
- **What's happening:** `description=""` is passed to BaseLayout, resulting in an empty meta description tag. While the page has `noindex={true}`, an empty description is still sloppy.
- **What should happen:** Even noindex pages should have a meaningful description for anyone who lands on them.
- **Fix:** Add a description like "Preparation guide for confirmed Garam Masala Dating contestants."

### [HIGH] Firebase Auth blocked by CSP in production — apply form silently fails

- **Date:** 2026-04-07
- **File:** `vercel.json`
- **Status:** Fixed (2026-04-07)
- **Severity:** High
- **What happened:** `connect-src` in the Vercel CSP was missing `https://identitytoolkit.googleapis.com` and `https://securetoken.googleapis.com`. The apply form calls `signInAnonymously()` before writing to Firestore — that call requires `identitytoolkit.googleapis.com`. Without it, Firebase Auth is blocked in production. The catch block swallows the error and shows an error toast, but the form never submits. No data reaches Firestore.
- **Fix:** Added both domains to `connect-src` in `vercel.json`.

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
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** Firebase Storage CORS allowed `origin: ["*"]` with all HTTP methods including DELETE.
- **Fix:** Restricted to `https://garammasaladating.com` only. Removed DELETE, POST, HEAD — now only GET and PUT.

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
- **File:** `src/index.css`
- **Status:** Fixed (2026-04-07)
- **Severity:** High
- **What happened:** `#888` on `#FFF8F0` was 3.38:1, failing WCAG AA (requires 4.5:1 for normal text).
- **Fix:** Changed `--muted` to `#6b6b6b` (5.06:1 ratio — passes WCAG AA).

### [LOW] Color contrast: #666 (--text-light) improved proactively

- **Date:** 2026-04-06
- **File:** `src/index.css`
- **Status:** Fixed (2026-04-07)
- **Severity:** Low (was a false positive — #666 on #FFF8F0 is 5.45:1, already passing WCAG AA)
- **What happened:** `#666` on `#FFF8F0` was initially recorded as 4.14:1 (incorrect). Correct value is 5.45:1, which passes WCAG AA. The fix was applied anyway as a proactive improvement.
- **Fix:** Changed `--text-light` to `#595959` (6.65:1 ratio — passes WCAG AA for all text sizes).

### [MEDIUM] outline:none on form inputs without visible focus replacement

- **Date:** 2026-04-06
- **File:** `ApplyPage.module.css`, `AdminLogin.module.css`, `ApplicantModal.module.css`
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** `outline: none` in 4 CSS module rules removed browser focus rings with no replacement. Keyboard users saw no focus indicator.
- **Fix:** Added global `:focus-visible { outline: 2px solid var(--brand-red); outline-offset: 2px }` to `src/index.css`. Removed `outline: none` from `.input` (ApplyPage, AdminLogin), `.statusSelect`, and `.notesTextarea` (ApplicantModal).

### [MEDIUM] Social icon touch targets 40x40px (below 44px WCAG minimum)

- **Date:** 2026-04-06
- **File:** `src/pages/links.astro`
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** Social icons were 40x40px, below WCAG 2.5.8 minimum and repo standard.
- **Fix:** Changed `.social-icon` width/height to 48x48px (repo minimum per CLAUDE.md).

### [MEDIUM] Modal close buttons too small (~28px effective area)

- **Date:** 2026-04-06
- **File:** `links.astro`, `ApplicantModal.module.css`
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** Close buttons had only 4–6px padding giving ~28–32px effective target.
- **Fix:** `links.astro` `.modal-close`: padding 4px → 12px with min 48x48px. `ApplicantModal.module.css` `.closeButton`: added `min-width: 48px; min-height: 48px`.

### [MEDIUM] ApplicantModal: no focus trap, not using native dialog

- **Date:** 2026-04-06
- **File:** `src/components/admin/ApplicantModal.tsx`
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** Modal used a custom overlay div with no focus trap. Keyboard users could tab behind the modal.
- **Fix:** Converted to native `<dialog role="dialog" aria-modal="true">` with `.showModal()`. Browser provides focus trap natively. Escape key handled via dialog's `cancel` event.

### [MEDIUM] HomeShows: div with role="button" should be a button element

- **Date:** 2026-04-06
- **File:** `src/components/home/HomeShows.astro`
- **Status:** Fixed (2026-04-07)
- **Severity:** Medium
- **What happened:** Notify-me show card was `<div role="button" tabindex="0">` — no native keyboard activation or semantics.
- **Fix:** Changed to `<button type="button">`. Added `width: 100%; font: inherit; text-align: left` to `.show-card` CSS for button reset. Removed `role="button"` and `tabindex="0"`.

### [LOW] No aria-current="page" on active nav links

- **Date:** 2026-04-06
- **File:** `src/components/home/HomeNav.astro`, `src/components/layout/PageNav.astro`
- **Status:** Fixed (2026-04-07)
- **Severity:** Low
- **What happened:** Navigation links didn't indicate active page to screen readers.
- **Fix:** Used `Astro.url.pathname` in both nav components to set `aria-current="page"` on matching links.

### [LOW] AdminLogin: inputs rely on placeholder instead of visible labels

- **Date:** 2026-04-06
- **File:** `src/components/admin/AdminLogin.tsx`
- **Status:** Fixed (2026-04-07)
- **Severity:** Low
- **What happened:** Email and password inputs used only placeholder text with no visible label. Placeholders disappear on typing.
- **Fix:** Added `<label htmlFor="admin-email">` and `<label htmlFor="admin-password">` with styled `.label` CSS class. Removed redundant `aria-label` attributes.

## Fixed

### [MEDIUM] FAQ page hero references deleted image (gmd-37.webp)

- **Date:** 2026-04-07
- **File:** `src/pages/faq.astro:95`
- **Status:** Fixed (2026-04-07)
- **What happened:** `gmd-37.webp` was deleted but `faq.astro` still referenced it, causing a broken image in the FAQ hero.
- **Fix:** Replaced with `on-stage.webp`.

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
- **What happened:** Password was compared against the literal string `"secret"` instead of reading from `VITE_ADMIN_PASSWORD` env var (which is set to `REDACTED`). Anyone trying to log in with the intended password would be rejected.
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
