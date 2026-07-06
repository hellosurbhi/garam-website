# build-spec.md — garammasaladating.com

_Technical spec for everything the audit found missing or broken. Ready to build from. Ordered by priority. Firestore schemas, API endpoints, UI descriptions, and email templates included. Existing patterns to reuse are named so nothing is reinvented._

---

## 0. Fix the build (blocker, do first)

**Problem:** `.test.ts` files in `src/pages/api/` are routed and prerendered, crashing the build (`vi.queueMock forbidden`).

**Do:** Move all API route tests out of `src/pages/`. Create `test/api/` (or `src/tests/api/`) and relocate `contestant-claim.test.ts`, `contestant-open-claim.test.ts`, `contestant-show-claim.test.ts`, `portal-state.test.ts`. Update `vitest.config.ts` `include` if it globs `src/pages`. Verify with `npm run build` (exit 0) and `npm run test`. Do not "fix" by adding `export const prerender` hacks to test files — the tests simply must not live in the routable tree.

---

## 1. Lock down Firestore reads (critical security)

**Goal:** Only real admins can read `applications` and `leads`; anonymous apply submissions keep working.

### 1a. Grant an admin custom claim

One-off script using the Admin SDK (or a protected `/api/admin/grant-claim` run once):

```ts
import { getAuth } from "firebase-admin/auth";
for (const uid of process.env.ADMIN_UIDS!.split(",")) {
  await getAuth().setCustomUserClaims(uid.trim(), { admin: true });
}
```

Admins must re-authenticate (or force ID-token refresh) for the claim to appear.

### 1b. Rewrite `firestore.rules`

```
function isAdmin() { return request.auth != null && request.auth.token.admin == true; }

match /applications/{doc} {
  allow create: if request.auth != null && validApplication();
  allow read, update, delete: if isAdmin();
}
match /applications/{doc}/{sub=**} {
  allow read, write: if isAdmin();
}
match /leads/{doc} {
  allow create: if validLead();
  allow update: if validPhoneUpdate() || isAdmin();
  allow read, delete: if isAdmin();
}
match /orders/{id}      { allow read: if isAdmin();  allow write: if false; }
match /syncMeta/{id}    { allow read: if isAdmin();  allow write: if false; }
match /systemConfig/{id}{ allow read, write: if isAdmin(); }
```

Keep `invites`, `contestants`, `stage_waivers` unlisted (client default-deny; server REST only).

**Verify:** anonymous session can create an application but a client `getDocs(collection(db,"applications"))` is denied; admin (claimed) session still reads the dashboard. Add rules-unit-tests (`@firebase/rules-unit-testing`) for both.

**Note:** the admin dashboard reads via client SDK today, so custom-claim rules keep it working unchanged. If you instead choose server-only reads, build the endpoints in §4 first and swap the dashboard's `getDocs` calls to fetch them.

---

## 2. Reconcile the Cast Portal / waiver (high)

**Decision:** use the native Green Room (`/contestant-portal` + `ContestantPortal.tsx` + `contestant-*-claim` endpoints, already built and tested). Retire the JotForm embed.

**Changes:**

1. `create-invite.ts:962` — change the emailed URL from `/waiver?token=...` to:
   `const portalUrl = `${siteUrl}/contestant-portal?invite=${inviteId}`;`
   Pass `portalUrl` to `inviteApproval()`.
2. `data/emails.ts` `inviteApproval` — reframe copy as "Accept your casting" / "Cast Member Terms" (not "waiver"): subject `You're cast for Garam Masala Dating 🌶️`, body invites them to the Green Room to confirm and sign their Cast Member Terms.
3. `waiver.astro` — either delete (if no public standalone waiver is needed) or repoint at the native `/contestant-portal?show=<showId>` show-claim flow for walk-up spectators. Remove the JotForm embed `261031391833047`.
4. `stage-waiver.astro` + `stage-waiver.ts` — delete if the native claim endpoints fully cover it (they write `contestants` + waiver hash + receipt). If a distinct "stage waiver for a specific applicant" record is still wanted, wire a page that posts to `stage-waiver.ts` with the portal token; otherwise remove the orphan.
5. Regression-test the three claim paths end to end (invite, show, open) and confirm the `portal_session` cookie + `portal-state` `active` view.

