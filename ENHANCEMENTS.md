# Enhancements Backlog

Items from the GMD website audit checklists (site audit, codebase cleanup, conversion audit, mobile audit) that need content, design decisions, or external work. Sorted by impact.

<!-- Doc routing (2026-07-13): this file is an OPEN backlog only. It holds
enhancements not yet built, plus deferred or blocked items with their reason.
When an item ships, DELETE it here in the same commit and record the work in
CHANGELOG.md. Never add completed or superseded entries to this file. -->

---

## Coverage-gate follow-ups (2026-08-26)

- [ ] ENHANCEMENT: diff-coverage.mjs's uninstrumentable-line regex doesn't recognize multi-line named imports as excludable, false-flagging them as uncovered | Why: a single-line `import { a, b } from "x"` is matched by the `import\s` exclusion pattern, but once Prettier wraps it across lines, only the opening `import {` line matches; the interior identifiers and the closing `} from "...";` line match no exclusion pattern, and since import statements are hoisted (never appear in Istanbul's statementMap) that closing line can never register as "covered," which also breaks CONTINUATION_RE's backward-rescue chain for the whole block. Hit this on PR #230: contestant-claim.ts, contestant-open-claim.ts, and contestant-show-claim.ts all false-flagged a 3-line import even though the imported functions were already fully exercised by existing tests; worked around in-session by splitting each into single-line imports rather than editing this shared gate script, since the script is pre-existing infra outside this session's scope | Files: scripts/diff-coverage.mjs | Plan: extend UNINSTRUMENTABLE_RE (or add a dedicated multi-line-import scanner) to recognize a `import {` ... `} from "...";` block spanning multiple diff lines as fully excludable, regardless of interior line content | Verify: reproduce with a synthetic multi-line named import in a throwaway diff, confirm diff-coverage.mjs no longer counts its interior/closing lines as uncovered; re-run against PR #230's original commit (0beb896) diff and confirm the three files no longer need the import-splitting workaround.

---

## Test fixture duplication surfaced by the stalled Dependabot queue (2026-10-11)

- [ ] ENHANCEMENT: extract one shared Application test factory and delete the duplicate locationDisplay test | Why: five test files each hand roll a Firestore `Timestamp` double, and one of them (`src/utils/locationDisplay.test.ts`) used a single cast instead of `as unknown as`, which is the type error that killed group PR #288 and blocked the whole security queue; `src/utils/locationDisplay.test.ts` and `test/locationDisplay.test.ts` are also two tests of the same `formatLocation` module, which CLAUDE.md forbids | Files: src/utils/locationDisplay.test.ts, test/locationDisplay.test.ts, src/components/admin/AdminDashboard.test.tsx, src/components/admin/ApplicantModal.test.tsx, src/components/admin/ApplicantCard.test.tsx, test/factories/application.ts (does not exist yet, this ticket creates it) | Plan: add `test/factories/application.ts` exporting `makeApplication(overrides)` that builds a valid `Application` with a real `Timestamp` from `firebase/firestore` so no cast is needed at all, point all five test files at it, then delete whichever locationDisplay test is the redundant copy and keep its unique cases | Verify: `npm run check` reports 0 errors, `npm test` passes, and `grep -r 'as unknown as Application' src/ test/` returns nothing.

---

## Future city additions: batch recipe (2026-07-06)

## Apply-monitor fix follow-ups (2026-08-19)

- [ ] ENHANCEMENT: CI job auto-deploys firestore.rules/storage.rules on merge to main (Surbhi approved 2026-08-19) | Why: both the July and August apply outages were rules merged but never manually deployed; executor is a dedicated follow-up PR, blocked until Surbhi completes operator step 4 of the apply-monitor fix PR (adds a FIREBASE_SERVICE_ACCOUNT repo secret, no workflow reads it yet because none exists yet) | Files: .github/workflows/deploy-rules.yml (does not exist yet, this ticket creates it) | Plan: workflow with explicit permissions contents: read, triggers on main-branch changes to firestore.rules/storage.rules, runs the firebase CLI rules deploy with the CI credential secret, fails loudly if the secret is missing (never skip-but-green) | Verify: merge a comment-only rules change, workflow goes green and scripts/check-rules-drift.mjs passes against production.
- [ ] ENHANCEMENT: sweep orphaned synthetic monitor photos in Storage | Why: 28 failed runs each rolled back the Firestore write but got 403 deleting the uploaded 1x1 photo (pre-#135 storage.rules), leaving orphaned objects | Files: scripts/synthetic-apply-verify.mjs | Plan: extend the verify script cleanup to list photos/ objects and delete those older than 1 day whose owner metadata matches a synthetic-run anonymous session with no surviving application document | Verify: Storage list shows no synthetic orphans after a run.
- [ ] ENHANCEMENT: second alert channel via ALERT_WEBHOOK_URL push | Why: alert email delivery to NOTIFICATION_EMAIL is unverified and email is a single point of failure for outage paging; opsAlert already supports a webhook | Files: src/lib/opsAlert.ts, README.md | Plan: operator sets ALERT_WEBHOOK_URL in Vercel to an ntfy topic, document the ops setup in README | Verify: test alert reaches the phone.

---

## Canceling a show does not invalidate already-issued contestant invites or active portal sessions (2026-08-14)

**Priority:** Medium
**Status:** Deferred pending an owner decision (surfaced by the Codex audit of the never-delete-events plan)

New invites and new claims for a canceled show are blocked (the events.ts lookups in create-invite, contestant-show-claim, portal-state and send-waiver-nudge all exclude `status: "canceled"`). But `portal-state`'s invite branch and `contestant-claim.ts` trust stored Firestore invite data and never consult events.ts, so a contestant invited BEFORE a cancellation can still claim and keep portal access. That may be desired (the team contacts affected contestants personally) or not; blocking it automatically is a product decision. If wanted: re-validate the stored `showId` against events.ts status in both flows and return a clear "show canceled" state.

---

## Apply/admin test and UI polish deferred from the CodeRabbit PR #135 body review (2026-08-12)

- Admin photo grid: `useApplicantPhotos` silently drops photos whose download fails; return a `failed` count so the dashboard can distinguish "loading" from "failed". Low value (admin-only surface); do with the planned admin rewrite.
- `ApplyPage.test.tsx`: hoist the `deleteObject` mock and assert the failure-cleanup and owner-metadata contracts at unit level. Both contracts are enforced today by the emulator rules tests (`apply-flow.rules-test.ts`), which is the stronger guarantee; the unit assertions are belt-and-braces for refactors.

## Apply-form outage follow-ups (2026-07-13)

### Add the synthetic monitor identity to PostHog's internal-user filter

**Priority:** Low
**Why:** Synthetic submissions no longer emit conversion events at all (skipped at the source), but their pageviews still occur. Adding `synthetic-monitor@garammasaladating.com` to PostHog's "filter out internal and test users" definition keeps session/pageview analytics clean.

---

## Mobile Sticky CTA for Event Landing Pages (2026-07-16)

### Add a sticky "Get Tickets" bar to /events/[slug] pages

**Priority:** High
**Status:** Needs implementation, sequenced into the ticket card consolidation task
**Branch context:** describes code on the unmerged `feat/event-pages-tracked-checkout` branch (`src/pages/events/[slug].astro`, `EventTicketCta.astro`, the `data-go-ticket` contract). None of it is on main yet; act on this entry with that branch.

The `/events/[slug].astro` landing page (built for the tracked-checkout redirect project) is a long-scroll page: hero, overview, what to expect, lineup, location, agenda, FAQ, social proof, bottom CTA. It is the intended landing spot for paid Instagram traffic. On mobile (70% of traffic), a visitor who scrolls past the hero CTA has to scroll all the way back up or down to the bottom CTA to convert.

`StickyCTA.astro` already exists and is used on `/tickets`, but its anchor carries no `data-go-ticket` attribute and none of the per-event tracking data attributes that `EventTicketCta.astro`'s click-tracking script depends on (it wires up every `[data-go-ticket]` anchor on the page: stamps a unique `eid`, forwards UTMs, fires `checkout_opened` with the CAPI dedup id). Dropping `StickyCTA` onto the event page as-is would render an untracked link, silently reintroducing the tracking blind spot this project exists to close.

**Why not built now:** the ticket card consolidation task is already scoped to unify CTA/card presentation sitewide (retiring the old Eventbrite embed/modal). That is the correct place to establish one sitewide sticky-CTA pattern with tracking built in from the start, rather than shipping a one-off sticky bar for the event page now and reworking it again immediately after.

**How:** when doing the consolidation, extend the tracked-link contract (`data-go-ticket` + `data-event-*` attrs) to `StickyCTA.astro` itself, or replace it with a shared `EventTicketCta`-based sticky variant, so every page wanting a persistent mobile CTA (event pages, `/tickets`, city pages) gets full tracking automatically from one implementation.

**Files to touch:** `src/components/StickyCTA.astro`, `src/pages/events/[slug].astro`, `src/pages/tickets.astro`.

---

## Contestant Workflow Test Coverage: Portal + Admin Components (2026-07-16)

### Write unit tests for ContestantPortal.tsx, TaskInbox.tsx, and ContestantFunnel.tsx

**Priority:** High
**Status:** Deferred

Backend unit tests for the P1 to P5 contestant workflow control tower shipped alongside this entry (`src/lib/zohoMailer.ts`, the cal.com webhook, and the post-show/followups cron jobs). Three UI pieces from the same rollout remain untested, deferred for two different reasons:

1. **`src/components/ContestantPortal.tsx`**: public facing waiver and prep portal, ~770 lines, stateful (needs `vi.stubGlobal("fetch")` plus `waitFor` patterns, not the `vi.mock`+dynamic-import pattern the backend tests use). Kept out of the backend test PR so that PR stayed a clean, reviewable, single-purpose change. Write its tests in a dedicated follow-up PR.
2. **`src/components/admin/TaskInbox.tsx`** and **`src/components/admin/ContestantFunnel.tsx`**: admin dashboard screens. The operator plans a full rewrite of the admin page (2026-07-15 directive: it is not working well and is getting redone). Writing tests against components about to be replaced wastes the effort; write tests against the rewritten components once that lands.

**Acceptance criteria:**

1. `ContestantPortal.tsx` has vitest coverage for waiver sign-through, invite-token validation, and error states.
2. Once the admin rewrite ships, its replacement Task Inbox and funnel views ship with unit tests as part of that PR, not as a follow-up debt item.

---

## City Page Enrichment: Remaining Batches (2026-07-06)

**Priority:** Reference for any new city page
**Status:** Open reference

The 2026-07-06 enrichment pass took all 307 city pages to 2 unique sections plus 6 city-specific FAQs each (shipped on feat/seo-powerhouse-wave1, recorded in CHANGELOG.md). Any city page added later must follow the same recipe:

1. Two `sections` entries: one on where that city's desi singles actually meet today (grounded in real, widely documented neighborhoods, universities and festivals; no invented venues or unsourced statistics) and one "what a Garam Masala night here will look like" tied to the tour narrative.
2. Three extra `faqItems` targeting long-tail queries: "indian speed dating {city}", "where do south asian singles meet in {city}" and one city-specific question (venue geography, pricing, community mix).
3. Keep the copy voice: no separator dashes, no Oxford commas, lowercase "join the waitlist" and "apply to be a contestant" phrases intact so `renderCityText` converts them into inline CTAs.
4. Tests: add the new slugs to the enriched list in `src/data/cities.test.ts` so the 2-section 6-FAQ floor is enforced.

---

## Admin Event Management (2026-05-15)

### Admin Event Management: CRUD events from the dashboard

**Priority:** High
**Status:** Needs implementation

Currently, adding a new show requires editing `src/data/events.ts` directly, creating a commit, and redeploying the entire site. Every new city, venue, or date change is a code change. This is a blocker for non-engineers and creates unnecessary deploy cycles for pure data updates.

Build a CRUD interface in the admin dashboard at `/admin` that lets the operator create, edit, and archive events without touching the codebase. Events would be stored in Firestore and fetched at build time so the existing SSG performance model is preserved. The static `events.ts` array becomes the seeded fallback; the Firestore collection is the source of truth going forward.

**Planning note:** This is a backlog plan only. Do not start implementation until the operator explicitly asks to build admin event management.

**Rollout plan:**

1. Confirm the operator workflow before code: who edits shows, whether draft events are needed, whether venue reuse matters, and whether hard delete is actually required.
2. Define the managed event schema from `EventEntry`, adding only operational fields that are truly needed: `createdAt`, `updatedAt`, `archived`, and optional `archivedAt`.
3. Create a one-time seed script that writes the existing static `events.ts` entries into Firestore with stable document IDs based on city slug and ISO date.
4. Add Firestore rules that allow authenticated admins to read and write the managed `events` collection while keeping public unauthenticated writes blocked.
5. Build the admin Events tab in small pieces: first list and archive, then create, then edit. Keep validation shared between create and edit so event rules do not drift.
6. Preserve the static site model by loading Firestore events at build time, falling back to `events.ts` if Firestore credentials are missing or the fetch fails during local development.
7. Keep `events.ts` as the emergency fallback until the Firestore event workflow has been used successfully for several real show updates.
8. Add tests at the data boundary and admin UI boundary: schema validation, duplicate city plus date rejection, archive behavior, and fallback behavior.
9. Document the operator process after launch: how to add a show, archive a show, mark sold out, and recover if Firestore is unavailable.

**Acceptance criteria:**

1. A logged-in admin can create, edit, archive, and restore events without touching code.
2. Public pages, city pages, Eventbrite widgets, JSON-LD, `llms.txt`, and `/links` all read the same managed event source after build.
3. Static fallback still produces a valid production build when Firestore is unavailable.
4. Validation prevents malformed dates, non-numeric Eventbrite IDs, invalid URLs, missing city slugs, and duplicate live events for the same city and ISO date.
5. Archived events are hidden from public pages but remain recoverable from the admin dashboard.
6. The implementation passes lint, type-check, unit tests, smoke tests for tickets and city pages, and a production build.

**Open decisions:**

1. Whether event management should use client SDK writes protected by Firestore rules or server-side API routes protected by Firebase ID token verification.
2. Whether venues should stay embedded on each event or become reusable managed venue records.
3. Whether hard delete should exist in the UI or remain a script-only maintenance operation.
4. Whether build-time Firestore failures should fail production builds or warn and use static fallback.
5. Whether an event draft state is needed before a show is ready to publish.

**Implementation steps:**

1. Create a `events` Firestore collection with a schema matching the `EventEntry` interface in `src/data/events.ts` (plus a `createdAt` timestamp and an `archived` flag)
2. Migrate existing `events.ts` entries into Firestore as the seed data (one-time script)
3. Update Firestore security rules to allow admin-authenticated reads and writes on the `events` collection
4. Add a build-time fetch in the Astro data layer that reads from Firestore and replaces the static array (use a Vercel serverless function or the Firestore REST API with a service account)
5. Add an Events tab to `AdminDashboard.tsx` alongside the existing applicants view
6. Build an event list view showing: date, city, venue, price, Eventbrite ID, status (upcoming, sold out, archived)
7. Build a create or edit form with fields for all `EventEntry` fields: date, isoDate, startTime, endTime, city, citySlug, venue fields, url, eventbriteId, price, soldOut, tagline, hidden
8. Add a delete flow: soft delete sets `archived: true` (removes from site), hard delete removes the Firestore document
9. Add client-side validation: isoDate must match the short date month and day, eventbriteId must be numeric, no duplicate city and isoDate combinations

**Files to touch:**

- `src/data/events.ts` (add Firestore fetch, keep static array as fallback)
- `src/components/admin/AdminDashboard.tsx` (add Events tab)
- `src/components/admin/EventForm.tsx` (new, create and edit form)
- `src/components/admin/EventList.tsx` (new, list with edit and delete actions)
- `firestore.rules` (add events collection rules)
- `src/pages/api/events.ts` (new, authenticated CRUD endpoints)

---

## Tracking Enhancements (2026-04-09)

### `event_shared` — Add share buttons with Web Share API

**Priority:** High
**Status:** Needs implementation

No share buttons exist on the site. Recommended approach for 98% mobile audience:

- **Mobile (Web Share API):** Opens native OS share sheet (iMessage, WhatsApp, Instagram DMs). 95%+ support on iOS Safari and Chrome Android.
- **Desktop fallback:** Copy event link to clipboard with toast confirmation.
- **Placement:** Small share icon on each ticket/show card (non-sold-out only).
- **Tracking:** Fire `event_shared` with `{ city, event_date, share_method: "native" | "clipboard" }`.

```typescript
async function shareEvent(event: EventEntry) {
  const shareData = {
    title: `Garam Masala Dating — ${event.city}`,
    text: `Live dating show in ${event.city} on ${event.date}!`,
    url: event.url || "https://garammasaladating.com/tickets",
  };
  if (navigator.share) {
    await navigator.share(shareData);
    trackLeadEvent("event_shared", {
      city: event.city,
      event_date: event.date,
      share_method: "native",
    });
  } else {
    await navigator.clipboard.writeText(shareData.url);
    trackLeadEvent("event_shared", {
      city: event.city,
      event_date: event.date,
      share_method: "clipboard",
    });
  }
}
```

**Files to touch:**

- `src/pages/tickets.astro` — add share button to each live ticket card
- `src/components/home/HomeShows.astro` — add share button to each show card

### Twitter/X pixel: move from GTM-only to direct code

**Priority:** Medium
**Status:** Needs implementation

The Twitter/X pixel currently fires only through GTM (`GTM-KQCBBL2W`). Chrome's Enhanced Tracking Protection blocks `static.ads-twitter.com` client-side regardless of whether the script tag comes from GTM or direct code, but moving it to a dedicated `twitter-pixel.astro` component (same deferred `requestIdleCallback` pattern as `meta-pixel.astro`) gives:

- Reliable PageView on every page load independent of GTM initialization timing
- A `twq('event', 'InitiateCheckout', {...})` call from the shared `wireTicketCtaTracking()` click handler (`src/lib/ticketCtaTracking.ts`), the one place every "Get Tickets" click across the site now fires from
- Source of truth in version control rather than GTM UI

Note: the old `onOrderComplete` callback in `tickets.astro` this entry originally referenced no longer exists (the Eventbrite checkout-modal widget was retired; see the `feat(events)` PR). Purchase-level tracking now needs its own server-side path analogous to `src/lib/capi.ts`, since Twitter/X's Conversions API is a separate integration from Meta's.

**Files to touch:**

- `src/components/twitter-pixel.astro` — new component, same shape as `meta-pixel.astro`
- `src/layouts/BaseLayout.astro` — import and render alongside PostHog/GTM/Meta
- `src/lib/ticketCtaTracking.ts`: add `twq('event', 'InitiateCheckout', { event_id })` alongside the existing `capture("checkout_opened", ...)` call

Requires: Twitter Ads pixel ID (found in Twitter Ads dashboard under Tools > Conversion Tracking).

### Eventbrite order webhook for near-real-time Purchase tracking (2026-07-16)

**Priority:** Low
**Status:** Working via daily cron, webhook would tighten latency

Purchase CAPI events (`src/pages/api/sync-orders.ts`) currently fire from the existing daily order-sync cron (`vercel.json`'s `/api/sync-orders` cron, 13:00 UTC), not a push webhook. This means a real purchase can take up to 24 hours to register as a Meta `Purchase` conversion, which under-reports same-day ad performance in Meta Ads Manager. An [Eventbrite webhook](https://www.eventbrite.com/platform/api#/reference/webhooks) for `order.placed` calling a new `/api/webhooks/eventbrite-order` endpoint (signature-verified, same CAPI Purchase logic as the cron path) would make this near-real-time. Deferred because the daily cron already delivers a correct, just delayed, signal, and this PR's scope was closing the "zero signal" gap, not optimizing latency on the signal that already exists.

### Vercel Deploy Hook for Eventbrite-sourced event page content (2026-07-16)

**Priority:** Low
**Status:** Needs implementation

`/events/[slug]` pages pull their description/summary from the Eventbrite API at build time (`src/lib/eventbriteContent.ts`, called from `getStaticPaths`). Astro's SSG means that content is only as fresh as the last deploy: if someone edits an event's listing on Eventbrite directly, the corresponding `/events/[slug]` page won't reflect it until the next `git push` to `main` triggers a rebuild. A Vercel Deploy Hook, triggered on a schedule (piggyback on an existing cron) or from an Eventbrite webhook, would keep this current without requiring a code change every time. Until this exists, anyone editing an Eventbrite listing's copy should know the site needs a redeploy (even a no-op commit) to pick it up.

### Twitter/X Conversions API (server-side pixel)

**Priority:** High
**Status:** Needs implementation

Client-side Twitter pixel is blocked by Chrome Enhanced Tracking Protection, Brave, uBlock Origin, and any DNS-level blocker (Pi-hole, NextDNS). The only reliable way to capture purchase conversions is server-side via the [Twitter Ads Conversions API](https://developer.twitter.com/en/docs/twitter-ads-api/measurement/api-reference/conversions).

Same concept as Meta's CAPI — send events directly from your server to Twitter's API, bypassing the browser entirely.

**Implementation:**

1. Create a Vercel serverless function at `api/twitter-conversion.ts`
2. On Eventbrite `order.placed` webhook (already planned above), call the Twitter Conversions API with the purchase event
3. Pass `event_id` for deduplication against the client-side pixel so Twitter doesn't double-count

```typescript
// api/twitter-conversion.ts
export async function POST(req: Request) {
  const { eventId, email, value } = await req.json();
  await fetch("https://ads-api.twitter.com/12/measurement/conversions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TWITTER_ADS_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversions: [
        {
          conversion_time: new Date().toISOString(),
          event_id: eventId,
          identifiers: [{ hashed_email: sha256(email.toLowerCase().trim()) }],
          value: { num: value, currency_code: "USD" },
        },
      ],
    }),
  });
}
```

Requires: Twitter Ads API access token, pixel ID, and event type IDs from Twitter Ads dashboard.

---

## Critical (Needs Content Assets)

### Add video section on homepage

- **Why:** Site claims "10M+ Views" but embeds zero videos. A 60-second clip converts more skeptics than 1,000 words of copy.
- **How:** Create `src/components/home/HomeVideo.astro` with YouTube facade pattern (thumbnail + play button, load iframe on click). Position between Experience and Shows sections. Add VideoObject JSON-LD.
- **Needs:** YouTube video URL / show footage clip

## High Impact

### Optimize surbhi.png to AVIF/WebP

- **File:** `public/images/surbhi.png` (595 KB)
- **Why:** Only host photo without modern format. AVIF version would be ~30KB.
- **How:** Run through squoosh.app or `sharp` to generate surbhi.avif and surbhi.webp. Update references in HomeCreators.astro and hosts.astro.

## Medium Impact

### Finish full audit photo rollout

- **Why:** The initial rewrite landed only part of the visual refresh. Key placements are still missing: Experience section proof image, testimonial accent image, upgraded creator portraits, and journal cupid art. (Hero background photo dropped: owner directive, the hero stays as designed.)
- **How:** Superseded by the homepage visual redesign (owner decision 2026-07-05). Decide placements fresh inside the redesign; do not port these April specs blindly. Sizing note if portraits come back: `hosts/wyatt.avif` source is 269x290, which caps avatars at about 160px before visible upscaling.

### Magic-byte validation for photo uploads

- **Why:** `storage.rules` validates contentType and size and the client checks MIME type, but contentType is client-declared. A hostile client can label any payload as image/jpeg. True content inspection needs to read the file bytes server-side.
- **How:** Cloud Function on `storage.object.finalize` that sniffs magic bytes and deletes non-image objects. Needs the firebase-functions toolchain, which the repo does not have yet; bundle this with the first real Cloud Functions work rather than standing up the toolchain for one check. Residual from the 2026-04-04 file-type bug in BUGS.md.

### Add a tickets-page hero image strip or banner

- **Why:** The tickets page is functional but visually flat compared with the homepage. The audit proposed a compact stage-photo banner to reinforce that the events are real and lively.
- **How:** Add a small hero image at the top of `src/pages/tickets.astro` with a dark overlay and keep the copy legible.

### Add city-specific hero imagery strategy

- **Why:** City pages currently rotate through generic show and AI images. The audit proposed using real venue/show photos for active cities and clearer placeholders for speculative markets.
- **How:** Create a per-city image mapping for active cities and reserve AI art only for placeholder markets where no real show asset exists yet.

### Strengthen popup offer copy once the actual incentive is finalized

- **Why:** The conversion audit recommended moving from generic "cheaper tickets" copy to a specific discount/value proposition.
- **How:** Finalize the real offer or code, then update popup copy and CTA text to match that promise consistently across popup and confirmation flows.

### ~~llms.txt + llms-full.txt (dynamic, build-time)~~ ✅ Done (2026-04-09)

The highest-leverage AEO item. Implemented as Astro endpoints that generate both files at build time from `src/data/` files. See `src/pages/llms.txt.ts` and `src/pages/llms-full.txt.ts`.

`llms.txt` is the emerging standard for telling AI systems (ChatGPT, Perplexity, Claude, Gemini, voice assistants) what your site is about — a curated index updated on every deploy. `llms-full.txt` is a comprehensive content dump: full FAQ answers, host bios, show description, all tips posts in full body text, 12 most-recent journal articles, active city pages with body copy. When an AI system ingests `llms-full.txt`, it has everything needed to accurately answer "what is Garam Masala Dating?" without crawling any other page.

**Why this matters for entity recognition:** Without `llms.txt`, AI systems must crawl the site, parse it correctly, and infer entity status — a process that takes 1–2 months. With `llms.txt`, you explicitly define the entity, making confident accurate answers possible within days of indexing. This is especially critical for GMD because "garam masala" is a globally recognized spice blend — AI systems need an explicit signal that "Garam Masala Dating" is a live comedy show, not a recipe brand.

**Robots.txt** updated to explicitly allow all major AI crawlers (GPTBot, ClaudeBot, OAI-SearchBot, Applebot-Extended, CCBot, Meta-ExternalAgent, cohere-ai, PerplexityBot). Bytespider (low-quality scraper) blocked.

**Remaining gap:** The `llms.txt` signal is only as strong as the external corroboration. Without Wikidata and IMDb, AI systems have no third-party authoritative source to anchor the entity. Complete those two items below to close the loop.

### IMDb listing for the show

- **Why:** Triggers Google Knowledge Panel recognition. Establishes GMD as a distinct entertainment entity. Wikipedia/Wikidata/IMDb are in every major AI system's training corpus — this is where entity recognition gets locked in.
- **How:** Create IMDb listing with: show name, seasons, episodes, Surbhi and Wyatt as hosts.
- **AEO impact:** Directly disambiguates "Garam Masala Dating" from "garam masala" (spice blend) in AI training data. High leverage.

### Wikidata entry

- **Why:** The single most important remaining AEO item. Wikidata is the structured knowledge base that feeds Google's Knowledge Graph, Wikipedia, and most LLM training corpora. A Wikidata entry for GMD creates a machine-readable entity record that AI systems can anchor to with high confidence.
- **How:** Create Wikidata entry for "Garam Masala Dating" as a live comedy dating show. Required fields: instance of (live performance/dating show), country (USA), founded (2022), host (Surbhi, Wyatt Feegrado), website (garammasaladating.com), venue (Top Secret Comedy Club).
- **AEO impact:** Until this exists, AI systems have no external authoritative source. `llms.txt` tells them what you are; Wikidata confirms it.

### Google Business Profile

- **Why:** Enables local search visibility, reviews, and Knowledge Panel.
- **How:** Set up and verify at business.google.com.

### LinkedIn Company Page

- **Why:** Cross-links improve entity recognition.
- **How:** Create page at linkedin.com/company, link to garammasaladating.com.

### Add redirect rules for old URLs

- **File:** `vercel.json`
- **Why:** If any URLs changed during the Astro migration, old links will 404.
- **How:** Audit old sitemap vs new sitemap, add redirects for any changed paths.

## Low Impact

### Cross-browser testing checklist

- Test in: Chrome, Safari (iOS/macOS), Firefox, Samsung Internet, Instagram in-app browser
- Instagram in-app browser is highest priority — most traffic comes from IG bio link
- Check: backdrop-filter, sticky positioning, smooth scrolling, font rendering

### AggregateRating schema on testimonials

- **Why:** Could trigger rich result stars in search.
- **How:** Add AggregateRating JSON-LD to the testimonials section if enough data points exist.

### Astro Content Collections for blog/journal

- **Why:** Blog data is currently in `src/data/journal.ts` as inline objects. Content Collections (`src/content/`) would give type-safe frontmatter, auto slug generation, and better build perf.
- **How:** Create `src/content/journal/` with .md files, define collection schema, update `[slug].astro` to use `getCollection()`.

### Astro Image component for auto-optimization

- **Why:** `astro:assets` `<Image>` auto-generates responsive sizes, converts to WebP/AVIF, adds width/height. Eliminates manual image optimization.
- **How:** Replace `<img>` tags in Astro components with `<Image>` imports. React islands would still use `<img>`.

### Shared UI components + field config data file (apply form)

- **Why:** Apply form fields (labels, placeholders, option lists) are hardcoded in JSX. A `src/data/applyForm.ts` config + shared input primitives in `components/ui/` would follow the workspace pattern of separating content from markup.
- **How:** Extract field metadata (labels, placeholders, options for gender/orientation/community/income) to `src/data/applyForm.ts`. Create `components/ui/Input.tsx`, `components/ui/Select.tsx`, `components/ui/RadioGroup.tsx` used by the apply form and any future forms. Low urgency — current split into `apply/` modules is already a significant improvement.

### Shared UI components (Button, Section wrapper)

- **Why:** Buttons and section wrappers are duplicated across pages with scoped styles. A shared component would reduce drift.
- **How:** Create `src/components/ui/Button.astro` with primary/outline/white variants. Low urgency — current duplication is manageable since each page has scoped styles.

### Prettier configuration

- **Why:** ESLint handles lint rules but not opinionated formatting (trailing commas, quote style, line width). Prettier would enforce consistency.
- **How:** `npm i -D prettier`, add `.prettierrc`, add to lint-staged. Optional — ESLint `--fix` already handles most formatting.

### Unify FAQ content between home page and /faq

- **Why:** HomeFAQ (from `copy.ts`) and /faq page have overlapping questions with different answer wording.
- **How:** Share a data source or intentionally differentiate (short on home, detailed on /faq).

# From PR #11 — Site Rewrite

## Add loading="lazy" to admin photo images

- **File:** `src/components/admin/ApplicantModal.tsx:97`
- **Source:** CodeRabbit PR #11
- **Comment:** Both `<img>` elements (lines 97 and 111) for user-uploaded photos are missing `loading="lazy"`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3046995940

## Move HomeShows copy into src/data/

- **File:** `src/components/home/HomeShows.astro:26`
- **Source:** CodeRabbit PR #11
- **Comment:** Section heading, CTA labels, fallback strings, modal copy, placeholders, and aria labels are all hardcoded — should be sourced from a data module.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304629

## Split request-city flow out of HomeShows

- **File:** `src/components/home/HomeShows.astro:209`
- **Source:** CodeRabbit PR #11
- **Comment:** HomeShows.astro exceeds 150-line cap — the request-city dialog/script/styles are a clean extraction point.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304637

## Add aria-hidden to HomeShows close icon SVG

- **File:** `src/components/home/HomeShows.astro:72`
- **Source:** CodeRabbit PR #11
- **Comment:** Close button already has `aria-label="Close"`, so the SVG should be `aria-hidden="true"` (decorative only).
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304649

## Replace hardcoded colors with CSS tokens in HomeShows

- **File:** `src/components/home/HomeShows.astro:231`
- **Source:** CodeRabbit PR #11
- **Comment:** Component CSS uses `white` and `rgba(...)` literals instead of shared design tokens from `:root`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304673

## Increase HomeShows modal close button hit area

- **File:** `src/components/home/HomeShows.astro:405`
- **Source:** CodeRabbit PR #11
- **Comment:** 20x20 icon with 4px padding yields ~28x28 effective target — below the 48x48 minimum for touch.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304678

## Add :focus-visible to HomeShows modal inputs

- **File:** `src/components/home/HomeShows.astro:431`
- **Source:** CodeRabbit PR #11
- **Comment:** `outline: none` removes browser focus indicator with only a subtle border-color change on `:focus` — needs explicit `:focus-visible` treatment.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304684

## Replace hardcoded white in HomeVideo

- **File:** `src/components/home/HomeVideo.astro:84`
- **Source:** CodeRabbit PR #11
- **Comment:** `background: white` should use `var(--off-white)` or another CSS custom property.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3047304694

## Move ApplyPage form copy into src/data/

- **File:** `src/components/ApplyPage.tsx:78`
- **Source:** CodeRabbit PR #11
- **Comment:** Titles, labels, placeholders, option text, helper copy, consent copy, and CTA strings are hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341272

## FieldGroup/react-select accessibility wiring

- **File:** `src/components/ApplyPage.tsx:256`
- **Source:** CodeRabbit PR #11
- **Comment:** FieldGroup and react-select controls need proper accessibility attribute wiring.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341275

## Add aria-invalid/aria-describedby to remaining apply form fields

- **File:** `src/components/ApplyPage.tsx:275`
- **Source:** CodeRabbit PR #11
- **Comment:** Height, Community, and Income fields pass `error` to FieldGroup but never set `aria-invalid`/`aria-describedby` like the earlier inputs do.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341283

## Move HomeHero hardcoded text into src/data/

- **File:** `src/components/home/HomeHero.astro:37`
- **Source:** CodeRabbit PR #11
- **Comment:** Hero eyebrow, headline, subtext, and CTA labels are all hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341285

## Use nyOffset utility for timezone-aware event end times

- **File:** `src/components/home/HomeHero.astro:85`
- **Source:** CodeRabbit PR #11
- **Comment:** `getEventEnd` parses dates as local time, but events are in Eastern Time — for users outside ET the pill may hide at the wrong time.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341289

## Fix font-size below 16px on interactive elements (iOS auto-zoom)

- **File:** `src/components/home/HomeHero.astro:224`
- **Source:** CodeRabbit PR #11
- **Comment:** `.next-show-pill` is 13px (12px at narrow), `.btn` drops to 14px at <=390px — all below the 16px minimum for interactive elements to avoid iOS auto-zoom.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341294

## Split HomeVideo component (>150 lines)

- **File:** `src/components/home/HomeVideo.astro:184`
- **Source:** CodeRabbit PR #11
- **Comment:** File is 184 lines — extract reels block and client script into smaller components/modules.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341297

## Move HomeVideo user-facing copy into src/data/

- **File:** `src/components/home/HomeVideo.astro:10`
- **Source:** CodeRabbit PR #11
- **Comment:** "Watch" text, heading, aria-label, alt text, and "Watch on Instagram" are hardcoded in the component.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3048341298

## Add aria-describedby to request-city form fields

- **File:** `src/components/home/HomeShows.astro:83`
- **Source:** CodeRabbit PR #11
- **Comment:** Neither city input references `#city-form-error` via `aria-describedby` — validation message is disconnected from the field.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901235

## Guard city autocomplete against API failure + disable submit during write

- **File:** `src/components/home/HomeShows.astro:170`
- **Source:** CodeRabbit PR #11
- **Comment:** If `/api/city-search` 500s or user is offline, submit rejects before the manual fallback, and the still-enabled button can create duplicate leads docs on repeat clicks.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901240

## Add aria-describedby on newsletter signup fields

- **File:** `src/components/home/HomeSignup.astro:14`
- **Source:** CodeRabbit PR #11
- **Comment:** Error alerts are rendered but neither `#nl-email` nor `#nl-phone` points back to them via `aria-describedby`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901261

## Move NotifyModal copy into src/data/ + split component

- **File:** `src/components/NotifyModal.astro:184`
- **Source:** CodeRabbit PR #11
- **Comment:** Labels, placeholders, and error strings are inline. Component carries copy, Firestore/analytics behavior, and styles — should be split.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901270

## Finish NotifyModal inline error accessibility wiring

- **File:** `src/components/NotifyModal.astro:11`
- **Source:** CodeRabbit PR #11
- **Comment:** Close button SVG needs `aria-hidden`, inputs need `aria-describedby` for error text, error elements should use `role="alert"`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901276

## Reset NotifyModal state on reopen

- **File:** `src/components/NotifyModal.astro:76`
- **Source:** CodeRabbit PR #11
- **Comment:** Only `#notify-error` and visibility flags are reset — email, phone, and phone-error keep previous state, so reopening shows stale input.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/11#discussion_r3051901287

---

# Codebase Audit — 2026-04-09

Items flagged during the deep-dive codebase audit. Organized by impact.

## High Impact

### Split large components (5 files exceed 150-line rule)

| Component                | Lines | Path                                      |
| ------------------------ | ----- | ----------------------------------------- |
| `ApplyPage.tsx`          | 569   | `src/components/ApplyPage.tsx`            |
| `AdminDashboard.tsx`     | 401   | `src/components/admin/AdminDashboard.tsx` |
| `useApplyForm.ts`        | 367   | `src/components/apply/useApplyForm.ts`    |
| `TermsModal.tsx`         | 356   | `src/components/apply/TermsModal.tsx`     |
| `ContestantPrepPage.tsx` | 301   | `src/components/ContestantPrepPage.tsx`   |

Start with `useApplyForm.ts` — it mixes form state, file upload, Firebase operations, and analytics. Extract into `usePhotoUpload`, `useFormValidation`, `useApplicationSubmit`.

### ~~Add centralized error tracking~~ ✅ Done (2026-04-09)

PostHog error tracking implemented: `client_error` event with `error_type` discriminator. Covers `uncaught` (window.onerror), `unhandled_rejection`, `react_boundary` (ErrorBoundary), `form_submission` (useApplyForm), and `api_error` (useCitySearch). Queue buffers errors before PostHog loads.

### Add ESLint security plugin

- `eslint.config.js` only has `reactHooks` and `reactRefresh` plugins
- Missing `eslint-plugin-security` to catch `eval()`, `dangerouslySetInnerHTML`, insecure randomness
- Install: `npm i -D eslint-plugin-security`

## Medium Impact

### Refactor non-mobile-first media queries

- `src/components/home/HomeHero.astro` — uses `max-width` queries at 430px, 390px, 340px, 1024px
- `src/components/admin/AdminDashboard.module.css` — uses `max-width` at 900px, 600px
- Should be `min-width` (mobile-first) per CLAUDE.md rules

### Reduce `!important` usage

- `src/components/home/HomeVideo.astro:170-174` — 5 instances (may be needed to override Instagram embed styles)
- `src/pages/404.astro` — 15+ instances
- `src/layouts/BaseLayout.astro:295` — cursor styles
- Audit each; eliminate where CSS specificity can solve the problem instead

### Migrate remaining hardcoded colors to CSS variables

Beyond the PR #11 items already logged:

- `src/pages/index.astro` — uses `#fff`, `#888`, `#999`, `rgba(0,0,0,...)`
- `src/components/ErrorBoundary.module.css:25` — uses `#666`
- `src/components/ApplyPage.module.css:177` — uses `#fff`

### Add Stryker mutation testing coverage for API routes

- `stryker.config.mjs` only mutates `src/**/*.ts` but API route tests have minimal edge case coverage
- No adversarial tests (XSS payloads in form fields, malformed JSON, header spoofing)
- Add API routes to mutation testing scope

## Low Impact

### Add preconnect for external domains

Add to `BaseLayout.astro` `<head>`:

```html
<link rel="preconnect" href="https://www.youtube.com" />
<link rel="preconnect" href="https://www.instagram.com" />
<link rel="preconnect" href="https://www.eventbrite.com" />
```

### Fix low contrast text (WCAG)

- `src/components/home/HomeFooter.astro:180` — `rgba(255,255,255,0.7)` on dark bg
- `src/components/home/HomeShows.astro` — `rgba(255,255,255,0.55)` on dark bg
- Run contrast checker; adjust where WCAG AA (4.5:1) requires it

---

# Codebase Audit — Review Later

Items flagged during the 2026-04-08 cleanup audit. Not confirmed dead — may have been created for a reason. Check each one and either wire it in or delete it.

## Review: src/utils/instagram.ts

- **What:** Exports `cleanInstagramHandle()` and `instagramUrl()` — utility for stripping `@` prefix and building Instagram profile URLs
- **Current state:** Zero imports. Admin components (`ApplicantCard.tsx`, `ApplicantModal.tsx`) inline `https://instagram.com/${handle}` directly instead of using this utility.
- **Action:** Either import and use these in the admin components, or delete the file.

## Review: scripts/optimize-images.js

- **What:** Image optimization script using sharp (resize, compress, convert to WebP)
- **Current state:** Repaired 2026-07-05: real source paths, idempotent, registered as `npm run images:optimize`, shares sharp helpers with organize-images via `scripts/lib/image-utils.js`.
- **Action:** Done. Kept as the named-image and OG-crop pipeline.

## Review: organize-images HF output directory drift

- **What:** `scripts/organize-images.js` writes the HF pool to `public/images/hf/`, but the committed hf files the site serves live under `public/images/ai-art/` (hf-01.webp and up).
- **Current state:** Running `npm run images:organize` regenerates 26 duplicate webp files into the untracked `public/images/hf/` directory. Found 2026-07-05 while verifying the script repair; the stray output was removed.
- **Action:** Point `HF_OUT` at the directory the site actually serves, or move the committed hf assets. Decide which location is canonical first.

## Review: scripts/migrate-locations.ts

- **What:** One-time Firestore migration — backfills legacy freetext city records with structured country/state/city fields
- **Current state:** Referenced in package.json as `npm run migrate:locations`. Unknown if it's been run.
- **Action:** Run `npm run migrate:locations` (dry run first, then `-- --execute`). Once done, delete the script and remove the npm script entry.

---

# From PR #13 — Site Rewrite

## Test: loading state assertion missing

- **File:** src/components/ContestantPrepPage.test.tsx:111
- **Source:** CodeRabbit PR #13
- **Comment:** Test named "shows loading state" never actually asserts the loading/checking UI — it only checks the final authed view. Either assert the loading state before `waitFor`, or rename the test.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004046

## Test: "renders all 13 prep questions" only verifies 3

- **File:** src/components/ContestantPrepPage.test.tsx:447
- **Source:** CodeRabbit PR #13
- **Comment:** Test claims to verify all 13 prep questions but only checks 3. Would still pass if 10 questions disappeared. Enumerate the full list or rename to indicate it's a smoke test.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004051

## Move gallery copy to src/data/

- **File:** src/components/home/HomePhotos.astro:59
- **Source:** CodeRabbit PR #13
- **Comment:** Photo `label`, `alt`, heading, and subheading are user-facing copy hardcoded in the component. Should live in `src/data/` per content architecture rules.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004057

## Remove inline style prop from HomePhotos img

- **File:** src/components/home/HomePhotos.astro:79
- **Source:** CodeRabbit PR #13
- **Comment:** Line 78 uses an inline `style={...}` prop on an Astro `<img>` element, which is disallowed by project rules. Should use a CSS class for `object-position`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004063

## Replace hardcoded colors in LegalModal with design tokens

- **File:** src/components/LegalModal.astro:124
- **Source:** CodeRabbit PR #13
- **Comment:** Lines 124, 137, and 138 use literal colors (`rgba(...)`, `white`) instead of CSS custom properties from `:root`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004071

## Ensure legal-content links meet 16px minimum

- **File:** src/components/LegalModal.astro:199
- **Source:** CodeRabbit PR #13
- **Comment:** Links inside legal paragraphs/lists inherit 15px body text size. Set explicit 16px minimum on `.legal-body :global(a)` for iOS zoom prevention.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004076

## Test: SITE env var not actually verified

- **File:** src/lib/generateContestantLink.test.ts:107
- **Source:** CodeRabbit PR #13
- **Comment:** Test says "url uses origin from SITE env var" but never sets `import.meta.env.SITE`. Only asserts `https://` prefix which can pass via fallback origin.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056004082

## Harden navigator.modelContext guard

- **File:** src/components/ApplyPage.tsx:33
- **Source:** CodeRabbit PR #13
- **Comment:** Current check only verifies `modelContext` exists as a property. If `modelContext` is an object without `registerTool`, line 33 will throw. Add a `typeof registerTool === "function"` check.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056485573

## searchCities() can throw before try block

- **File:** src/components/home/HomeShows.astro:296
- **Source:** CodeRabbit PR #13
- **Comment:** `searchCities()` is called at line 287, before the `try` block starts at line 296. If the fetch fails, the promise rejects unhandled and the modal error UI never shows.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/13#discussion_r3056485597

# From CLS Audit & Performance (formerly ENHANCEMENT.md)

## Prefetch/preload key pages + skeleton loaders to eliminate CLS

**Priority:** High
**Logged:** 2026-04-07

### Problem

The Apply and Get Tickets pages take noticeable time to load on first navigation. There is no skeleton or placeholder UI, so the page jumps from blank → content (CLS). These are the two highest-traffic destinations from the homepage nav.

### What to do

**1. Prefetch Apply and Tickets on homepage load**

Add `<link rel="prefetch">` tags in `BaseLayout.astro` (or the homepage `index.astro`) so the browser fetches those pages in the background while the user is on the homepage:

```html
<link rel="prefetch" href="/apply" /> <link rel="prefetch" href="/tickets" />
```

For Astro pages, `prefetch` is enough — no JS chunk prefetching needed since both pages are SSG.

Alternatively, use Astro's built-in prefetch:

- Enable `prefetch: true` in `astro.config.mjs`
- Add `data-astro-prefetch` to the nav links in `HomeNav.astro` and `PageNav.astro`

**2. Skeleton loaders on Apply page**

The Apply page hydrates a React island (`ApplyPage.tsx`) — there's a gap between HTML arriving and the form being interactive. Add a CSS skeleton that matches the form layout:

- Show the skeleton in the static Astro shell (`apply.astro`) until React hydrates
- Use `client:visible` or `client:idle` directive instead of `client:load` to defer hydration if above-the-fold content doesn't need it immediately
- Skeleton should reserve the exact height of the form to prevent CLS

**3. Skeleton on Tickets page**

Similar to Apply — if any dynamic content loads after HTML, add a skeleton placeholder that reserves layout space.

### Files to touch

- `src/layouts/BaseLayout.astro` — add prefetch link tags
- `src/components/home/HomeNav.astro` and `src/components/layout/PageNav.astro` — add `data-astro-prefetch` to Apply and Tickets links
- `src/pages/apply.astro` — add skeleton shell / adjust client directive
- `src/pages/tickets.astro` — add skeleton shell if needed
- `astro.config.mjs` — enable prefetch integration

### Notes

- Do NOT add `rel="preload"` (that's for critical resources on the current page). Use `rel="prefetch"` (background, lower priority).
- Test that prefetch doesn't increase LCP on the homepage (it should be fine since prefetch is low-priority).
- The goal is zero visible layout shift when navigating to Apply or Tickets from any page.

---

## Full-site CLS audit

**Priority:** Medium
**Logged:** 2026-04-07

Audit of all Cumulative Layout Shift sources across the site. 13 instances identified.

### HIGH — Fix these first (user-visible, happens in primary flows)

| #   | Location                                             | Trigger                                                                                                  | Fix                                                                                                                                       |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/pages/apply.astro` + `ApplyPage.tsx`            | React island hydrates after static HTML → form renders below a blank stub                                | Add height-reserving CSS skeleton in `apply.astro` Astro shell; switch to `client:visible`                                                |
| 2   | `src/components/admin/ApplicantModal.tsx`            | Error message inserted above form fields when validation fires → shifts fields down                      | Reserve space with `min-height` on the error container; always render it (empty), toggle visibility only                                  |
| 3   | `src/pages/apply.astro` (photo upload)               | Photo thumbnail appears after upload → section height changes                                            | Pre-reserve thumbnail slot with a fixed-size placeholder div before upload completes                                                      |
| 4   | `src/pages/apply.astro` (nomination section)         | Nomination fields revealed via `data-reveal` / `hidden` toggle → content below shifts                    | Use `max-height` / `overflow: hidden` transition instead of `hidden` attribute; reserve max possible height                               |
| 5   | `src/hooks/useGeoData.ts` → apply form geo dropdowns | State dropdown populates after country selected → city dropdown appears after state → double CLS cascade | Render all three dropdowns always (empty/disabled state); never insert new DOM nodes on selection                                         |
| 6   | Apply page terms modal                               | `document.body` scroll-lock (`overflow: hidden`) removes scrollbar → body shifts right                   | Add `padding-right: var(--scrollbar-width)` to body when locking; measure with `window.innerWidth - document.documentElement.clientWidth` |
| 7   | Any `<dialog>` open (NotifyModal, RequestCity, etc.) | Same scroll-lock issue as above                                                                          | Same fix — apply scrollbar-width compensation on `dialog.showModal()`                                                                     |

### MEDIUM — Address in next polish pass

| #   | Location                                  | Trigger                                                             | Fix                                                                                      |
| --- | ----------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 8   | `src/components/admin/AdminDashboard.tsx` | "Deleted" toggle reveals replacement text → row height changes      | Reserve row height; use `opacity`/`pointer-events` toggle instead of content replacement |
| 9   | `src/components/admin/AdminDashboard.tsx` | Loading spinner replaced by content on fetch complete → height jump | Render skeleton rows with fixed heights matching content rows                            |
| 10  | `src/pages/contestant-prep.astro`         | Gender-reveal section animates in via JS → pushes content below     | Pre-reserve section height; use transform/opacity animation only (no height change)      |
| 11  | Any admin modal                           | Same scroll-lock body-shift as item 6                               | Same scrollbar-width fix                                                                 |

### LOW — Nice to have

| #   | Location                                                       | Trigger                                                                                         | Fix                                                                                                                                 |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 12  | `src/layouts/BaseLayout.astro` skip-link                       | Skip-link rendered `position: absolute` shifts to `fixed` on focus → minor repaint              | Use `position: fixed` always with negative `top` offset; transition `top` on focus                                                  |
| 13  | `src/components/home/HomeShows.astro` + `HomeStats.astro` etc. | `data-reveal` adds `.revealed` class via IntersectionObserver → opacity + translateY transition | Already progressive-enhancement but translateY can cause subpixel repaints; switch to `will-change: transform` on observed elements |

### Already fixed in this branch

- Email form step transitions (HomeSignup, popup, NotifyModal, city notify) — wrapped in `min-height` containers (220–260px) so step 1→2 swap never shifts content below.

---

## International phone input with country selector

**Priority:** Low (Later Later)
**Logged:** 2026-04-08

Right now we accept any phone number and auto-format US numbers to E.164 (`+1XXXXXXXXXX`). International numbers are stored as-is with basic digit cleanup. This works fine at current scale.

When we start actually texting international numbers (via Twilio/MessageBird/etc.), add a proper country-code dropdown + phone input that validates per-country format. Packages like `react-phone-number-input` or `intl-tel-input` handle this well.

**Why not now:**

- We don't have an international texting service yet
- No confirmed international show dates
- The npm package adds bundle weight to every page with a phone field
- Current approach (accept anything, clean up later) is good enough for lead capture

---

# From PR #12 — Site Rewrite

## aria-describedby + role="alert" missing on form inputs (LeadCaptureModal)

- **File:** `src/components/LeadCaptureModal.astro`
- **Source:** CodeRabbit PR #12
- **Comment:** Inputs don't reference their error elements via `aria-describedby`, and error nodes lack `role="alert"`. Screen-reader users won't reliably get field-level validation feedback.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383973

## SpiceListSection copy should be in src/data

- **File:** `src/components/SpiceListSection.astro`
- **Source:** CodeRabbit PR #12
- **Comment:** Section label, CTA text, and modal copy are hardcoded in JSX. Since this component renders site-wide, copy should live in `src/data/copy.ts` to avoid drift.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383984

## Modal without title has no accessible name

- **File:** `src/components/ui/Modal.astro:34`
- **Source:** CodeRabbit PR #12
- **Comment:** When `title` is omitted, the dialog renders without `aria-labelledby` or `aria-label`, making it unlabeled for assistive tech. A fallback accessible label prop should be enforced.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383986

## aria-label="Close" hardcoded in Modal.astro

- **File:** `src/components/ui/Modal.astro:36`
- **Source:** CodeRabbit PR #12
- **Comment:** The close button aria-label is user-facing copy hardcoded in the component. Should be sourced from `src/data/copy.ts` per project content guidelines.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054383993

## Journal CTA font sizes below 16px and missing touch targets

- **File:** `src/pages/journal/[slug].astro`
- **Source:** CodeRabbit PR #12
- **Comment:** CTA styles at line 470 set 15px inherited by CTA links (line 475), below the 16px minimum for interactive elements. Inline text links also unlikely to meet 48x48 touch-target requirement.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384016

## Inline style={} in journal slug.astro

- **File:** `src/pages/journal/[slug].astro`
- **Source:** CodeRabbit PR #12
- **Comment:** Lines 140 and 153 use inline `style={...}` in an Astro file. Should be moved to named CSS classes in the `<style>` block.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384021

## CTA animation via inline style in links.astro

- **File:** `src/pages/links.astro`
- **Source:** CodeRabbit PR #12
- **Comment:** Animation variant/delay is applied via inline `style={...}` prop. Should use a CSS class or data attribute in the scoped stylesheet instead.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384025

## Hardcoded colors and spacing in reactSelectStyles.ts

- **File:** `src/utils/reactSelectStyles.ts:123`
- **Source:** CodeRabbit PR #12
- **Comment:** Style maps include hardcoded literals (`#fff`, `rgba(...)`, `12px`, `100px`). Replace with CSS custom properties from `:root` to align with the design token system.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3054384030

## `modalIn` keyframe name trips Stylelint in ApplicantModal.module.css

- **File:** `src/components/admin/ApplicantModal.module.css:20`
- **Source:** CodeRabbit PR #12
- **Comment:** `modalIn` should be renamed to kebab-case (e.g., `modal-in`) to pass the repo's `keyframes-name-pattern` Stylelint rule.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086433

## Focus ring hardcodes #fff in ApplicantModal.module.css

- **File:** `src/components/admin/ApplicantModal.module.css:91`
- **Source:** CodeRabbit PR #12
- **Comment:** The focus ring uses hardcoded `#fff` instead of `var(--off-white)` or a dedicated modal focus token.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086442

## Raw colors instead of tokens in TermsModal.module.css

- **File:** `src/components/apply/TermsModal.module.css:16`
- **Source:** CodeRabbit PR #12
- **Comment:** `white` and several `rgba(...)` values are hardcoded. Most can use existing root tokens (`--off-white`, `--border`, `--hover-subtle`) or a small addition to `modal-tokens.css`.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086447

## `modalIn` keyframe name trips Stylelint in TermsModal.module.css

- **File:** `src/components/apply/TermsModal.module.css:27`
- **Source:** CodeRabbit PR #12
- **Comment:** Same as ApplicantModal — rename `modalIn` to kebab-case to satisfy the `keyframes-name-pattern` Stylelint rule.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086453

## Button font sizes at 15px in TermsModal.module.css

- **File:** `src/components/apply/TermsModal.module.css:133`
- **Source:** CodeRabbit PR #12
- **Comment:** `.agreeBtn` and `.dismissBtn` are styled at `15px`, below the repo's 16px minimum for interactive elements (iOS auto-zoom prevention).
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086458

## TermsModal.tsx agreement copy should be in src/data

- **File:** `src/components/apply/TermsModal.tsx:292`
- **Source:** CodeRabbit PR #12
- **Comment:** Full agreement text, section titles, and button copy are hardcoded in JSX, pushing the file past the 150-line limit. Should be a structured `src/data` export to keep TermsModal as a small renderer.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086463

## ApplyPage subtitle hardcoded

- **File:** `src/components/ApplyPage.tsx:41`
- **Source:** CodeRabbit PR #12
- **Comment:** The "#1" marketing subtitle is hardcoded in the component. Should live in `src/data/copy.ts` to have a single source of truth.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086466

## LeadCaptureModal fallback copy hardcoded

- **File:** `src/components/LeadCaptureModal.astro:47`
- **Source:** CodeRabbit PR #12
- **Comment:** Default heading, subheading, and other user-facing fallback copy are inline in the component. Should be imported from `src/data/` to maintain the content/data boundary.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086467

## Unqualified "#1" claims in city data files

- **File:** `src/data/cities/international-other.ts:11`, `src/data/cities/southeast-asia.ts:9`
- **Source:** CodeRabbit PR #12
- **Comment:** Unqualified "#1" assertions without a verifiable qualifier/source can create advertising/legal risk. Consider adding a qualifier like "NYC's #1 live comedy dating show" or linking to a citation.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086468

## HomeSignup in BaseLayout should be opt-in per page

- **File:** `src/layouts/BaseLayout.astro:101`
- **Source:** CodeRabbit PR #12
- **Comment:** `HomeSignup` renders on nearly every page unless explicitly opted out, adding extra JS to static content pages. Consider moving to per-page composition rather than opt-out.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086474

## "See live" links below 16px and missing touch targets on hosts.astro

- **File:** `src/pages/hosts.astro:112`
- **Source:** CodeRabbit PR #12
- **Comment:** New "See ... live" CTAs render at `15px` without a reliable 48x48 hit area. Should use `inline-flex` with `var(--touch-target)` sizing and 16px text.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086477

## City-request button text below 16px on tickets.astro

- **File:** `src/pages/tickets.astro:530`
- **Source:** CodeRabbit PR #12
- **Comment:** The "Tell Us Where You Are" button is styled at `15px`, below the minimum for interactive elements. Bump to 16px.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3061086483

## HomeStats section heading hardcoded

- **File:** `src/components/home/HomeStats.astro:16`
- **Source:** CodeRabbit PR #12
- **Comment:** "The Numbers Don't Lie" heading is hardcoded. Should be moved to `src/data/copy.ts` per project content guidelines.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3063506915

## Logo nav link tap target below 48px

- **File:** `src/components/layout/PageNav.astro:9`
- **Source:** CodeRabbit PR #12
- **Comment:** The logo link's effective mobile hit area is ~28px tall, below the 48px minimum touch-target requirement.
- **Link:** https://github.com/hellosurbhi/garam-website/pull/12#discussion_r3063506921

---

# From CodeRabbit batch 2 (2026-04-10)

## link-check.yml: add workflow_dispatch trigger

- **File:** `.github/workflows/link-check.yml:3-6`
- **Source:** CodeRabbit batch 2
- **Comment:** The workflow only runs on a schedule. Adding `workflow_dispatch` allows on-demand runs after content changes without waiting for Monday.
- **Link:** n/a

## Modal.astro: background: white → var(--off-white)

- **File:** `src/components/ui/Modal.astro:68-96`
- **Source:** CodeRabbit batch 2
- **Comment:** `.base-modal-inner` uses `background: white` instead of `var(--off-white)`. Should follow the design token system.
- **Link:** n/a

## HomeStats.astro: color: white → token

- **File:** `src/components/home/HomeStats.astro:131`
- **Source:** CodeRabbit batch 2
- **Comment:** Two occurrences of `color: white` in `.stats h2` and `.stat-label` should use `var(--off-white)` or a dedicated token.
- **Link:** n/a

## analytics.test.ts: add dataLayer push coverage

- **File:** `src/lib/analytics.test.ts:97-180`
- **Source:** CodeRabbit batch 2
- **Comment:** Tests for `identifyLead` do not cover the `window.dataLayer.push` call. Add tests mocking `window.dataLayer` and asserting correct push behavior including empty/whitespace inputs.
- **Link:** n/a

## southeast-asia.ts: "desi" → "South Asian" for consistency

- **File:** `src/data/cities/southeast-asia.ts`
- **Source:** CodeRabbit batch 2
- **Comment:** The word "desi" (lowercase) appears in many user-facing strings across the city descriptions. "South Asian" is the canonical term used elsewhere in the codebase. Update all occurrences for consistency and SEO.
- **Link:** n/a

## robots.txt: consolidate redundant Anthropic user-agent entries

- **File:** `public/robots.txt:20-27`
- **Source:** CodeRabbit batch 2
- **Comment:** Three Anthropic crawler entries (ClaudeBot, Claude-SearchBot, anthropic-ai) may be redundant. Review Anthropic documentation and consolidate if they are the same crawler.
- **Link:** n/a

## HomeCreators.astro: extract hosts array to src/data/

- **File:** `src/components/home/HomeCreators.astro:2-17`
- **Source:** CodeRabbit batch 2
- **Comment:** The `hosts` array is hardcoded in the component. Should be extracted to a dedicated data module and imported, per the content architecture guidelines.
- **Link:** n/a

## HomePhotos.astro: extract photos array to src/data/

- **File:** `src/components/home/HomePhotos.astro:2-17`
- **Source:** CodeRabbit batch 2
- **Comment:** The `photos` constant is hardcoded in the component including inline `pos` styles. Move the data to `src/data/` and replace inline position styles with CSS classes.
- **Link:** n/a

## SpiceListSection.astro CSS: replace hardcoded values with tokens

- **File:** `src/components/SpiceListSection.astro:34-74`
- **Source:** CodeRabbit batch 2
- **Comment:** Component CSS uses hardcoded values for spacing, colors, and fonts. Replace with `:root` custom properties matching existing tokens.
- **Link:** n/a

## eventSchema.ts: hoist performers array to module-level constant

- **File:** `src/utils/eventSchema.ts:55-66`
- **Source:** CodeRabbit batch 2
- **Comment:** The `performer` array is recreated for every event call. Should be hoisted to a module-level `PERFORMERS` constant.
- **Link:** n/a

## instagram.ts: normalize handles inside instagramUrl

- **File:** `src/utils/instagram.ts:2-9`
- **Source:** CodeRabbit batch 2
- **Comment:** `instagramUrl` trusts caller input. Should self-normalize by trimming whitespace, stripping leading "@", lowercasing, and using `encodeURIComponent` so call sites don't need to do it manually.
- **Link:** n/a

## eventDate.ts: stricter validation in parseMonth/parseDay

- **File:** `src/utils/eventDate.ts:37-53`
- **Source:** CodeRabbit batch 2
- **Comment:** `parseMonth` and `parseDay` accept partially parsed strings (e.g., "Feb 32", "Feb 3rd"). Add strict 2-token check, MONTHS key validation, and 1-31 integer-only day validation.
- **Link:** n/a

## HomeFAQ.astro: add transitionend timeout fallback

- **File:** `src/components/home/HomeFAQ.astro:55-88`
- **Source:** CodeRabbit batch 2
- **Comment:** `animateOpen`/`animateClose` have no setTimeout safety net. Add a short timeout (e.g., 400ms) that runs cleanup if `transitionend` never fires, cleared if the event fires first.
- **Link:** n/a

---

## Contestant workflow control tower (P1-P5)

### Rubric-based interview scoring

**What:** Score each contestant on story, on-camera presence, prep quality, and decision confidence (1 to 5 per dimension). Store in the `applications/{id}/events` subcollection as a `decision_recorded` payload extension.

**Why deferred:** Free-text notes in the interview outcome form cover the current need. Rubric calibration requires at least 20+ interviews to be meaningful.

**Trigger:** Useful past ~20 interviews per week or when co-hosts need to compare cohorts without calling each other.

---

### Multiple cal.com event types

**What:** Support per-city or per-format cal.com booking URLs (e.g., `cal.com/garammasala/nyc-interview`, `cal.com/garammasala/la-interview`). The cal.com webhook handler would need to inspect the event type name to route bookings to the correct city context.

**Why deferred:** A single `CAL_INTERVIEW_URL` env var is sufficient while all interviews are conducted identically. Diverges when touring logistics require city-specific scheduling links.

**Trigger:** Useful when touring across cities with different time zones or co-host availability windows.

---

### SMS reminders (Twilio)

**What:** Send an SMS 24h before a scheduled interview ("You're scheduled for tomorrow at 3 PM ET -- here is your cal.com link") and another when the waiver nudge fires.

**Why deferred:** High signal, but Twilio has a per-message cost. Email nudges via Zoho SMTP are free and currently sufficient.

**Trigger:** Worth building once no-show rate is tracked and measurable. If no-show rate exceeds 20%, SMS becomes ROI-positive immediately.

---

### Non-Zoho SMTP fallback

**What:** If Zoho SMTP rejects a connection (rate limit or outage), retry via a secondary provider (Resend or SendGrid).

**Why deferred:** Zoho SMTP failures are rare at current volume. Manual Zoho paste is a fine fallback for one-off outages.

**Trigger:** Useful if outreach volume exceeds 50 emails per day and Zoho app-password rate limits become a real issue.

---

### Automated approval routing

**What:** If a contestant scores above a configurable rubric threshold (requires rubric first), automatically set `decision = "approve"` and queue them for invite without admin action.

**Why deferred:** Requires rubric scoring (see above) plus calibration data. Manual approval preserves gut-check judgment that rubrics cannot capture.

**Trigger:** Meaningful past 500 total interviews with calibrated rubric data.

---

### Immutable audit log

**What:** Make `applications/{id}/events` append-only via Firestore security rules (`allow delete: if false`). Optionally stream events to an external sink (BigQuery or a simple Cloud Storage JSON export) for compliance.

**Why deferred:** Trusted-team model is sufficient now. Events subcollection is already append-only by convention -- no admin UI deletes events.

**Trigger:** Relevant if the show goes multi-brand, franchises, or faces compliance requirements around talent vetting records.

---

## Revenue waves (from April 2026 plan)

### VIP ticket tier

**What:** A $30 to $50 "front row + early entry" tier on Eventbrite with separate ticket class. No additional product work needed -- just Eventbrite config and a callout on the tickets page.

**Why deferred:** Requires validating demand at current price point first.

**Trigger:** Sell out two consecutive shows at current price.

---

### Sponsorship page and media kit

**What:** A `/sponsors` page with audience stats, show format, sponsor tiers, and a contact form. Companion media kit PDF linked from the page.

**Why deferred:** Audience stats need to be accurate and recent (requires analytics consolidation first).

**Trigger:** First inbound sponsor inquiry, or after analytics wave ships audience size data.

---

### AdSense on content pages

**What:** Google AdSense ads on journal and tips pages only. Never on tickets, apply, or admin pages.

**Why deferred:** Ads hurt conversion on the high-value pages and require sufficient organic traffic to generate meaningful revenue.

**Trigger:** Journal/tips pages reaching 10K+ monthly organic sessions.

---

## Ambiguous "shows" phrasing outside the journal (2026-07-13)

The journal tickets CTA was renamed from "See Upcoming Shows" to "Catch Us Live" because "shows" next to a YouTube CTA reads like episodes, not live tickets. Two other surfaces still use the old phrasing and sit near YouTube CTAs, but were out of scope for that fix (user scoped it to the journal):

1. `src/pages/press.astro` bottom link: hardcoded "See upcoming shows →" (also violates the content architecture rule: copy hardcoded in a component instead of `src/data/`).
2. `CITY_FOLLOW.nearbyCtaLabel` in `src/data/copy.ts`: "See All Upcoming Shows", shown on city pages directly under "Watch Full Episodes on YouTube".

If the ambiguity matters there too, rename both with Surbhi's approval on the exact copy.

## Skipped reviews (pending retry)

- 2026-07-13T14:18Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=de07acb31b1046222c912bf32176941ee3f4ad03138575e556c21c92240280c0
- 2026-07-13T14:21Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=c632e66 | diff_sha=de07acb31b1046222c912bf32176941ee3f4ad03138575e556c21c92240280c0
- 2026-07-13T18:27Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=5a053421b4d64aea28b915648574c67cc0db170eac03cf28f4ee5bc42bedbcee
- 2026-07-13T14:14Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=727f9c571636bde5fa1659a5cfe3e0752dd55bfd98a7140eba940b370ac57b25
- 2026-07-13T14:18Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=aa14f0405fb398ccc172f7d23e2c9751ee8c0ea5f24ddfb43a0f0bc1380bc5c6
- 2026-07-13T14:21Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=c632e66 | diff_sha=aa14f0405fb398ccc172f7d23e2c9751ee8c0ea5f24ddfb43a0f0bc1380bc5c6
- 2026-07-13T14:23Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=ba6728a | diff_sha=4fda69b1208df08e4e0d4b9c77ef4613feb0ca8b9bc76f065441e8676120a62b
- 2026-07-13T14:23Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=ba6728a | diff_sha=4fda69b1208df08e4e0d4b9c77ef4613feb0ca8b9bc76f065441e8676120a62b
- 2026-07-15T19:41Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=8ecc6b2 | diff_sha=cd75cca2e1162551848ad7e7bd36b8eaafea48695da51c508f24dc4b385ae6c7
- 2026-07-15T19:41Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=8ecc6b2 | diff_sha=cd75cca2e1162551848ad7e7bd36b8eaafea48695da51c508f24dc4b385ae6c7
- 2026-07-15T20:02Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=ad03ccb | diff_sha=8f7496694dfa7a06a1b1dbf0b403469de24530653c93388269f0d5f1898fea65
- 2026-07-15T20:19Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=ad03ccb | diff_sha=2969cbac7200a1b37f3596ee9c891fc6080090253851585901f3c863c6b35d95
- 2026-07-15T20:19Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=ad03ccb | diff_sha=2969cbac7200a1b37f3596ee9c891fc6080090253851585901f3c863c6b35d95
- 2026-07-15T20:22Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=526ef6c | diff_sha=b99b45e90a18f0720ad467341370ce32025635d28d5f27c404e9df100956287c
- 2026-07-15T20:22Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=526ef6c | diff_sha=b99b45e90a18f0720ad467341370ce32025635d28d5f27c404e9df100956287c
- 2026-07-13T18:40Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=3e1db579ae60b215d3d81431d9225473e867fabdb1f9b20bf3fb55cfb8178c1f
- 2026-07-13T18:48Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=c632e66 | diff_sha=ea227aab2630940192ca9df9468e1601b24d48e1b85df98ccd6c3f3d52a6ac6c
- 2026-07-13T18:48Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=c632e66 | diff_sha=ea227aab2630940192ca9df9468e1601b24d48e1b85df98ccd6c3f3d52a6ac6c
- 2026-07-13T18:57Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=adb24f9 | diff_sha=b2eeae5696cfc850c0b28e6c73ccaa3f7773c08fee4c96d5c0c6ab41b5c2fd8a
- 2026-07-13T18:57Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=adb24f9 | diff_sha=b2eeae5696cfc850c0b28e6c73ccaa3f7773c08fee4c96d5c0c6ab41b5c2fd8a

- 2026-07-13T20:44Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=b7283c5 | diff_sha=5f77712c4b23f4384da3c7cb52231034d8dc7977d14da7a17538911188121da6

- 2026-07-13T20:47Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=b7283c5 | diff_sha=27549cd4222173b300c0f4b35fd1d200c6060ae78c44c063d2936d942804bc46
- 2026-07-13T20:47Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=b7283c5 | diff_sha=27549cd4222173b300c0f4b35fd1d200c6060ae78c44c063d2936d942804bc46

- 2026-07-13T20:51Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=b7283c5 | diff_sha=62dcea0150a678f2a1318562584a2f3c88d520482847d931ad73a30fa5710ba7
- 2026-07-13T20:51Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=b7283c5 | diff_sha=62dcea0150a678f2a1318562584a2f3c88d520482847d931ad73a30fa5710ba7
- 2026-07-13T20:53Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=cc33f13 | diff_sha=792300f61baae3694258927633d9b4b5b636290e28c822fde0b59509b6340748
- 2026-07-13T20:53Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=cc33f13 | diff_sha=792300f61baae3694258927633d9b4b5b636290e28c822fde0b59509b6340748
- 2026-07-13T20:56Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=cc33f13 | diff_sha=49c071425e7d368e6c395b50375c366ae9489d1de40a22a911f27d37008968e0
- 2026-07-13T20:56Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=cc33f13 | diff_sha=49c071425e7d368e6c395b50375c366ae9489d1de40a22a911f27d37008968e0
- 2026-07-13T20:59Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=5f8a97a | diff_sha=34b48fea48bbe348043200b998329f88cef4a17723d1a8bc12c6a3773a0caab8
- 2026-07-13T21:10Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=5f8a97a | diff_sha=d58b91c239276eace2d026c18cd8ab96853ea2f58466db7e30a49b599bd85d26
- 2026-07-13T21:10Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=5f8a97a | diff_sha=d58b91c239276eace2d026c18cd8ab96853ea2f58466db7e30a49b599bd85d26
- 2026-07-13T21:27Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=6c3790a | diff_sha=679393073329dbbc68a931b4c86844c71f02c323182389c186cb11c964ee3e4a
- 2026-07-13T21:27Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=6c3790a | diff_sha=679393073329dbbc68a931b4c86844c71f02c323182389c186cb11c964ee3e4a
- 2026-07-13T21:57Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=9190990 | diff_sha=7bca21da891889b6dae89b49b16d6084eb7de5e87fdb501a153605027db634dd
- 2026-07-13T22:11Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=a7a0407 | diff_sha=2c211f142130ad8681e4a9d1cf618f0277d935274a958c082a3e77c553091e41
- 2026-07-13T22:11Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=a7a0407 | diff_sha=2c211f142130ad8681e4a9d1cf618f0277d935274a958c082a3e77c553091e41
- 2026-07-13T22:14Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=a7a0407 | diff_sha=2974c587f3ec43b3238266c6d8d696bd4712d7d09c277ffcad14e647cfae9851
- 2026-07-13T22:14Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=a7a0407 | diff_sha=2974c587f3ec43b3238266c6d8d696bd4712d7d09c277ffcad14e647cfae9851
- 2026-07-14T04:16Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=31350a3 | diff_sha=63902a1c8047ddcb81fa6b730cd65b95ec9e08cfaa0bb4a4a38b58d91770886b
- 2026-07-14T04:23Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=31350a3 | diff_sha=03c8b8b21d387c28dc89ac40747d9fa2043dbace5c90e230826b3ce4571946ee
- 2026-07-14T04:23Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=31350a3 | diff_sha=03c8b8b21d387c28dc89ac40747d9fa2043dbace5c90e230826b3ce4571946ee
- 2026-07-15T19:30Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=59ce89e | diff_sha=88698c0745250b933e00b06b7a2aa231ce4a06f1eba6493454f27ff17b9fa5c5
- 2026-07-15T19:41Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=59ce89e | diff_sha=150fdc6d7ed893e4bfa548355de934e7a42d44adb01c86c617353b7fcd950253
- 2026-07-15T19:41Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=59ce89e | diff_sha=150fdc6d7ed893e4bfa548355de934e7a42d44adb01c86c617353b7fcd950253
- 2026-07-15T19:44Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=59ce89e | diff_sha=3cabdcd14cf59183d7b909e9be68a68c38717dc9b5c23e17e60a6748e1f7dd4c
- 2026-07-15T19:44Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=59ce89e | diff_sha=3cabdcd14cf59183d7b909e9be68a68c38717dc9b5c23e17e60a6748e1f7dd4c

## Low priority enhancements

### DeepSeek — 20260713-181721

- WONT-FIX (decision, do not re-file): reviewer flagged "non-obvious" in LESSONS.md as a banned double dash. It is a single hyphen forming a compound word, which the copy rules explicitly allow. No change. At `LESSONS.md:232`.

### CodeRabbit — 20260713-102329

- LOW: Inconsistent heading levels are used for items in the "Indian Dating App Landscape in 2026" ranked list. Items 7, 6, and 5 use `h3`, while items 4 through 1 use `h2`. For semantic HTML and accessibility, all items in a single ranked list should use the same heading level.

### CodeRabbit — 20260713-103031

- LOW: Inconsistent heading levels are used for items in the "Indian Dating App Landscape in 2026" ranked list. Items 7, 6, and 5 use `h3`, while items 4 through 1 use `h2`. For semantic HTML and accessibility, all items in a single ranked list should use the same heading level.

- 2026-07-13T14:35Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=ba6728a | diff_sha=4fda69b1208df08e4e0d4b9c77ef4613feb0ca8b9bc76f065441e8676120a62b
- 2026-07-13T21:30Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=ba6728a | diff_sha=20a149d8de616e12be47d70ad78ddfcb63396c294c66268653770baf52f5718f
- 2026-07-13T21:30Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=ba6728a | diff_sha=20a149d8de616e12be47d70ad78ddfcb63396c294c66268653770baf52f5718f
- 2026-07-13T21:32Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=d64b1a7 | diff_sha=93c5a476f2cf0cfb519ba62d8f7cbc2ac0b875cdfab5a416dbd48c7ec3b9f988
- 2026-07-13T21:32Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=d64b1a7 | diff_sha=93c5a476f2cf0cfb519ba62d8f7cbc2ac0b875cdfab5a416dbd48c7ec3b9f988
- 2026-07-13T21:49Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=31350a3 | diff_sha=e35f355d8ce66d3bee2b4cb0a3a46beb9e293044bcb8a954a72352747f0ec6ce
- 2026-07-13T21:54Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=31350a3 | diff_sha=b85bc6ec208be3e9c39090376efd6fb019be6269f674a405c12822b01884ae11
- 2026-07-14T04:12Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=31350a3 | diff_sha=a457f9f43c890a3896d690da506abb79097a4a3ef66a6f7940892657c149ea39
- 2026-07-13T21:58Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=31350a3 | diff_sha=e99328d390b12ce56298326ab4de0bbe0dc52589de496f6c32de51a45e6bfc6d
- 2026-07-13T21:58Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=31350a3 | diff_sha=e99328d390b12ce56298326ab4de0bbe0dc52589de496f6c32de51a45e6bfc6d
- 2026-07-13T22:03Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=be735b9 | diff_sha=aad31620a68713c8d429e0c119d83b6d351d4e2eaa7a4338546eecdd1ac0d095
- 2026-07-13T22:03Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=be735b9 | diff_sha=aad31620a68713c8d429e0c119d83b6d351d4e2eaa7a4338546eecdd1ac0d095
- 2026-07-13T22:07Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=deepseek | commit=37cde64 | diff_sha=9506d1aa157f1daade093c8e9414c34d99e8046112fb55278553d9723010625c
- 2026-07-13T22:07Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=37cde64 | diff_sha=9506d1aa157f1daade093c8e9414c34d99e8046112fb55278553d9723010625c
- 2026-07-14T18:04Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=8b4d379 | diff_sha=21cb57ca33a0bc568eacd8e142d7932bb30af7a382fa25b557f2c6dda526c07e
- 2026-07-15T01:57Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=59ce89e | diff_sha=79d49c2634be8fd8ec7a52e9739360de8ba9bb45ede67b3359c69ac05ca02d7a
- 2026-07-15T18:57Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=3e710a3 | diff_sha=8a5d9b44e12d873915bc410ecf7ac50ea656f9f5643c4c24afec31b5de602895
- 2026-07-15T18:57Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=3e710a3 | diff_sha=8a5d9b44e12d873915bc410ecf7ac50ea656f9f5643c4c24afec31b5de602895
- 2026-07-15T02:08Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=4efe5d3 | diff_sha=b74f4259c3e8725c36ba740c55be50f41db8a256f4ac932ce24114c7160ec270
- 2026-07-15T19:26Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=8ecc6b2 | diff_sha=c9f20eceb0d2132fd116a62263d47c0c3d5f314a576755c1dfc0e7cb6dd8f18b
- 2026-07-15T19:37Z | resolved=unretryable-no-diff | tier=E | primary=codex | reason=error_or_timeout | fallback_used=gemini | commit=8ecc6b2 | diff_sha=0dcddf1f107891ad33ffb99d2cd75f10b3ad2973464c41b886f960166a096a50
- 2026-07-15T19:37Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=8ecc6b2 | diff_sha=0dcddf1f107891ad33ffb99d2cd75f10b3ad2973464c41b886f960166a096a50
- 2026-08-03T00:59Z | resolved=unretryable-no-diff | tier=E | primary=ALL | reason=OUTAGE | fallback_used=NONE | commit=5fe6a0a | diff_sha=3d998d0b513304e4dcd13cc7dc65f588854d173e64fe4c35b0bb72ea5a31bf94
- 2026-07-16T18:17Z | resolved=unretryable-no-diff | tier=E | primary=ALL | reason=OUTAGE | fallback_used=NONE | commit=5ddedb4 | diff_sha=ed14541b82dc007ce4624509b649e2da8f71e4fe8c02799ab276ad30e4d08254

### Codex (2026-07-16T19:17Z)

- LOW: New `BUGS.md` headings use em dashes and `CHANGELOG.md:11` adds an Oxford comma, both violating the repository copy mandate.

### Codex (2026-07-16T19:23Z)

- LOW: `BUGS.md:638`, `BUGS.md:642` and `BUGS.md:646` use prohibited em dashes. `CHANGELOG.md:11` uses a prohibited Oxford comma.

### CodeRabbit — 20260715-160549

- LOW: [CodeRabbit] ENHANCEMENTS.md: Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate. In @ENHANCEMENTS.md at line 1493, Update the metadata timestamp entry in ENHANCEMENTS.md to use the repository-approved dash-free separator format instead of the hyphenated date in the 2026-07-15T20:02Z value. Preserve the remaining metadata fields unchange...

### DeepSeek — 20260715-160953

- LOW: The heading '### CodeRabbit — 20260715-160549' uses an em dash, which violates the project's copy voice mandate.
  > a/ENHANCEMENTS.md:1496 | +### CodeRabbit — 20260715-160549

### Codex LOW findings 2026-07-16 (won't fix, kept so they are not re-filed)

- Bold-label sections in the new LESSONS.md Eventbrite entry: won't fix. The global CLAUDE.md LESSONS.md mandate prescribes the `**What went wrong:**` `**Why:**` `**Rule:**` template and nearly every existing entry follows it. The specific template mandate overrides the general copy-voice ban on bold-label lists for this file.
- Em dash in the `1f0a217` commit message body: won't fix. That commit is already on origin, so rewriting its message means amending a published commit and force-pushing. The rule stands for future commit messages.
- 2026-08-13T19:10Z | resolved=unretryable-no-diff | tier=E | primary=ALL | reason=RC_143 | fallback_used=NONE | commit=38cb5df | diff_sha=6ade649dbb262cb1294f3a55a01d603b15ec09f93217ea52b1579b01af756d3b
- 2026-08-13T19:11Z | resolved=unretryable-no-diff | tier=E | primary=ALL | reason=OUTAGE | fallback_used=NONE | commit=38cb5df | diff_sha=6ade649dbb262cb1294f3a55a01d603b15ec09f93217ea52b1579b01af756d3b
- 2026-08-14T08:26Z | tier=E | primary=ALL | reason=OUTAGE | fallback_used=NONE | commit=e4b2b9a | diff_sha=63f7b57cf4b49691cc79e120859dc072641a01a10d1745cd7228035dbdf3e515

### Codex (2026-08-14T19:29Z)

- LOW: [COPY-VOICE] The commit message for `0961d06` contains a prohibited em dash in the phrase "npm 10 [em dash] the exact split" (character replaced with a placeholder here so this file does not reproduce it).
- Decision (2026-08-14): won't fix, same rationale as the `1f0a217` entry above. Commit `0961d06` is already on origin, so rewriting its message means amending a published commit and force-pushing. The rule stands for future commit messages.

### Codex (2026-08-15T02:23Z)

- LOW: [INTERACTIVE-TYPE-SIZE] `src/components/events/EventTicketCta.astro:194` uses 15px button text and `src/pages/events/[slug].astro:541` uses 14px link text, violating the project’s 16px minimum for interactive elements.
- LOW: [DESIGN-TOKEN-BYPASS] New event components hardcode colors such as `white`, `#444` and black RGBA values instead of using the project’s centralized color tokens.

### Fable — 20260816-094940 (PR #193)

- [ ] ENHANCEMENT: LOW [NO-GLOBAL-HOOK-FALLBACK] Pre-push runs zero local checks on a machine without the global hooks installed | Why: `.husky/pre-push:16`, with `npm run check` removed, has its only remaining gate as the `-x "$HOME/.git-hooks/pre-push"` chain, so on a fresh clone, new laptop, or worktree before setup a push runs no local checks at all and type-broken or `--no-verify`-committed code reaches the remote silently, caught only later in CI. Filed, not built: a repo-local fallback gate is new scope beyond the pre-push trim this PR shipped | Files: .husky/pre-push | Plan: add a repo-local fallback check (e.g. run `npm run check` directly when `$HOME/.git-hooks/pre-push` is absent) so pushes are never fully ungated | Verify: rename `~/.git-hooks` locally, make a type-broken commit, confirm the push is still blocked. Executor: the 3:00 overnight fix-medium-bugs lane.

### Dependency follow-ups (2026-08-18)

- [ ] ENHANCEMENT: Clear the 3 moderate npm audit findings in the firebase-tools chain | Why: firebase-tools 15.x depends on @google-cloud/pubsub 5.x which pins @opentelemetry/core ^1.30.1, flagged for unbounded memory allocation in W3C Baggage propagation (GHSA-8988-4f7v-96qf); dev-only CLI exposure, no upstream fix exists yet and `npm audit fix --force` would downgrade firebase-tools to 14.x, so forcing a cross-major override of a transitive dep was rejected in the 2026-08-18 dependency PR | Files: package.json, package-lock.json | Plan: wait for firebase-tools to pull pubsub 6.0.1+ (or pubsub to ship otel core 2.8+), then bump firebase-tools and confirm the audit chain clears; only if months pass with no upstream movement, test an `@opentelemetry/core` override against the emulator suite | Verify: npm audit reports 0 vulnerabilities and the Firestore/Storage rules emulator job passes. Executor: the 3:00 overnight fix-medium-bugs lane (as a periodic bump check) or the next dependency PR session.
- [ ] ENHANCEMENT: LOW [STALE-COMMENT-EXAMPLE] The WHY comment in astro.config.mjs cites a slug that no longer exists | Why: `astro.config.mjs:79` names `chicago-tba` as an example TBA event slug, but `src/data/events.ts` has no such entry, so the example misleads future readers (flagged by the recovered 2026-08-17 outage review) | Files: astro.config.mjs | Plan: replace `chicago-tba` in the comment with a real current TBA slug from events.ts, or drop the specific example and say "TBA/coming-soon cities" | Verify: the named example slug greps to a real entry in src/data/events.ts. Executor: the 3:00 overnight fix-medium-bugs lane.
- [ ] LOW: [EDGE-CASE] src/components/apply/useApplyForm.ts:152, `city: form.city.trim()` is sent unconditionally while firestore.rules requires `d.city.size() > 0`, so a whitespace-only city (" ") that previously passed the deployed size check now trims to "" and the write is rejected; if getFieldErrors does not also trim city, the applicant passes UI validation, uploads photos, then hits "Missing or insufficient permissions" and the application is lost. | Files: d.city.size firestore.rules form.city.trim src/components/apply/useApplyForm.ts | PR: #208 | Head: 112b1694598499bda676c576ac04eeb0a394324d
- [ ] LOW: [CONTRACT-DRIFT] src/components/apply/useApplyForm.ts:190, buildApplicationDocument recomputes `emailNormalized: form.email.trim().toLowerCase()` instead of reusing the identical expression already producing `email` in buildApplicationData, so a future edit to one site (e.g. extra normalization) silently desynchronizes the two fields and breaks the webhook correlation that emailNormalized exists for, with no test asserting the two stay equal. | Files: e.g form.email.trim src/components/apply/useApplyForm.ts | PR: #208 | Head: 112b1694598499bda676c576ac04eeb0a394324d

<!-- fable-routed PR #208 head 112b1694598499bda676c576ac04eeb0a394324d -->

- [ ] LOW: [SINGLE-ATTEMPT-PAGER] .github/workflows/synthetic-apply.yml:106, the default `bash -e` shell aborts the step if the `gh issue list` dedup query transiently fails, skipping both `gh issue comment` and `gh issue create` with no retry, so that run's only remaining page is the site-channel path already known to drop alerts. | Files: .github/workflows/synthetic-apply.yml | PR: #207 | Head: 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619
- [ ] LOW: [SEARCH-DEDUP-ALIASING] .github/workflows/synthetic-apply.yml:106, dedup relies on GitHub's eventually-consistent search plus substring `in:title` matching, so back-to-back failures can open duplicate issues before the first is indexed, and a comment can land on any unrelated open issue whose title merely contains "Synthetic apply monitor failing". | Files: .github/workflows/synthetic-apply.yml | PR: #207 | Head: 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619

<!-- fable-routed PR #207 head 56f4a6e2a2ab4f28a568a9221bd072b9b7d73619 -->

- [ ] LOW: [SILENT-FAILURE] .github/workflows/mutation-audit.yml:54, `npx stryker run --incremental 2>&1 | tee stryker-output.log` runs under Actions' default shell without pipefail, so a Stryker crash exits 0 via tee and the failure only surfaces later as a misleading "Could not find an All files row" parse error in the summary step. | Files: .github/workflows/mutation-audit.yml stryker-output.log | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8
- [ ] LOW: [SECURITY] .github/workflows/mutation-audit.yml:31, the checkout omits `persist-credentials: false` (which ci.yml deliberately sets), leaving the contents:write GITHUB_TOKEN in .git config while `npm ci` and Stryker execute third-party dependency and test code that could read it. | Files: .github/workflows/mutation-audit.yml ci.yml | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8
- [ ] LOW: [CONTRACT] .github/workflows/ci.yml:52, checking out `head.sha` instead of GitHub's test-merge commit means the required job never builds or tests the PR merged with current main, so a PR that is green in isolation can still break main at merge time (the inline rationale conflates the diff step's SHA needs, which are env vars, with what commit must be checked out). | Files: .github/workflows/ci.yml head.sha | PR: #160 | Head: c251ea7abaa5a9862f3477db86cf0f37d27695f8

<!-- fable-routed PR #160 head c251ea7abaa5a9862f3477db86cf0f37d27695f8 -->

- [ ] LOW: [correctness] src/components/ContestantPrepPage.tsx:31, `readSession` (called during render and in the auth effect) and `saveSession` access `sessionStorage` with no try/catch, so in storage-blocked browsers (Chrome "block all cookies", some private modes) the render throws and blanks the page, or a successful auth response throws in `saveSession` and is caught as a failure — a contestant with a valid emailed link sees "Link expired"; the sibling portalBootstrap module guards exactly this but the prep page rewrite did not. | Files: src/components/ContestantPrepPage.tsx | PR: #147 | Head: 177c6e2f7a0aaca2ca43f31a74aa6d20a59ff829
- [ ] LOW: [security] src/components/ContestantPrepPage.tsx:293, the prep page's `?date&sig` bearer credentials are read but never scrubbed from the URL, so they remain visible to the deferred GTM/PostHog/Meta scripts, browser history and shared screenshots for the whole session — the same exposure this PR eliminates for portal `?invite=` tokens is left in place on the adjacent page. | Files: src/components/ContestantPrepPage.tsx | PR: #147 | Head: 177c6e2f7a0aaca2ca43f31a74aa6d20a59ff829

<!-- fable-routed PR #147 head 177c6e2f7a0aaca2ca43f31a74aa6d20a59ff829 -->

- [ ] LOW: [duplication] src/lib/homeSignupInit.ts:52, the email-then-phone lead-capture flow is now maintained as three near-identical copies (homeSignupInit.ts, homepageInit.ts, notifyModalInit.ts) instead of one shared helper; failure scenario: a future bug fix or API change (e.g. a new required field in captureLead) gets applied to one module and silently skipped in the other two, so leads from the un-fixed forms are captured wrong or dropped without any error. | Files: e.g homeSignupInit.ts homepageInit.ts notifyModalInit.ts src/lib/homeSignupInit.ts | PR: #146 | Head: 81273d0b35ae67a94a9e2956218c866c07685707
- [ ] LOW: [refactor-verification] src/lib/notifyModalInit.ts:12, the extraction moves ~740 lines of live signup code verbatim into modules with no accompanying test or smoke check in the PR, so any transcription slip in the copy (the highest-risk part of this change) would only surface as a runtime failure on a production signup form; failure scenario: a missed line in one handler throws in the browser, the form's catch block shows "Something went wrong," and signups from that surface quietly stop until someone notices the lead count dropped. | Files: src/lib/notifyModalInit.ts | PR: #146 | Head: 81273d0b35ae67a94a9e2956218c866c07685707

<!-- fable-routed PR #146 head 81273d0b35ae67a94a9e2956218c866c07685707 -->

- [ ] LOW: [EXIT-CODE] scripts/verify-admin-emails.mjs:232, the final exit code is `ok === confirmUids.length ? 0 : 1`, so a run where one CONFIRM_UIDS entry was skipped (e.g. a deleted account) but the post-run recheck proved every allowlisted email verified prints "Safe to merge" yet exits 1, contradicting stdout for any wrapper gating on the exit code (fails closed, so blocking not dangerous). | Files: confirmUids.length e.g scripts/verify-admin-emails.mjs | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3
- [ ] LOW: [DOC-CONTRACT] architecture-map.md:58, the admin section heading states "allowlisted verified email OR `admin` custom claim" for the whole table, but every `verifyAdminIdentity` row additionally requires a non-empty `email` claim (src/lib/verifyToken.ts:151), so a claim-only admin with no email would 401 on those routes despite the docs saying they qualify. | Files: architecture-map.md src/lib/verifyToken.ts | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3
- [ ] LOW: [COPY-VOICE] LESSONS.md:5, the new lesson uses the bold-term-colon format and the CHANGELOG adds Oxford commas that the repo's own copy-voice gate has repeatedly flagged across multiple reviewer passes in this same diff, so the commit knowingly lands style violations the gate will keep re-reporting. | Files: LESSONS.md | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3
- [ ] LOW: [TRUNCATED-RECORDS] ENHANCEMENTS.md:1497, several committed reviewer bookkeeping entries end mid-sentence ("Pre...", "f...", "structu..."), permanently storing incomplete records that later audits of past review findings cannot reconstruct. | Files: ENHANCEMENTS.md | PR: #145 | Head: a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3

<!-- fable-routed PR #145 head a7c96eeb700313f56cfbf3a7c2063ac4e4defcf3 -->

- [ ] LOW: [CONTRACT] BUGS.md:8, the new routing comment mandates that fixed entries be deleted "in the same commit" the fix is "record[ed] in CHANGELOG.md", but this PR deletes ~60 fixed/historical entries (CSP Firebase Auth outage, admin password, PII console leak, etc.) while touching no CHANGELOG.md — the very first commit under the new policy breaks the policy, and anyone auditing past security fixes must resort to git archaeology. | Files: BUGS.md CHANGELOG.md | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7
- [ ] LOW: [DATA-LOSS] BUGS.md:24, the deleted photo-upload-limit entry contained the still-actionable operational note "storage.rules needs a Firebase deploy to take effect" — if that deploy was never run, the server still enforces the old 5 MB cap while the client accepts 15 MB, so large iPhone photo uploads pass client validation then fail server-side, and the only written reminder of the pending deploy is now gone. | Files: BUGS.md storage.rules | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7
- [ ] LOW: [CORRECTNESS] ENHANCEMENTS.md:1175, the added fallback-log line "2026-07-13T21:57Z" is inserted after the existing "2026-07-14T04:12Z" line, breaking the log's chronological ordering — any tooling or person reading the tail of the log to find the most recent reviewer-fallback event reads a stale entry as the latest. | Files: ENHANCEMENTS.md | PR: #139 | Head: 4db91e278d8c9077471bd056160c2d57390339c7

<!-- fable-routed PR #139 head 4db91e278d8c9077471bd056160c2d57390339c7 -->

- [ ] LOW: [DEPS] package-lock.json:19061, the transitive markdown engine `satteri` jumps from 0.9.5 to 0.10.5 (a breaking-range 0.x minor pulled in by the `@astrojs/markdown-satteri` 0.3.7 patch, which also drops its `hast-util-from-html` parsing dependency), so markdown/MDX rendering behavior can change even though this PR is labeled minor-and-patch; a content page that previously rendered inline HTML or generated heading anchors one way could silently emit different HTML after this merge, breaking styling, in-page links, or SEO markup with no code change to blame. | Files: 0.x package-lock.json | PR: #211 | Head: 5b05fe0af2c34293edcdf69ec3b1655bd8c3d9df

<!-- fable-routed PR #211 head 5b05fe0af2c34293edcdf69ec3b1655bd8c3d9df -->

- [ ] LOW: [log-integrity] ENHANCEMENTS.md:1493, four new fallback-log entries timestamped 2026-07-14T18:13Z–18:25Z are appended after an existing entry timestamped 2026-07-15T01:57Z, breaking the file's chronological append order; any tooling or reviewer that reads the tail of the log as "most recent review event" will pick up the 07-14 entry and misjudge which commit was last reviewed. | Files: ENHANCEMENTS.md | PR: #134 | Head: 5da61cf89e4daf2e275c9a7e9ad2485635a6bf92
- [ ] LOW: [dependabot] .github/dependabot.yml:14, the new ignore rule for `version-update:semver-major` on typescript also applies to Dependabot security updates, so if a future TypeScript security fix ships only in a new major version, no PR is ever filed and the vulnerable version sits in the repo with no alert-driven bump until someone remembers to remove the rule. | Files: .github/dependabot.yml | PR: #134 | Head: 5da61cf89e4daf2e275c9a7e9ad2485635a6bf92

<!-- fable-routed PR #134 head 5da61cf89e4daf2e275c9a7e9ad2485635a6bf92 -->

- 2026-07-14T18:13Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=24f2dfb | diff_sha=3f36b82a499ff8d0d9ce02280734d6e9abbb23b752851075f3419f08ac0c1eef
- 2026-07-14T18:18Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=e03c81e | diff_sha=84b353635e0d0759efea2b3738befa550278c5103eef7c91876532f209e284e4
- 2026-07-14T18:22Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=e03c81e | diff_sha=d3c4345fa4b0d7370d9f353dd1522a044210e706b984ae0b5f064c2cb1a40a66
- 2026-07-14T18:25Z | resolved=unretryable-no-diff | tier=F | primary=coderabbit | reason=error | fallback_used=gemini | commit=f7d9792 | diff_sha=05259226cacd5fd58c8ecfb4bd442cd98ef9b72cbabcfc1aa4cbbe0bad0fb49a
- [ ] ENHANCEMENT: Review hiding the city page h1 at 1024px and below | Why: `.city-h1` is display:none on phones and tablets (the 70% of traffic), so the only visible heading there is the eyebrow; hidden headings can be discounted for SEO and leave screen reader users without the page title, and this is a deliberate design choice so it needs the owner's call | Files: src/pages/cities/[slug].astro, tests/smoke/site.spec.ts | Plan: propose a visually restyled but visible h1 for small screens, show the owner a before and after, change only if approved | Verify: city smoke cases assert the h1 is visible on every viewport
- [ ] LOW: [DEPS] package.json:75, @stryker-mutator/vitest-runner remains at ^9.6.1 while this PR moves jest-runner to 10.0.0, and Stryker plugins are version-locked to core, so after core is bumped to satisfy this PR the vitest runner becomes the incompatible one unless PR #213 lands in the same window. | Files: package.json | PR: #214 | Head: 7bba5264084b80c69448bdecd2cca30c3881c2ab

<!-- fable-routed PR #214 head 7bba5264084b80c69448bdecd2cca30c3881c2ab -->

- [ ] LOW: [DEPS] package.json:74, @stryker-mutator/jest-runner remains at ^9.6.1 in this PR, so even after core is bumped by #212 the tree mixes 9.x and 10.x Stryker plugins until #214 also lands, meaning the three PRs are only safe merged together and in order (core first), which none of them enforces. | Files: package.json | PR: #213 | Head: 68d78b2b00f057fda4ac4596449cac1941b325b1

<!-- fable-routed PR #213 head 68d78b2b00f057fda4ac4596449cac1941b325b1 -->

- [ ] LOW: [SUPPLY-CHAIN] package-lock.json:6597, the new Babel 8 packages pulled in by @stryker-mutator/instrumenter introduce the unfamiliar transitive dependency `obug` (a debug-style logger) whose lockfile entry is not visible in this diff; if it is not the package Babel 8 actually ships with, or the entry is missing from the lockfile, `npm ci` either installs an unvetted package into the dev toolchain or fails outright, so its name, publisher, and lockfile entry should be confirmed before merge. | Files: package-lock.json | PR: #212 | Head: f6704cc7f8f6f6c265647c0c3dd0f74a43182252

<!-- fable-routed PR #212 head f6704cc7f8f6f6c265647c0c3dd0f74a43182252 -->

- [ ] LOW: [CORRECTNESS] scripts/check-rules-drift.mjs:31, `readTrimmedEnv` strips exactly one trailing literal `\n` and never re-trims or repeats, so a secret shaped like `"proj \n"` (space before the two characters) or `"proj\n\n"` still emerges with a trailing space or a residual literal `\n` and silently rebuilds the same corrupted, 404-ing URL that incident #215 was about (identical duplicated code at scripts/synthetic-apply-verify.mjs:40). | Files: scripts/check-rules-drift.mjs scripts/synthetic-apply-verify.mjs | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6
- [ ] LOW: [SILENT-FAILURE] src/components/ContestantPrepPage.tsx:27, `saveSession` through `safeSessionStorage.setItem` now no-ops silently when Safari private browsing blocks storage, so a contestant who enters a valid access token appears signed in, is bounced back to the login prompt on the next page load, and no error is thrown, surfaced, or reported to PostHog to explain the loop. | Files: src/components/ContestantPrepPage.tsx | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6
- [ ] LOW: [PROCESS] CHANGELOG.md:4, the PR is titled "chore(ci): retrigger CI workflow" while actually shipping production-facing JavaScript (storage wrappers, cursor guard, shader null-check, PostHog filters), CI coverage-gate logic, and test-isolation changes, so anyone bisecting, reverting, or auditing history by commit title will drastically underestimate this change's blast radius. | Files: CHANGELOG.md | PR: #234 | Head: 6dfd21c44f456e926e18475aed25b504d88819b6

<!-- fable-routed PR #234 head 6dfd21c44f456e926e18475aed25b504d88819b6 -->

- [ ] LOW: [BEHAVIOR] astro.config.mjs:230, removing the `define` that pinned `process.env.NODE_ENV` to "development" flips production builds into real production mode, so any code path gated on NODE_ENV (dev-only logging suppression, analytics guards, React dev-mode behavior) silently changes for all visitors on the next deploy. | Files: astro.config.mjs | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] LOW: [OBSERVABILITY] src/pages/api/actions/record-decision.ts:91, the error log dropped the applicationId ("Rejection email failed" with no ID), so when a rejection email fails there is no way to tell from the logs which applicant never received it or to re-send manually. | Files: src/pages/api/actions/record-decision.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec
- [ ] LOW: [SEO] src/utils/breadcrumbs.ts:1, `import.meta.env.SITE` reflects the raw Astro `site` config and can carry a trailing slash, in which case every breadcrumb URL becomes `https://garammasaladating.com//tickets`-style double-slash and the structured data no longer matches canonical URLs. | Files: src/utils/breadcrumbs.ts | PR: #123 | Head: 0674aa103c7808e575e755311072fdc815d3e6ec

<!-- fable-routed PR #123 head 0674aa103c7808e575e755311072fdc815d3e6ec -->

- [ ] LOW: [contract] CHANGELOG.md:4, the PR is titled "content: rewrite applicant welcome email copy" but actually refactors all 11 template functions into JSON, changes the `applicationReceived()` public signature (dropping the `city` parameter), and edits an API route, so a future git-blame or revert targeting "the welcome copy change" would unexpectedly touch every email template and the notify-application endpoint. | Files: CHANGELOG.md | PR: #236 | Head: 2b3a91e58902101ad894b733e0c85fb19daf23d9

<!-- fable-routed PR #236 head 2b3a91e58902101ad894b733e0c85fb19daf23d9 -->

- [ ] LOW: [contract] src/pages/api/stage-waiver.ts:128 (same pattern in contestant-claim.ts, contestant-open-claim.ts, contestant-show-claim.ts), the `waiverReceipt`/`producerWaiverNotification` template calls were moved from inside the old try/catch to bare synchronous code before Promise.allSettled, so a template function that throws (e.g. on unexpected input) now escapes as an unhandled 500 after the waiver was already persisted, where previously it was caught and only paged ops while still returning success. | Files: src/pages/api/stage-waiver.ts | PR: #230 | Head: c39ab6f345b7be7c2fc8859928d77f8815dfd979

<!-- fable-routed PR #230 head c39ab6f345b7be7c2fc8859928d77f8815dfd979 -->

- [ ] LOW: [correctness] README.md:15, the clone URL `github.com/hellosurbhi/garam-masala-dating.git` does not match the actual repository name `garam-website`, so a new contributor following the Quick Start gets a 404 from `git clone`. | Files: README.md | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] LOW: [contract] package.json:6, `"license": "SEE LICENSE"` is not a valid SPDX expression (npm expects `SEE LICENSE IN <file>` or `MIT`), and it contradicts the MIT grant in the new LICENSE file, producing npm warnings and ambiguity about what license actually applies. | Files: package.json | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] LOW: [process] test/notify-application.test.ts:1, the PR is titled "test: update notify-application tests for origin guard" but the diff also changes production API behavior, Firebase Storage rules, licensing, and .gitignore, so a reviewer or bisect trusting the commit message will miss behavior-changing code under a test-only label. | Files: test/notify-application.test.ts | PR: #243 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1

<!-- fable-routed PR #243 head 877aa7a1137f0f582c1b247c7ffaefdada5126d1 -->

- [ ] LOW: [redaction-gap] src/lib/opsAlert.ts:134, `EMAIL_ADDRESS = /[^\s@]+(?:@[^\s@]+)+/` requires at least one non-space character after every `@`, so a token ending in a bare `@` (e.g. exception text already truncated upstream to "post-show email to priya@") matches nothing and the whole local part ships unredacted; `boundRedactionInput` guards this fragment shape only at its own 8000-char boundary, not for fragments produced by callers or transports that cut their own error strings, the CHANGELOG itself notes callers historically hand-sliced `errorMessage` at 2000. | Files: src/lib/opsAlert.ts | PR: #254 | Head: 0bc5a4024c98e48404a3dce84bc430a50140f7ba

<!-- fable-routed PR #254 head 0bc5a4024c98e48404a3dce84bc430a50140f7ba -->

- [ ] LOW: [COVERAGE] package.json:83, @vitest/coverage-v8 5.0.0 swaps istanbul-lib-coverage/istanbul-lib-report/istanbul-reports for new @vitest/istanbul-lib-* forks and drops istanbul-reports (HTML output) from the tree; any coverage threshold, report parser, or CI artifact wired to the old istanbul output format can break or silently report differently. | Files: package.json | PR: #257 | Head: 91a19035ca6fa25d5842eda84195d1b3fa688791

<!-- fable-routed PR #257 head 91a19035ca6fa25d5842eda84195d1b3fa688791 -->

- [ ] LOW: [SUPPLY-CHAIN] package-lock.json:7680, this "minor-and-patch" PR silently pulls a transitive major upgrade of @vercel/routing-utils (5.3.3 → 6.5.0) via the @astrojs/vercel bump, so route/redirect compilation rules in the Vercel adapter can change under a PR labeled as low-risk; a redirect or rewrite defined in the site config that compiled fine under v5 could compile differently under v6 and only fail after the next production deploy. | Files: package-lock.json | PR: #256 | Head: 3df295e97d04f99e3810883ef39613bb819038c1

<!-- fable-routed PR #256 head 3df295e97d04f99e3810883ef39613bb819038c1 -->

- [ ] LOW: [CI] package-lock.json:11680, the eslint engines requirement tightens from `^18.18.0 || ^20.9.0 || >=21.1.0` to `^20.19.0 || ^22.13.0 || >=24`, so any CI job, git hook, or dev machine still on Node 18, Node 21, or an early 20.x/22.x patch will refuse to run eslint (or warn and misbehave), breaking lint in environments that worked yesterday. | Files: package-lock.json | PR: #253 | Head: 0c7fee3343f206621469d6e8523e98cfc838a03f

<!-- fable-routed PR #253 head 0c7fee3343f206621469d6e8523e98cfc838a03f -->

- [ ] LOW: [COPY-BUG] src/pages/cities/[slug].astro:178, the hardcoded social aside says "We sell out every week in NYC… Watch while we make our way to {city.displayName}" on every city page, so the New York City page will read "make our way to New York City", which is self-contradictory. | Files: (none cited) | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af
- [ ] LOW: [DEAD-CODE] src/pages/cities/[slug].astro:795, a new `.city-stat` style block is added even though the only element using that class was deleted in the same diff, leaving orphaned CSS that suggests the removal decision was not fully settled. | Files: (none cited) | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af
- [ ] LOW: [CHANGELOG-INACCURATE] CHANGELOG.md:14, the changelog entry claims only `src/pages/cities/[slug].astro` was affected, but the diff also modifies `src/pages/journal/[slug].astro`, so the recorded history of the change is wrong. | Files: CHANGELOG.md | PR: #252 | Head: 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af

<!-- fable-routed PR #252 head 62e57f4c7586ae2f821ea2f7a1bebca1bc34b4af -->

- [ ] LOW: [stale-data] src/data/events.ts:361, the DC Comedy Loft show has isoDate 2026-08-30 which is already in the past relative to today (2026-09-09), so this change publishes a "buy tickets" URL for a concluded show or, if past events are filtered out, never displays at all. | Files: src/data/events.ts | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c
- [ ] LOW: [correctness] src/components/admin/ApplicantModal.tsx:242, styles.participatedButton is referenced but no such class was added to the CSS module, so className resolves to "undefined" and any intended shared button styling (focus states, responsive rules) is silently absent, leaving only the inline styles. | Files: src/components/admin/ApplicantModal.tsx | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c
- [ ] LOW: [dead-code] src/components/admin/ApplicantModal.tsx:238, the !isDeleted check inside the non-deleted branch of the isDeleted ternary is always true, which is harmless now but invites a future editor to assume it does something. | Files: src/components/admin/ApplicantModal.tsx | PR: #251 | Head: 3bf2d8abd6a724db727276633aa0d829af00898c

<!-- fable-routed PR #251 head 3bf2d8abd6a724db727276633aa0d829af00898c -->

- [ ] LOW: [DATA-CONSISTENCY] src/data/events.ts:400, the canceled/hidden Edison entry keeps `ticketSource: "our-eventbrite"` despite `url: ""` and no listing, contradicting the new taxonomy where `"none"` means "no tickets on sale anywhere yet" and the changelog's "remapped mechanically by URL" claim; if this entry is ever un-hidden or copied as a template for a future TBA show, it would wrongly claim our-account ownership and, once given an `eventbriteId`, be swept into order sync and Eventbrite content fetches that will fail on every run. | Files: src/data/events.ts | PR: #250 | Head: 620768d9c9c664d5d2bd64a62b379506ccfa6d7e

<!-- fable-routed PR #250 head 620768d9c9c664d5d2bd64a62b379506ccfa6d7e -->

- [ ] LOW: [CORRECTNESS] package.json:6, `"license": "SEE LICENSE"` is not a valid npm/SPDX license value (the accepted form is `"SEE LICENSE IN <filename>"` or `"MIT"`), so npm and license-scanning tools emit warnings and cannot determine the code's actual MIT status. | Files: package.json | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] LOW: [CONTRACT] NOTICE:18, the proprietary carve-out references paths like `src/data/journal/**` and `src/data/tips**` that don't match the actual layout (journal content lives in `src/data/journal.ts` per repo docs), so the editorial content the notice is meant to protect may fall outside its own path claims and default to MIT. | Files: (none cited) | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] LOW: [SECURITY] test/notify-application.test.ts:37, the fixture scrub replaced the Instagram handle but left the matching "priya@example.com" address (and any associated name fields) in place, so if the fixture identified a real person the de-identification is incomplete, and the original handle remains in git history regardless. | Files: test/notify-application.test.ts | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d
- [ ] LOW: [SILENT-FAILURE] .gitignore:14, new ignore rules (`.env`, `.env.*`, `docs/private/`) only affect untracked files, so if any of these were previously committed they remain tracked and fully visible in the public repo while appearing "ignored" locally. | Files: (none cited) | PR: #241 | Head: 59812505cb865287e1bb7a97c5d995b38491e89d

