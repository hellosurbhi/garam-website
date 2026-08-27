# Bugs

<!-- Doc routing (2026-07-13): this file is an OPEN backlog only. It holds
bugs not yet fixed, deferred or blocked items with their reason, and won't-fix
or resolved-by-design decisions (kept so the same report is not re-filed).
When a bug is fixed, DELETE its entry here in the same commit and record the
fix in CHANGELOG.md (plus LESSONS.md when the fix was non-obvious). Never add
fixed entries, [x] checkboxes or "Status: Fixed" records to this file. -->

## Open

### [MODERATE] 3 unfixed npm audit findings in @opentelemetry/core (via firebase-tools)

- **Date:** 2026-08-02
- **File:** `package-lock.json` (`firebase-tools` -> `@google-cloud/pubsub` -> `@opentelemetry/core`)
- **Status:** Open, deliberately deferred
- **Severity:** Moderate
- **What happened:** `npm audit` (full, including devDependencies) reports 3 moderate findings in `@opentelemetry/core`, pulled in transitively through `firebase-tools`. All 5 CI-gating high-severity findings (astro, brace-expansion, postcss, svgo, tar) were resolved via a plain `npm audit fix` lockfile resync, which also bumped `firebase-tools` from 15.23.0 to 15.25.1 within its existing `^15.23.0` range; these 3 remain because they're only fixable with `npm audit fix --force`, which per `npm audit --json`'s `fixAvailable` field downgrades `firebase-tools` 15.25.1 -> 14.23.0.
- **Why deferred:** all 3 findings are the same advisory, [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) (CWE-770, unbounded memory allocation when a service parses untrusted W3C Baggage propagation headers). `firebase-tools` is devDependency-only and does hold production credentials when run with them, so "devDependency" alone does not clear it: the advisory only fires in a process that parses trace-context headers from untrusted network input, and this project invokes `firebase-tools` as short-lived interactive/CI commands, never as a long-running service accepting external requests, so the vulnerable code path is not reachable here. CI's actual gate (`npm audit --audit-level=high --omit=dev`) also already excludes it and reports 0 vulnerabilities. Forcing a breaking downgrade of a dev tool for a moderate finding with no reachable attack path is not justified; the fix would trade a real regression (older `firebase-tools`, potential CLI incompatibilities) for closing an audit line with no exploitable exposure in how this project uses the tool.
- **Revisit when:** a newer `firebase-tools` release (a 15.x patch or a new major) resolves the `@opentelemetry/core` chain without a downgrade, or the finding starts blocking CI (severity change, `--omit=dev` policy change).

### [LOW] GitHub issue #210: `ReferenceError: Cannot access uninitialized variable` has no reachable stack trace

- **Date:** 2026-08-26
- **File:** Unknown, no stack trace in the PostHog-filed issue body.
- **Status:** Open
- **Severity:** Low
- **What's happening:** Safari's exact wording for a temporal-dead-zone `ReferenceError`. No stack trace is attached to the issue, and no PostHog API credential exists anywhere in this repo (checked `.env.example`, `api/`, `scripts/`, `package.json`), so the actual event payload isn't reachable from the codebase, only from the PostHog dashboard directly. No sourcemap config exists either, so even a stack couldn't be de-minified without one. No commits touched any user-facing page in the week around the issue's creation date, so if this were a live first-party bug it would be expected to recur, and it hasn't since.
- **Fix:** Needs a session with PostHog dashboard access (or an API key added to `.env.local`, never committed) to pull the actual stack trace and re-diagnose. Left open rather than closed on inference.

### [LOW] GitHub issue #161: `r.close is not a function` has no reachable stack trace

- **Date:** 2026-08-26
- **File:** Unknown, no stack trace in the PostHog-filed issue body.
- **Status:** Open
- **Severity:** Low
- **What's happening:** Same reachability problem as #210 (no PostHog credential in the repo, no sourcemap config). Every `.close()` call site in the codebase was checked directly: `dialog.close()`/`popup.close()` calls are on real `HTMLDialogElement`s, and `bitmap.close()` in `src/utils/compressImage.ts` is on a real `ImageBitmap` and is additionally wrapped in a `try/finally` inside an outer `try/catch`, so it cannot be the source even if it threw. Nothing in first-party source matches the minified `r.close` call.
- **Fix:** Same as #210, needs dashboard/API access to get the real stack. Left open rather than closed on inference.

### [MEDIUM] Event JSON-LD always uses New York's UTC offset, even for non-NY shows

- **Date:** 2026-07-16
- **File:** `src/utils/eventSchema.ts:2` (`nyOffset` from `src/utils/timezone.ts`), `src/data/events.ts` (`EventEntry.timezone` field)
- **Status:** Open
- **Severity:** Medium
- **What's happening:** `buildEventSchemas()` calls `nyOffset(e.isoDate, time)` unconditionally for every event's `startDate`/`endDate`/`doorTime`, regardless of the event's actual city. `EventEntry` already has an optional `timezone` field (IANA identifier, e.g. `"America/New_York"`) intended for exactly this, but nothing reads it: `nyOffset` is hardcoded to the `America/New_York` zone. Every non-NY show (San Diego, Chicago, and any future city) ships Event structured data with the wrong UTC offset baked into `startDate`/`endDate`. This is silent: it doesn't throw or fail a build, it just publishes incorrect machine-readable event times, which can make Google's Event rich results (and "Add to calendar" actions derived from them) show the wrong local time for that city.
- **Confirmed pre-existing:** `git diff main -- src/utils/eventSchema.ts src/utils/timezone.ts` shows this logic is untouched by the current per-event-landing-page work; it predates that effort and was never exercised for non-NY cities' individual event pages until now.
- **What should happen:** `buildEventSchemas` should resolve each event's actual IANA zone (`e.timezone ?? "America/New_York"`) and `nyOffset` should be generalized to accept a zone parameter (e.g. `offsetForZone(isoDate, time, timezone)`) instead of hardcoding New York.
- **Fix:** Not applied here, out of scope for the ad-tracking/checkout-redirect PR that surfaced it. Needs its own pass with a schema/timezone-focused smoke test (Rich Results Test on a San Diego or Chicago event page) rather than a drive-by fix.

### [MEDIUM] Cookie consent banner does not gate Meta/marketing tracking

- **Date:** 2026-07-16
- **File:** `src/components/CookieConsent.astro`, `src/components/meta-pixel.astro`, `src/components/gtm.astro`, `src/pages/api/go/[slug].ts`, `src/pages/api/sync-orders.ts`
- **Status:** Won't fix / by design (2026-07-16, Surbhi)
- **Severity:** Medium
- **What's happening:** The cookie banner writes a `marketing` boolean to localStorage, but nothing reads it before firing any Meta surface. `meta-pixel.astro` loads the Pixel unconditionally on idle and fires `fbq("init")` + `PageView` regardless of consent; `gtm.astro` loads the same way; the server-side CAPI calls added in this PR (`/api/go/[slug]`'s InitiateCheckout, `sync-orders.ts`'s Purchase) are server-to-server and were never going to be blockable by a client-side preference in the first place. Rejecting "marketing" in the banner therefore stops nothing. This predates the event-pages/CAPI work (Pixel and GTM already ignored consent); the new CAPI calls are consistent with that existing, ungated surface rather than a new gap.
- **Decision:** Confirmed intentional (Surbhi, 2026-07-16). The show targets US audiences only, with no EU/UK-targeted traffic, so GDPR-style consent gating is not a legal requirement here, and the business call is to keep every Meta signal, including the now-unblockable server CAPI, firing regardless of banner state. Devil's-advocate note recorded and accepted: server CAPI reaches a few more users than the browser Pixel alone would (it survives ad blockers and ITP), which is exactly the tradeoff being made on purpose. No consent-gating code will be built. Logged here so future reviews don't re-flag it as a new defect.

