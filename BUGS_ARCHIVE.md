# Bugs Archive

This file stores non-active issues removed from `BUGS.md` after a full repo audit on 2026-04-20.

Reopened items stay in `BUGS.md`; this archive only holds issues that are no longer actively tracked.

## Verified Fixed

### From 2026-04-20 Full Backlog Pass (Codex + Claude)

- `[MEDIUM] No runtime input validation on POST API routes`
  Original date: 2026-04-09. Fixed: `src/lib/schemas.ts` added with Zod schemas for all six POST routes. All routes now use `safeParse()` instead of unsafe `as TypeCast`. Returns 400 with structured error on parse failure.

- `[MEDIUM] Spice List section still double-asks subscribed users for email`
  Original date: 2026-04-08. Fixed: `src/components/home/HomeSignup.astro` now reads `gmd-popup-subscribed` from localStorage on load and renders an already-subscribed state instead of the email form.

- `[LOW] Home nav scrolled state does not emphasize the tickets CTA`
  Original date: 2026-04-08. Fixed: `src/components/home/HomeNav.astro` adds `box-shadow` to `.home-nav.scrolled .nav-pill.primary` so the CTA visually pops after scroll.

- `[LOW] Contact email usage is still inconsistent across pages`
  Original date: 2026-04-08. Fixed: `src/data/socials.ts` `SOCIAL_URLS.email` was already `contact@garammasaladating.com`. `press@` retained only for the explicit "Booking & Press Inquiries" link in `links.astro`. No remaining `hello@` usage on public pages.

- `[LOW] New image optimization pipeline from the audit was not completed cleanly`
  Original date: 2026-04-08. Fixed: `scripts/optimize-images.js` rewritten to use `source-images/` as the canonical input directory with an explicit source manifest, pre-run validation that exits non-zero if any source is missing, and clear header documentation.

- `[MEDIUM] No rate limiting on API endpoints`
  Original date: 2026-04-04. Fixed: `src/lib/rateLimit.ts` extended with `contestantClaimLimiter`, `stageWaiverLimiter`, and `getClientIp()` helper. `checkRateLimit()` wired into all six public POST routes: `notify-application`, `capture-lead`, `contestant-prep-auth`, `update-lead`, `contestant-claim`, `stage-waiver`.

- `[MEDIUM] Public capture-lead endpoint forwards unauthenticated writes to Firestore`
  Original date: 2026-04-10. Fixed: `capture-lead.ts` now validates, rate limits, checks the honeypot, and writes leads with the server Firestore credential. Direct client creates to `leads` are denied in `firestore.rules`.

- `[LOW] CSP uses unsafe-inline weakening XSS protection`
  Original date: 2026-04-04. Reopened on 2026-05-16: current `vercel.json` still includes `script-src 'unsafe-inline'`, and `src/components/posthog.astro` still contains an inline executable script. Tracked again in `BUGS.md`.

- `[MEDIUM] No CAPTCHA or rate limiting on application form`
  Original date: 2026-04-04. Partially resolved for the `capture-lead` path (rate limiting + honeypot). The apply-form App Check enforcement remains open and tracked as a separate active bug.

- `[LOW] No pagination in AdminDashboard`
  Original date: 2026-04-04. Fixed: `src/components/admin/AdminDashboard.tsx` replaced `getDocs(collection(...))` with paginated queries using `query`, `orderBy("submittedAt", "desc")`, `limit`, and `startAfter`.

- `[LOW] Modal close (X) button showed red focus ring on mobile`
  Original date: 2026-04-16. Fixed: `:focus-visible` rules on modal close buttons now wrapped in `@media (pointer: fine)` in `HomeShows.astro`, `Modal.astro`, `TermsModal.module.css`, and `ApplicantModal.module.css`.

- `[LOW] Inline styles still remain in admin surfaces after CSS-module cleanup`
  Original date: 2026-03-12. Fixed: Three real inline style cases in `AdminDashboard.tsx` moved to `AdminDashboard.module.css`. The `--status-color` bridge in `ApplicantModal.tsx` retained with an explanatory comment (intentional CSS variable bridge for runtime-dynamic values).

### Core Repo Bugs

- `[LOW] Missing image: cupid-garden.webp causes 404 on every apply page load`
  Original date: 2026-04-13. Audit result: Verified fixed. `src/pages/apply.astro` no longer references `cupid-garden.webp`.

- `[HIGH] Firestore applications collection has no field validation on create`
  Original date: 2026-04-09. Audit result: Verified fixed. `firestore.rules` now gates `applications` create behind `request.auth != null && validApplication()`.

- `[HIGH] Homepage still emits duplicate FAQPage schema`
  Original date: 2026-04-08. Audit result: Verified fixed. `src/pages/index.astro` no longer emits homepage `FAQPage` JSON-LD; `src/pages/faq.astro` remains the canonical owner.

