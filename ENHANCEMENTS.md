# Enhancements Backlog

Items from the GMD website audit checklists (site audit, codebase cleanup, conversion audit, mobile audit) that need content, design decisions, or external work. Sorted by impact.

## Critical (Needs Content Assets)

### Replace placeholder photo gallery with real show photos
- **File:** `src/components/home/HomePhotos.astro`
- **Why:** Line 17 literally says "Your photos go here" with gradient color blocks. This is the #1 conversion killer — visitors need visual proof the show is real, packed, and fun.
- **How:** Replace the `photos` array (lines 2-11) with real image paths. Need 6-8 photos: on-stage moments, crowd energy, host reactions, matched couples. Use AVIF/WebP with `<picture>` elements.

### Add video section on homepage
- **Why:** Site claims "10M+ Views" but embeds zero videos. A 60-second clip converts more skeptics than 1,000 words of copy.
- **How:** Create `src/components/home/HomeVideo.astro` with YouTube facade pattern (thumbnail + play button, load iframe on click). Position between Experience and Shows sections. Add VideoObject JSON-LD.

## High Impact

### CTAs after Experience, FAQ, and Creators sections
- **Files:** `src/components/home/HomeExperience.astro`, `HomeFAQ.astro`, `HomeCreators.astro`
- **Why:** All three sections build conviction then give visitors nowhere to go. The FAQ section especially — those are high-intent buyers overcoming objections.
- **How:** Add centered "Get Tickets" button + secondary "Apply" link after each section's content. Design decision needed on styling.



### Optimize surbhi.png to AVIF/WebP
- **File:** `public/images/surbhi.png` (595 KB)
- **Why:** Only host photo without modern format. AVIF version would be ~30KB.
- **How:** Run through squoosh.app or `sharp` to generate surbhi.avif and surbhi.webp. Update references in HomeCreators.astro and hosts.astro.

### GTM delayed loading for Lighthouse boost
- **Why:** GTM, Meta Pixel, PostHog all load synchronously in `<head>`. Delaying by 2s or firing on first user interaction can boost Lighthouse performance score by 10-15 points.
- **How:** Set up a "Window Loaded + 2 seconds" trigger in GTM for all tracking tags. Or lazy-load the GTM snippet itself with `requestIdleCallback`.

### FAQ conversion to HTML5 details/summary
- **File:** `src/components/home/HomeFAQ.astro`
- **Why:** Google may not fully index FAQ answers that are JS-toggled via `display:none`/`grid-template-rows: 0fr`. Native `<details>/<summary>` is fully indexable even when collapsed.
- **How:** Replace the JS accordion with styled `<details>` elements. Will need CSS work to preserve the current smooth animation (CSS `interpolate-size: allow-keywords` or `content-visibility`).

### Add video section with facade pattern
- **Why:** Pages with show footage increase time-on-page by ~88%. Currently no video anywhere on the site.
- **How:** Add a section between testimonials and FAQ. Use thumbnail + play button, load YouTube iframe only on click. See `src/components/home/HomeExperience.astro` for placement reference.

## Medium Impact

### IMDb listing for the show
- **Why:** Triggers Google Knowledge Panel recognition. Establishes GMD as a distinct entertainment entity.
- **How:** Create IMDb listing with: show name, seasons, episodes, Surbhi and Wyatt as hosts.

### Wikidata entry
- **Why:** Further reinforces entity recognition in Google Knowledge Graph. Disambiguates from the spice blend.
- **How:** Create Wikidata entry for "Garam Masala Dating" as a live comedy dating show.

### Google Business Profile
- **Why:** Enables local search visibility, reviews, and Knowledge Panel.
- **How:** Set up and verify at business.google.com.

### LinkedIn Company Page
- **Why:** Cross-links improve entity recognition.
- **How:** Create page at linkedin.com/company, link to garammasaladating.com.

### Tighten CSP headers
- **File:** `vercel.json`
- **Why:** Current CSP uses `*` and `unsafe-inline` everywhere. This was set permissively for tracking pixel compatibility.
- **How:** Progressively tighten by whitelisting specific domains (google-analytics.com, connect.facebook.net, etc.) instead of `*`.

### Add redirect rules for old URLs
- **File:** `vercel.json`
- **Why:** If any URLs changed during the Astro migration, old links will 404.
- **How:** Audit old sitemap vs new sitemap, add redirects for any changed paths.

## Low Impact