### [CRITICAL] Apply submissions with large photos lost + undeployed security rules left PII readable

- **Date:** 2026-07-13 (partial failures since ~2026-07-05; record corrected 2026-07-13 after production verification)
- **File:** `storage.rules`, `firestore.rules`, `src/components/apply/useApplyForm.ts`
- **Status:** Code fixed (2026-07-13, second contract bug fixed 2026-08-19), STILL pending the manual rules deploy. Operator steps live in the apply-monitor fix PR.
- **Severity:** Critical (lost applicants from paid traffic + live PII exposure until the rules deploy)
- **Update 2026-08-19:** The deploy never happened and the cost escalated. When PR #135 merged on Aug 12, Vercel auto-deployed the client (which now always writes `photoPaths`) while production kept the pre-#135 rules (whose field whitelist rejects `photoPaths`), so EVERY application has failed with "Missing or insufficient permissions" since Aug 12. The synthetic monitor caught it on run one and has been red all 28 runs; the failure was misdiagnosed as a broken monitor because the drift check ran after the always-failing Playwright step and alert emails never verifiably landed. A second, independent contract bug was found and fixed in the same investigation: the client sent `""` for blank optional fields (and `referrerName: ""` on every Self application) while the rules require `size() > 0` on those keys, so deploying the rules alone would still have failed most submissions. Client now omits empty optional keys, rules require only what the UI requires, the rules tests build their payload from the real client builder and the monitor runs the drift check first. The rules deploy remains the single blocking operator step.
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
- **File:** any `.astro` file with TypeScript inside a `<script>` tag (HomeSignup, NotifyModal, index and more)
- **Status:** Open for remaining files (CookieConsent fixed 2026-07-05; upstream Astro/Vite Rolldown issue remains open)
- **Severity:** High (dev only; production builds are unaffected)
- **What happened:** In `npm run dev`, the `vite:oxc` transform parses extracted astro scripts as plain JavaScript, so any TypeScript syntax (a `type` import specifier, `as` casts, non-null `!`) throws `[PARSE_ERROR]` and the script module 500s. Pages render but their client scripts never execute, which makes features look broken in dev while working fine in the built site.
- **Fix pattern (proven on CookieConsent):** extract logic to a plain `.ts` module imported via Vite's normal TS pipeline; keep the inline `<script>` as a bare import with zero TS syntax. Sweep the remaining affected files if the upstream Astro/Vite Rolldown fix does not land.

### [LOW] Popup CTA copy still uses weaker pre-audit wording

- **Date:** 2026-04-08
- **File:** `src/pages/index.astro`
- **Status:** Blocked on business decision (2026-07-05): no final offer exists yet. Tracked in ENHANCEMENTS.md under "Strengthen popup offer copy once the actual incentive is finalized".
- **Severity:** Low
- **What's happening:** The popup still says "Want Cheaper Tickets?" and "Get My Discount Code" rather than the stronger offer-based copy proposed in the audit.
- **What should happen:** Popup copy should use the updated conversion-focused wording once the actual offer is confirmed.
- **Fix:** Replace the popup headline, supporting copy, and CTA with the finalized offer language.

### [LOW] CSP uses unsafe-inline weakening XSS protection

- **Date:** 2026-04-04
- **File:** `vercel.json`
- **Status:** Open
- **Severity:** Low
- **What's happening:** Both script-src and style-src include 'unsafe-inline', weakening CSP XSS protection.
- **What should happen:** Since the site is SSG, nonces do not apply; hashes do. Migrate to Astro's `experimental.csp` support, which computes hashes for inline scripts and styles at build time, then move the Content-Security-Policy header out of `vercel.json` so there is one source of truth.
- **Fix:** Dedicated PR (2026-07-05 triage decision): the migration touches every page's inline scripts and needs its own smoke-test pass, so it stays out of batch fixes. Read the LESSONS.md entry on `unsafe-inline` and Astro island hydration first: PR #121 already broke the apply form once by removing it, so any migration must prove the two Astro hydration inline scripts are hashable before shipping.

## Deferred

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

## Won't fix and resolved by design

### [MEDIUM] Home hero photo background from audit not implemented

- **Date:** 2026-04-08
- **File:** `src/components/home/HomeHero.astro`
- **Status:** Won't fix (2026-07-05)
- **Severity:** Medium
- **What happened:** Owner directive: the hero is intentional and stays as designed (shader plus gradient). No photo layer will be added.

### [LOW] Leads collection allows unauthenticated phone updates

- **Date:** 2026-04-09
- **File:** `firestore.rules:45`
- **Status:** Resolved by design (2026-07-03)
- **Severity:** Low
- **What happened:** Confirmed intentional. The step-2 phone capture runs from the browser without auth — the caller needs the Firestore doc ID returned by `/api/capture-lead` to reach this path. Added a comment to `firestore.rules` explaining the design and the mitigation (doc ID as implicit ownership proof, field-only restriction).

### [LOW] Contact email usage is still inconsistent across pages

- **Date:** 2026-04-08
- **File:** `src/pages/faq.astro`, `src/pages/links.astro`
- **Status:** Resolved by design
- **Severity:** Low
- **What happened:** `contact@garammasaladating.com` is the canonical public contact (schema, legal, socials, llms.txt, FAQ footer). `press@garammasaladating.com` is intentionally used only in press/partnership-specific contexts (FAQ collaboration answer, links page press section). The two-inbox model is deliberate.

### Door time calculation can produce timestamp after show start time

- **File:** `src/utils/eventSchema.ts`
- **Source:** CodeRabbit PR #12
- **Status:** Resolved (no bug present)
- **Comment:** `subtractMinutes(start, 30)` computes `h * 60 + m - 30` with `Math.floor` — always produces a time 30 minutes before start. No clamping logic exists that could produce a later time. The referenced behavior does not reproduce in the current implementation.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384028

### [MEDIUM] Admin restore/participated handlers discard their async promise

- **Date:** 2026-07-13
- **File:** `src/components/admin/AdminDashboard.tsx:290,295`
- **Source:** DeepSeek 20260713-142719
- **Status:** Resolved (no bug present)
- **Comment:** `handleRestore` and `handleParticipated` are async but their `ApplicantCard` callers are typed `() => void`, so the returned promise is discarded. Not a live bug: `handleUpdate` catches every write error internally and surfaces a toast, so the discarded promise can never reject. The handlers also wrap in try/finally for the pending-state cleanup.

### [MEDIUM] Journal countdown heading for position 4 has no rankedItems entry

