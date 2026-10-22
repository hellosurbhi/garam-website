# architecture-map.md — garammasaladating.com

_What actually exists in the codebase as of 2026-07-06 (branch `fix/missing-portal-apis`). Generated from a full read of `src/`, `firestore.rules`, `storage.rules`, `vercel.json`._

Stack: Astro 5 (SSG + on-demand server routes via `@astrojs/vercel`) · React islands · Firebase Firestore + Auth + Storage · Vercel hosting · Zoho Mail SMTP (nodemailer) · Kit (ConvertKit) · Eventbrite · Cal.com · Upstash Redis (rate limiting) · Cloudflare Turnstile.

---

## 1. Page routes (`src/pages/`)

| Route                                | File                                               | Rendering                   | Primary conversion goal              | Notes                                                   |
| ------------------------------------ | -------------------------------------------------- | --------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `/`                                  | `index.astro`                                      | static                      | Tickets + email/phone capture        | 30s/scroll/exit-intent popup, StickyCTA, Spice List     |
| `/tickets`                           | `tickets.astro`                                    | static                      | Ticket purchase                      | Eventbrite modal widgets + city-request fallback        |
| `/apply`                             | `apply.astro` → `ApplyPage.tsx`                    | static shell + React island | Contestant application               | Turnstile, anonymous Firebase auth, photo upload        |
| `/cities`                            | `cities/index.astro`                               | static                      | Browse cities                        | Index of city landing pages                             |
| `/cities/[slug]`                     | `cities/[slug].astro`                              | static (getStaticPaths)     | Tickets or city waitlist             | 1558 lines; waitlist modal + city-notify form           |
| `/faq`                               | `faq.astro`                                        | static                      | Info → tickets                       | Only page emitting FAQPage JSON-LD                      |
| `/hosts`                             | `hosts.astro`                                      | static                      | Info                                 | Host bios                                               |
| `/journal`                           | `journal/index.astro`                              | static                      | Content → tickets                    | Blog index                                              |
| `/journal/[slug]`                    | `journal/[slug].astro`                             | static                      | Content → tickets                    | ArticleCta component                                    |
| `/journal/situationship-masterclass` | dedicated `.astro`                                 | static                      | Content                              | Masterclass slides                                      |
| `/links`                             | `links.astro`                                      | static                      | Social + tickets                     | Link-in-bio page                                        |
| `/corporate`                         | `corporate.astro`                                  | static                      | Lead (corporate)                     |                                                         |
| `/sponsorship`                       | `sponsorship.astro`                                | static                      | Lead (sponsor)                       |                                                         |
| `/contestant-prep`                   | `contestant-prep.astro` → `ContestantPrepPage.tsx` | static + island             | Contestant info                      | HMAC date+sig gated (`/api/contestant-prep-auth`)       |
| `/contestant-portal`                 | `contestant-portal.astro` → `ContestantPortal.tsx` | island `client:load`        | Cast acceptance (native Cast Portal) | reads `?invite=` / `?show=` params                      |
| `/waiver`                            | `waiver.astro`                                     | static                      | Waiver signing                       | **JotForm embed `261031391833047`** (ignores `?token=`) |
| `/stage-waiver`                      | `stage-waiver.astro`                               | 301 redirect                | → `/waiver`                          | preserves `?show=`                                      |
| `/consent`                           | `consent.astro`                                    | static, `noindex`           | Legal                                | from `LEGAL_DOCS.consent`                               |
| `/privacy`                           | `privacy.astro`                                    | static, `noindex`           | Legal                                |                                                         |
| `/terms`                             | `terms.astro`                                      | static, `noindex`           | Legal                                |                                                         |
| `/thank-you`                         | `thank-you.astro`                                  | static                      | Post-conversion                      |                                                         |
| `/admin`                             | `admin.astro` → `AdminPage.tsx`                    | island                      | Internal CRM                         | Firebase Auth email/password                            |
| `/llms.txt`                          | `llms.txt.ts`                                      | server endpoint             | AEO                                  | build-time content dump                                 |
| `/llms-full.txt`                     | `llms-full.txt.ts`                                 | server endpoint             | AEO                                  | full content dump                                       |
| `/404`                               | `404.astro`                                        | static                      | —                                    |                                                         |

## 2. API endpoints (`src/pages/api/`) — all `prerender = false`

### Public (unauthenticated by design)