<!-- fable-routed PR #241 head 59812505cb865287e1bb7a97c5d995b38491e89d -->

- [ ] LOW: [DEV-DEP-CHURN] package-lock.json:12187, ESLint's cache layer is wholesale replaced (file-entry-cache 8→11, flat-cache 4→6, keyv 4→5) and adds seven new transitive packages (cacheable, hookified, qified, hashery, @cacheable/*, @keyv/bigmap), several declaring engines node >=20; lint runs on any CI or hook environment still on Node 18 will start failing with engine or runtime errors, and the new small packages modestly widen the dev-time supply-chain surface even though all resolve to registry.npmjs.org with integrity hashes intact. | Files: package-lock.json | PR: #268 | Head: 629d7037818c5743e786efd2b94a33568a5d0d84

<!-- fable-routed PR #268 head 629d7037818c5743e786efd2b94a33568a5d0d84 -->

- [ ] LOW: [CONFIG-MIGRATION] package.json:97, vitest and @vitest/coverage-v8 4→5 restructure the package internals (expect/runner/snapshot/utils removed as installable packages, istanbul deps replaced by @vitest forks), so any direct import from those subpackages or a renamed coverage config option can be silently ignored, letting coverage thresholds stop being enforced without a visible CI failure. | Files: package.json | PR: #267 | Head: f18679cf3df41ddb33e5da8654360e3a44fb4087