---

## 3. Waitlist CRM (high)

### 3a. Schema — extend `leads` (no new collection needed)

Add optional `name` to the lead shape and rules (`validLead()` in `firestore.rules`): allow `name` string ≤ 200. Everything else (`email`, `phone`, `city`, `sourceCitySlug`, `geoCity`, `createdAt`) already exists.

### 3b. Capture-form changes (also serves §5)

Add **city** to the homepage popup and Spice List, and **phone** to the city waitlist modal and tickets city-request form. Reuse `captureLead()` / `updateLeadPhone()` from `lib/leadSubmission.ts` and `buildLeadAttribution()`. Optionally add an optional **name** field to waitlist modals so the CRM can show a name.

### 3c. API — `GET /api/admin/leads`

- Auth: `verifyAdminToken` (Firebase ID token + `ADMIN_UIDS`), same as `analytics.ts`.
- Reads `leads` via `firestoreAdmin` service-account REST (`listCollection` helper already in `analytics.ts`/`sync-orders.ts` — extract to `lib/firestoreRest` or reuse).
- Query params: `city`, `source`, `from`, `to`, `format=json|csv`.
- Returns `{ leads: [{ id, name?, email, phone?, city, sourceCitySlug?, source, createdAt }], total }`. For `format=csv`, stream `text/csv` with a `Content-Disposition: attachment` header.
- Mask nothing here (admin-only), unlike the public analytics recent-leads which masks email.

### 3d. UI — Admin "Waitlist" tab

- Add a 4th tab in `AdminDashboard.tsx` next to Today/Applicants/Analytics.
- Table: Name · Email · Phone · City · Source · Date, sortable by column, default sort city A→Z then date desc.
- Filter chips: city (multi-select, reuse the `react-select` filter pattern already in the dashboard), source, date range.
- "Export CSV" button per current filter → hits `/api/admin/leads?...&format=csv`.
- Empty/loading/error states matching the existing dashboard skeleton pattern.

---

## 4. (Optional) Server-only application reads

If you chose server-only reads in §1 instead of custom claims:

- `GET /api/admin/applications?status=&city=&cursor=&limit=` — `verifyAdminToken`, service-account REST, cursor pagination mirroring the current `startAfter`/`limit(50)` client logic.
- `GET /api/admin/applications/:id/events` — events subcollection.
- Swap `AdminDashboard.tsx` `getDocs` calls for `fetch` to these. Otherwise skip this section.

---

## 5. Lead capture completeness (medium)

Every capture surface should collect **email + phone + city**. Current gaps and the concrete edits:

| Form                 | Add                                         | File                      |
| -------------------- | ------------------------------------------- | ------------------------- |
| Homepage popup       | city (text or geo-prefill)                  | `index.astro` step 2      |
| Spice List           | city                                        | `HomeSignup.astro`        |
| City waitlist modal  | phone (2nd step, reuse city-notify pattern) | `cities/[slug].astro:509` |
| Tickets city-request | phone                                       | `tickets.astro`           |

Prefill city from `sessionStorage` `gmd-geo-city` (already populated by `bootstrapGeoData`) so the user rarely types it. Keep phone as an optional second step to avoid hurting email conversion.

---

## 6. Day-before cast confirmation email (medium)

### Cron — extend `cron/followups.ts` or add `cron/day-before.ts`

- Add `vercel.json` cron `{ "path": "/api/cron/day-before", "schedule": "0 16 * * *" }` (or fold into the existing daily run; it already computes NYC time and iterates `applications`).
- Logic: find `contestants` (or `applications` with `status=Cast` + `castEventId`) whose show `isoDate == tomorrow` (in show timezone) and `confirmationEmailSentAt == null`; send once; set `confirmationEmailSentAt`. Idempotent per contestant/show (same guard pattern as `postShowSentAt`).