| Endpoint                   | Method | Auth / guard                                                          | Purpose                                                                 |
| -------------------------- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `capture-lead.ts`          | POST   | Rate limit (10/min), origin-less, email validation                    | Writes lead to Firestore REST; issues HMAC update token; fires Kit sync |
| `update-lead.ts`           | POST   | Rate limit (10/min) + HMAC lead token (when `LEAD_UPDATE_SECRET` set) | Adds phone to a lead                                                    |
| `geo.ts`                   | GET    | none                                                                  | Returns Vercel IP geo headers (DEV returns NYC stub)                    |
| `verify-turnstile.ts`      | POST   | Rate limit (20/min) + origin allowlist                                | Cloudflare Turnstile verify (pass-through if no secret)                 |
| `notify-application.ts`    | POST   | Rate limit (5/min) + origin allowlist + Zod schema                    | Emails admin + applicant confirmation (Zoho)                            |
| `contestant-prep-auth.ts`  | POST   | Rate limit (5/min) + HMAC sig, show-day expiry                        | Unlocks `/contestant-prep`                                              |
| `contestant-claim.ts`      | POST   | Rate limit + invite lookup + waiver checks                            | Native cast claim (invite path); sets `portal_session` cookie           |
| `contestant-show-claim.ts` | POST   | Rate limit + event lookup                                             | Native cast claim (show path)                                           |
| `contestant-open-claim.ts` | POST   | Rate limit                                                            | Open-casting packet claim                                               |
| `stage-waiver.ts`          | POST   | Rate limit + optional portalToken                                     | Writes `stage_waivers`, links to application                            |
| `portal-state.ts`          | GET    | invite/show param OR `portal_session` cookie (JWT)                    | Drives ContestantPortal state machine                                   |
| `unsubscribe.ts`           | GET    | HMAC sig (`UNSUBSCRIBE_SECRET`)                                       | Resend audience unsubscribe                                             |

### Admin (Firebase ID token; verified email on the `src/lib/adminAllowlist.ts` allowlist OR `admin` custom claim)

| Endpoint                              | Method | Verifier                        | Purpose                                                   |
| ------------------------------------- | ------ | ------------------------------- | --------------------------------------------------------- |
| `analytics.ts`                        | GET    | `verifyAdminToken`              | Aggregated revenue/leads/applications snapshot            |
| `admin/leads.ts`                      | GET    | `verifyAdminToken`              | Waitlist/Email List CRM read + CSV export                 |
| `create-invite.ts`                    | POST   | `verifyAdminIdentity`           | Creates invite doc, emails cast link, patches application |
| `generate-contestant-link.ts`         | POST   | `verifyAdminToken`              | Builds HMAC prep link                                     |
| `actions/log-note.ts`                 | POST   | `verifyAdminIdentity`           | Appends `interview_note` event                            |
| `actions/record-decision.ts`          | POST   | `verifyAdminIdentity`           | Records accept/reject decision                            |
| `actions/send-scheduling-email.ts`    | POST   | `verifyAdminIdentity`           | Sends Cal.com invite email                                |
| `actions/send-scheduling-followup.ts` | POST   | `verifyAdminIdentity`           | Sends follow-up                                           |
| `actions/send-waiver-nudge.ts`        | POST   | `verifyAdminIdentity`           | Sends waiver nudge                                        |
| `sync-orders.ts`                      | POST   | `verifyAdminToken` + rate limit | Pulls Eventbrite orders into Firestore                    |

### Cron / service-secret (`CRON_SECRET` bearer)

| Endpoint               | Schedule (`vercel.json`) | Purpose                                                         |
| ---------------------- | ------------------------ | --------------------------------------------------------------- |
| `cron/followups.ts`    | `0 14 * * *` daily       | Scheduling follow-ups, waiver nudges, auto-decay, host briefing |
| `cron/post-show.ts`    | `0 15 * * 1` weekly      | Post-show feedback emails                                       |
| `sync-leads-to-kit.ts` | (manual / secret)        | Backfills leads to Kit                                          |
| `webhooks/cal.ts`      | (Cal.com webhook)        | HMAC-verified booking created/rescheduled/cancelled             |

## 3. Firestore collections

| Collection                 | Written by                          | Read by                                          | Client rules (`firestore.rules`)                                                         |
| -------------------------- | ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `leads`                    | `capture-lead` (REST), client SDK   | `analytics`, `sync-leads-to-kit`                 | `create: validLead()`; `update: validPhoneUpdate() or auth`; `read,delete: auth != null` |
| `applications`             | apply form (client SDK, anon auth)  | admin dashboard (client SDK), crons, cal webhook | `create: auth && validApplication()`; `read,update,delete: auth != null`                 |
| `applications/{id}/events` | admin actions, crons, webhook       | admin                                            | `create/read/update/delete: auth != null`                                                |
| `orders`                   | `sync-orders` (service acct)        | `analytics`                                      | `read: auth`; `write: false`                                                             |
| `syncMeta`                 | `sync-orders`                       | `analytics`                                      | `read: auth`; `write: false`                                                             |
| `systemConfig`             | crons                               | crons/admin                                      | `read,write: auth != null`                                                               |
| `invites`                  | `create-invite` (REST service acct) | portal-state, claim endpoints                    | **not in rules → client default deny** (server REST only)                                |
| `contestants`              | claim endpoints (REST)              | portal-state, post-show cron                     | **not in rules → client default deny**                                                   |
| `stage_waivers`            | `stage-waiver` (REST)               | —                                                | **not in rules → client default deny**                                                   |