- **Date:** 2026-07-13
- **File:** `src/data/journal/pop-culture-dating.ts:681`
- **Source:** DeepSeek 20260713-173257
- **Status:** Disproven (2026-07-13), do not auto-fix
- **Comment:** No such article exists; the post at that location is `dating-shows-south-asians-all-ranked` and its `rankedItems` array has all 7 contiguous positions. The countdown tests in `src/data/journal.test.ts` verify heading/position correspondence on every commit and pass.

### [MEDIUM] WaiverPanel ResizeObserver never re-observes a changed child

- **Date:** 2026-07-13
- **File:** `src/components/WaiverPanel.tsx`
- **Source:** DeepSeek 20260713-175426
- **Status:** Resolved by design (2026-07-13)
- **Comment:** `observer.disconnect()` in the effect cleanup drops every observed target per spec (no leak), and the child is the `WaiverDocument` article rendered from a compile-time constant, so its identity never changes within a mount.

### [MEDIUM] WaiverPanel handleScroll recreated each render

- **Date:** 2026-07-13
- **File:** `src/components/WaiverPanel.tsx`
- **Source:** DeepSeek 20260713-175426
- **Status:** Resolved by design (2026-07-13)
- **Comment:** React delegates synthetic events at the root; a new handler identity per render does not re-register DOM listeners. Wrapping in useCallback would add noise with no behavior change.
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

### Codex — 2026-07-16T18:30Z

- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:1502` adds an unrelated reviewer-outage log entry that does not trace to the stated changelog-correction intent.

### Codex — 2026-07-16T18:36Z

- [ ] MEDIUM: The commit message claims repos must belong to the authenticated GitHub user, but `scripts/lib/repos.sh:58` applies that filter only when `_gh_login` returns a value. Authentication or cache failure makes discovery fail open to third-party GitHub repos.

### Codex — 2026-07-16T18:43Z

- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:1502` remains unrelated reviewer telemetry with no trace to the stated changelog-correction intent. Commit `3e13d42` also still overclaims the authenticated-owner filter as unconditional despite `repos.sh:58` applying it only when `_gh_login` succeeds.

### Codex (2026-07-16T18:52Z)

- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:1502` adds reviewer-outage telemetry unrelated to the stated changelog correction. `BUGS.md:640` and `BUGS.md:648` then duplicate that finding as open backlog work.

### Codex (2026-07-16T19:10Z)

- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:1502` does not trace to the stated changelog-correction intent. `BUGS.md:640`, `BUGS.md:648` and `BUGS.md:652` then queue the same finding repeatedly, leaving duplicate open backlog entries.

### Codex (2026-07-16T19:17Z)

- [ ] MEDIUM: [UNASKED-CHANGE] `ENHANCEMENTS.md:1502` is unrelated reviewer telemetry. `BUGS.md:640`, `BUGS.md:648`, `BUGS.md:652` and `BUGS.md:656` then preserve the same issue as multiple open backlog entries instead of deduplicating or resolving it.

### Codex (2026-07-16T19:23Z)

- [ ] MEDIUM: `BUGS.md:638-660` adds six open findings although the commit message claims five. Five duplicate a telemetry complaint explicitly covered by the stated intent while the owner-filter finding is resolved by `CHANGELOG.md:11`, leaving stale backlog entries.

### Codex (2026-07-16T19:28Z)

- [ ] MEDIUM: [UNASKED-CHANGE] `BUGS.md:662-664` and `ENHANCEMENTS.md:1508-1510` add reviewer telemetry unrelated to the stated comma-only intent. The enhancement also falsely claims `CHANGELOG.md:11` still contains the Oxford comma removed by this commit.

### DeepSeek — 20260715-160953

- [ ] MEDIUM: The finding logged from CodeRabbit appears to be truncated ("...unchange..."). This could hide the full context of the finding.
  > a/ENHANCEMENTS.md:1498 | + - LOW: [CodeRabbit] ENHANCEMENTS.md: Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate. In @ENHANCEMENTS.md at line 1493, Update the metadata timestamp entry in ENHANCEMENTS.md to use the repository-approved dash-free separator format instead of the hyphenated date in the 2026-07-15T20:02Z value. Preserve the remaining metadata fields unchange...

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

### Flaky CI (2026-08-26)

- [ ] HIGH: Weekly Smoke Tests workflow on main has failed 6 consecutive scheduled runs (Jul 22 through Aug 26 2026, latest run 32962540856), every failure on the iphone Playwright project: apply form success panel never appears, HomeSignup and both waiver flows fail, every city page test fails | Why: a permanently red scheduled job means real mobile regressions land unseen, and 70% of traffic is mobile; part of this may be the already queued waiver apply-terms selector rot but apply/city/signup failures are broader than that entry | Files: tests/smoke/critical-flows.spec.ts, tests/smoke/site.spec.ts, playwright.config.ts | Plan: run the iphone project locally against a build to classify each failure as selector rot, mobile overlay intercepting taps or a real regression; fix test-side rot directly, split any real mobile UI regression into its own entry with the owning component files | Verify: smoke workflow green on main for the iphone project on the next scheduled run plus 3 consecutive green local runs of both spec files under the iphone project
- [ ] MEDIUM: Rules emulator test "step-2 phone update may touch ONLY the phone field" flakes with "Null value error" at firestore.rules L172 (validPhoneUpdate) | Why: PR #219 run 32936947905 failed it while the identical rules and test passed CI 40 minutes earlier on the same branch (74f0b96); a flaky security-rules gate trains everyone to rerun-and-ignore, which is how a real rules regression slips through | Files: test/rules/public-write.rules-test.ts, firestore.rules | Plan: reproduce by looping the leads describe block against the emulator; suspect the update test reuses a doc created by a prior test or the create-then-update pair races doc visibility, making resource.data null inside d.diff(prev); fix by giving the test its own freshly awaited doc (or asserting the create completed) rather than weakening the rule | Verify: 20 consecutive vitest.rules runs of the file green locally and the CI job green on the next push

### CodeRabbit PR #135 review — 2026-08-12 (deferred, heavy lifts; quick wins fixed same day)

- [ ] MEDIUM: `isSynthetic` remains in the public Firestore write schema, so an anonymous client can mark its own application synthetic and hide it from the dashboard. The notification-suppression half was closed same day (server derives synthetic from the verified email in `/api/notify-application`); removing the field from the public schema needs a trusted server-side write path for the monitor and matching rules-test updates.
- [ ] MEDIUM: photo previews in the apply form read every accepted file through `FileReader.readAsDataURL()` before compression; a multi-photo selection of large originals can hold hundreds of MB of base64 in memory on mobile. Switch previews to `URL.createObjectURL` with revocation. at src/components/apply/useApplyForm.ts:262
- [ ] MEDIUM: `contestant-claim`, `contestant-open-claim` and `contestant-show-claim` group several non-idempotent Firestore writes in one try block and return a retryable 500; a retry after a partial failure creates duplicate contestant records and waiver submissions. Needs idempotency keys or preflighting the fallible config (portal token signing) before the first write.
- [ ] LOW: `.github/workflows/synthetic-apply.yml` runs verification/cleanup only when Playwright succeeds; a submission written before a later assertion failure is left behind and can trip the 48-hour cleanup guard. Run cleanup unconditionally (`if: always()`).