### Cross-browser testing checklist
- Test in: Chrome, Safari (iOS/macOS), Firefox, Samsung Internet, Instagram in-app browser
- Instagram in-app browser is highest priority — most traffic comes from IG bio link
- Check: backdrop-filter, sticky positioning, smooth scrolling, font rendering

### client:visible for ContestantPrepPage
- **File:** `src/pages/contestant-prep.astro`
- **Why:** Currently uses `client:load`. Could use `client:idle` since the page requires a password check first.
- **How:** Change to `client:idle` — minor perf improvement on a low-traffic page.

### Email popup timing optimization
- **Why:** Checklist recommends 30-second time-on-page delay (not on load, not on scroll).
- **How:** Check current popup trigger timing in index.astro and adjust if needed.

### AggregateRating schema on testimonials
- **Why:** Could trigger rich result stars in search.
- **How:** Add AggregateRating JSON-LD to the testimonials section if enough data points exist.

### Astro Content Collections for blog/journal
- **Why:** Blog data is currently in `src/data/journal.ts` as inline objects. Content Collections (`src/content/`) would give type-safe frontmatter, auto slug generation, and better build perf.
- **How:** Create `src/content/journal/` with .md files, define collection schema, update `[slug].astro` to use `getCollection()`.

### Astro Image component for auto-optimization
- **Why:** `astro:assets` `<Image>` auto-generates responsive sizes, converts to WebP/AVIF, adds width/height. Eliminates manual image optimization.
- **How:** Replace `<img>` tags in Astro components with `<Image>` imports. React islands would still use `<img>`.

### Shared UI components (Button, Section wrapper)
- **Why:** Buttons and section wrappers are duplicated across pages with scoped styles. A shared component would reduce drift.
- **How:** Create `src/components/ui/Button.astro` with primary/outline/white variants. Low urgency — current duplication is manageable since each page has scoped styles.

### Prettier configuration
- **Why:** ESLint handles lint rules but not opinionated formatting (trailing commas, quote style, line width). Prettier would enforce consistency.
- **How:** `npm i -D prettier`, add `.prettierrc`, add to lint-staged. Optional — ESLint `--fix` already handles most formatting.

### StructuredData component
- **Why:** JSON-LD is inlined in pages via `JSON.stringify` + `set:html`. A `<StructuredData>` component would be slightly cleaner but the current utility function approach (`buildBreadcrumbJsonLd`, `buildEventSchemas`) already works well.
- **How:** Create `src/components/StructuredData.astro` that takes `data` prop and renders the script tag. Marginal improvement.

### Remove "click empty space to go home" behavior
- **File:** `src/layouts/BaseLayout.astro` (lines 112-127)
- **Why:** Users clicking anywhere non-interactive get navigated home unexpectedly. Conversion risk — someone reading content could click whitespace and lose their place.
- **How:** Remove the click handler entirely. If back-navigation is desired, use an explicit "Back to Home" link.

### Shorten HomeCreators bios and add /hosts link
- **File:** `src/components/home/HomeCreators.astro`
- **Why:** Full bios are duplicated between home page and /hosts. Short teasers with a "Meet the Hosts" link drive users deeper.
- **How:** Truncate bios to 2-3 sentences, add CTA linking to `/hosts`.

### Vary HomeExperience h2 to reduce tagline repetition
- **File:** `src/components/home/HomeExperience.astro`
- **Why:** "NYC's #1 Live South Asian Dating Show" appears in hero, marquee, experience h2, meta title. Varying the h2 keeps copy fresh.
- **How:** Change h2 to something distinct like "How the Night Works" or "What to Expect".

### Add social proof stats near ticket CTAs
- **Why:** Stats (40+ shows, 2K+ audience) are in a separate HomeStats section far from buy buttons. Placing mini stats near ticket CTAs increases urgency.
- **How:** Add a small proof line near ticket cards in HomeShows and /tickets.

### Clean up hero image preloads if unused
- **File:** `src/layouts/BaseLayout.astro` (lines 45-62)
- **Why:** Preloads for `hero.avif` and `hero-mobile.avif` fire on home page. Verify `HomeHero.astro` actually uses these files. If not, remove to save bandwidth.
- **How:** Check HomeHero image references against preloaded paths.

### Unify FAQ content between home page and /faq
- **Why:** HomeFAQ (from `copy.ts`) and /faq page have overlapping questions with different answer wording. Duplicate FAQ JSON-LD was removed, but content divergence remains.
- **How:** Share a data source or intentionally differentiate (short on home, detailed on /faq).