<!-- fable-routed PR #267 head f18679cf3df41ddb33e5da8654360e3a44fb4087 -->

- [ ] LOW: [KEY-FILE-NOT-CLEANED] .github/workflows/deploy-rules.yml:81, `rm -f "$RUNNER_TEMP/firebase-sa.json"` only runs if the deploy command succeeds, so any deploy failure leaves the service-account private key on the runner filesystem for the rest of the job (including the pager step); a trap or an `if: always()` cleanup step would remove it unconditionally, exposure is bounded by the ephemeral runner but nonzero. | Files: (none cited) | PR: #266 | Head: 1d19918e05e4c3f1a5a760f430dad4ec45750530
- [ ] LOW: [DRIFT-WINDOW-REMAINS] .github/workflows/deploy-rules.yml:65, the header claims this "closes that class permanently," but Vercel still ships the client instantly while this job spends minutes on npm ci and emulator tests before deploying, and a post-merge `test:rules` failure blocks the deploy entirely, recreating the exact client/rules drift (new client, old rules, applicants rejected) until a human acts on the paged issue. | Files: (none cited) | PR: #266 | Head: 1d19918e05e4c3f1a5a760f430dad4ec45750530

<!-- fable-routed PR #266 head 1d19918e05e4c3f1a5a760f430dad4ec45750530 -->