- `[MEDIUM] SVG-only buttons missing aria-label (accessibility)`
  Original date: 2026-04-08. Audit result: Verified fixed. Modal close buttons carry `aria-label="Close"` in the audited components.

- `[HIGH] Firebase Auth blocked by CSP in production — apply form silently fails`
  Original date: 2026-04-07. Audit result: Verified fixed. `vercel.json` now includes both `https://identitytoolkit.googleapis.com` and `https://securetoken.googleapis.com` in `connect-src`.

- `[MEDIUM] CORS config allows all origins with DELETE method`
  Original date: 2026-04-04. Audit result: Verified fixed. `cors.json` is restricted to `https://garammasaladating.com` with `GET` and `PUT` only.

- `[HIGH] Color contrast: #888 (--muted) fails WCAG AA on #FFF8F0`
  Original date: 2026-04-06. Audit result: Verified fixed. `src/index.css` now sets `--muted: #6b6b6b`.

- `[LOW] Color contrast: #666 (--text-light) improved proactively`
  Original date: 2026-04-06. Audit result: Verified fixed. `src/index.css` now sets `--text-light: #595959`.

- `[MEDIUM] outline:none on form inputs without visible focus replacement`
  Original date: 2026-04-06. Audit result: Verified fixed. Global `:focus-visible` is present in `src/index.css`, and the original targeted `outline: none` removals were addressed.

- `[MEDIUM] Social icon touch targets 40x40px (below 44px WCAG minimum)`
  Original date: 2026-04-06. Audit result: Verified fixed. `src/pages/links.astro` uses `var(--touch-target)` for `.social-icon` width and height.

- `[MEDIUM] Modal close buttons too small (~28px effective area)`
  Original date: 2026-04-06. Audit result: Verified fixed. `src/pages/links.astro` and `src/components/admin/ApplicantModal.module.css` now use 48px-class touch targets.

- `[MEDIUM] ApplicantModal: no focus trap, not using native dialog`
  Original date: 2026-04-06. Audit result: Verified fixed. `ApplicantModal.tsx` now renders through the shared `Modal` dialog component instead of a custom overlay.

- `[MEDIUM] HomeShows: div with role="button" should be a button element`
  Original date: 2026-04-06. Audit result: Verified fixed. `src/components/home/HomeShows.astro` uses a real `<button type="button">` for notify cards.

- `[LOW] No aria-current="page" on active nav links`
  Original date: 2026-04-06. Audit result: Verified fixed. Both nav components now set `aria-current="page"` from `Astro.url.pathname`.

- `[LOW] AdminLogin: inputs rely on placeholder instead of visible labels`
  Original date: 2026-04-06. Audit result: Verified fixed. `AdminLogin.tsx` renders visible `<label>` elements for email and password.

- `[MEDIUM] FAQ page hero references deleted image (gmd-37.webp)`
  Original date: 2026-04-07. Audit result: Verified fixed. `src/pages/faq.astro` now uses a different hero image and no longer references `gmd-37.webp`.

- `[MEDIUM] Debug console.log leaks PII to browser console`
  Original date: 2026-03-12. Audit result: Verified fixed. The current `AdminDashboard.tsx` no longer contains the logged snapshot dump.

- `[MEDIUM] Admin dashboard shows infinite loading on fetch error`
  Original date: 2026-03-12. Audit result: Verified fixed. `AdminDashboard.tsx` now has `fetchError` state and a `Try again` UI.

- `[LOW] Unused searchableLocation export — dead code`
  Original date: 2026-03-12. Audit result: Verified fixed. `src/utils/locationDisplay.ts` exports only `formatLocation()`.

- `[LOW] ESLint error — ternary used as expression statement`
  Original date: 2026-03-12. Audit result: Verified fixed. `ApplicantCard.tsx` now uses `if (onDelete) onDelete(); else onRestore?.();`.

- `[LOW] Large bundle size (9.5MB uncompressed JS)`
  Original date: 2026-03-12. Audit result: Verified fixed at the root-cause level. `src/lib/citySearch.ts` now loads `country-state-city` via dynamic `import()`.

### From PR #11 — Site Rewrite

- `[LOW] Photo size validation off-by-one (client vs storage.rules)`
  Original date: 2026-04-08. Audit result: Verified fixed. `src/components/apply/useApplyForm.ts` rejects files at exactly 5MB with `>= 5 * 1024 * 1024`, and the test suite covers the boundary.

- `[MEDIUM] Instagram "@" alone passes validation, creates invalid Firestore doc`
  Original date: 2026-04-08. Audit result: Verified fixed. `normalizeInstagramHandle()` is used in validation and submission paths, and the tests cover bare `@` input.

### From Mid-April Backlog

- `[MEDIUM] Apply form success state did not scroll to top on mobile`
  Original date: 2026-04-16. Audit result: Verified fixed. `ApplySuccessPanel.tsx` now scrolls the viewport to top on mount.

