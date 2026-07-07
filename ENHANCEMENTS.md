# Enhancements

Two sections: things that require action outside the codebase, and things that require code changes.

---

## Manual Enhancements (Off-Site)

### Entity Building (AEO / Knowledge Panel)

- **Wikidata entry** — create item for "Garam Masala Dating": instance of live event series, official website, inception 2022, country US, located in NYC, genre comedy, all social links. This is the single highest-leverage AEO item. Until it exists, AI systems have no external authoritative source to anchor to.
- **IMDb listing** — show name, seasons, episodes, Surbhi and Wyatt as hosts. Triggers Google Knowledge Panel recognition and establishes GMD as a distinct entertainment entity.
- **Google Business Profile** — create as "Event planner", NYC service area. Weekly Google Posts with upcoming shows.
- **LinkedIn Company page** — create and link to garammasaladating.com. Cross-links improve entity recognition.

### Email Marketing

- **Klaviyo setup** — connect Firestore leads export to Klaviyo. Build welcome series (5 emails over 14 days: "You're in" → social proof → BTS → how it works → direct ask). Build show announcement and pre-event hype flows.

### Advertising / Pixels

- **Eventbrite Meta Pixel + CAPI** — dashboard config: add Meta Pixel ID (`1469248418329402`) + Conversions API token so Eventbrite fires `Purchase` events. Enables attribution on external checkout.
- **Twitter/X Ads pixel ID** — retrieve from Twitter Ads dashboard under Tools > Conversion Tracking. Needed before any Twitter pixel work can be done in code.
- **Google AdSense application** — apply for AdSense. Ads only go on `/journal`, `/south-asian-dating-tips`, `/cities` content pages. Never on home, tickets, apply, links, or admin.

### Revenue / Business

- **VIP ticket tier** — configure in Eventbrite: Standard $15, Priority $30, VIP $49 ("front row + early entry + meet hosts"). No code work needed. Trigger: sell out two consecutive shows at current price.
- **Sponsorship outreach** — create media kit (Canva or Figma: audience stats, show format, tiers, past sponsors, contact). Begin outreach to Dil Mil, Hinge, Bumble, Hennessy, Grey Goose, chai brands, South Asian restaurants. Trigger: build the `/sponsors` page in code first (see site enhancements below).
- **Popup incentive** — finalize the actual discount or offer before updating popup copy. The site currently says "Want Cheaper Tickets?" and "Get My Discount Code" but no real code exists. Decide: is it a percentage off, early-bird price, a specific code? Once decided, update `src/data/copy.ts` and the popup flow in `src/pages/index.astro`.

---

## Site Enhancements

### Security

- **CSP: eliminate unsafe-inline** (LOW, dedicated PR needed) — both `script-src` and `style-src` include `'unsafe-inline'`. Migration path: Astro's `experimental.csp` computes build-time hashes for inline scripts/styles. Move the `Content-Security-Policy` header out of `vercel.json` into Astro config. Touches every page's inline scripts; needs its own smoke-test pass. File: `vercel.json`, `astro.config.mjs`.
- **Firestore rules: verify admin-only reads** — audit-findings flagged that anonymous clients could potentially read the full `applications` and `leads` collections via the client SDK. Verify `firestore.rules` blocks `getDocs(collection(db, "applications"))` from unauthenticated or non-admin sessions. Add rules-unit-tests (`@firebase/rules-unit-testing`).
- **ESLint security plugin** — `eslint-plugin-security` catches `eval()`, `dangerouslySetInnerHTML`, and insecure randomness. Install: `npm i -D eslint-plugin-security`, add to `eslint.config.js`.

### SEO / Content