- [ ] LOW: [SUPPLY-CHAIN-SURFACE] package-lock.json:14207, the dev-only eslint cache chain jumped several majors (file-entry-cache 8→11, flat-cache 4→6, keyv 4→5) and pulls in roughly eight brand-new small transitive packages (hookified, hashery, qified, cacheable, @cacheable/_, @keyv/_), expanding the install-time attack surface; a compromised or yanked release of any of them would execute in CI and on every dev machine at npm install even though none ship to production. | Files: package-lock.json | PR: #274 | Head: 712726a7467d5150bf3e3148a274bdcfa57179f1

<!-- fable-routed PR #274 head 712726a7467d5150bf3e3148a274bdcfa57179f1 -->

- [ ] LOW: [compat] lighthouserc.js:1, the config uses `export default` in a `"type": "module"` package but `@lhci/cli` loads rc files via `require()`, which only works on Node ≥22.12, a maintainer running `npx @lhci/cli autorun` locally on Node 20 gets ERR_REQUIRE_ESM and the check crashes before collecting anything; naming it `lighthouserc.cjs` avoids this. | Files: lighthouserc.cjs | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a
- [ ] LOW: [config] .github/dependabot.yml:12, GitHub deprecated and stopped honoring the `reviewers` key in dependabot.yml (mid-2025, replaced by CODEOWNERS), so both `reviewers: hellosurbhi` entries are silently ignored and Dependabot PRs arrive with no review request, undermining the intended safety net. | Files: .github/dependabot.yml | PR: #263 | Head: 9445035d1a97d7a4fcead117d1ee9e3f85f1564a

