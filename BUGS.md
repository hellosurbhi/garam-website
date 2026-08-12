# Bugs

## Open

### [CRITICAL] Apply submissions with large photos lost + undeployed security rules left PII readable

- **Date:** 2026-07-13 (partial failures since ~2026-07-05; record corrected 2026-07-13 after production verification)
- **File:** `storage.rules`, `firestore.rules`, `src/components/apply/useApplyForm.ts`
- **Status:** Code fixed (2026-07-13), pending rules deploy via Firebase CLI (`--only firestore:rules,storage`)
- **Severity:** Critical (lost applicants from paid traffic + live PII exposure until the rules deploy)
- **What happened:** Two compounding problems, both traced to rules changes merging without the manual Firebase deploy. (1) PR #110 (July 5) raised the client photo cap from 5 MB to 15 MB but its `storage.rules` bump was never deployed, so applicants with photos over the deployed cap (exactly the large iPhone photos the bump was for) failed at upload with `storage/unauthorized` and their applications were lost: confirmed failure bursts July 7, 9, 12 and 13 including paid LA campaign traffic. Smaller-photo submissions kept working, which is why the pipeline looked alive. (2) PR #115's security rules (admin-only reads for applicant photos and PII docs) were also never deployed, leaving the pre-#115 posture live: any visitor with an anonymous session can read applicant photos, and per #115's own audit, applicant/lead PII documents. An earlier version of this entry claimed a total outage caused by `getDownloadURL()` under the #115 rules; production verification (successful submission + applications arriving all week) disproved that. The `getDownloadURL()` mechanism was real but latent: deploying #115's rules without this fix WOULD have taken the form fully down. Fix: path-based `photoPaths` + admin `getBlob()` rendering, client-side compression (puts every photo under any cap), owner-tagged cleanup, emulator rules tests locking the client/rules contract, real-time failure alerting, 6-hour synthetic monitor and a deployed-vs-repo rules drift check so merged-but-undeployed rules can never sit silent again.

### [HIGH] Contestant workflow: portal + admin components still lack unit test coverage