- **City enrichment batches 2-5** — all 307 city pages were enriched in wave 1 (2026-07-06). Batch recipe: two `sections` entries per city (real neighborhoods/venues), three extra `faqItems` (long-tail queries), no separator dashes, no Oxford commas, `renderCityText` CTA phrases intact. Add new slugs to the enriched list in `src/data/cities.test.ts`. Priority order: Batch 2 US (phoenix, denver, tampa, orlando, raleigh, charlotte, nashville, detroit, minneapolis, columbus-oh, pittsburgh, st-louis), Batch 3 Canada + UK (calgary, ottawa, montreal, edmonton, winnipeg, birmingham, manchester, bradford, wolverhampton, glasgow), Batch 4 (brisbane, perth, adelaide, canberra, auckland, singapore, dubai, hong-kong).
- **Community landing pages** — standalone pages for highest-volume communities: `/sikh-singles`, `/gujarati-singles`, `/south-asian-singles`, `/indian-dating`, `/pakistani-singles`, `/hindu-singles`, `/punjabi-singles`. Each targets "[community] speed dating", "[community] singles events", "[community] dating events" keywords. No direct SEO competition exists for event-focused variants (matrimonial sites own the matchmaking variants, not event terms).
- **Press page** — a proper press page with show photos, press kit PDF download, and press inquiry CTA. Currently there is no dedicated press page. The links page has a press section but no downloadable assets or photos.
- **Sponsorship page** — `/sponsors` or `/partner` with audience stats (250 people/week, 10M+ views, email list size), show format, tier pricing, past sponsors, and a contact form. Build before starting outreach so there is somewhere to send interested brands.
- **FAQPage schema on homepage** — `HomeFAQ.astro` renders FAQ items but the homepage emits no `FAQPage` JSON-LD. Add to `src/pages/index.astro` using the FAQ data already in `src/data/copy.ts`. File: `src/pages/index.astro`.
- **Event schema upgrade to ComedyEvent** — `src/utils/eventSchema.ts` uses `@type: "Event"`. Change to `@type: "ComedyEvent"` (officially supported, more specific, same rich results). Add `performer` array (Surbhi + Wyatt as Person types), `doorTime`, `maximumAttendeeCapacity: 250`, `typicalAgeRange: "21-"`, `isAccessibleForFree: false`.
- **Speakable schema** — add `SpeakableSpecification` to homepage and FAQ marking the most citable passages for AI voice and citation extraction.
- **Video section on homepage** — `HomeVideo.astro` exists but is hidden or conditional. Needs a real YouTube show clip URL to be effective. Once a 60-second clip is ready, add `VideoObject` JSON-LD and position the section between Experience and Shows.

### Conversion

- **Share buttons** — no share buttons exist anywhere on the site. Add a small share icon to each ticket/show card (non-sold-out only). Mobile: Web Share API opens native OS share sheet. Desktop: copy link to clipboard with toast. Fire `event_shared` PostHog event. Files: `src/pages/tickets.astro`, `src/components/home/HomeShows.astro`.
- **Eventbrite conversion tracking** — checkout and purchase happen on Eventbrite's domain. Set up an Eventbrite webhook for `order.placed` events. Create `POST /api/webhooks/eventbrite` that verifies the signature, sends a post-purchase thank-you email via Zoho SMTP, and forwards the purchase event to PostHog server-side. Requires: Eventbrite webhook config (already have `EVENTBRITE_API_TOKEN`).
- **Post-purchase thank-you page** — `src/pages/thank-you.astro` as a redirect target from Eventbrite post-purchase. Content: confirmation, show details, "Apply to be on stage", social share, email signup. Set redirect URL in Eventbrite event settings.
- **Day-before cast confirmation email** — cron job that finds contestants with `status=Cast` whose show `isoDate == tomorrow`, sends one confirmation email (venue, call time = showStartTime minus 45 minutes, producer phone), sets `confirmationEmailSentAt`. Fold into existing `cron/followups.ts` or add `cron/day-before.ts`. Files: `src/pages/api/cron/`, `src/data/emails.ts`.
- **Lead capture completeness** — every capture surface should collect email + phone + city. Current gaps: homepage popup and Spice List don't capture city; city waitlist modal and tickets city-request don't capture phone. Prefill city from `sessionStorage` `gmd-geo-city`. Files: `src/pages/index.astro`, `src/components/home/HomeSignup.astro`, `src/pages/cities/[slug].astro`, `src/pages/tickets.astro`.

