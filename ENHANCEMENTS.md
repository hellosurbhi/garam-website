# Enhancements Backlog

Items from the GMD website audit checklists (site audit, codebase cleanup, conversion audit, mobile audit) that need content, design decisions, or external work. Sorted by impact.

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

### `checkout_started` / `ticket_purchased` — Eventbrite conversion tracking

**Priority:** Medium
**Status:** Blocked — requires Eventbrite API access

Checkout and purchase happen on Eventbrite's domain. Three options:

**Option A: Eventbrite Webhook (recommended)**

Set up an [Eventbrite webhook](https://www.eventbrite.com/platform/api#/reference/webhooks) for `order.placed` events. Create a serverless function at `/api/eventbrite-webhook` that:

1. Receives the webhook payload (event ID, order details, attendee info)
2. Forwards to PostHog server-side via `posthog-node` SDK
3. Correlates with PostHog distinct ID via the `aff=garamsite` param or email match

Requires: Eventbrite API key + Organization ID.

**Option B: UTM attribution (passive, already working)**

Eventbrite URLs already include `aff=garamsite`. Eventbrite's own analytics dashboard shows conversions by affiliate tag: Eventbrite dashboard → Marketing → Tracking Links.

**Option C: Eventbrite Tracking Pixel**

Eventbrite supports a [conversion tracking pixel](https://www.eventbrite.com/support/articles/en_US/How_To/how-to-use-conversion-tracking) for checkout page tracking. Limited — only shows someone started checkout from your site, not full purchase details.

### Twitter/X pixel: move from GTM-only to direct code

**Priority:** Medium
**Status:** Needs implementation

The Twitter/X pixel currently fires only through GTM (`GTM-KQCBBL2W`). Chrome's Enhanced Tracking Protection blocks `static.ads-twitter.com` client-side regardless of whether the script tag comes from GTM or direct code, but moving it to a dedicated `twitter-pixel.astro` component (same deferred `requestIdleCallback` pattern as `meta-pixel.astro`) gives:

- Reliable PageView on every page load independent of GTM initialization timing
- A `twq('event', 'Purchase', {...})` call in the Eventbrite `onOrderComplete` callback in `tickets.astro` (hook already exists)
- Source of truth in version control rather than GTM UI

**Files to touch:**

- `src/components/twitter-pixel.astro` — new component, same shape as `meta-pixel.astro`
- `src/layouts/BaseLayout.astro` — import and render alongside PostHog/GTM/Meta
- `src/pages/tickets.astro` — add `twq('event', 'Purchase', { value, currency, event_id })` in `onOrderComplete`

Requires: Twitter Ads pixel ID (found in Twitter Ads dashboard under Tools > Conversion Tracking).

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

## Lead Attribution Follow-ups (2026-04-10)

Surfaced while fixing the `tickets-notify` source-per-city attribution. Both items were deliberately deferred out of that change because their blast radius is larger than the one-file fix deserved. Execute these in their own atomic PRs.

### Geo fetch race condition in `bootstrapGeoData()`

**Priority:** Medium
**Status:** Needs implementation

`src/lib/leadAttribution.ts` (around lines 75 to 92) fires `fetch("/api/geo")` as a fire-and-forget call from `bootstrapGeoData()`, which is invoked by `bootstrapLeadAttribution()` on page load via `BaseLayout.astro` (around line 116 in the body-tail script). The response populates `sessionStorage` keys `gmd-geo-city`, `gmd-geo-region`, `gmd-geo-country`, `gmd-geo-latitude`, `gmd-geo-longitude`, `gmd-geo-timezone`, gated by `gmd-geo-fetched`. `buildLeadAttribution()` reads those keys synchronously (around lines 147 to 164) and silently omits any that are missing.

**The bug:** a user who submits any lead form (Spice List on any page, tickets-notify modal on `/tickets`, apply page) within roughly 100 to 200 milliseconds of page load can win the race and write a Firestore lead before the geo response lands. Those leads end up with no `geoCity`, `geoRegion`, `geoCountry`, `geoLatitude`, `geoLongitude`, or `geoTimezone` fields even in production, which silently corrupts any funnel or attribution that depends on geo.

**Fix:** track the in-flight fetch promise at module scope and let `buildLeadAttribution` await it. This makes `buildLeadAttribution` async, which ripples through the callers listed below.

**Implementation steps:**

1. In `src/lib/leadAttribution.ts`, add a module-level `let geoFetchPromise: Promise<void> | null = null;`.
2. Rewrite `bootstrapGeoData()` to populate `geoFetchPromise` the first time it is called and return early on subsequent calls. Set it back to `null` only on error so a retry is possible.

   ```ts
   let geoFetchPromise: Promise<void> | null = null;

   function bootstrapGeoData() {
     if (sessionStorage.getItem(GEO_FETCHED_KEY)) return;
     if (geoFetchPromise) return;

     geoFetchPromise = fetch("/api/geo")
       .then((res) => (res.ok ? (res.json() as Promise<GeoResponse>) : null))
       .then((geo) => {
         if (!geo) return;
         if (geo.city) sessionStorage.setItem(GEO_CITY_KEY, geo.city);
         if (geo.region) sessionStorage.setItem(GEO_REGION_KEY, geo.region);
         if (geo.country) sessionStorage.setItem(GEO_COUNTRY_KEY, geo.country);
         if (geo.latitude)
           sessionStorage.setItem(GEO_LATITUDE_KEY, geo.latitude);
         if (geo.longitude)
           sessionStorage.setItem(GEO_LONGITUDE_KEY, geo.longitude);
         if (geo.timezone)
           sessionStorage.setItem(GEO_TIMEZONE_KEY, geo.timezone);
         sessionStorage.setItem(GEO_FETCHED_KEY, "1");
       })
       .catch((err) => {
         console.error(err);
         geoFetchPromise = null; // allow a retry next time
       });
   }
   ```

3. Change `buildLeadAttribution` to `async` and await `geoFetchPromise` before reading the geo session-storage keys, capped by a timeout so a slow `/api/geo` never blocks lead writes forever:

   ```ts
   export async function buildLeadAttribution(params: {
     source: string;
     sourceCitySlug?: string;
   }): Promise<LeadAttribution> {
     bootstrapLeadAttribution();
     if (geoFetchPromise) {
       await Promise.race([
         geoFetchPromise,
         new Promise<void>((resolve) => setTimeout(resolve, 1500)),
       ]);
     }
     // rest unchanged
   }
   ```

4. Update all callers to `await` the new async function. As of 2026-04-10 these are:
   - `src/components/home/HomeSignup.astro`: email and phone submit handlers. Both are already inside `async` submit callbacks, so add `await`.
   - `src/components/NotifyModal.astro`: email and phone submit handlers. Both already `async`, add `await`.
   - `src/components/ApplyPage.tsx`: search for `buildLeadAttribution(` in this file, wrap in `await`, and mark the containing React submit handler `async` if it is not already.
   - Anywhere else `grep -rn "buildLeadAttribution(" src/` finds a caller.
5. Update `src/lib/leadAttribution.test.ts`. The existing suite tests a synchronous `buildLeadAttribution`. Convert the relevant assertions to `await buildLeadAttribution(...)` and add one new test that mocks a slow `/api/geo` via `global.fetch = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ city: "NYC" }) }), 50)))` and asserts the awaited call returns `geoCity: "NYC"` instead of `undefined`. Add one more test asserting the 1500 ms timeout cap by making the mock never resolve and asserting the call still returns with geo fields absent rather than hanging.
6. Verification: run `npm run test`. Hit `/tickets` in a production-like preview deploy, submit a notify lead immediately after page load, confirm the Firestore doc includes all six `geo*` fields.

**Files to touch:**

- `src/lib/leadAttribution.ts`: module-level promise, async `buildLeadAttribution`, `Promise.race` timeout.
- `src/lib/leadAttribution.test.ts`: convert to async, add two new tests.
- `src/components/home/HomeSignup.astro`: `await` both submit handlers.
- `src/components/NotifyModal.astro`: `await` both submit handlers.
- `src/components/ApplyPage.tsx`: `await` wherever `buildLeadAttribution` is called.

### Dev-mode fallback for `/api/geo`

**Priority:** Low
**Status:** Needs implementation

`src/pages/api/geo.ts` reads Vercel's `x-vercel-ip-*` headers, which do not exist on the local Astro dev server. As a result every localhost test of any lead form writes a Firestore doc with zero `geo*` fields, which makes it impossible to verify the geo plumbing end-to-end in dev and causes repeated confusion ("why is my lead doc missing metadata?"). This was the exact cause of the 2026-04-10 tickets-notify question.

**Fix:** when running under `import.meta.env.DEV`, fall back to a static mock (or a public IP geolocation service) so the dev experience matches production.

**Implementation steps:**

1. In `src/pages/api/geo.ts`, after the header reads, detect the all-undefined case and check `import.meta.env.DEV`.
2. When both conditions hold, pick one of:
   - **Option A, preferred, no network dependency:** return a hardcoded static mock that mirrors the shape Vercel would return. Keeps the dev experience offline-friendly.

     ```ts
     const allEmpty = Object.values(geo).every((v) => !v);
     if (allEmpty && import.meta.env.DEV) {
       return new Response(
         JSON.stringify({
           city: "New York",
           region: "NY",
           country: "US",
           latitude: "40.7128",
           longitude: "-74.0060",
           timezone: "America/New_York",
         }),
         {
           status: 200,
           headers: {
             "Content-Type": "application/json",
             "Cache-Control": "no-store",
           },
         },
       );
     }
     ```

   - **Option B, live data, needs network:** call `https://ipapi.co/json/` from the server, map the response fields to the existing shape, and return that. Free tier is rate-limited to 1000 per day, fine for dev. Add a fetch timeout so it does not hang the dev server if ipapi is down.

3. Make sure the fallback is only active when `import.meta.env.DEV` is true, so production never accidentally reads a mock. Add a unit test, or at least a manual smoke step, that asserts the production path still returns the Vercel headers unchanged.
4. Verification: `npm run dev`, open any page, submit a lead form, confirm the resulting Firestore doc now contains `geoCity: "New York"`, etc.

**Files to touch:**

- `src/pages/api/geo.ts`: add the DEV fallback branch.

**Trade-offs:**

- Option A is simpler and deterministic but always returns the same fake NYC values in dev, which can mask bugs where attribution uses the wrong field.
- Option B is more realistic but adds a network dependency and rate limit. Pick A unless you specifically need real geo in dev.

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

- **Why:** The initial rewrite landed only part of the visual refresh. Key placements are still missing: hero background photo, Experience section proof image, testimonial accent image, upgraded creator portraits, and journal cupid art.
- **How:** Use the optimized photo set from the audit and finish the remaining placements section by section, verifying desktop/mobile composition after each pass.

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
- **Current state:** Not referenced in any npm script or GitHub workflow. `scripts/organize-images.js` IS used via `npm run images:organize`.
- **Action:** Check if this is run manually. If not, delete it.

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

# Enhancements

Future improvements that are logged but not currently prioritized.

---

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

| 1 | `src/pages/apply.astro` + `ApplyPage.tsx` | React island hydrates after static HTML → form renders below a blank stub | Add height-reserving CSS skeleton in `apply.astro` Astro shell; switch to `client:visible` |
| 2 | `src/components/admin/ApplicantModal.tsx` | Error message inserted above form fields when validation fires → shifts fields down | Reserve space with `min-height` on the error container; always render it (empty), toggle visibility only |
| 3 | `src/pages/apply.astro` (photo upload) | Photo thumbnail appears after upload → section height changes | Pre-reserve thumbnail slot with a fixed-size placeholder div before upload completes |
| 4 | `src/pages/apply.astro` (nomination section) | Nomination fields revealed via `data-reveal` / `hidden` toggle → content below shifts | Use `max-height` / `overflow: hidden` transition instead of `hidden` attribute; reserve max possible height |
| 5 | `src/hooks/useGeoData.ts` → apply form geo dropdowns | State dropdown populates after country selected → city dropdown appears after state → double CLS cascade | Render all three dropdowns always (empty/disabled state); never insert new DOM nodes on selection |
| 6 | Apply page terms modal | `document.body` scroll-lock (`overflow: hidden`) removes scrollbar → body shifts right | Add `padding-right: var(--scrollbar-width)` to body when locking; measure with `window.innerWidth - document.documentElement.clientWidth` |
| 7 | Any `<dialog>` open (NotifyModal, RequestCity, etc.) | Same scroll-lock issue as above | Same fix — apply scrollbar-width compensation on `dialog.showModal()` |

### MEDIUM — Address in next polish pass

| 8 | `src/components/admin/AdminDashboard.tsx` | "Deleted" toggle reveals replacement text → row height changes | Reserve row height; use `opacity`/`pointer-events` toggle instead of content replacement |
| 9 | `src/components/admin/AdminDashboard.tsx` | Loading spinner replaced by content on fetch complete → height jump | Render skeleton rows with fixed heights matching content rows |
| 10 | `src/pages/contestant-prep.astro` | Gender-reveal section animates in via JS → pushes content below | Pre-reserve section height; use transform/opacity animation only (no height change) |
| 11 | Any admin modal | Same scroll-lock body-shift as item 6 | Same scrollbar-width fix |

### LOW — Nice to have

| 12 | `src/layouts/BaseLayout.astro` skip-link | Skip-link rendered `position: absolute` shifts to `fixed` on focus → minor repaint | Use `position: fixed` always with negative `top` offset; transition `top` on focus |
| 13 | `src/components/home/HomeShows.astro` + `HomeStats.astro` etc. | `data-reveal` adds `.revealed` class via IntersectionObserver → opacity + translateY transition | Already progressive-enhancement (only active if JS+IntersectionObserver available) but translateY can cause subpixel repaints on some browsers; switch to `will-change: transform` on observed elements |

### Already fixed in this branch

- Email form step transitions (HomeSignup, popup, NotifyModal, city notify) — wrapped in `min-height` containers (220–260px) so step 1→2 swap never shifts content below.

---

add A press page with design packet and photos and stuff for the press inquiry

## Later Later

Low-priority ideas that only make sense at significant scale. Revisit when the product warrants it.

### International phone input with country selector

**Logged:** 2026-04-08

Right now we accept any phone number and auto-format US numbers to E.164 (`+1XXXXXXXXXX`). International numbers are stored as-is with basic digit cleanup. This works fine at current scale.

When we start actually texting international numbers (via Twilio/MessageBird/etc.), add a proper country-code dropdown + phone input that validates per-country format. Packages like `react-phone-number-input` or `intl-tel-input` handle this well — country flag dropdown, auto-formatting, per-country length validation.

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

## Auto-open PR on push (2026-07-02)

Every push to a feature branch should immediately open a PR on GitHub (draft is fine). The current rule in `~/.claude/CLAUDE.md` says "when the task is complete" which is soft and easy to skip. This is how `fix/csp-twitter-connect-src` sat local for six weeks with no PR.

Options to evaluate:

1. Strengthen CLAUDE.md wording: move the rule into Non-Negotiable Safety Rules with explicit `gh pr create --fill --draft` command.
2. Local git `post-push` hook: runs `gh pr create --fill --draft` automatically when no PR exists on the current branch.
3. Claude Code `Stop` hook in `~/.claude/settings.json`: checks for pushed-but-unopened branches at end of every turn.

---

## Triage stale PR #16 `bugs` (2026-07-02)

PR #16 (`bugs` branch) has been open since May 2026 with 66 commits covering contestant-portal work, security hardening, CSP migration, and various bug fixes. Currently in CONFLICTING state against main. Contestant-prep still exists in the codebase, so this branch has real work worth reviewing.

Suggested approach: rebase the branch, then split into smaller PRs by topic (portal, security hardening, CSP migration, individual bug fixes) rather than trying to land 66 commits as one PR.

---

## Clean up already-merged local and remote branches (2026-07-02)

Twelve local branches whose PRs are already merged still exist and clutter `git branch -a`:

- `chore/americas-number-one-copy` (PRs #53, #60)
- `chore/fix-types-node-pin` (PR #54)
- `fix/presale-duplicate-show` (PR #52)
- `fix/nomination-wording-phone` (PR #51)
- `chore/deps-bump-june-2026` (PRs #42-#45)
- `feat/dc-aug30-show` (PR #41)
- `feat/may31-nyc-show` (PR #28)
- `feat/nyc-show-jun7` (PR #30)
- `feat/nyc-show-aug2` (PR #29)
- `feat/remove-contestant-prep` (PR #31)
- `feat/city-winery-jul26` (PR #32)
- `fix/pipeline-audit` (PR #33)

Delete via `git branch -D <name>` (use `-D` because squash-merges leave the branch unreachable) and `git push origin --delete <name>` for remote counterparts. Verify each against `gh pr list --state merged` before deleting.
