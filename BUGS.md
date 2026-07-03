# Bugs

## Open

### [LOW] Missing image: cupid-garden.webp causes 404 on every apply page load

- **Date:** 2026-04-13
- **File:** `src/pages/apply.astro:23`
- **Status:** Fixed (2026-07-03)
- **Severity:** Low
- **What happened:** Reference to the missing image was removed from `apply.astro`.

### [HIGH] Firestore applications collection has no field validation on create

- **Date:** 2026-04-09
- **File:** `firestore.rules:36, 40`
- **Status:** Fixed (prior session)
- **Severity:** High
- **What happened:** `validApplication()` function was added to `firestore.rules` with `hasOnly`, `hasAll`, type checks, length limits, and enum validation — matching the `validLead()` pattern. Cloudflare Turnstile CAPTCHA also added to the apply form (wave-2 work).

### [MEDIUM] No runtime input validation on POST API routes

- **Date:** 2026-04-09
- **File:** `src/pages/api/notify-application.ts:105`
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** Replaced unsafe `as ApplicationNotification` cast with a full Zod schema (`ApplicationSchema`) validating all 15+ fields including types, lengths, email format, URL format, and enum values. Returns 400 on schema failure.

### [LOW] Leads collection allows unauthenticated phone updates

- **Date:** 2026-04-09
- **File:** `firestore.rules:45`
- **Status:** Resolved by design (2026-07-03)
- **Severity:** Low
- **What happened:** Confirmed intentional. The step-2 phone capture runs from the browser without auth — the caller needs the Firestore doc ID returned by `/api/capture-lead` to reach this path. Added a comment to `firestore.rules` explaining the design and the mitigation (doc ID as implicit ownership proof, field-only restriction).