<!-- fable-routed PR #263 head 9445035d1a97d7a4fcead117d1ee9e3f85f1564a -->

- [ ] LOW: [supply-chain] package-lock.json:19773, the build now depends on several immature pre-1.0 native-binary packages (satteri 0.9.3 under the third-party @bruits scope, @astrojs/compiler-binding 0.2.3, rolldown 1.1.3, plus am-i-vibing/process-ancestry), all are pinned with npm integrity hashes and add no new install scripts, which is good, but 0.x native code now sits in the critical path of every page build. | Files: package-lock.json | PR: #262 | Head: 3e3869f442fdef6c7990419862bb1f2a3ea95314

<!-- fable-routed PR #262 head 3e3869f442fdef6c7990419862bb1f2a3ea95314 -->

- [ ] LOW: [correctness] tests/smoke/critical-flows.spec.ts:62, the Playwright glob `**/api/alert-failure` does not match a URL carrying a query string (globs match the full URL including `?...`), so if `reportFailure()` ever appends params (cache-buster, version tag) the mock silently stops intercepting and the test resumes paging production on-call with fixture alerts, with no test failure to reveal it. | Files: tests/smoke/critical-flows.spec.ts | PR: #250 | Head: d64f6cc8c5e196ffbe259223c984269ac64c152f
- [ ] LOW: [correctness] src/components/apply/useApplyForm.ts:878, the ten field lengths are recomputed inline instead of reusing the `field_lengths` object already built for PostHog, so when a new form field is added (as name/instagram were in PR #244) the two copies drift and the alert email, now the only diagnosable channel in in-app browsers, reports lengths for a stale field set during exactly the kind of incident it was added to debug. | Files: src/components/apply/useApplyForm.ts | PR: #250 | Head: d64f6cc8c5e196ffbe259223c984269ac64c152f
- [ ] LOW: [process] BUGS.md:1, the PR is titled "test(sync-orders): extract and pin the order-syncable filter" but the diff contains none of that and instead ships apply-form alerting changes, smoke-test mocking, and unreviewed production-dependency bumps in package-lock.json (nodemailer 9.0.6→9.1.1 with no package.json change), so a future revert or bisect of the sync-orders work would silently drag the alerting fix and the email-sending library along with it. | Files: BUGS.md package-lock.json package.json | PR: #250 | Head: d64f6cc8c5e196ffbe259223c984269ac64c152f

<!-- fable-routed PR #250 head d64f6cc8c5e196ffbe259223c984269ac64c152f -->

- [ ] LOW: [CORRECTNESS] src/pages/api/notify-application.ts:129, real Vercel preview deployment domains for personal accounts are typically scoped like `project-git-branch-<scope>-projects.vercel.app` rather than ending exactly in `-hellosurbhi.vercel.app`, so preview-environment submissions may all 403 and origin-guard changes can't be validated before production. | Files: src/pages/api/notify-application.ts | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] LOW: [CORRECTNESS] README.md:15, the clone URL and package.json repository field point to `hellosurbhi/garam-masala-dating` while the actual repository is `hellosurbhi/garam-website`, so anyone following the public setup instructions gets a 404 on `git clone`. | Files: README.md package.json | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1
- [ ] LOW: [PROCESS] .gitignore:14, removing the `*.local` pattern (replaced only by `.env.*`) means other local-only files such as `.claude/settings.local.json` or `settings.local.json` become trackable and could be accidentally committed to the soon-public repo; the PR title "test: update notify-application tests" also materially undersells that this change ships production security rules, licensing, and doc deletions. | Files: (none cited) | PR: #242 | Head: 877aa7a1137f0f582c1b247c7ffaefdada5126d1

<!-- fable-routed PR #242 head 877aa7a1137f0f582c1b247c7ffaefdada5126d1 -->

- [ ] LOW: [TRANSITIVE-MAJOR] package-lock.json:7735, the "minor-and-patch" group silently carries transitive major upgrades, most notably @vercel/routing-utils 5.3.3→6.6.0 (plus file-entry-cache 8→11, flat-cache 4→6, keyv 4→5), so a Vercel deploy from this lockfile could emit different route/redirect config and send a previously-working redirect to a 404 without any code change in this repo. | Files: package-lock.json | PR: #276 | Head: 6b205359093f722f7f7dc03402ba2d0cf9d0227e
- [ ] LOW: [ENGINES] package-lock.json:111, jsdom's transitive deps (@asamuzakjp/css-color, @asamuzakjp/dom-selector) raise their Node floor from ^22.13.0||>=24 to ^22.22.2||^24.15.0||>=26.0.0, so a CI or local machine pinned to Node 22.13 to 22.21 or 24.0 to 24.14 can start failing the vitest/jsdom test suite (or erroring under engine-strict installs) after this merge. | Files: package-lock.json | PR: #276 | Head: 6b205359093f722f7f7dc03402ba2d0cf9d0227e

<!-- fable-routed PR #276 head 6b205359093f722f7f7dc03402ba2d0cf9d0227e -->

- [ ] LOW: [AMBIGUOUS-STATE] .claude-fixed-items.txt:1, all three entries in a file named "fixed-items" are written as unchecked `- [ ]` boxes, the same syntax BUGS.md uses for open findings, so a later automated lane (or a future session grepping for unchecked boxes) can parse these already-resolved items as open backlog and re-queue or re-fix work this PR already completed and covered with tests. | Files: BUGS.md | PR: #239 | Head: aec10cf8dd8ddaeee1d8041753375a5502190796

<!-- fable-routed PR #239 head aec10cf8dd8ddaeee1d8041753375a5502190796 -->

- [ ] LOW: [silent-failure] src/pages/api/sync-orders.ts:20, the 3-day window reasons only about "new orders" but the sync cursor is `changed_since`, which also surfaces order _changes_; a refund or cancellation landing 4+ days after a show is now permanently excluded from sync with no log or alert, so downstream Purchase data can silently diverge from Eventbrite. | Files: src/pages/api/sync-orders.ts | PR: #237 | Head: f62d213fa80cfc021cd74a7884030dd6226f3756
- [ ] LOW: [contract] src/data/events.ts:493, the PR is titled "docs(bugs): queue Upstash rate-limit timeout" but the diff changes production behavior, two `ticketSource` data flips and new sync-eligibility logic in sync-orders.ts, so the merge record misrepresents a behavior change as documentation and anyone triaging by commit title will miss it. | Files: src/data/events.ts | PR: #237 | Head: f62d213fa80cfc021cd74a7884030dd6226f3756
- [ ] LOW: [docs] CHANGELOG.md:8, the new changelog entry states "No existing test coverage exists for sync-orders.ts" while this same PR adds src/pages/api/_tests/sync-orders.test.ts covering it, leaving a self-contradictory record (and BUGS.md's MISSING-COVERAGE pointer now stale on merge). | Files: BUGS.md CHANGELOG.md | PR: #237 | Head: f62d213fa80cfc021cd74a7884030dd6226f3756

<!-- fable-routed PR #237 head f62d213fa80cfc021cd74a7884030dd6226f3756 -->

- [ ] LOW: [race] src/lib/leadSubmission.ts:69, the `controller.signal.aborted` check runs after the response and JSON are fully read, so a request completing right at the 20-second boundary (abort fires between body-read completion and the check) is reported as "The connection timed out" despite a successful server write, the visitor retries and a duplicate lead is created. | Files: src/lib/leadSubmission.ts | PR: #279 | Head: 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f
- [ ] LOW: [silent-failure] src/utils/photoUploads.ts:58, waitForPhotoUpload never attaches then/catch to the UploadTask thenable, so `task.cancel()` on an idle/max timeout (or a natural upload error) rejects the task's internal promise with no handler, an unhandled promise rejection per failed photo that can trip global onunhandledrejection reporting or crash strict test runners. | Files: (none cited) | PR: #279 | Head: 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f
- [ ] LOW: [contract] src/components/apply/useApplyForm.ts:711, reportFailure for a partial photo failure now runs after addDoc but before the submitted state is set, and reportFailure itself was not hardened in this PR, if it throws, the outer catch reports stage "submit" and shows the applicant an error even though the application document was written, inviting a duplicate re-submission. | Files: src/components/apply/useApplyForm.ts | PR: #279 | Head: 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f
- [ ] LOW: [test-coverage] tests/smoke/critical-flows.spec.ts:18, the beforeEach route only intercepts same-origin POSTs matching `**/api/**`, but the Apply form writes via the Firebase SDK to firestore.googleapis.com/firebasestorage hosts which this glob never matches, the comment's claim that "fixture submissions cannot create leads" still depends entirely on the separate Firebase mock whose breakage caused the original incident, so a repeat of that breakage against production writes a real application document. | Files: tests/smoke/critical-flows.spec.ts | PR: #279 | Head: 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f

<!-- fable-routed PR #279 head 4d40c675c54c24f8c3a2f553ddd9cbd282583b3f -->

- [ ] LOW: [engines] package-lock.json:113, several dev-side transitive packages (`@asamuzakjp/css-color@7`, `@asamuzakjp/dom-selector@9`, `w3c-xmlserializer@6`, `html-encoding-sniffer@7`, `stream-chain@4`) tightened their Node engine floors to `^22.22.2 || ^24.15.0 || >=26.0.0`, so a CI or dev machine on an older Node 22/24 patch line will fail `npm ci` under engine-strict (or spray EBADENGINE warnings and risk jsdom test-suite breakage) even though nothing in the repo's own code changed. | Files: package-lock.json | PR: #277 | Head: b7fbe1b586886408ed0dbcd0915995b24bf3e90c
- [ ] LOW: [transitive-majors] package-lock.json:20537, despite the "minor-and-patch" label this bump swaps in major-version rewrites of dev-tool transitives (`stream-json` 1→3 and `stream-chain` 2→4 inside firebase-tools, `csv-parse` 5→7, `file-entry-cache` 8→11 / `flat-cache` 4→6 with an entirely new `cacheable`/`keyv@5` stack inside eslint), so a firebase-tools operation that streams JSON (e.g. emulator data import/export used by the rules test setup) or eslint's on-disk cache could behave differently on the next run with no source change to explain it. | Files: package-lock.json | PR: #277 | Head: b7fbe1b586886408ed0dbcd0915995b24bf3e90c

<!-- fable-routed PR #277 head b7fbe1b586886408ed0dbcd0915995b24bf3e90c -->

- [ ] LOW: [STALE-POINTER] BUGS.md:15, the new CRITICAL entry cites "BUGS.md records at line 24" using pre-insertion numbering, but the entry's own four added lines shift that text to line 28 on merge, so a fixer or reviewer following the pointer lands on the wrong line of the file the entry itself lives in. | Files: BUGS.md | PR: #286 | Head: 9b8123ef1fa84560c13239b388e1f7c29e5f29ec
- [ ] LOW: [STALE-POINTER] ENHANCEMENTS.md:1440, the allowed-origin entry references "the HIGH at BUGS.md:14", a line number this same PR invalidates by inserting four lines above that entry in BUGS.md, so the cross-reference points at the wrong entry the moment both files merge together. | Files: BUGS.md ENHANCEMENTS.md | PR: #286 | Head: 9b8123ef1fa84560c13239b388e1f7c29e5f29ec
- [ ] LOW: [PROD-DATA-POLLUTION] ENHANCEMENTS.md:1438, the Kit-removal entry's Verify step "a signup through the homepage form still writes its lead document" specifies no emulator or test environment, so an overnight fixer executing it literally would submit a fake signup against production and plant a fabricated lead in the real leads collection. | Files: ENHANCEMENTS.md | PR: #286 | Head: 9b8123ef1fa84560c13239b388e1f7c29e5f29ec

<!-- fable-routed PR #286 head 9b8123ef1fa84560c13239b388e1f7c29e5f29ec -->

- [ ] LOW: [validation-gap] src/lib/markets.ts:360, citySlugIndex is built with plain `Map.set` and no duplicate check or test, so a future hand-edit listing the same citySlug under two markets makes the later market silently win, recreating the exact coin-flip failure the alias ambiguity pinning was built to prevent. | Files: (none cited) | PR: #285 | Head: 6973b223eddd04060496b314ecaa64e7e621a539
- [ ] LOW: [silent-failure] src/lib/markets.ts:545, a record carrying only `geoCity` (no typed city, no coordinates) is never consulted as a signal and returns the reason "no city, source city or coordinates on this record", which both discards a usable low-confidence bucket and misdescribes the record on the needs-a-city dashboard. | Files: (none cited) | PR: #285 | Head: 6973b223eddd04060496b314ecaa64e7e621a539

<!-- fable-routed PR #285 head 6973b223eddd04060496b314ecaa64e7e621a539 -->

- [ ] LOW: [validation] firestore.rules:62, `marketConfidence` and `marketSource` are accepted on a lead that has no `market` key at all (each field is independently optional with no cross-field check), so orphaned confidence/provenance values can land in documents and any downstream consumer that treats "has marketConfidence" as "has a market" will misbehave; the tests even exercise this shape (the `src-${i}` loop writes marketSource without marketConfidence) but never the market-absent case as a rejection. | Files: firestore.rules | PR: #284 | Head: b0afac086d991c6e89bb3470d25ab8c8450f89d9

<!-- fable-routed PR #284 head b0afac086d991c6e89bb3470d25ab8c8450f89d9 -->

- [ ] LOW: [seo] src/pages/cities/[slug].astro:23, unknown city and event slugs now return a 302 redirect to /404 instead of a real 404 status (same pattern in events/[slug].astro:44), so crawlers treat dead URLs as temporary moves and keep stale pages indexed. | Files: (none cited) | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7
- [ ] LOW: [misleading-error] src/pages/api/admin/email/import.ts:90, the catch-all maps transient Firestore/server failures to a 400 "Correct the file and retry" message, telling the admin a valid prepared file is broken when the storage backend merely hiccuped. | Files: (none cited) | PR: #306 | Head: 9d690de1422451bcbd7d42e76c45c26a48aba4a7

<!-- fable-routed PR #306 head 9d690de1422451bcbd7d42e76c45c26a48aba4a7 -->

- [ ] LOW: [CONFLICT] package-lock.json:519, @astrojs/react 7.1.0 declares optional peer oxc-transform-react ^0.145.0 while @vitejs/plugin-react 6.1.2 declares ^0.152.0, disjoint 0.x caret ranges that cannot both be satisfied, so any future attempt to adopt the oxc transform path hits an unresolvable dependency error. | Files: package-lock.json | PR: #305 | Head: 480c968ea5f120a4b15ac0f75a9b445d257c738d

<!-- fable-routed PR #305 head 480c968ea5f120a4b15ac0f75a9b445d257c738d -->

- [ ] ENHANCEMENT: Shrink the ~150 MB `_astro` build output so each production deploy stores less | Why: each deploy is ~207 MB (`_astro` 150 MB, `cities` 13 MB, `journal` 11 MB, functions 25 MB), which is what filled the Vercel 10 GB free tier | Files: astro.config.mjs, public/** | Plan: list the largest files in `dist/client/_astro`, find what imports them (images, bundled data), move heavy assets to compressed formats or external storage, rebuild and compare sizes | Verify: `du -sh dist/client/_astro` drops materially and the site renders unchanged