- `[MEDIUM] "Don't see your city" modal skipped the phone-number step`
  Original date: 2026-04-16. Audit result: Verified fixed. `HomeShows.astro` now has `city-form` -> `city-phone-form` -> success flow.

- `[LOW] Homepage CTAs all said "Grab My Spot"`
  Original date: 2026-04-16. Audit result: Verified fixed. The homepage CTAs are now differentiated (`Get Tickets`, `Book My Seat`, `I'm In`).

### From PR #12 — Site Rewrite

- `cityMode captures no city on tickets page`
  Original source: PR #12. Audit result: Verified fixed. The tickets page no longer passes `cityMode={true}` into the request-city `LeadCaptureModal`.

- `identifyLead() called with Instagram handle corrupts PostHog identity`
  Original source: PR #12. Audit result: Verified fixed. The apply flow no longer identifies users with an Instagram handle.

- `Phone update API: non-2xx responses show false success`
  Original source: PR #12. Audit result: Verified fixed. `LeadCaptureModal.astro` now checks `res.ok` before advancing to success.

- `No timeout on Firestore API request in capture-lead`
  Original source: PR #12. Audit result: Verified fixed. `capture-lead.ts` uses `AbortController` with a 5-second timeout.

- `Raw Firestore error text returned to clients`
  Original source: PR #12. Audit result: Verified fixed. `capture-lead.ts` logs raw Firestore errors server-side only and returns a generic client error.

- `update-lead allows phone overwrite without ownership proof`
  Original source: PR #12. Audit result: Verified fixed. `update-lead.ts` now requires an `updateToken` and verifies it server-side.

- `Door time calculation can produce timestamp after show start time`
  Original source: PR #12. Audit result: Verified fixed. `src/utils/eventSchema.ts` no longer contains the earlier clamping pattern; `subtractMinutes()` now performs direct subtraction.

- `Duplicate brand name in sponsorship page title`
  Original source: PR #12. Audit result: Verified fixed. `src/pages/sponsorship.astro` sets `const TITLE = "Sponsorship"`.

- `Pre-commit hook lacks fail-fast, checks can be silently bypassed`
  Original source: PR #12. Audit result: Verified fixed. `.husky/pre-commit` starts with `set -e`.

- `Blank source prop produces malformed lead attribution`
  Original source: PR #12. Audit result: Verified fixed. `NotifyModal.astro` now uses `dataset.source?.trim() || "notify-modal"`.

- `Explicit city slugs in NotifyModal not sanitized`
  Original source: PR #12. Audit result: Verified fixed. `NotifyModal.astro` normalizes explicit and fallback city slugs through `toCitySlug()`.

### From CodeRabbit Batch 2

- `Duplicate keyframes popupOut / modalOut in index.css`
  Original source: CodeRabbit batch 2. Audit result: Verified fixed. `src/index.css` contains one `@keyframes popupOut` and one `@keyframes modalOut`.

- `HomeShows.astro empty city string passed to analytics`
  Original source: CodeRabbit batch 2. Audit result: Verified fixed. `HomeShows.astro` now conditionally spreads geo props only when values exist.

## Stale / No Longer True

- `[LOW] Leads collection allows unauthenticated phone updates`
  Original date: 2026-04-09. Audit result: No longer true. Current `firestore.rules` only allow `update` on `leads` when `request.auth != null`.

## Superseded By Rewrite

- `[MEDIUM] Apply page backdrop dismiss always navigates to landing page`
  Original date: 2026-03-13. Audit result: Superseded by rewrite. The old implementation path is gone; the current apply flow no longer matches the code described in the bug.

- `[CRITICAL] Admin password hardcoded as "secret" instead of env var`
  Original date: 2026-03-12. Audit result: Superseded by rewrite. Current admin auth uses Firebase Auth rather than a local env-password comparison.

- `[MEDIUM] Font CSS variable typo — var(--font-dm) doesn't exist`
  Original date: 2026-03-12. Audit result: Superseded by rewrite. The referenced `LinksPage.tsx` file is gone in the current repo.

- `[LOW] Pointless variable alias sortedPress = pressItems`
  Original date: 2026-03-12. Audit result: Superseded by rewrite. The referenced `LinksPage.tsx` file is gone.

- `[LOW] ESLint error — useCallback self-reference ordering`
  Original date: 2026-03-12. Audit result: Superseded by rewrite. The referenced `src/hooks/useMouseParallax.ts` path no longer exists.

- `[LOW] ESLint error — setState in useEffect body`
  Original date: 2026-03-12. Audit result: Superseded by rewrite. The referenced `src/pages/AdminPage.tsx` path is gone and the current admin entrypoint uses a different auth flow.

- `HomeFAQ.astro no transitionend timeout fallback`
  Original source: CodeRabbit batch 2. Audit result: Superseded by rewrite. The current FAQ animation implementation is materially different from the one described in the original note.