### Performance / Accessibility

- **Geo fetch race condition** (`src/lib/leadAttribution.ts`) — `buildLeadAttribution()` reads geo sessionStorage keys synchronously, but the `/api/geo` fetch is fire-and-forget on page load. A user who submits a lead form within ~100-200ms of page load writes a Firestore doc with no geo fields. Fix: track the in-flight fetch promise at module scope and await it (with a 1500ms timeout cap) in `buildLeadAttribution`. Make the function async. Update all callers. Files: `src/lib/leadAttribution.ts`, callers in `HomeSignup.astro`, `NotifyModal.astro`, `ApplyPage.tsx`.
- **CLS audit (13 instances)** — HIGH priority: apply page skeleton loader (React island hydration gap), ApplicantModal error message min-height reservation, photo upload thumbnail placeholder, nomination section max-height transition, geo dropdowns always-render pattern, scrollbar-width compensation on scroll-lock. MEDIUM: admin dashboard skeleton rows, contestant prep section height reservation. LOW: skip-link position:fixed, IntersectionObserver will-change.
- **Prefetch key pages** — add `data-astro-prefetch` to Apply and Tickets nav links, or enable `prefetch: true` in `astro.config.mjs`. Eliminates visible navigation delay from the homepage.
- **surbhi.png optimization** — `public/images/surbhi.png` is 595KB. Convert to AVIF/WebP using `npm run images:optimize` or squoosh.app. Update references in `HomeCreators.astro` and `hosts.astro`.
- **Tickets page hero** — the tickets page is functionally complete but visually flat. Add a compact stage-photo banner at the top with a dark overlay. File: `src/pages/tickets.astro`.
- **Magic-byte validation for photo uploads** — `storage.rules` validates contentType and the client checks MIME type, but `contentType` is client-declared. True content inspection requires a Cloud Function on `storage.object.finalize` that reads magic bytes and deletes non-image objects. Bundle with the first real Cloud Functions work rather than standing up the toolchain just for this.
- **Twitter/X direct pixel + Conversions API** — client-side Twitter pixel fires through GTM only and is blocked by ETP/Brave/uBlock. Move to a dedicated `src/components/twitter-pixel.astro` (same `requestIdleCallback` pattern as `meta-pixel.astro`). Add server-side Conversions API call on Eventbrite `order.placed` for reliable purchase attribution. Requires Twitter Ads pixel ID and API token (see manual enhancements above).
- **Fix font sizes below 16px on interactive elements** — iOS auto-zooms inputs below 16px. Affected: `.next-show-pill` (13px), `.btn` at narrow (14px) in `HomeHero.astro`; "Tell Us Where You Are" button in `tickets.astro` (15px); "See live" CTAs in `hosts.astro` (15px); button text in `TermsModal.module.css` (15px). Bump all to minimum 16px.

### Code Quality