- **Date:** 2026-07-16
- **File:** `src/components/ContestantPortal.tsx` (#97), `src/components/admin/TaskInbox.tsx` (#97), `src/components/admin/ContestantFunnel.tsx` (#99)
- **Status:** Open
- **Severity:** High
- **What happened:** All five phases of the contestant workflow project merged 2026-07-03 to 07-05 with zero unit tests, confirmed by a Stryker mutation report showing these files scoring 0 to 8% mutation coverage. The backend half of the gap (Zoho SMTP mailer, cal.com webhook, post-show and followups cron jobs) now has unit coverage, see CHANGELOG. The remaining three files are UI components: `ContestantPortal.tsx` is public facing and deferred to its own follow-up PR (not dropped, see ENHANCEMENTS.md); `TaskInbox.tsx` and `ContestantFunnel.tsx` are admin dashboard screens the operator plans to rewrite, so their tests are deferred until after that rewrite lands rather than writing tests for code about to be replaced (see ENHANCEMENTS.md).
- **Impact:** A regression in the contestant portal waiver flow or the admin Task Inbox/funnel view would not be caught by the test suite; only manual QA would notice.
- **Fix:** Write `ContestantPortal.tsx` tests in a dedicated follow-up PR (stateful component, needs `vi.stubGlobal("fetch")` plus `waitFor`). Write `TaskInbox.tsx`/`ContestantFunnel.tsx` tests against their post-rewrite replacements.

### [HIGH] Dev server cannot transform TypeScript in astro component scripts

- **Date:** 2026-07-05
- **File:** any `.astro` file with TypeScript inside a `<script>` tag (CookieConsent, HomeSignup, NotifyModal, index and more)
- **Status:** Fixed (2026-07-05) for CookieConsent; upstream Astro/Vite Rolldown issue remains open for other files
- **Severity:** High (dev only; production builds are unaffected)
- **What happened:** In `npm run dev`, the `vite:oxc` transform parses extracted astro scripts as plain JavaScript, so any TypeScript syntax (a `type` import specifier, `as` casts, non-null `!`) throws `[PARSE_ERROR]` and the script module 500s. Pages render but their client scripts never execute, which makes features like the cookie banner look broken in dev while working fine in the built site.
- **Fix applied to CookieConsent:** Moved all banner logic into `src/lib/cookieConsentInit.ts`, a plain TypeScript module imported via Vite's normal TS pipeline. The `<script>` in `CookieConsent.astro` is now a bare `import { initCookieConsent } from "@/lib/cookieConsentInit"; initCookieConsent();` with zero TS syntax — so the oxc extractor never chokes on it. Full typing is preserved in the module.
- **Remaining:** Other `.astro` files with TS-syntax inline scripts are still affected. Same pattern applies: extract logic to a `.ts` module, keep the inline `<script>` as a bare import. Track for a follow-up sweep if the upstream Astro/Vite Rolldown fix does not land.

### [HIGH] Cookie consent banner reappears on every page and covers the submit button

- **Date:** 2026-07-05
- **File:** `src/components/CookieConsent.astro`
- **Status:** Fixed (2026-07-05)
- **Severity:** High
- **What happened:** The banner decided visibility at build time via `readConsent()` in Astro frontmatter, where localStorage does not exist, so every static page shipped with the banner visible and the client script never re-checked on load. Clicking a button hid it for that page only. On mobile the stacked layout covered the apply submit button and sticky CTAs. Fix: banner ships hidden, the client script reveals it only when no valid consent record exists, Manage loads saved preferences before opening the dialog, Escape closes the dialog again, and the mobile layout is compact (single message line, three equal-width buttons on one row, 48px touch targets). Banner copy moved to `data/copy.ts`.

### [MEDIUM] Photo upload limit rejected large iPhone photos

- **Date:** 2026-07-05
- **File:** `src/components/apply/useApplyForm.ts`, `storage.rules`
- **Status:** Fixed (2026-07-05)
- **Severity:** Medium
- **What happened:** The 5 MB cap rejected recent iPhone photos (48 MP HEIC runs up to about 10 MB). Raised to 15 MB in both the client check and storage.rules, aligned on strict less-than (the client previously accepted a file exactly at the limit that storage then rejected). storage.rules needs a Firebase deploy to take effect.

### [MEDIUM] Homepage Instagram reels showed facade covers instead of real embeds

- **Date:** 2026-07-05
- **File:** `src/components/home/HomeVideo.astro`
- **Status:** Fixed (2026-07-05)
- **Severity:** Medium
- **What happened:** The Wave 6 perf pass (PR #70) replaced the reel embeds with gradient covers showing only the Instagram logo; the real reel appeared only after a click. Restored the real `instagram-media` blockquotes with embed.js loading in idle time after window load, plus a 480px min-height per slot to hold layout while embeds hydrate. Accepted trade-off: embed.js (~50KB) is back on every homepage load.

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
- **Status:** Won't fix (2026-07-05)
- **Severity:** Medium
- **What happened:** Owner directive: the hero is intentional and stays as designed (shader plus gradient). No photo layer will be added.

### [MEDIUM] Home creators avatars were not upgraded to larger host photos

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeCreators.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout"; decide sizing fresh in the redesign. Note if revisited: `hosts/wyatt.avif` source is 269x290, which caps avatars at about 160px before visible upscaling.

### [MEDIUM] Hosts page still uses small individual avatar images

- **Date:** 2026-04-08
- **File:** `src/pages/hosts.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Experience section photo placement was missed

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeExperience.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Testimonials accent photo was not added

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeTestimonials.astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout".

### [MEDIUM] Journal decorative cupid artwork not implemented

- **Date:** 2026-04-08
- **File:** `src/pages/journal/index.astro`, `src/pages/journal/[slug].astro`
- **Status:** Deferred (2026-07-05)
- **Severity:** Medium
- **What happened:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Tracked in ENHANCEMENTS.md under "Finish full audit photo rollout". The `ai-art/cupid-garden.webp` asset exists and remains unused.

### [MEDIUM] Spice List section still double-asks subscribed users for email

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeSignup.astro`
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** `captureLead()` in `src/lib/leadSubmission.ts` now sets `gmd-popup-subscribed` on every successful email capture. HomeSignup already read this key — the gap was that LeadCaptureModal, NotifyModal, HomeShows and city pages called `captureLead` without setting the key. Fixing it in one place (the shared function) covers all call sites.

### [LOW] Popup CTA copy still uses weaker pre-audit wording

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`
- **Status:** Blocked on business decision (2026-07-05): no final offer exists yet. Tracked in ENHANCEMENTS.md under "Strengthen popup offer copy once the actual incentive is finalized".
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
- **Status:** Fixed (2026-07-05)
- **Severity:** Low
- **What happened:** The script referenced source files that no longer exist and wrote to a phantom `public/images/gallery/` directory. Now reads raws from `src/assets/show-raw/`, writes named webp files to `public/images/promo/`, produces the OG crop from the real raw, and is idempotent (skip-if-exists, `FORCE=1` to regenerate). Shared sharp helpers extracted to `scripts/lib/image-utils.js`, also used by `organize-images.js`. Registered as `npm run images:optimize`. Verified with two consecutive runs (second run all skips, zero diff on committed images).

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
- **Status:** Fixed (2026-07-05)
- **Severity:** Medium
- **What happened:** Per-IP Upstash sliding-window limits on eight POST routes: capture-lead, update-lead, notify-application, contestant-prep-auth, verify-turnstile, sync-orders, sync-leads-to-kit and stage-waiver. `src/lib/rateLimit.ts` was rewritten to lazy init and fail open when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset or Redis errors (the earlier module-scope version failed closed in prod with unset env). Admin ID-token routes and the HMAC-verified cal webhook are excluded as already authenticated. Inert until the Upstash env vars are set in Vercel.

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
- **What should happen:** Since the site is SSG, nonces do not apply; hashes do. Migrate to Astro's `experimental.csp` support, which computes hashes for inline scripts and styles at build time, then move the Content-Security-Policy header out of `vercel.json` so there is one source of truth.
- **Fix:** Dedicated PR (2026-07-05 triage decision): the migration touches every page's inline scripts and needs its own smoke-test pass, so it stays out of batch fixes.

### [MEDIUM] No server-side file-type validation on photo uploads

- **Date:** 2026-04-04
- **File:** `src/components/ApplyPage.tsx`
- **Status:** Fixed (PR #87 + PR #100)
- **Severity:** Medium
- **What happened:** `storage.rules` enforces auth, a contentType allowlist (jpeg, png, webp, heic) and the size cap server-side (PR #87). The client validates MIME type against the same allowlist before upload (PR #100). SVG is not on the allowlist. Residual gap: contentType is client-declared, so true magic-byte inspection would need a Cloud Function on `storage.object.finalize`; tracked in ENHANCEMENTS.md.

### [MEDIUM] No CAPTCHA or rate limiting on application form

- **Date:** 2026-04-04
- **File:** `src/components/ApplyPage.tsx`
- **Status:** Fixed (2026-07-03)
- **Severity:** Medium
- **What happened:** Cloudflare Turnstile invisible CAPTCHA added to the apply form. Server-side verification at `/api/verify-turnstile` blocks submission if token is missing or invalid. Opt-in via `PUBLIC_TURNSTILE_SITE_KEY` env var so localhost still works without keys.

### [LOW] No pagination in AdminDashboard

- **Date:** 2026-04-04
- **File:** `src/components/admin/AdminDashboard.tsx`
- **Status:** Fixed (PR #88)
- **Severity:** Low
- **What happened:** Cursor-based pagination landed in PR #88: `limit(50)` with `orderBy("submittedAt", "desc")`, `startAfter` cursor and a "Load more" button.

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
- **Status:** Fixed (2026-07-05)
- **Comment:** Per-IP rate limiting (10/min, Upstash sliding window) now guards the route, bounding scripted spam and cost amplification. Firestore rules `validLead()` continues to constrain document shape. The route stays intentionally unauthenticated: it is the public email capture path.
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
- **Status:** Fixed (2026-07-05)
- **Comment:** capture-lead now issues an HMAC-signed 10 minute token (`src/lib/leadToken.ts`) and update-lead derives the doc id from that token, ignoring any client-supplied id. Opt-in via `LEAD_UPDATE_SECRET`; the legacy doc-id path stays active until the env var is set so deploys are safe. Also fixed while in the route: raw Firestore error text was leaking to clients and the fetch had no timeout.
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

## Medium priority (auto-fix pending)

### DeepSeek — 20260713-103550

(Empty section: the reviewer emitted a zero-finding COMMIT_BLOCK; nothing was ever queued. Kept for the record.)

### DeepSeek — 20260713-142719

- [x] MEDIUM: `handleRestore` at line 290 calls `handleUpdate` with no single-flight guard — same Firestore round-trip risk as the delete that was fixed. at src/components/admin/AdminDashboard.tsx:290 — Fixed same day: `pendingAction` single-flight guard now covers delete, restore and participated.
- [x] MEDIUM: `handleParticipated` at line 295 calls `handleUpdate` with no single-flight guard — same Firestore round-trip risk as the delete that was fixed. at src/components/admin/AdminDashboard.tsx:295 — Fixed same day: `pendingAction` single-flight guard now covers delete, restore and participated.
- [x] MEDIUM: `handleRestore` is an async function but the caller `onRestore` in `ApplicantCard` is typed as `() => void` — the returned promise is discarded, so any error in restore is silently swallowed. at src/components/admin/AdminDashboard.tsx:290 — Not a live bug: `handleUpdate` catches every write error internally and surfaces a toast, so the discarded promise can never reject. Handlers now also wrap in try/finally.
- [x] MEDIUM: `handleParticipated` is an async function but the caller `onParticipated` in `ApplicantCard` is typed as `() => void` — the returned promise is discarded, so any error in participated is silently swallowed. at src/components/admin/AdminDashboard.tsx:295 — Not a live bug: same reasoning as above; all rejection paths are caught inside the handler chain.

### DeepSeek — 20260713-181721

- WONT-FIX (decision, do not re-file): reviewer asked to drop `set -e` from `.husky/pre-commit` as redundant with the `#!/bin/sh` shebang. Rejected: a shebang implies no error-exit behavior at all; `set -e` is load-bearing in a gate script and stays. At `.husky/pre-commit:2`.

### CodeRabbit — 20260713-173257

- [x] MEDIUM: Inconsistent heading levels in the `best-indian-dating-apps-ranked` countdown: items 7, 6, 5 used `h3` while items 4 through 1 used `h2`. (Entry was queued as an empty stub by the old header-only severity grep in the pre-commit hook; actual finding text restored by hand. Capture bug since fixed in `~/.claude/config/git-hooks/pre-commit` via `extract_severity`.) FIXED 2026-07-13: all seven items promoted to `h2` in `src/data/journal/app-alternatives.ts`, per Surbhi's call.

### DeepSeek — 20260713-173257

- [x] MEDIUM: `pop-culture-dating.ts` "best ways to meet" article body heading for position 4 has no corresponding `rankedItems` entry at `src/data/journal/pop-culture-dating.ts:681`
      DISPROVEN 2026-07-13, do not auto-fix: no such article exists; the post at that location is `dating-shows-south-asians-all-ranked` and its `rankedItems` array has all 7 contiguous positions. The countdown tests in `src/data/journal.test.ts` verify heading/position correspondence on every commit and pass.

### DeepSeek — 20260713-175426

- [x] MEDIUM: `ResizeObserver` observes `el.firstElementChild` and never re-observes if the child changes. at src/components/WaiverPanel.tsx — Resolved by design: `observer.disconnect()` in the effect cleanup drops every observed target per spec (no leak), and the child is the `WaiverDocument` article rendered from a compile-time constant, so its identity never changes within a mount.
- [x] MEDIUM: `handleScroll` is recreated each render and passed to `onScroll`. at src/components/WaiverPanel.tsx — Resolved by design: React delegates synthetic events at the root; a new handler identity per render does not re-register DOM listeners. Wrapping in useCallback would add noise with no behavior change.

### Codex (2026-07-17T15:12Z)

- MEDIUM `INACCURATE-HISTORY` in the `4c6e07a` commit body: won't fix, kept here so the same report is not re-filed. Both points are conceded as accurate. The em dash sits in `1f0a217`'s message, not `f1d5483`'s. And `widget_load_failed` existed before the fix in the `createWidget` catch paths and the inline embed timeout; what the fix added is firing it when the modal never opens after a click. The committed docs state both facts correctly, so the inaccuracies live only in the message of a commit already on origin, and rewriting a published commit message requires a force push, which is prohibited.

### Codex (2026-07-17T15:16Z)

- [ ] MEDIUM: `INACCURATE-POLICY` in the Codex 2026-07-17T15:12Z won't-fix rationale above: rewriting the published non-main commit would require a forced update, but it is not categorically prohibited. The governing rule permits `--force-with-lease` after a rebase and prohibits only bare `--force` and forced updates to main. The won't-fix choice may stand, but its stated rationale is false.

## High priority (from push reviews, fix first)

### Codex (2026-08-03T06:53Z)

Both findings critique the "Mobile Sticky CTA" writeup in ENHANCEMENTS.md, which was authored on the unmerged `feat/event-pages-tracked-checkout` branch and describes that branch's code. Evaluate when that branch's PR is reviewed.

- [ ] HIGH: [SCOPE-CREEP] `ENHANCEMENTS.md` sticky CTA entry broadens an event-page CTA request into a sitewide contract covering tickets and city pages without that universal scope appearing in the stated intent.
- [ ] HIGH: [UNSOURCED-CLAIM] `ENHANCEMENTS.md` sticky CTA entry makes current-code, traffic and existing-task claims without `file:line` evidence or command output.

### Codex (2026-08-03T07:15Z)

Applies to the unmerged `feat/event-pages-tracked-checkout` branch; fix there.

- [ ] HIGH: [UNRESOLVED-BACKLOG] The no-`eid` `InitiateCheckout` finding was pruned as resolved, but `f916f02` does not fully resolve it. `ticketCtaTracking.ts:42-58` adds `eid` client-side while the rendered link remains `/api/go/...`; `api/go/[slug].ts:58-60,93` still generates a fallback ID and fires CAPI for any unrecognized user agent. Browser prefetches using a normal browser user agent can therefore still be counted as conversions.

### Codex (2026-08-12T16:29Z)

This review ran on the merge of main into `fix/eventbrite-widget-silent-failure` (PR #159), so its diff was dominated by content already merged to main via other PRs; every finding below targets that main-side content, none of it authored on the PR branch. The SCOPE-CREEP and UNSOURCED-CLAIM findings on the ENHANCEMENTS.md sticky CTA entry are duplicates of the Codex 2026-08-03T06:53Z entries above and are not re-listed.

- [ ] HIGH: [FALSE-SUCCESS] `test/followups.test.ts:291-334` omits missing-recipient and delivery-failure cases. `src/pages/api/cron/followups.ts:256-277` records the briefing date and reports `briefingSent: true` even when no host email is configured or every send fails, preventing retries.
- [ ] HIGH: [SWALLOWED-ERROR] `test/post-show.test.ts:178-187` normalizes an SMTP failure without requiring any observable error. `src/pages/api/cron/post-show.ts:61-62` silently suppresses the failure and returns success.
- [ ] MEDIUM: [BOUNDARY-COVERAGE] `test/post-show.test.ts:144-166` uses days 1 and 11 but never tests the inclusive D3 and D10 boundaries claimed in the CHANGELOG entry for the contestant-workflow test coverage, leaving the relevant off-by-one mutations uncovered.
- CRITICAL `FABRICATED-REFERENCE` on the `e520120` commit body (test and check results stated without logs stored in the repo): won't fix, kept here so the same report is not re-filed. Two grounds. First, `e520120` is already published on main, merged via PR #158; it entered this review's diff only through the merge of main into the PR branch, and rewriting a published main commit message would require force-pushing main, which is prohibited without exception. Second, this repo intentionally stores no test logs as committed artifacts. The required "Lint, Types, Test, Build" check (`.github/workflows/ci.yml`) runs on pull requests targeting `main` and runs lint, `astro check`, the full vitest suite, the build and `npm audit`; it runs neither Stryker nor the scoped test command, so the commit body's specific historical counts (scoped 53/53, Stryker 0 to 8%) are not re-verified anywhere and stand only as that commit's contemporaneous report. What CI does guarantee is that the code currently on the branch passes the full suite before merge, which is the property the repo actually relies on.

### CodeRabbit PR #135 review — 2026-08-12 (deferred, heavy lifts; quick wins fixed same day)

- [ ] MEDIUM: `isSynthetic` remains in the public Firestore write schema, so an anonymous client can mark its own application synthetic and hide it from the dashboard. The notification-suppression half was closed same day (server derives synthetic from the verified email in `/api/notify-application`); removing the field from the public schema needs a trusted server-side write path for the monitor and matching rules-test updates.
- [ ] MEDIUM: photo previews in the apply form read every accepted file through `FileReader.readAsDataURL()` before compression; a multi-photo selection of large originals can hold hundreds of MB of base64 in memory on mobile. Switch previews to `URL.createObjectURL` with revocation. at src/components/apply/useApplyForm.ts:262
- [ ] MEDIUM: `contestant-claim`, `contestant-open-claim` and `contestant-show-claim` group several non-idempotent Firestore writes in one try block and return a retryable 500; a retry after a partial failure creates duplicate contestant records and waiver submissions. Needs idempotency keys or preflighting the fallible config (portal token signing) before the first write.
- [ ] LOW: `.github/workflows/synthetic-apply.yml` runs verification/cleanup only when Playwright succeeds; a submission written before a later assertion failure is left behind and can trip the 48-hour cleanup guard. Run cleanup unconditionally (`if: always()`).

### Codex (2026-08-12T17:53Z)

- [ ] HIGH: [FALSE-PAGER-SUCCESS] `src/lib/opsAlert.ts:81` swallows every delivery failure with `Promise.allSettled`, and `src/pages/api/alert-failure.ts:77` always returns 200. The workflow heartbeat and failure notification can therefore report success when neither email nor webhook delivered.
- [ ] HIGH: [NON-BLOCKING-RULES-GATE] `.github/workflows/ci.yml:63` adds the emulator suite as a separate job, but `scripts/setup-branch-protection.sh:79` requires only `Lint, Types, Test, Build`. A failed security-rules job does not block merging under the documented protection configuration.

- [ ] MEDIUM: `.github/workflows/synthetic-apply.yml:49` runs verification and cleanup only after Playwright succeeds. A submission that reaches Firestore before a later browser assertion fails is left behind. Once older than 48 hours, it can make the cleanup script refuse subsequent cleanup runs.
- [ ] MEDIUM: `src/data/waiverPage.ts:22` promises that a receipt was emailed, but `src/pages/api/stage-waiver.ts:131` intentionally returns success after receipt delivery fails. Users can receive a false confirmation.

### Codex (2026-08-12T18:28Z)

- [ ] HIGH: [PUBLIC-WEBHOOK-PII] `src/lib/opsAlert.ts:79` still sends `report.errorMessage` verbatim. Cron errors embed applicant email addresses at `src/pages/api/cron/followups.ts:110` and `src/pages/api/cron/post-show.ts:67`, so PII still reaches effectively public ntfy topics.
- [ ] HIGH: [PUSH-GUARD-BYPASS] `.husky/pre-push:4` checks the current branch, not the remote refs supplied to the hook. From a feature branch, `git push origin HEAD:main`, `git push origin main` or deletion of remote main bypasses the guard.
- [ ] HIGH: [BROKEN-SMOKE-SELECTOR] `tests/smoke/critical-flows.spec.ts:204` selects `apply-terms` on `/waiver`, but `StandaloneWaiverForm.tsx:205` has no such attribute. The waiver smoke flow now fails before submission.

### Codex (2026-08-12T18:28Z)

- [ ] MEDIUM: [PHOTO-PATH-MISMATCH] `firestore.rules:42` rejects spaces and Unicode while `useApplyForm.ts:444` copies the original filename suffix without sanitizing it. Small or fallback images can retain names such as `holiday photo`, upload successfully then have the application rejected by Firestore.
- [ ] MEDIUM: [FALSE-POSITIVE-RULE-TEST] The non-image test at `test/rules/apply-flow.rules-test.ts:87` omits required owner metadata. It now fails regardless of the content-type rule, so removing the image restriction would not make this regression test fail.

## Critical (round cap reached, push allowed, fix before merge)

### Codex (2026-08-12T16:37Z)

- CRITICAL: [FABRICATED-REFERENCE] Re-filed against the `e520120` commit body (1157/1157 full-suite tests, 53/53 scoped tests, zero check errors, 0 to 8% Stryker result, all stated without stored evidence): same won't-fix decision as the entry above, kept so the report is not re-filed a third time. The commit is published main history and the repo stores no test logs; the won't-fix rationale above now states the CI scope accurately (PRs targeting `main`; no Stryker, no scoped command, historical counts not re-verified). This entry is a recorded decision, not an open action item.

### Codex (2026-08-12T19:41Z)

- [ ] HIGH: [RECOVERY-ORDERING] `src/lib/eventbriteRecovery.ts:135-138` checks `event.defaultPrevented` before later listeners or ancestor listeners execute. If a partially initialized Eventbrite handler prevents default during bubbling, this fallback has already returned and the checkout CTA remains dead. `src/lib/eventbriteRecovery.test.ts:214-234` only tests a suppressing listener registered earlier on the same element.
- [ ] HIGH: [SCOPE-CREEP] `LESSONS.md:9` turns Eventbrite-specific timing and DOM behavior into constraints for “Any integration,” while `src/lib/navigation.ts:7-9` mandates the wrapper for all navigation. Neither universal rule is part of the stated Eventbrite recovery scope and the latter already conflicts with direct navigation at `src/layouts/BaseLayout.astro:347`.
- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:7-12` adds a separate script-load failure backlog item that explicitly identifies itself as outside PR #159’s review findings and does not trace to the stated commit intent.

The 2026-08-12T19:47Z re-review of the amended push re-filed the same three findings verbatim; they are recorded once above, not duplicated.

### Codex (2026-08-12T20:05Z)

This review ran on the merge of main into `fix/eventbrite-widget-silent-failure` (PR #159) after PR #135 landed on main, so its diff was dominated by PR #135's apply-outage content; every finding in this section targets that main-side content, none of it authored on the PR branch. Several overlap the 17:53Z and 18:28Z entries above with added detail.

- CRITICAL `UNSAFE-ROLLOUT` (`useApplyForm.ts:507` writes `photoPaths` while the deployed Firestore allowlist may still exclude it): not fixable on this branch and not created by it. The flagged client code is already published on main via PR #135 and Vercel ships it from main regardless of whether PR #159 merges. The rollout sequencing risk is exactly the "pending rules deploy via Firebase CLI" condition already tracked by the CRITICAL apply-outage entry at the top of this file, plus PR #135's operator steps. Recorded here so the same report is not re-filed against PR #159's merge commits.

- [ ] HIGH: [FALSE-PAGER-SUCCESS] `src/lib/opsAlert.ts:72` does not reject non-success webhook responses, `src/lib/opsAlert.ts:92` swallows every channel failure and `src/pages/api/alert-failure.ts:77` always returns 200. The heartbeat and failure notification curls at `.github/workflows/synthetic-apply.yml:72` and `:86` can therefore pass when no alert was delivered.
      [PUBLIC-WEBHOOK-PII] `src/lib/opsAlert.ts:79` forwards `errorMessage` to an effectively public ntfy topic. Cron messages embed applicant addresses at `src/pages/api/cron/followups.ts:110` and `src/pages/api/cron/post-show.ts:67`.
      [NON-BLOCKING-RULES-GATE] The new emulator suite is a separate job at `.github/workflows/ci.yml:65`, while only `Lint, Types, Test, Build` is required at `scripts/setup-branch-protection.sh:79`. Security-rule failures do not block merging.
      [PUSH-GUARD-BYPASS] `.husky/pre-push:4` checks the checked-out branch instead of the refs received on stdin. From a feature branch, pushes such as `git push origin HEAD:main` bypass the main protection.
      [BROKEN-SMOKE-SELECTOR] `tests/smoke/critical-flows.spec.ts:204` checks `apply-terms` on `/waiver`, but the waiver checkbox at `src/components/waiver/StandaloneWaiverForm.tsx:205` has no such attribute. Both waiver smoke flows fail before submission.
      [NON-IDEMPOTENT-WRITES] The claim routes write a contestant before token signing or invite updates at `src/pages/api/contestant-claim.ts:110`, `contestant-open-claim.ts:98` and `contestant-show-claim.ts:117`. `stage-waiver.ts:97` similarly writes the waiver before linkage writes. Later failure returns a retryable 500, so retries create duplicate legal records.
      [MOBILE-OOM] `useApplyForm.ts:253` accepts ten files approaching 50 MB each, then `useApplyForm.ts:275` converts every original to a base64 data URL before compression. Large iPhone selections can allocate hundreds of megabytes and kill the tab.
      [UNTRUSTED-MIGRATION-INPUT] `firestore.rules:100` permits unvalidated public `photoUrls`, while `scripts/migrate-legacy-photo-urls.mjs:67` accepts any URL containing `/o/photos...` without validating host or bucket. A crafted application can make the privileged migration revoke a known unrelated photo token.
      [SCOPE-CREEP] `LESSONS.md:247` turns one JotForm failure into a universal ban on third-party payments. That was not part of the stated waiver change and conflicts with the existing Eventbrite payment architecture documented at `src/data/legal.ts:73`.
      [UNASKED-CHANGE] The apply-outage commit also changes repository-wide hook architecture through `.husky/pre-commit`, `.husky/pre-push`, `.gitignore:70` and `package.json:28`. This developer-workflow refactor does not trace to the stated apply, waiver, alerting or dependency intent.

### Codex (2026-08-12T20:05Z)

- [ ] MEDIUM: [NONATOMIC-MIGRATION] Despite the WHY comment, `scripts/migrate-legacy-photo-urls.mjs:197` revokes tokens before writing `photoPaths`. A patch failure leaves documents pointing only to dead URLs until an operator reruns the script.
      [PHOTO-PATH-MISMATCH] `useApplyForm.ts:449` copies an arbitrary filename suffix into the Storage path, while `firestore.rules:42` permits only ASCII path characters. Valid image files with spaces or Unicode in the suffix upload successfully and then fail the application write.
      [FALSE-RECEIPT-CONFIRMATION] `src/data/waiverPage.ts:22` promises that a receipt was emailed, but `src/pages/api/stage-waiver.ts:134` suppresses delivery failures and still returns success.
      [FALSE-POSITIVE-RULE-TEST] The non-image regression at `test/rules/apply-flow.rules-test.ts:87` omits required owner metadata. It fails even if the content-type restriction is removed.
      [STALE-SYNTHETIC-DATA] Cleanup at `.github/workflows/synthetic-apply.yml:51` runs only after Playwright succeeds. A document written before a later browser assertion fails is left behind and can eventually exceed the cleanup script’s 48-hour safety window.
      [PUBLIC-SYNTHETIC-FLAG] `firestore.rules:102` lets anonymous writers set `isSynthetic`, while `AdminDashboard.tsx:211` hides every marked application. The monitor marker needs a trusted write path rather than a public boolean.
      [CONTRADICTORY-INCIDENT-RECORD] `LESSONS.md:227` says every July application failed because admin-only rules were live. `LESSONS.md:251` and `BUGS.md:11` correctly state those rules were never deployed and only large-photo submissions failed.
      [SILENT-PHOTO-FAILURE] `useApplicantPhotos.ts:81` converts download errors to `null` and `:87` removes them without exposing an error count. The dashboard renders a no-photo placeholder indistinguishable from an applicant who uploaded nothing.
      [SVG-CONTRACT-MISMATCH] `useApplyForm.ts:241` accepts every `image/*`, but `storage.rules:40` rejects SVG. Small SVG files bypass compression and produce an avoidable submission failure.

### Codex (2026-08-12T20:16Z)

- [ ] HIGH: [FALSE-PAGER-SUCCESS] `src/lib/opsAlert.ts:72-102` neither rejects unsuccessful webhook responses nor propagates channel failures. `src/pages/api/alert-failure.ts:75-79` consequently returns 200 when every channel failed. The workflow curls at `.github/workflows/synthetic-apply.yml:72` and `:86` also omit HTTP failure handling, so both the heartbeat and outage page can report success without delivering anything.
      [PUBLIC-WEBHOOK-PII] `src/lib/opsAlert.ts:79` forwards `errorMessage` to the ntfy-style URL. Cron messages embed applicant addresses at `src/pages/api/cron/followups.ts:110` and `src/pages/api/cron/post-show.ts:67`, bypassing the stated context-only PII protection.
      [INCOMPLETE-PII-MIGRATION] `scripts/migrate-legacy-photo-urls.mjs:74-89` only queries `photoUrls`. Legacy `photoUrl` documents explicitly supported at `src/types/application.ts:42` and `src/utils/applicantPhotos.ts:24` are never migrated or revoked. Documents already containing `photoPaths` also retain `photoUrls` because the patch is skipped at `scripts/migrate-legacy-photo-urls.mjs:205`.
      [PUSH-GUARD-BYPASS] `.husky/pre-push:4-8` checks the checked-out branch instead of the refs received on stdin. From a feature branch, `git push origin HEAD:main`, `git push origin main` and deletion of remote main all bypass the guard.
      [NON-BLOCKING-RULES-GATE] `.github/workflows/ci.yml:65-81` adds rules testing as a separate job, but the documented required context at `scripts/setup-branch-protection.sh:76-80` remains only `Lint, Types, Test, Build`. A rules failure does not block merging.
      [BROKEN-SMOKE-SELECTOR] `tests/smoke/critical-flows.spec.ts:204` selects `apply-terms` on `/waiver`, but the checkbox at `src/components/waiver/StandaloneWaiverForm.tsx:205-213` has no such attribute. Both new waiver smoke tests fail before submission.
      [MOBILE-OOM] `src/components/apply/useApplyForm.ts:253-289` accepts ten files approaching 50 MB each and converts every original to a base64 data URL before compression. This can allocate hundreds of megabytes and terminate the mobile tab.
      [NON-IDEMPOTENT-WRITES] The claim routes write contestant records before token signing or linkage at `src/pages/api/contestant-claim.ts:110-122`, `contestant-open-claim.ts:98-104` and `contestant-show-claim.ts:117-118`. `stage-waiver.ts:97-109` similarly writes the waiver first. Later failures return retryable 500 responses, so retries create duplicate legal records.
      [SCOPE-CREEP] `LESSONS.md:247` expands one JotForm failure into a universal ban on third-party payments, despite the existing Eventbrite payment architecture documented at `src/data/legal.ts:73`.
      [UNASKED-CHANGE] The apply-outage change also rewrites repository-wide hook architecture through `.husky/pre-commit`, `.husky/pre-push`, `.gitignore:70-77` and `package.json:28`. This does not trace to the stated apply, waiver, alerting or dependency intent.

### Codex (2026-08-12T20:16Z)

- [ ] MEDIUM: [PUBLIC-SYNTHETIC-FLAG] `firestore.rules:102` allows anonymous writers to set `isSynthetic`, while `src/components/admin/AdminDashboard.tsx:211-213` and `:252-254` hide every marked application.
      [PHOTO-CONTRACT-MISMATCH] `useApplyForm.ts:239-242` accepts SVG, but small files bypass compression at `compressImage.ts:20` and are rejected by `storage.rules:40`. Arbitrary filename suffixes are also copied at `useApplyForm.ts:449`, while `firestore.rules:42` rejects spaces and Unicode.
      [FALSE-RECEIPT-CONFIRMATION] `src/data/waiverPage.ts:22` promises an emailed receipt, but `src/pages/api/stage-waiver.ts:134-145` suppresses receipt failures and still returns success.
      [STALE-SYNTHETIC-DATA] Verification and cleanup at `.github/workflows/synthetic-apply.yml:51-52` run only after Playwright succeeds. A submission written before a later assertion fails remains and eventually triggers the permanent 48-hour cleanup refusal at `scripts/synthetic-apply-verify.mjs:163-168`.
      [FALSE-POSITIVE-RULE-TEST] The non-image test at `test/rules/apply-flow.rules-test.ts:87-93` omits required owner metadata, so it still fails if the content-type restriction is accidentally removed.
      [RULE-TEST-ISOLATION] Both rules suites use project `demo-garam-masala` and clear its Firestore state in `beforeEach`, while `vitest.rules.config.ts:14-19` leaves file parallelism enabled. Parallel files can erase each other’s fixtures.
      [SILENT-PHOTO-FAILURE] `src/components/admin/useApplicantPhotos.ts:77-88` converts every download failure to `null`. The modal then renders the same no-photo placeholder at `ApplicantModal.tsx:287-296`, with no failed count or error state.
      [CONTRADICTORY-INCIDENT-RECORD] `LESSONS.md:227` still says every July submission failed under deployed admin-only rules. `BUGS.md:7-11` correctly records that those rules were never deployed and only large-photo applications failed.

### Codex (2026-08-12T20:19Z)

- [ ] MEDIUM: Consolidate duplicate findings. (BUGS.md:761-772)
- [ ] MEDIUM: Consolidate the repeated findings. (BUGS.md:774-783)