### [HIGH] Homepage still emits duplicate FAQPage schema

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`, `src/pages/faq.astro`
- **Status:** Fixed (prior session)
- **Severity:** High
- **What happened:** The `faqJsonLd` block was removed from `src/pages/index.astro`. Only `/faq` emits `FAQPage` structured data.

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
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** `captureLead()` in `src/lib/leadSubmission.ts` now sets `gmd-popup-subscribed` on every successful email capture. HomeSignup already read this key — the gap was that LeadCaptureModal, NotifyModal, HomeShows and city pages called `captureLead` without setting the key. Fixing it in one place (the shared function) covers all call sites.

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
- **Status:** Fixed (prior session)
- **Severity:** Low
- **What happened:** `.home-nav.scrolled .nav-pill.primary` now adds `box-shadow: 0 2px 8px rgba(220,38,38,0.3)` and `transform: scale(1.03)` with 200ms ease-out transitions. Both are suppressed under `prefers-reduced-motion`.

### [LOW] Contact email usage is still inconsistent across pages

- **Date:** 2026-04-08
- **File:** `src/pages/faq.astro`, `src/pages/links.astro`
- **Status:** Resolved by design
- **Severity:** Low
- **What happened:** `contact@garammasaladating.com` is the canonical public contact (schema, legal, socials, llms.txt, FAQ footer). `press@garammasaladating.com` is intentionally used only in press/partnership-specific contexts (FAQ collaboration answer, links page press section). The two-inbox model is deliberate.

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
- **Status:** Fixed (prior session)
- **Severity:** Medium
- **What happened:** Audited all button elements across .astro and .tsx files. Every SVG-only button (close buttons in NotifyModal, HomeShows modal, city page modal, index popup, and the Modal.astro base component) already has `aria-label="Close"`. Share buttons in TicketCard have `aria-label={`Share ${cityLabel} show`}`. No offending buttons remain.

### [LOW] Contestant-prep page has empty meta description

- **Date:** 2026-04-08
- **File:** `src/pages/contestant-prep.astro`
- **Status:** Fixed (prior session)
- **Severity:** Low
- **What happened:** Description set to "Preparation guide for confirmed Garam Masala Dating contestants." in `contestant-prep.astro`.

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
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** Cloudflare Turnstile invisible CAPTCHA added to the apply form. Server-side verification at `/api/verify-turnstile` blocks submission if token is missing or invalid. Opt-in via `PUBLIC_TURNSTILE_SITE_KEY` env var so localhost still works without keys.

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

# From PR #11 — Site Rewrite

### [LOW] Photo size validation off-by-one (client vs storage.rules)

- **Date:** 2026-04-08
- **File:** `src/components/apply/useApplyForm.ts:153`
- **Source:** CodeRabbit PR #11
- **Status:** Fixed (2026-07-03)
- **Severity:** Low
- **What happened:** Changed `f.size > MAX_PHOTO_BYTES` to `>=` in the oversized filter and `<= MAX_PHOTO_BYTES` to `<` in the valid filter — now matches storage.rules strict less-than.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3046995946

### [MEDIUM] Instagram "@" alone passes validation, creates invalid Firestore doc

- **Date:** 2026-04-08
- **File:** `src/components/apply/useApplyForm.ts:190`
- **Source:** CodeRabbit PR #11
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** Both the `isFormValid()` guard and the submit-time validation now strip the leading `@` before checking emptiness: `!form.instagram.trim().replace(/^@/, "")`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3046995985

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

---

# From PR #12 — Site Rewrite

## cityMode captures no city on tickets page

- **File:** `src/pages/tickets.astro:233`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed — removed `cityMode={true}` from the "Request Your City" LeadCaptureModal since the trigger has no `data-open-modal-city`. Lead is still captured with `source="tickets-city-request"`.
- **Comment:** The "Request Your City" modal used `cityMode={true}` but the trigger button had no `data-open-modal-city` attribute, so the hidden city input was never populated. Users submitted the form thinking their city was sent, but no city data was ever captured.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086482

## identifyLead() called with Instagram handle corrupts PostHog identity

- **File:** `src/components/apply/useApplyForm.ts:320`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (2026-07-03)
- **Comment:** Changed `identifier = form.email.trim() || igHandle` to `identifier = form.email.trim()`. If email is absent, the identifyLead call is skipped. Instagram handle is still passed as a property but never as the distinct_id or email field.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383967

## Phone update API: non-2xx responses show false success

- **File:** `src/components/LeadCaptureModal.astro:344`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (prior session)
- **Comment:** LeadCaptureModal was refactored to call `updateLeadPhone()` from `leadSubmission.ts` instead of raw `fetch`. `updateLeadPhone` already checks `res.ok` and throws on failure, which the surrounding try/catch surfaces as an error message.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383980

## Unauthenticated Firestore writes on capture-lead

- **File:** `src/pages/api/capture-lead.ts:85`
- **Source:** CodeRabbit PR #12
- **Status:** Open
- **Comment:** The route accepts unauthenticated public input with no rate limiting or CAPTCHA, forwarding directly to a writable `leads` collection. Vulnerable to scripted spam and cost amplification.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383999

## No timeout on Firestore API request in capture-lead

- **File:** `src/pages/api/capture-lead.ts:85`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (2026-07-03)
- **Comment:** Added `signal: AbortSignal.timeout(8000)` to `createLeadDocument()` fetch call. Requests stalled beyond 8 seconds now abort and surface a 500 to the client.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384003

## Raw Firestore error text returned to clients

- **File:** `src/pages/api/capture-lead.ts:92`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (2026-07-03)
- **Comment:** Removed `detail: errText` from error response. Firestore error text is now logged server-side via `console.error`. Client receives only the generic "Failed to save lead" message.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384008

## update-lead allows phone overwrite without ownership proof

- **File:** `src/pages/api/update-lead.ts:50`
- **Source:** CodeRabbit PR #12
- **Status:** Open
- **Comment:** The route trusts a caller-supplied `id` with no ownership verification. Anyone who obtains a lead document ID can overwrite its phone number. Should require a signed update token tied to the original email capture session.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384013

## Door time calculation can produce timestamp after show start time

- **File:** `src/utils/eventSchema.ts`
- **Source:** CodeRabbit PR #12
- **Status:** Resolved (no bug present)
- **Comment:** `subtractMinutes(start, 30)` computes `h * 60 + m - 30` with `Math.floor` — always produces a time 30 minutes before start. No clamping logic exists that could produce a later time. The referenced behavior does not reproduce in the current implementation.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384028

## Duplicate brand name in sponsorship page title

- **File:** `src/pages/sponsorship.astro:13`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed — changed TITLE to `"Sponsorship"`; BaseLayout appends `| Garam Masala Dating` giving `Sponsorship | Garam Masala Dating`
- **Comment:** The `TITLE` constant includes "Garam Masala Dating" and `BaseLayout` appends " | Garam Masala Dating" again, resulting in the SEO title "Sponsor Garam Masala Dating | Garam Masala Dating".
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086478

## Pre-commit hook lacks fail-fast, checks can be silently bypassed

- **File:** `.husky/pre-commit:3`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed — added `set -e` as first line of `.husky/pre-commit`
- **Comment:** The hook runs `lint-staged`, `npm run check`, and `npm run test` without `set -e`. If `npm run check` fails but `npm run test` passes, the hook exits 0 and the commit proceeds despite type errors or lint failures.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3062105613

## Blank source prop produces malformed lead attribution

- **File:** `src/components/NotifyModal.astro:137`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (2026-07-03)
- **Comment:** Changed `dataset.source ?? "notify-modal"` to `dataset.source?.trim() || "notify-modal"` so empty-string props fall through to the default just like undefined.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3063506928

## Explicit city slugs in NotifyModal not sanitized

- **File:** `src/components/NotifyModal.astro:170`
- **Source:** CodeRabbit PR #12
- **Status:** Fixed (2026-07-03)
- **Comment:** Both paths now run through `toCitySlug()`: `const rawSlug = el.dataset.notifyCitySlug?.trim(); const citySlug = rawSlug ? toCitySlug(rawSlug) : toCitySlug(city)`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3063506949

---

# From CodeRabbit batch 2 (2026-04-10)

## Duplicate keyframes popupOut / modalOut in index.css

- **File:** `src/index.css:222-241`
- **Source:** CodeRabbit batch 2
- **Status:** Fixed (2026-07-03)
- **Comment:** Consolidated both identical keyframes into a single `@keyframes dialog-out`. Updated references in `index.astro` (popup close) and `HomeShows.astro` (city modal close).
- **Link:** n/a

## HomeFAQ.astro no transitionend timeout fallback

- **File:** `src/components/home/HomeFAQ.astro:55-88`
- **Source:** CodeRabbit batch 2
- **Status:** Fixed (2026-07-03)
- **Comment:** `closeAnimated` now uses a `done` flag + `setTimeout(cleanup, 400)` fallback alongside the `transitionend` listener. If the transition never fires (hidden ancestor, display:none, etc.), the `is-closing` class and `item.open` are cleaned up after 400ms regardless.
- **Link:** n/a

## HomeShows.astro empty city string passed to analytics

- **File:** `src/components/home/HomeShows.astro:111-124`
- **Source:** CodeRabbit batch 2
- **Status:** Fixed (2026-07-03)
- **Comment:** `identifyLead` and `trackLeadEvent` calls now use `const cityProp = city ? { city } : {}` and spread it conditionally, so `city` is never included when empty.
- **Link:** n/a

---

# Dead public assets (2026-04-13)

### [LOW] Confirmed unused files in public/

- **Date:** 2026-04-13
- **Files:**
  - `public/images/asset-3.svg`
  - `public/images/journal/journal-featured.webp`
  - `public/images/promo/links-hero.webp`
  - `public/images/promo/tickets-hero.webp`
- **Status:** Fixed (prior session)
- **Severity:** Low
- **What happened:** All four files were deleted from the public directory.

### [LOW] Hero variant files may be orphaned

- **Date:** 2026-04-13
- **Files:**
  - `public/images/hero/hero.avif`
  - `public/images/hero/hero-mobile.webp`
  - `public/images/hero/hero-mobile.avif`
- **Status:** Fixed (2026-07-03)
- **Severity:** Low
- **What happened:** `hero-mobile.*` were already gone. Confirmed `hero.avif` had no references anywhere in the codebase and deleted it. Updated CLAUDE.md to remove stale AVIF preload note.