- **Split large components** — five files exceed the 150-line rule: `ApplyPage.tsx` (~570 lines), `AdminDashboard.tsx` (~400 lines), `useApplyForm.ts` (~367 lines), `TermsModal.tsx` (~356 lines), `ContestantPrepPage.tsx` (~301 lines). Start with `useApplyForm.ts`: extract into `usePhotoUpload`, `useFormValidation`, `useApplicationSubmit`.
- **Move hardcoded copy to data files** — HomeShows section heading and modal copy, HomeHero eyebrow/headline/subtext, HomeVideo watch text and aria-labels, HomeStats "The Numbers Don't Lie" heading, NotifyModal labels and placeholders, ApplyPage form copy, LeadCaptureModal default copy, HomePhotos labels, HomeCreators hosts array. All should live in `src/data/copy.ts` or dedicated data modules.
- **Migrate hardcoded colors to CSS variables** — `src/pages/index.astro` uses `#fff`, `#888`, `#999`, `rgba(0,0,0,...)`. `src/components/ErrorBoundary.module.css:25` uses `#666`. `src/components/ApplyPage.module.css:177` uses `#fff`. `src/components/admin/ApplicantModal.module.css` uses hardcoded rgba values for lightbox. `src/utils/reactSelectStyles.ts` has hardcoded literals throughout.
- **Refactor max-width to min-width media queries** — `HomeHero.astro` and `AdminDashboard.module.css` use `max-width` queries. Should be `min-width` (mobile-first) per CLAUDE.md rules.
- **NotifyModal cleanup** — move copy to `src/data/`, add `aria-describedby` on inputs, `role="alert"` on errors, `aria-hidden` on close SVG, reset all input state on reopen (not just the error message).
- **HomeShows cleanup** — split request-city dialog into its own component (file is over 150 lines). Add `aria-describedby` to city inputs referencing `#city-form-error`. Add `aria-hidden="true"` to close icon SVG. Replace `white` and `rgba(...)` CSS literals with tokens.
- **Apply form accessibility** — wire `aria-invalid` and `aria-describedby` on Height, Community, and Income `FieldGroup` fields. Fix FieldGroup/react-select accessibility attribute wiring.
- **instagram.ts utility** — `src/utils/instagram.ts` exports `cleanInstagramHandle()` and `instagramUrl()` with zero imports. Either wire these into `ApplicantCard.tsx` and `ApplicantModal.tsx` (which currently inline `https://instagram.com/${handle}` directly) or delete the file.
- **migrate-locations.ts** — one-time script in `scripts/` that backfills legacy freetext city records with structured fields. Run `npm run migrate:locations` (dry run first, then `-- --execute`). Delete the script and its npm entry once done.
- **organize-images directory drift** — `scripts/organize-images.js` writes the HF pool to `public/images/hf/` but committed HF assets live under `public/images/ai-art/`. Point `HF_OUT` at the correct directory or move the committed assets and update all references.
- **Stryker mutation testing for API routes** — `stryker.config.mjs` only mutates `src/**/*.ts` but API route tests have minimal edge-case coverage. Add adversarial tests (XSS payloads, malformed JSON, header spoofing). Add API routes to the mutation testing scope.
- **Reduce `!important` usage** — `src/pages/404.astro` has 15+ instances. `src/components/home/HomeVideo.astro:170-174` has 5 (may be needed for Instagram embed overrides). `src/layouts/BaseLayout.astro:295` has cursor styles. Audit each; eliminate where CSS specificity can solve it.
- **Astro Content Collections for journal/tips** — current blog data is in `src/data/journal.ts` as inline objects. Content Collections (`src/content/`) would give type-safe frontmatter, auto slug generation, and better build performance.
- **Astro Image component** — replace `<img>` tags in Astro components with `<Image>` from `astro:assets` for auto-responsive sizes, WebP/AVIF conversion, and built-in `width`/`height`. React islands still use `<img>`.

### Contestant Workflow (Deferred)

- **Day-before confirmation email** — see Conversion section above.
- **SMS reminders (Twilio)** — 24h before scheduled interview and when waiver nudge fires. Deferred until Twilio is set up and no-show rate is measurable. Trigger: no-show rate exceeds 20%.
- **Rubric-based interview scoring** — score each contestant on story, on-camera presence, prep quality, and decision confidence (1 to 5 per dimension). Store in `applications/{id}/events` subcollection. Deferred until at least 20 interviews per week and calibration data exists.
- **Multiple cal.com event types** — per-city or per-format booking URLs. Deferred until touring requires city-specific scheduling links.
- **Non-Zoho SMTP fallback** — secondary provider (Resend or SendGrid) if Zoho rate-limits. Deferred until outreach volume exceeds 50 emails/day.
- **Automated approval routing** — auto-approve contestants above a rubric threshold. Requires rubric scoring above. Deferred until 500+ total interviews with calibrated data.