### Email template — `data/emails.ts` `dayBeforeShow(opts)`

Inputs: `firstName`, `showCity`, `showDisplayDate`, `venueName`, `venueAddress`, `callTime` (`showStartTime - 45min`), `producerPhone`. Copy (dash-clean, on-brand):

> Subject: `Tomorrow's the night, {firstName} 🌶️`
> Body: excited-for-you tone. Include: venue name + address, call time ("please arrive by {callTime}, we run on time, not Indian time 😄"), producer name + phone for day-of questions, and a share nudge: "Tell your friends to grab tickets tonight, prices go up at midnight." Link the current show's Eventbrite URL. Sign off from Surbhi.

Add `PRODUCER_PHONE` / `HOST_BRIEFING_EMAILS`-style env for the producer contact.

---

## 7. Post-purchase + post-show buyer emails (medium)

### 7a. Post-purchase (needs Eventbrite webhook — currently only polling via `sync-orders`)

- New `POST /api/webhooks/eventbrite` — verify with Eventbrite's signature/`aff` correlation, on `order.placed` send a Zoho email via `zohoMailer`.
- Template `data/emails.ts` `postPurchase(opts)`: personal thanks, a discount code for a future show, "reply to unsubscribe" line. Store `orders/{id}.thankYouSentAt` to stay idempotent.
- Requires Eventbrite webhook config + API key (already have `EVENTBRITE_API_TOKEN`).

### 7b. Post-show to buyers (batch)

- `POST /api/admin/send-post-show` — `verifyAdminIdentity`, body `{ showId, template: "post-show" }`. Reads `orders` for that `eventbriteEventId`, sends `postShow`-style feedback email to each unique buyer email, records `orders/{id}.postShowSentAt`.
- UI: on the Analytics "revenue by show" row, a "Send post-show email" action opens a confirm modal (count of recipients) before sending.

---

## 8. Analytics additions (low)

- **Active cast per upcoming show:** add to `/api/analytics` a `castByShow` aggregate from `contestants` (group by `showId`, count + names/roles), and render a per-show roster card in `AnalyticsDashboard.tsx`.
- **Email stats:** Zoho SMTP gives no open/click feedback. If email analytics matter, either (a) send marketing via Kit and read Kit stats, or (b) add link-tracking redirects. Document as out-of-scope for transactional Zoho sends.

---

## 9. Smaller fixes (low)

- **`generate-contestant-link.ts`** — swap `verifyIdToken` → `verifyAdminToken`.
- **CSP** — migrate to Astro `experimental.csp` (build-time hashes), drop `'unsafe-inline'`, move the CSP out of `vercel.json` to a single source (already tracked in BUGS.md; its own PR).
- **`Permissions-Policy` header** in `vercel.json`: `camera=(), microphone=(), geolocation=(), interest-cohort=()`.
- **Apply story prompt** — make one personality prompt required and specific, e.g. replace optional "Why would you be a great fit?" with required "Tell us about the most chaotic date you've ever been on (we cast for stories):" (maxLength 600). Update `notify-application` Zod `pitch` handling and `validApplication()` length if needed.
- **Popup offer copy** — once a real incentive exists, replace "Want Cheaper Tickets?" / "Get My Discount Code" across `index.astro` popup + Spice List with the finalized offer.
- **Chunk size** — code-split the largest island bundle if LCP regresses; measure first.

---

## Build order (dependency-aware)

1. §0 build fix → 2. §1 Firestore lockdown (+ rules tests) → 3. §2 portal reconciliation → 4. §3 Waitlist CRM (+ §5 city/phone capture, which it shares) → 5. §6 day-before email → 6. §7 buyer emails → 7. §8/§9 polish. Each is an atomic PR; §0 and §1 must land before any deploy.
