# audit-findings.md — garammasaladating.com

_Full-site audit, 2026-07-06, branch `fix/missing-portal-apis`. Every finding has a severity (critical / high / medium / low), file path, and line reference where applicable. Severity reflects production impact, not effort._

## Executive summary

The build is **broken** (test files ship as prerendered routes). The **single most important issue is a critical PII exposure**: any anonymous visitor can read the entire applicant and waitlist database through the client Firestore SDK. The native "Cast Portal" is fully built and tested but **not wired to the emails that are actually sent**, so the casting-acceptance flow is unreachable. Conversion plumbing is strong (popup, sticky CTA, per-city waitlist, UTM'd Eventbrite, apply success panel), but the waitlist forms **do not capture phone**, and there is **no admin CRM view for waitlist leads** despite the data existing in Firestore. `npm audit` is clean and no secrets are hardcoded.

---

## Phase 1 — Codebase Health

### [CRITICAL] Production build fails — test files are treated as routes

- **File:** `src/pages/api/contestant-claim.test.ts` (and the other `*.test.ts` files under `src/pages/api/`)
- **Evidence:** `npm run build` exits 1: `Error: Vitest mocker was not initialized in this environment. vi.queueMock() is forbidden.` while prerendering `/api/contestant-claim.test`.
- **Cause:** `.test.ts` files colocated in `src/pages/api/` are picked up by Astro's file router and prerendered. On `bugs`/main these API test files did not exist; they were added on this branch (`git diff origin/main` shows `contestant-claim.test.ts`, `contestant-open-claim.test.ts`, `contestant-show-claim.test.ts`, `portal-state.test.ts`).
- **Fix (best practice):** Move API tests out of `src/pages/` (e.g. `src/pages/api/__tests__/` is still under pages — instead use a top-level `test/` or `src/tests/api/` dir), OR add `test.{ts,tsx}` to an exclude in the Astro route resolution. Colocating tests inside the routable `pages/` dir is the root cause; relocate them. This blocks every deploy until fixed.

### [MEDIUM] Bundle chunk > 500 kB warning

- **Evidence:** build log: `Some chunks are larger than 500 kB after minification`.
- **Impact:** LCP risk on the island pages. Likely the Firebase/geo vendor bundle. Not blocking. Track for a code-splitting pass; `country-state-city` is already dynamically imported per prior fix.

### [INFO] BUGS.md / ENHANCEMENTS.md catalog

- BUGS.md: the only genuinely **open** items are `[LOW] CSP uses unsafe-inline` (deliberately deferred to its own PR) and `[LOW] popup offer copy` (blocked on a business decision — no real offer exists yet). Everything else is Fixed / Won't-fix / Deferred-to-redesign and correctly retained as history.
- ENHANCEMENTS.md is large but internally consistent; the highest-value un-built items are Admin Event CRUD, share buttons, Wikidata/IMDb entity work, and the contestant control-tower deferrals (SMS reminders, rubric scoring). No stale contradictions with current code found except the JotForm/native-portal split (below).

### [LOW] `generate-contestant-link.ts` uses `verifyIdToken`, not admin check

- **File:** `src/pages/api/generate-contestant-link.ts:20`
- **Detail:** Any authenticated Firebase user (including an anonymous apply-form session) passes `verifyIdToken`. It only builds an HMAC prep link (needs `CONTESTANT_PREP_SALT`), so exposure is low, but it should use `verifyAdminToken`/`verifyAdminIdentity` for consistency with the other admin routes.

### Open PRs — conflict / regression risk

| PR                        | Title                                                      | Risk                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #113 (this branch, draft) | fix/missing portal apis                                    | **Introduces the build break** (API `.test.ts` files). Must relocate tests before merge.                                                                                         |
| #114                      | apply: disabled submit, inline blur errors                 | Low. Touches `useApplyForm`/`ApplyPage`; overlaps #113 only if both edit apply. Safe after review.                                                                               |
| #115                      | SEO powerhouse wave 1                                      | Low, additive (city depth, schema).                                                                                                                                              |
| #116 #117 #118            | Dependabot (vitest, @astrojs/react 5→6, @types/node 22→26) | `@astrojs/react 6.0.1` is a **major** bump — verify island hydration + `client:*` directives before merge. @types/node 26 is dev-only.                                           |
| #16                       | Contestant portal, security hardening, CSP migration       | **Long-lived (Apr 20), broad.** Overlaps the portal/waiver work now on this branch. High merge-conflict + regression risk; reconcile against what already landed before merging. |

---

## Phase 2 — Security

### [CRITICAL] Anonymous users can read all applicant + waitlist PII

- **Files:** `firestore.rules:112` (`applications` `read ... if request.auth != null`), `firestore.rules:121` (`leads` `read ... if request.auth != null`); apply form calls `signInAnonymously` at `src/components/apply/useApplyForm.ts:370`; admin reads via client SDK at `src/components/admin/AdminDashboard.tsx:184,230`.
- **Attack:** Firebase anonymous auth is enabled (the apply form relies on it). Any visitor can obtain an anonymous token with the public web API key, then issue client Firestore reads against `applications` and `leads`. The rule only checks `auth != null`, which an anonymous token satisfies. That exposes every applicant record (name, age, email, phone, Instagram, income, location, photos URLs) and the entire waitlist (email, phone, city). This is the "can a contestant see other contestants' data / enumerate the waitlist" concern from the goal, and the answer is yes.
- **Fix (best practice):** Restrict reads to real admins. Two sound options:
  1. **Custom claims** — set `admin: true` claim on the admin UIDs (Cloud Function or Admin SDK one-off), change rules to `allow read: if request.auth.token.admin == true` for `applications`, `leads`, `applications/{id}/events`, `orders`, `syncMeta`, `systemConfig`. Keep `applications create: if request.auth != null && validApplication()` so anon submit still works. This is the cleanest — the admin dashboard already uses Firebase Auth.
  2. **Server-only reads** — move the admin dashboard's `getDocs` reads behind `/api/*` routes guarded by `verifyAdminToken` (service-account REST), and set `applications`/`leads` `read: if false` for clients.
     Option 1 is the smaller, more consistent change. Either way, `leads`/`applications` must stop being readable by non-admin authenticated sessions.

### [HIGH] `applications` writable/deletable by any authenticated session

- **File:** `firestore.rules:112` — `allow read, update, delete: if request.auth != null`.
- **Detail:** Same anonymous-token surface can `update`/`delete` arbitrary application docs (e.g. flip statuses, soft-delete, tamper with `castEventId`). Restrict `update`/`delete` to admin claim (same fix as above). `create` staying at `auth != null && validApplication()` is correct.

### [LOW→resolved] Admin auth is server-side and real

- `AdminLogin.tsx` uses `signInWithEmailAndPassword` (real Firebase Auth), and every admin API route verifies the Firebase ID token against `ADMIN_UIDS` (`verifyToken.ts`). The old hardcoded `VITE_ADMIN_PASSWORD` is fully removed. Admin is **not** security-through-obscurity. The gap is only the Firestore-rules read path above (client SDK bypasses the API layer).

### [GOOD] API endpoint hygiene

- Rate limiting (Upstash sliding window, fail-open) on all public POST routes (`rateLimit.ts`). Origin allowlist on `notify-application` and `verify-turnstile`. Zod schemas on `notify-application`, `create-invite`, actions, and the claim routes (`lib/schemas.ts`). HMAC on cal webhook, unsubscribe, prep-auth, lead-update. Cron routes gated by `CRON_SECRET` bearer. Error text is logged server-side, generic messages returned to clients. This is solid.

### [INFO] Secrets, headers, deps

- **No hardcoded secrets** in client-reachable code (only test fixtures contain fake PEM strings). All config via `import.meta.env`. `.env.example` documents 23 vars.
- **`npm audit --omit=dev`: 0 vulnerabilities.**
- **Headers (`vercel.json`):** HSTS (2yr, preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, COOP same-origin, and a detailed CSP. **Gap:** CSP `script-src` and `style-src` both use `'unsafe-inline'` (already tracked as `[LOW]` in BUGS.md — migrate to Astro `experimental.csp` hashes). No `Permissions-Policy` header — consider adding one to lock down camera/microphone/geolocation.

### [LOW] Form spam protection is partial

- Apply form: Cloudflare Turnstile (invisible) **but fails open** — `useApplyForm.ts:346` deliberately allows submission through on verify failure/network error ("widget issues must not block real applicants"). Reasonable trade-off, but means Turnstile is advisory, not enforcing. Lead-capture/waitlist/notify forms have **no CAPTCHA or honeypot** — only per-IP rate limiting, which is inert until `UPSTASH_*` env vars are set in Vercel. Confirm Upstash is configured in prod, or spam is unbounded.

---

## Phase 3 — Conversion (per page)

### Homepage `/` — strong

- Above-fold: hero with next-show pill + tickets CTA. Email/phone capture via the Spice List (rendered site-wide by BaseLayout) and the 30s/scroll(65%)/exit-intent popup (`index.astro`). Sticky CTA (`StickyCTA.astro`, triggers after `.hero`). UTM'd Eventbrite via `buildTicketUrl`. Popup captures **email then phone** in two steps.
- **[MEDIUM] No city field in the homepage popup or Spice List.** City is only inferred from `geoCity` (Vercel IP header). The goal wants an explicit city for "city bubbles"; non-NYC visitors are not routed to a city-prefilled waitlist from the homepage popup. The city-request path only exists in HomeShows/`#waitlist` modals.
- **[LOW] Popup copy is the weak pre-audit wording** ("Want Cheaper Tickets?" / "Get My Discount Code"). Already logged as blocked on a real offer.

### City pages `/cities/[slug]` — strong, one gap

- Correct per-event Eventbrite widget/link (`buildTicketUrl(event.url, "cities", slug)`); cities with no event fall back to a **waitlist modal with city + `sourceCitySlug` pre-filled** (`[slug].astro:479`). Cities with events also show a two-step email+phone "city-notify".
- **[MEDIUM] The city waitlist modal captures email + city but NOT phone** (`[slug].astro:509`). The email+phone two-step (`city-notify`) only renders for cities that already have events — exactly the cities where you least need a waitlist. Add phone to the no-event waitlist modal.

### Apply `/apply` — high quality, not "poor"

- Contrary to the brief's worry, the apply flow is well-built. Fields: application type (Self/Nomination toggle), name, age, gender, orientation, "attended a show before" (with a Stealer-nudge + `STEALER` 20% code when No), metro area, height (optional), Instagram (required, `@` stripped), **email (required)**, **phone (present, optional)**, community, income, "what's your type", pitch, marketing consent (required), terms (required), up to 10 photos with guidance.
- **Selectivity framing is present and good:** `APPLY_PAGE.selectivityNote` ("We receive 2,000+ applications and cast a handful per show…"), the contact-accuracy note, and the "most contestants started as Stealers" nudge all frame it as selective.
- **Post-submit:** `ApplySuccessPanel` builds excitement (Instagram DM nudge, Stealer discount, live Eventbrite buy buttons for upcoming shows). **Confirmation email works** — `applicationReceived()` sends a warm personal email from Zoho via `notify-application`.
- **[LOW] Open-ended prompts are shallow.** "Why would you be a great fit?" and "What's your type" are the only personality prompts and both are optional. To raise applicant quality, make one story prompt required and more specific (see build-spec.md §Apply prompts).
- **[LOW] Phone is optional and unvalidated on the client** (`ApplyPage.tsx:538`); no `inputMode`/format enforcement beyond `type="tel"`. Email has `inputMode="email"` (good).

### Contestant prep `/contestant-prep` — fine

- HMAC-gated (date+sig), non-indexed, exciting tone. Reachable from generated links. No conversion goal needed (post-cast page).

### Consent/waiver — **fragmented (see Phase 5)**

- `/consent` is a legal doc page (fine). `/waiver` embeds a **JotForm** (not Tally as the brief assumed, not the native portal). The native "Cast Portal / Green Room" is `/contestant-portal`. These are not connected — see the HIGH finding in Phase 5.

### Journal, FAQ, hosts, links, corporate, sponsorship

- Journal posts use `ArticleCta.astro` → have CTAs. FAQ links to tickets. Links page is the bio hub. **No true dead-end pages found** — every page has at least one conversion path. `/hosts` CTAs are the weakest ("See … live" links) and were flagged for 16px/touch-target in ENHANCEMENTS.md.

---

## Phase 4 — Forms deep dive

| Form                                  | Fields                                | Email  | Phone          | Success                  | Error               | Notes                             |
| ------------------------------------- | ------------------------------------- | ------ | -------------- | ------------------------ | ------------------- | --------------------------------- |
| Homepage popup                        | email → phone (2-step)                | ✅ req | ✅ optional    | step swap + localStorage | inline `role=alert` | no city; weak copy                |
| Spice List (site-wide)                | email → phone                         | ✅ req | ✅ optional    | success panel            | inline              | no city                           |
| NotifyModal                           | email → phone                         | ✅     | ✅             | ✅                       | ✅                  | city via data-attr                |
| City waitlist modal (no-event cities) | email + city(hidden)                  | ✅     | ❌ **missing** | ✅                       | ✅                  | **add phone**                     |
| City-notify (event cities)            | email → phone                         | ✅     | ✅             | ✅                       | ✅                  | only on event cities              |
| Tickets city-request                  | email (source `tickets-city-request`) | ✅     | ❌             | ✅                       | ✅                  | no phone                          |
| Apply                                 | full (see above)                      | ✅ req | ✅ opt         | success panel + email    | inline + toast      | strongest form                    |
| Admin login                           | email + password                      | —      | —              | redirect                 | shake + alert       | real Firebase Auth                |
| Contestant portal/claim               | name, email, phone, signature, waiver | ✅     | ✅ req         | portal unlock            | ✅                  | native, not wired to invite email |
| `/waiver`                             | JotForm (external)                    | —      | —              | JotForm                  | JotForm             | opaque; not integrated            |

- **Mobile keyboards:** email inputs use `type="email"` and (apply) `inputMode="email"`; phone inputs use `type="tel"` (some with `inputMode="tel"`). Mostly correct. The bare `type="tel"` inputs in the astro popups/Spice List don't set `inputMode` but `type=tel` already triggers the numeric-ish keypad on iOS.
- **Copy is on-brand and dash-clean** (no separator dashes spotted in the audited form copy). The one weak spot is the popup discount copy (already tracked).
- **Systematic gap:** **phone is missing from three capture forms** (city waitlist modal, tickets city-request) and **city is missing from two** (homepage popup, Spice List). The goal wants email + phone + city everywhere a lead is captured.

---

## Phase 5 — Admin CRM / Contestant pipeline

### [HIGH] Native Cast Portal exists but invite emails don't use it

- **Files:** `create-invite.ts:962` builds `waiverUrl = ${siteUrl}/waiver?token=...` and emails that; `waiver.astro` is a **JotForm embed that ignores `?token=`** (`waiver.astro:26`); `stage-waiver.astro` 301-redirects `/stage-waiver → /waiver`. Meanwhile `ContestantPortal.tsx` (`/contestant-portal`) reads `?invite=`/`?show=` and calls `contestant-claim` / `contestant-show-claim` / `contestant-open-claim`, all of which exist and are unit-tested.
- **Impact:** The "Accept your casting" / Cast Member Terms flow the goal describes **is built** (native portal, JWT session cookie, waiver hash, Zoho receipt) but the operator-triggered invite email sends people to a generic JotForm instead. The tokenized native flow is effectively dead-ended, and `stage-waiver.ts` (which resolves `applicantId` from a portal token) has no page that posts to it. Two parallel waiver systems, only the JotForm one reachable from real emails.
- **Fix:** Decide on one system. Recommended: point `create-invite` at `/contestant-portal?invite=<inviteId>` (the native Green Room), retire the JotForm embed, and delete or repurpose `stage-waiver.astro`/`waiver.astro`. See build-spec.md §Cast Portal reconciliation.

### Pipeline: what exists vs the target lifecycle

| Target stage (goal)               | Implemented?   | Where                                                                                                                           |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Applied                           | ✅             | apply form → `applications` status `New`                                                                                        |
| Interview Invited (Cal.com email) | ✅ manual      | `actions/send-scheduling-email`                                                                                                 |
| Interview Scheduled (from Cal)    | ✅             | `webhooks/cal.ts` sets `scheduledAt`, `New→Contacted`                                                                           |
| No-Show follow-up                 | ⚠️ partial     | cron `followups` sends scheduling follow-up + auto-decay to `No Response`; no explicit "no-show" state tied to a passed booking |
| Reviewed (admin notes)            | ✅             | `actions/log-note` → events subcollection                                                                                       |
| Accepted / Rejected               | ✅             | `actions/record-decision`, rejection email template                                                                             |
| Cast (Pending Acceptance)         | ⚠️             | `create-invite` sets status `Cast` + emails link — but link goes to JotForm (above)                                             |
| Cast (Confirmed)                  | ⚠️             | native claim sets it, but flow unreachable from email                                                                           |
| Assigned to Show                  | ✅             | `castEventId` on application / invite carries show metadata                                                                     |
| Day-Before notification           | ❌ **missing** | no cron finds tomorrow's cast to send the "prices go up at midnight, here's the venue + producer phone" email                   |
| Show Complete                     | ✅             | status `Participated` + post-show cron                                                                                          |

- **[MEDIUM] No day-before automation.** The `ContestantConfirmationEmail` and a "shows tomorrow" cron are specced in ENHANCEMENTS.md but not built. `vercel.json` crons are only the 2pm follow-ups and Monday post-show.
- **[MEDIUM] Discount codes are static, not per-contestant.** The `STEALER` 20% code is hardcoded copy; there is no per-contestant/per-venue code management in admin.
- **[LOW] Status transitions are mostly manual** in the dashboard; there's no "active cast per show" roster view (the data exists via `castEventId` but isn't surfaced as a per-show roster).
- Admin dashboard **does** support: view by status (collapsible sections), filter by gender/orientation/city, notes, manual email triggers, pagination, Today/TaskInbox, Analytics/ContestantFunnel.

---

## Phase 6 — Waitlist CRM

### [HIGH] Waitlist data is captured but has no admin CRM view

- **Where the data lives:** Firestore `leads` collection (via `capture-lead`) with `email`, optional `phone`, `city`, `sourceCitySlug`, `geoCity/Region/Country`, UTM, `source`, `createdAt`. Also mirrored to Kit.
- **Gap:** The admin dashboard reads **only `applications`** — there is **no leads/waitlist table, no sort-by-city, no export**. The Analytics tab surfaces `leadsByCity` as an aggregate count via `/api/analytics`, but you cannot see individual entries (name/email/phone/city/date) or export a city's list to email when a show is announced.
- **[MEDIUM] City is inconsistently captured.** Explicit `city`/`sourceCitySlug` only comes from city pages and NotifyModal. Homepage popup + Spice List capture no city (only `geoCity`). So "city bubbles" are partially populated at best.
- **[LOW] No `name` field on leads at all** — the goal's waitlist entry ("name, email, phone, city, date") can't show a name because the capture forms never ask for one.
- **Fix:** Build a Waitlist tab (server-side read via admin API, sortable/filterable by city, CSV export). Add `city` (and optionally `name`) to every capture form. See build-spec.md §Waitlist CRM.

---

## Phase 7 — Email system

### Current state

- **All transactional email already sends from the site via Zoho SMTP** (`lib/zohoMailer.ts`, from `contact@`/`ZOHO_SMTP_USER`, nodemailer, port 465). Templates in `src/data/emails.ts`: `applicationReceived`, `schedulingInvite`, `schedulingFollowup`, `inviteApproval`, `waiverNudge`, `waiverReceipt(WithText)`, `rejection`, `hostBriefing`, `postShow`, `newShowAnnouncement`. These land in Primary (individual Zoho sends), which is exactly the direction the goal wants.
- **Kit (ConvertKit)** is the bulk/marketing sync (`capture-lead` tags subscribers). The brief mentions Klaviyo landing in Promotions — **no Klaviyo integration exists in the codebase**; the marketing tool wired here is Kit, not Klaviyo. Deliverability concerns are external (Kit/Klaviyo dashboards), not visible in code.
- **Resend** is used only for contestant-audience unsubscribe.

### Gaps vs the spec

- **[MEDIUM] No post-purchase email.** There is no Eventbrite `order.placed` → Zoho "thanks + discount code" send. `sync-orders` pulls orders for analytics but triggers no email. (Eventbrite webhook is specced in ENHANCEMENTS.md but not built.)
- **[LOW] Post-show email exists but is applicant-only.** `cron/post-show` emails cast members (`status Participated`), not ticket buyers. The goal's "post-show feedback to buyers" would need the orders/buyer list as the send target.
- **[MEDIUM] No admin "send to selected buyers/city" UI.** Sends are either automated (cron) or per-applicant (admin actions). There's no batch send from the dashboard (e.g. "select this show's buyers → post-show email" or "email NYC waitlist").

---

## Phase 8 — Analytics dashboard

### [EXISTS] `/admin` → Analytics tab

- `AnalyticsDashboard.tsx` + `/api/analytics` (admin-token gated) render: total gross/net revenue, tickets sold, unique buyers, avg ticket price, revenue by show, revenue by city, revenue time series, lead funnel (`totalLeads`, `leadsBySource`, `leadsByCity`, conversion rate, 10 recent leads with masked email + hasPurchased), channel attribution by UTM, application metrics (`byStatus`, `byCity`), last Eventbrite sync time + errors. `ContestantFunnel.tsx` visualizes the application funnel.
- **This covers most of the goal's asks:** waitlist by city (aggregate), applicants by status, ticket buyers (Eventbrite-synced), revenue.
- **Gaps:** no **active-contestants-per-upcoming-show** roster; no **email send/open/click stats** (Zoho/nodemailer has no analytics feedback loop); waitlist-by-city is a count, not the exportable per-lead table Phase 6 needs. Depends on `sync-orders` being run for revenue data to exist.

---

## Priority order (what to fix first)

1. **[CRITICAL] Fix the build** — relocate `src/pages/api/*.test.ts` out of the routable tree. Nothing ships until this is green.
2. **[CRITICAL] Lock Firestore reads** — anonymous PII exposure on `applications` + `leads`. Add admin custom claim, restrict `read`/`update`/`delete`.
3. **[HIGH] Reconcile the waiver systems** — point invite emails at the native `/contestant-portal`, retire the JotForm `/waiver` (or vice-versa, but pick one).
4. **[HIGH] Build the Waitlist CRM view** — server-side leads table, sort/filter by city, CSV export.
5. **[MEDIUM] Capture phone + city on every lead form**; add day-before cast email + post-purchase buyer email; add batch-send admin UI.
6. **[LOW] Popup copy, apply story prompt, Permissions-Policy header, CSP hash migration, `generate-contestant-link` admin check.**