Storage (`storage.rules`): `photos/{photoId}` — read/write require `auth != null`; write capped 15 MB; contentType allowlist jpeg/png/webp/heic.

## 4. React islands & major components

- `ApplyPage.tsx` (866 lines) + `apply/useApplyForm.ts` (form/upload/submit), `apply/TermsModal.tsx`, `apply/ApplySuccessPanel.tsx`, `apply/PhotoUploadField.tsx`, `apply/FieldGroup.tsx`
- `AdminPage.tsx` → `admin/AdminLogin.tsx`, `admin/AdminDashboard.tsx` (tabs: Today/`TaskInbox`, Applicants, Analytics/`ContestantFunnel`+`AnalyticsDashboard`), `admin/ApplicantModal.tsx`, `admin/ApplicantCard.tsx`, `admin/ContestantInviteModal.tsx`
- `ContestantPortal.tsx` — native Cast Portal state machine
- `ContestantPrepPage.tsx`, `WaiverDocument.tsx`
- Astro: `home/*` (Hero, Shows, Signup, Video, FAQ, etc.), `layout/PageNav`, `StickyCTA`, `LeadCaptureModal`, `NotifyModal`, `CookieConsent`, `ui/Modal`, `cities/CityEventTicketEmbed`

## 5. Shared libs (`src/lib/`)

`firebase.ts` (client SDK singletons) · `firestoreAdmin.ts` (service-account OAuth) · `firestoreRest.ts` (fsGet/fsAdd/fsPatch/fsQuery/fsListAll) · `verifyToken.ts` (Firebase ID token + admin allowlist) · `portalToken.ts` (HS256 JWT for portal session) · `leadToken.ts` (HMAC lead-update token) · `rateLimit.ts` (Upstash sliding window, fail-open) · `zohoMailer.ts` (nodemailer SMTP) · `kit.ts` · `eventbrite.ts` · `leadSubmission.ts` / `leadAttribution.ts` / `analytics.ts` (client capture)

## 6. External integrations

| Service              | Used for                                         | Config                                                          |
| -------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Firebase             | Firestore, Auth (anon + admin email/pw), Storage | `PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*`                         |
| Zoho Mail            | all transactional email (SMTP)                   | `ZOHO_SMTP_USER/PASS`, `ZOHO_FROM_NAME`, `NOTIFICATION_EMAIL`   |
| Eventbrite           | ticketing, order sync                            | `EVENTBRITE_API_TOKEN`, per-event `eventbriteId` in `events.ts` |
| Cal.com              | interview scheduling                             | `CAL_INTERVIEW_URL`, `CAL_WEBHOOK_SECRET`                       |
| Kit (ConvertKit)     | email list sync                                  | `KIT_API_SECRET`                                                |
| Resend               | contestant audience unsubscribe only             | `RESEND_API_KEY`, `RESEND_CONTESTANT_AUDIENCE_ID`               |
| JotForm              | current `/waiver` embed (form 261031391833047)   | hardcoded in `waiver.astro`                                     |
| Cloudflare Turnstile | apply-form CAPTCHA                               | `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`             |
| Upstash Redis        | API rate limiting                                | `UPSTASH_REDIS_REST_URL/TOKEN`                                  |
| Analytics            | GTM, GA4, Meta/TikTok/X pixels, PostHog, Vercel  | see `BaseLayout.astro`                                          |

## 7. Contestant lifecycle (as implemented)

Application statuses: `New → Contacted → Responded → Said Not Now → Cast → No Response → Not Interested Anymore → Not Interested → Rejected → Bailed → Participated`.

Flow wired today: apply → Firestore `applications` (status `New`) → admin sends Cal invite (`send-scheduling-email`) → Cal webhook flips `New→Contacted`, stores `scheduledAt` → cron follow-ups/auto-decay → admin `create-invite` (status→`Cast`, emails cast link) → contestant signs → post-show cron. See audit-findings.md §Phase 5 for the gaps (invite email links to JotForm, not the native portal; no day-before automation; manual status transitions).