### Codex (2026-08-12T17:53Z)

- [ ] HIGH: [FALSE-PAGER-SUCCESS] `src/lib/opsAlert.ts:81` swallows every delivery failure with `Promise.allSettled`, and `src/pages/api/alert-failure.ts:77` always returns 200. The workflow heartbeat and failure notification can therefore report success when neither email nor webhook delivered. Executor: the 3:00 overnight fixer (product repos are in its lane per the 2026-08-19 cadence decision); the independent GitHub-issue pager covers the owner meanwhile, but real applicants' failure emails still ride this swallowing path.
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

### Codex (2026-08-14, PR #157 merge push)

This review ran on the merge of main into `fix/speed-insights-node-env` (PR #157), so its diff was again dominated by main-side content from PRs #135, #158 and #159; nothing it flags was authored on the PR branch, whose own change is a 4 line `astro.config.mjs` deletion plus doc conflict resolution. Both CRITICALs are re-filings of decisions already recorded in this file.

- CRITICAL `UNSAFE-ROLLOUT` re-filed against PR #157's merge commit: same recorded decision as the Codex 2026-08-12T20:05Z entry above, on identical grounds (client code published on main via PR #135, sequencing tracked by the apply-outage entry at the top of this file plus PR #135's operator steps). Kept so the report is not re-filed against further merge commits of main into open branches.
- CRITICAL `FABRICATED-REFERENCE` re-filed against the `38cb5df`, `4ec96f3` and `e520120` commit bodies (exact lint and test counts stated without committed logs): same won't-fix decision as the two entries in the round-cap section below. `4ec96f3` and `e520120` are published main history and cannot be reworded without a prohibited force push. `38cb5df`'s Verified line follows the format the repo's own commit-msg hook mandates and rejects commits without (its own examples state exact counts such as "npm test -> 47/47 pass"); the counts were produced by the pre-commit gate that ran on that very commit, and the repo intentionally stores no test logs as artifacts. CI re-runs the full suite on every PR, which is the guarantee the repo relies on.

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

### Codex (2026-08-13T19:14Z): both findings describe the pre-merge transition window, resolved when claude-global-config PR #18 merges (kept so they are not re-filed)

- HIGH: [ORPHANED-QUEUE] True only until PR #18 merges: the LIVE retry tooling (the reviewer's vantage) still reads legacy ENHANCEMENTS.md, while PR #18's code reads reviews/retry-queue.md first with a legacy transition leg and a nightly migrator sweep, and excludes .worktrees so stale tracked copies in old session worktrees stop being counted. The 57 moved rows wait out the window exactly as pre-migration entries waited before.
- HIGH: [HOOK-GUARD-NOT-IMPLEMENTED] The guard exists on PR #18 (bash-guardrails denies commit/push into any repo with a local core.hooksPath, self-test fixtures included); it is not yet in the LIVE hook the reviewer read. Until merge, the unset already applied to this repo is the protection.

### Codex (2026-08-14T16:21Z)

- [ ] HIGH: [FALSE-PAGER-SUCCESS] `src/lib/opsAlert.ts:72-102` neither rejects unsuccessful webhook responses nor propagates delivery failures. `src/pages/api/alert-failure.ts:75-79` always returns 200, while both workflow curls omit HTTP failure handling. The heartbeat and outage pager can pass without delivering an alert.
      [PUBLIC-WEBHOOK-PII] `src/lib/opsAlert.ts:79` forwards `errorMessage` to the ntfy-style URL. Cron messages embed applicant addresses at `src/pages/api/cron/followups.ts:110` and `src/pages/api/cron/post-show.ts:67`.
      [NON-BLOCKING-RULES-GATE] `.github/workflows/ci.yml:65-81` adds rules tests as a separate job, but `scripts/setup-branch-protection.sh:76-80` requires only `Lint, Types, Test, Build`. Security-rule failures therefore do not block merging under the documented configuration.
      [PUSH-GUARD-BYPASS] `.husky/pre-push:4-8` checks the checked-out branch instead of the refs supplied on stdin. A feature branch can still push or delete remote `main`.
      [BROKEN-SMOKE-SELECTOR] `tests/smoke/critical-flows.spec.ts:204` selects `apply-terms` on `/waiver`, but `StandaloneWaiverForm.tsx:205-213` has no such attribute. Both new waiver smoke flows fail before submission.
      [FALSE-BRIEFING-SUCCESS] `src/pages/api/cron/followups.ts:271-293` records the briefing date and reports `briefingSent: true` when no recipient is configured or every delivery fails, preventing a retry.
      [NON-IDEMPOTENT-WRITES] The claim routes and `stage-waiver.ts` persist legal records before later token or linkage operations. A subsequent retryable 500 can produce duplicate contestants or waivers.
      [MOBILE-OOM] `useApplyForm.ts:253-289` accepts ten files approaching 50 MB each, then converts every original to a base64 data URL before compression. This can exhaust memory on the mobile browsers the change targets.
      [UNTRUSTED-MIGRATION-INPUT] `firestore.rules:100` permits unvalidated public `photoUrls`, while `migrate-legacy-photo-urls.mjs:67-71` accepts any host containing a matching `/o/photos...` path. A crafted application can make the privileged migration revoke an unrelated photo token.
      [INCOMPLETE-PII-MIGRATION] The migration queries only `photoUrls`, missing supported legacy `photoUrl` records. It also retains `photoUrls` when `photoPaths` already exists, leaving tokened PII URLs stored.
      [RECOVERY-ORDERING] `eventbriteRecovery.ts:135-138` checks `defaultPrevented` before later or ancestor listeners run. If one of those listeners suppresses navigation, the fallback has already returned and the CTA remains dead.
      [SCOPE-CREEP] `LESSONS.md` expands isolated Eventbrite and JotForm failures into universal rules for every integration and all third-party payments, beyond the stated changes and in conflict with the existing Eventbrite checkout architecture.
      [UNASKED-CHANGE] The apply-outage commit also rewrites repository-wide hook architecture through `.husky`, `.gitignore` and `package.json`, which is not named by the stated apply, waiver, alerting or dependency intent.

### Codex (2026-08-14T16:21Z)

- [ ] MEDIUM: [PUBLIC-SYNTHETIC-FLAG] `firestore.rules:102` lets anonymous writers set `isSynthetic`, while `AdminDashboard.tsx:211-213` and `:252-254` hide every marked application.
      [PHOTO-CONTRACT-MISMATCH] The client accepts SVG but Storage rejects it. It also copies arbitrary filename suffixes into paths that Firestore restricts to ASCII, allowing an upload to succeed before the application write fails.
      [FALSE-RECEIPT-CONFIRMATION] `waiverPage.ts:22` promises an emailed receipt, but `stage-waiver.ts:134-145` suppresses delivery failures and still returns success.
      [STALE-SYNTHETIC-DATA] Verification and cleanup run only after Playwright succeeds. A document written before a later assertion failure remains and can eventually trigger the cleanup script’s permanent 48-hour refusal.
      [FALSE-POSITIVE-RULE-TEST] The non-image test at `apply-flow.rules-test.ts:87-93` omits required owner metadata, so it still fails if the content-type restriction is removed.
      [RULE-TEST-ISOLATION] Both rules suites share project `demo-garam-masala` and clear its state in `beforeEach`, while file parallelism remains enabled. Parallel suites can erase each other’s fixtures.
      [SILENT-PHOTO-FAILURE] `useApplicantPhotos.ts` converts download failures to missing photos, leaving the admin UI unable to distinguish access or network failures from applicants who uploaded nothing.
      [CONTRADICTORY-INCIDENT-RECORD] `LESSONS.md` says every July application failed under admin-only rules, while `BUGS.md:5-11` correctly says those rules were not deployed and only large-photo submissions failed.

### Codex (2026-08-14T16:44Z)

- [ ] MEDIUM: Remove the repeated findings before merge. (BUGS.md:801-827)

### Codex (2026-08-14T17:40Z)

- HIGH: [SCOPE-CREEP] LESSONS.md:9 broadens the show-specific retention rule to every `src/data/` record. src/data/CLAUDE.md:5 and EVENTS-HISTORY.md:29 also permanently retain unused venue constants, while src/data/events.ts:390 freezes the current TBA roster as “always.” The stated intent only retains shows and sets the current roster.
  Decision (2026-08-14): resolved by design. The reviewer did not have the owner's mid-session instructions: venue constants were EXPLICITLY ordered permanent ("even stuff like this venue constant should say, all the log should stay even if it then ends up referencing nothing") and the standing LA/SF/NY notify roster is verbatim her ask ("add LA SF and new york should always be on notify me"). The LESSONS rule scoping to destructive-sounding requests against src/data content is the lesson she taught twice.

### Codex (2026-08-14T17:40Z)

- [ ] MEDIUM: [TBA-SUPPRESSION] src/data/events.ts:454-457 does not use `isDisplayable()`, so a hidden future show suppresses its city’s public TBA card despite the function’s contract. Hidden entries supplied through `tbaList` are also appended.
      [SHARED-GATE-BYPASS] The four changed API lookups manually duplicate `hidden` and `status` checks instead of using `isDisplayable()`, contradicting the commit’s centralization claim and allowing future display-state changes to drift.
      [CONTRADICTORY-PERMANENCE-RECORD] EVENTS-HISTORY.md:18-21 lists six removed shows that remain absent from events.ts, while LESSONS.md:5 and src/data/CLAUDE.md:5 claim every scheduled show stays there forever. Document the legacy exception or restore those records.
      [UNASKED-CHANGE] ENHANCEMENTS.md:1603-1610 and ENHANCEMENTS.md:1625-1626 modify unrelated historical review metadata with no trace to either stated commit intent.
      Decision on UNASKED-CHANGE (2026-08-14): resolved by design. Those telemetry lines are appended by the review hooks themselves (same pattern as commits 38cb5df and 1f56dea) and were already in the working tree at session start; committing them alongside is the established convention. TBA-SUPPRESSION, SHARED-GATE-BYPASS and CONTRADICTORY-PERMANENCE-RECORD remain open for a follow-up pass.

### Codex (2026-08-14T18:12Z)

- [ ] MEDIUM: [MISSING-CHANGELOG] The production analytics fix is absent from `CHANGELOG.md`, despite the repository requiring meaningful changes to be recorded.

### Codex (2026-08-14T19:09Z) on the event-pages-tracked-checkout ship push

Fixed in-session the same day (entries removed per doc routing): CHECKOUT-RATE-LIMIT and STALE-PAST-CTA (go route now resolves the event first, sends canceled/past shows to /tickets, and a tripped rate limit only suppresses CAPI, never the redirect; covered by test/go-redirect.test.ts), BUILD-HANG (10s AbortSignal.timeout on the build-time Eventbrite content fetch), ANALYTICS-SEMANTICS (data-event-vendor standardized to vendorFromUrl across all seven CTA sites), MERGE-DEBRIS (formatter-escaped conflict markers removed from CHANGELOG.md) and the FABRICATED-REFERENCE critical (obsolete widget-loader entry deleted from ENHANCEMENTS.md). Remaining items below.

- [ ] HIGH [UNBOUNDED-SYNC-RUNTIME] `src/pages/api/sync-orders.ts` awaits CAPI calls sequentially; the retry query permits 100 orders and each timeout is 3 seconds, so retries alone can consume 300 seconds of a run before other work. Needs bounded concurrency or a per-run time budget, plus a test. Executor: the 3:00 overnight fix-medium-bugs lane (or the next session in this repo if it runs first).
- [ ] MEDIUM [MISSING-COVERAGE, remainder] The new redirect route now has test/go-redirect.test.ts, but the CAPI client (`src/lib/capi.ts`), bot detection (`src/lib/isBotUserAgent.ts`), ticket CTA wiring (`src/lib/ticketCtaTracking.ts`), withTimeout behavior and the sync-orders Purchase retry state machine remain untested. Executor: the 3:00 overnight fix-medium-bugs lane.
- Decision (2026-08-14): [EVENT-ID-REUSE] in `src/lib/ticketCtaTracking.ts` is won't-fix, by design. The per-anchor event_id carries an explicit WHY comment: repeated clicks on one rendered anchor are a single checkout intent, and Meta deduping the browser Pixel, the server CAPI call and any repeat click into one InitiateCheckout is the wanted behavior. Regenerating per click would double-count intent and desynchronize the ?eid= already stamped on the href. Logged so the finding is not re-filed.

### Codex (2026-08-15T02:23Z)

- [ ] HIGH: [UTC-CALENDAR-CUTOFF] `src/utils/eventDate.ts:107` compares dates against UTC. At 5 PM PDT, a West Coast show is considered past, so `src/pages/api/go/[slug].ts:61` redirects buyers to `/tickets` before an evening show begins. Compare against the event’s timezone and end time. (Pre-existing PR #196 code, surfaced by the 2026-08-15 review of the merge range on the dependency branch.) Executor: the 3:00 overnight fix-medium-bugs lane (or the next session in this repo if it runs first).
- Note (2026-08-15): the UNBOUNDED-SYNC-RUNTIME finding from this round duplicates the entry above dated 2026-08-14; that entry already carries the executor.

### Codex (2026-08-15T02:23Z)

- [ ] MEDIUM: [PERMANENT-RETRY-STARVATION] `src/pages/api/sync-orders.ts:793` retains every failed CAPI delivery indefinitely, including terminal 4xx responses and events whose original timestamp has aged outside Meta’s accepted window. These orders can repeatedly occupy the unordered 100-row query and starve newer purchases. Classify terminal failures and mark them unrecoverable. (Pre-existing PR #196 code.) Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] MEDIUM: [CONTENT-ARCHITECTURE] User-facing copy is hardcoded throughout `src/components/events/EventTicketCta.astro:61` and `src/pages/events/[slug].astro:195`, contrary to the repository rule that copy belongs in `src/data/`. Move these strings into `src/data/copy.ts`. (Pre-existing PR #196 code.) Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] MEDIUM: [MISSING-COVERAGE] The new CAPI client, terminal retry behavior, bot detection and ticket tracking module have no direct tests. The redirect test also omits the same-day timezone boundary that exposes the checkout cutoff. (Pre-existing PR #196 gap; largely duplicates the MISSING-COVERAGE remainder entry above, which already carries the executor.) Executor: the 3:00 overnight fix-medium-bugs lane.

### Outage-recovery review 2026-08-17 (recovered Codex pass over the PR #196 merge range; RETRY file processed and deleted 2026-08-18)

Already handled elsewhere: the UTC date cutoff, UNBOUNDED-SYNC-RUNTIME, PERMANENT-RETRY-STARVATION and coverage findings duplicate the queued entries above; MERGE-DEBRIS was fixed in commit c04c44c before PR #195 merged; the chicago-tba stale comment example moved to ENHANCEMENTS.md as a LOW. New items, all pre-existing PR #196 code:

- [ ] HIGH: [UNTRACKED-CTA] Event-specific Get Tickets links on the links page go straight to the vendor | Why: `src/pages/links.astro` renders `href={ticketUrl}` directly, bypassing `/api/go/[slug]`, so those clicks fire no server CAPI InitiateCheckout and skip browser/server dedup, undercounting the exact conversions the PR #196 migration was built to capture | Files: src/pages/links.astro, src/lib/ticketCtaTracking.ts | Plan: route the links-page event CTAs through `/api/go/[slug]` with the same `?eid=` stamping the other seven CTA sites use | Verify: click a links-page event CTA locally and confirm the /api/go redirect plus one deduped InitiateCheckout event id. Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] HIGH: [CHECKOUT-DELAY] `/api/go/[slug]` awaits Meta CAPI for up to 2 seconds before redirecting | Why: `CAPI_TIMEOUT_MS = 2000` is awaited before the 302 (the WHY comment is right that fire-and-forget dies on Vercel, but a slow Meta response still stalls the buyer up to 2s, recreating the stall the redirect migration removed) | Files: src/pages/api/go/[slug].ts, package.json | Plan: use `waitUntil` from `@vercel/functions` so the CAPI call runs after the response is sent, keeping delivery guaranteed without blocking the redirect; keep the awaited path as fallback where waitUntil is unavailable | Verify: redirect returns immediately with CAPI mocked to a 2s delay, existing go-redirect tests stay green. Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] MEDIUM: [STALE-STATIC-CTA] `EventTicketCta.astro` freezes past/upcoming state at build time | Why: the label and link state are computed during the static build, so once an event date passes without a redeploy the page still shows Get Tickets even though the server route now redirects past shows to /tickets (server half fixed 2026-08-14; this is the client half) | Files: src/components/events/EventTicketCta.astro | Plan: add a small inline date check on the client (or an ISR/rebuild trigger) that swaps the CTA to the past-show state when `isoDate` has passed | Verify: load a built event page with a mocked past date and confirm the CTA shows the past-show state. Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] MEDIUM: [DATA-MIGRATION-MISSING] The Purchase-CAPI retry query only matches orders where both new booleans are explicitly false | Why: order documents created before PR #196 have neither `purchaseCapiSent` field, Firestore equality filters skip documents missing the field, so pre-existing undelivered orders can never be retried without a backfill | Files: src/pages/api/sync-orders.ts | Plan: one-time backfill with a cutover rule, not a blanket one. Orders created before server-side Purchase CAPI went live (PR #196's deploy) may already have been counted by the old browser-side pixel Purchase, which had no CAPI dedup id, so re-sending them can double-count revenue: mark those pre-cutover documents `purchaseCapiSent: true` with a `migrationNote` field so they leave the retry set permanently. Only documents created after the cutover get backfilled to false for retry. A not-equal-true query is NOT a substitute for either half: Firestore inequality filters also exclude documents where the field is absent, so only an explicit backfill reaches fieldless documents | Verify: emulator test confirms a fieldless pre-cutover order is marked sent and stays out of the retry set while a fieldless post-cutover order enters it. Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] MEDIUM: [INCOMPLETE-PRICE-REMOVAL] Journal copy still states specific ticket prices | Why: PR #196 removed visible prices from UI surfaces on the grounds they drift from real Eventbrite pricing, but journal article copy (e.g. `src/data/journal/live-shows.ts:34` and `:906`) still names Garam Masala ticket prices that can go equally stale | Files: src/data/journal/live-shows.ts | Plan: audit journal and tips data for our own show's price mentions and replace stale exact figures with durable phrasing (content-only edit, city content enrichment rules apply, no deletions of surrounding copy) | Verify: grep journal data for dollar figures tied to Garam Masala shows and confirm none contradict events.ts. Executor: the 3:00 overnight fix-medium-bugs lane.
- WONTFIX(MEDIUM, 2026-08-18): [EVENT-SLUG-DATE-MISMATCH] The rescheduled Boston show's slug `boston-2026-08-02` keeps the original date while `isoDate` is 2026-08-13 | Reason: intentional slug stability. The slug is the published canonical URL and tracking id; regenerating it on a date change would 404 shared links and reset conversion attribution. The move is recorded the mandated way (`previousDate`, note, EVENTS-HISTORY.md) and the show has since passed. Recorded so the report is not re-filed.

### Codex (2026-08-18T16:11Z) — HIGH findings

Note (2026-08-19, PR #193 merge pass): this round's own [UNSUPPORTED-NODE-RANGE] finding is dropped here; main's engines.node commit (`a4e4226`) already fixed and deleted it. Split from a shared checkbox into one line per finding (Fable `[SHARED-CHECKBOX]`, 2026-08-19) so the overnight fixer's one-checkbox-per-finding parsing doesn't silently drop the co-listed items.

- [ ] HIGH: [UTC-CALENDAR-CUTOFF] `src/utils/eventDate.ts:107-111` uses the UTC calendar date, so `src/pages/api/go/[slug].ts:61` rejects same-day West Coast ticket purchases from 5 PM local time. Compare against the event timezone and end time.
- [ ] HIGH: [UNBOUNDED-SYNC-RUNTIME] `src/pages/api/sync-orders.ts:758-838` processes up to 100 retries sequentially with a three-second timeout each. Failures can consume over 300 seconds before metadata is persisted, while `withTimeout` does not abort the underlying fetch.

### Codex (2026-08-18T16:11Z) — MEDIUM findings

Split from a shared checkbox into one line per finding, same pass as above (Fable `[SHARED-CHECKBOX]`, `[DUP-SECTION-HEADER]`, 2026-08-19).

- [ ] MEDIUM: [DELIVERY-FLAG-REGRESSION] `src/pages/api/sync-orders.ts:652-656` resets `purchaseCapiSent` to false before every upsert. When the optional CAPI token is absent, or the existing-state read fails, a previously delivered order is persisted as pending again.
- [ ] MEDIUM: [PERMANENT-RETRY-STARVATION] `src/pages/api/sync-orders.ts:401-443` returns an unordered 100-row queue, but only missing source events become unrecoverable. Terminal Meta 4xx responses and expired events retry forever and can crowd out new purchases.
- [ ] MEDIUM: [FALSE-PURCHASE-CONVERSION] `src/lib/eventbrite.ts:42-46` converts every unknown Eventbrite status to `placed`; the new branch at `src/pages/api/sync-orders.ts:677` then sends those orders to Meta as purchases. Unknown statuses must fail closed.
- [ ] MEDIUM: [HIDDEN-EVENT-INDEXING] `src/pages/events/[slug].astro:53-73` generates pages for hidden records and `astro.config.mjs:217-232` includes them in the sitemap. This publicly indexes records such as the hidden Chicago and Edison entries.
- [ ] MEDIUM: [TBA-SUPPRESSION] `src/data/events.ts:595-600` checks cancellation but not `hidden`, despite claiming to test displayability. A hidden future show suppresses its city's public notify card.
- [ ] MEDIUM: [WRONG-EVENT-TIMEZONE] `src/utils/eventSchema.ts:58-60` still applies New York offsets to every event, producing incorrect structured-data times for California and other non-New-York shows.

### Review lane finding filed on the primary checkout (2026-08-19)

- WONTFIX(HIGH, 2026-08-19): firestore.rules phone-update rule alleged to null-error and keep the "Firestore/Storage rules (emulator)" CI check red on main since 2026-06-17, blocking PRs from leaving draft | Reason: false positive AS FILED (a permanent red since June does not match reality: the check passed on PRs #203, #204, #205 and PR #203 merged 2026-08-19T17:07Z), but the underlying test proved intermittently flaky the same day; the reproduced intermittent failure is re-filed as the open FLAKY-PHONE-UPDATE-TEST entry below
- [ ] MEDIUM: [FLAKY-PHONE-UPDATE-TEST] "step-2 phone update may touch ONLY the phone field" (leads collection) fails intermittently in CI with PERMISSION_DENIED, passed unchanged on immediate rerun | Why: reproduced on PR #208 run 32290971770 (2026-08-19), a branch that touches neither the leads rules nor this test, then passed on rerun with zero diff; validPhoneUpdate() in firestore.rules reads resource.data via d.diff(prev), so a seedLead() write that is not yet visible to the rules evaluator under CI load would explain a transient null prev and PERMISSION_DENIED; the same run also logs a storage.rules line 41 "Property owner is undefined" evaluation warning worth checking in the same pass | Files: test/rules/public-write.rules-test.ts, firestore.rules | Plan: make the test await seed visibility (or retry the assertSucceeds once with backoff) only if investigation confirms the seed race; otherwise harden validPhoneUpdate() against missing resource.data and add a regression test that updates a just-created doc in a tight loop to reproduce | Verify: 20 consecutive CI runs of the rules job green, no PERMISSION_DENIED flakes in the run logs

### Codex (2026-08-19T18:58Z)

- [ ] HIGH: [FLAKY-LEADS-RULES-TEST] test/rules/public-write.rules-test.ts "leads: step-2 phone update may touch ONLY the phone field" failed then passed on identical code within 20 minutes (local emulator runs, 2026-08-19: deploy-rules run4 failed 1/34, run5 passed 34/34). A flaky rules test can block the gated rules-deploy lane at random. Files: test/rules/public-write.rules-test.ts, firestore.rules. Executor: the 3:00 overnight fixer.

### Codex (2026-08-19T19:00Z)

- [ ] HIGH: Make heartbeat delivery failure observable. (.github/workflows/synthetic-apply.yml:78-82)

### Codex (2026-08-19T19:00Z)

- [ ] MEDIUM: Do not describe the heartbeat as proof of alert delivery. (CHANGELOG.md:5-16)

- WONTFIX(MEDIUM, 2026-08-19): Trim optional text before deciding whether to include it (useApplyForm.ts payload builder) | Reason: every untrimmed inclusion check in buildApplicationData (country, state, community, income, howHeard) is a select or geo-dataset value that cannot contain whitespace; every free-text field (name, email, phone, height, instagram, referrerName, pitch, type) was already trimmed. The one real gap, city (free-text input) sent untrimmed, was fixed in the same session with city.trim().

### Codex (2026-08-20T14:49Z)

- [ ] HIGH: Operator step 2 falsely expects an email after a successful manual monitor run. `.github/workflows/synthetic-apply.yml:71` sends a heartbeat only during Monday 13 UTC runs, while `src/pages/api/notify-application.ts:192` explicitly suppresses synthetic-submission emails. Most successful manual runs therefore produce no email and would falsely implicate alert delivery.

### Codex (2026-08-20T14:49Z)

- [ ] MEDIUM: [COPY-VOICE] Added prose violates the repository ban on em dashes in `.github/workflows/synthetic-apply.yml:49`, `src/components/apply/useApplyForm.ts:136`, `src/components/apply/useApplyForm.ts:177` and `test/rules/apply-flow.rules-test.ts:245`.
- [ ] MEDIUM: [SILENT-FAILURE] .github/workflows/synthetic-apply.yml:50, moving the drift check before the Playwright step means a drift failure now stops the job before the Playwright spec runs, and per BUGS.md that spec's failure path is what POSTs to /api/alert-failure; unless the workflow has an `if: always()` alert step outside this diff, the most likely outage class (stale rules — the exact Aug 12 scenario) fails CI with no immediate alert attempt and surfaces only via the absent Monday-13:30 heartbeat, up to ~7 days later. | Files: .github/workflows/synthetic-apply.yml BUGS.md | PR: #208 | Head: 112b1694598499bda676c576ac04eeb0a394324d

<!-- fable-routed PR #208 head 112b1694598499bda676c576ac04eeb0a394324d -->

- [ ] MEDIUM: [ALWAYS-RUNS-ON-CANCEL] .github/workflows/synthetic-apply.yml:62, `if: always()` (unlike `!cancelled()`) makes the verify/cleanup and rules-drift steps execute even on a cancelled run, so a run cancelled mid-flight (manually or via the `synthetic-apply` concurrency group) still performs its Firestore cleanup sweep and can delete the synthetic document a superseding run just created, making that run's verify step fail and fire a false page. | Files: .github/workflows/synthetic-apply.yml | PR: #207 | Head: 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619
- [ ] MEDIUM: [OVERBROAD-CONTRACT] CHANGELOG.md:5, the claim "can no longer fail silently" is violated because both pager steps gate on `failure()`, which is false for cancelled runs, and no run fires at all if the scheduled workflow is auto-disabled after 60 days of repo inactivity or the runner is lost — leaving silent-death modes covered only by the weekly heartbeat over the site channel that is documented (FALSE-PAGER-SUCCESS) to swallow delivery failures. | Files: CHANGELOG.md | PR: #207 | Head: 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619

<!-- fable-routed PR #207 head 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619 -->

- [ ] HIGH: [CORRECTNESS] scripts/diff-coverage.mjs:79, the gate diffs base.sha against head.sha two-dot instead of using the merge-base (three-dot), so whenever the PR branch and main have diverged — e.g. a stale branch, or this very PR's "merged main after a month" scenario — lines authored on main are counted as the PR's changed lines, and if any are under-covered the required check fails a PR for code it never touched. | Files: base.sha e.g head.sha scripts/diff-coverage.mjs | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8
- [ ] MEDIUM: [FALSE-BLOCK] scripts/diff-coverage.mjs:55, coveredLinesFor marks lines covered only when they fall inside an executed statement range, so added lines that are comments, blank lines, interfaces, or type-only declarations can never be covered; a comment-only or types-only edit to a tracked src file computes 0% patch coverage and fails the required check. | Files: scripts/diff-coverage.mjs | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8
- [ ] MEDIUM: [CI-BREAK] .github/workflows/ci.yml:63, the job now runs `npm run test:coverage` but no hunk in this diff adds a `test:coverage` script to package.json, so unless that script already exists on main, every run of the required "Lint, Types, Test, Build" job fails immediately with "Missing script". | Files: .github/workflows/ci.yml package.json | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8

<!-- fable-routed PR #160 head c251ea7abaa5a9862f3477db86cf0f37d27695f8 -->

- [ ] MEDIUM: [contract-violation] src/lib/portalBootstrap.ts:215, `isDefinitiveRejection` only recognizes a 2xx body with `state:"error"` as definitive, so a stored context whose link dies via a non-2xx status (e.g. the 404 "Invalid invite link." shape the mapping tests model) or resolves to `state:"expired"` is never cleared — every subsequent visit that session replays the dead link and the visitor can never reach the bare/open portal or the cookie-authed branch, contradicting the changelog's "clears on definitive server rejection" claim. | Files: e.g src/lib/portalBootstrap.ts | PR: #147 | Head: 177c6e2f7a0aaca2ca43f31a74aa6d20a59ff829

<!-- fable-routed PR #147 head 177c6e2f7a0aaca2ca43f31a74aa6d20a59ff829 -->

- [ ] MEDIUM: [missing-asset] src/pages/journal/index.astro:80, the new cupid section references /images/ai-art/cupid-garden.webp but this PR adds no image file, so if that file is not already in the deployed public/images/ai-art/ folder the request 404s and the journal page renders a bordered ~200px broken-image block; failure scenario: a visitor opens /journal and sees an empty gray box with a broken-image icon where the artwork should be, with no build-time error to catch it since the src is a plain string. | Files: images/ai-art/cupid-garden.webp src/pages/journal/index.astro | PR: #146 | Head: 81273d0b35ae67a94a9e2956218c866c07685707

<!-- fable-routed PR #146 head 81273d0b35ae67a94a9e2956218c866c07685707 -->

- [ ] HIGH: [DEPLOY-ORDER] src/lib/verifyToken.ts:110, the new `email_verified === true` requirement takes effect the moment this merges and auto-deploys, but nothing in the repo or CI enforces the documented precondition that `npm run admin:verify-emails` printed safe first — if the real admin accounts are still unverified (the script's own comment says password accounts "stay unverified forever" without this one-time flip), every admin API route returns 401 again, recreating the exact outage this PR fixes. | Files: src/lib/verifyToken.ts | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3
- [ ] MEDIUM: [DRIFT-GUARD-GAP] src/lib/verifyToken.test.ts:349, the code comments claim the drift tests hold the full predicate copies together, but the tests only guard the email list and the `email_verified` conjunct — a future edit that drops the anonymous-provider check or loosens `admin == true` in firestore.rules or storage.rules passes the gate while the rules silently diverge from the API, potentially leaving Firestore-direct access weaker than the API path. | Files: firestore.rules src/lib/verifyToken.test.ts storage.rules | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3

<!-- fable-routed PR #145 head a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3 -->

- [ ] MEDIUM: [DATA-LOSS] ENHANCEMENTS.md:649, the deleted "Prefetch/preload key pages + skeleton loaders" (Priority: High) and the 13-item "Full-site CLS audit" carry no Fixed/shipped status and no CHANGELOG.md entry appears in this diff, violating the PR's own new rule that only shipped items are deleted — if the apply-page skeleton and scroll-lock fixes were never built, the open work is silently dropped with no surviving record and never gets scheduled. | Files: CHANGELOG.md ENHANCEMENTS.md | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7
- [ ] MEDIUM: [DATA-LOSS] ENHANCEMENTS.md:749, the "International phone input with country selector" item is an explicitly deferred item ("Later Later", with its documented why-not-now reasoning), which the new routing header says must stay in the file, yet it is deleted outright — when international texting via Twilio/MessageBird starts, no record of the required per-country validation work exists and malformed numbers get texted. | Files: ENHANCEMENTS.md | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7
- [ ] MEDIUM: [DATA-LOSS] ENHANCEMENTS.md:228, the "Geo fetch race condition in bootstrapGeoData()" item is deleted on the strength of "Status: Fixed in feat/wave2-conversion", a feature branch rather than a main-line commit — if that branch was never merged, users who submit a lead form within ~200ms of page load still write Firestore leads with all six geo fields missing, and the detailed six-step implementation plan needed to fix it is gone. | Files: ENHANCEMENTS.md | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7

<!-- fable-routed PR #139 head 4db91e278d8c9077471bd056160c2d57390339c7 -->

- [ ] HIGH: [PEER-CONFLICT] package.json:73, @stryker-mutator/vitest-runner 10.0.0 declares a strict peer dependency on @stryker-mutator/core 10.0.0 while this PR leaves core at ^9.6.1, so `npm ci`/`npm install` will fail with ERESOLVE (or, if forced past it, Stryker will crash at runtime on mismatched plugin APIs) if this PR merges alone — it is only safe merged together with or after PR #212 (core 10.0.0) and alongside #214 (jest-runner 10.0.0). | Files: package.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1
- [ ] MEDIUM: [ENGINE-BUMP] package-lock.json:6092, the runner's engines requirement jumps from node >=14.18.0 to >=22.0.0, so any CI job or local machine still on Node 18/20 will fail installs run with engine-strict or fail silently at runtime when the mutation-test job executes on the older runtime. | Files: package-lock.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1
- [ ] MEDIUM: [SPLIT-TREE] package-lock.json:6100, the lockfile now nests @stryker-mutator/api and util 10.0.0 under vitest-runner while core 9.6.1 keeps api 9.6.1 at the root, and Stryker resolves plugins through core's API surface, so even an install forced with --legacy-peer-deps yields two incompatible API copies and mutation runs error out or report nonsense instead of failing loudly at install time. | Files: package-lock.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1

<!-- fable-routed PR #213 head 68d78b2b00f057fda4ac4596449cac1941b325b1 -->

- [ ] MEDIUM: [lockfile] package-lock.json:20411, the regenerated lockfile relocates the @typescript-eslint/* packages (parser, eslint-plugin, typescript-estree, utils, type-utils, project-service, tsconfig-utils) from top-level node_modules into folders nested under node_modules/typescript-eslint — a layout a clean regeneration would not produce with no version conflict present (peer `>=4.8.4 <6.1.0` is satisfied by 6.0.3), suggesting the lockfile still carries resolution state from the failed TS 7 attempt despite the CHANGELOG claiming "Lockfile regenerated"; concretely, after `npm ci` any eslint config, editor plugin, or script that resolves `@typescript-eslint/parser` or `@typescript-eslint/eslint-plugin` directly from the project root (rather than through the `typescript-eslint` meta-package) fails with MODULE_NOT_FOUND and the lint CI leg goes red or silently skips. | Files: package-lock.json | PR: #134 | Head: 5da61cf89e4daf2e275c9a7e9ad2485635a6bf92

<!-- fable-routed PR #134 head 5da61cf89e4daf2e275c9a7e9ad2485635a6bf92 -->
