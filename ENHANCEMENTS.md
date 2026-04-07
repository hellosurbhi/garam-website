# Enhancements Backlog

Items from the GMD website audit checklists (site audit, codebase cleanup, conversion audit, mobile audit) that need content, design decisions, or external work. Sorted by impact.

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

### Shared UI components (Button, Section wrapper)
- **Why:** Buttons and section wrappers are duplicated across pages with scoped styles. A shared component would reduce drift.
- **How:** Create `src/components/ui/Button.astro` with primary/outline/white variants. Low urgency — current duplication is manageable since each page has scoped styles.

### Prettier configuration
- **Why:** ESLint handles lint rules but not opinionated formatting (trailing commas, quote style, line width). Prettier would enforce consistency.
- **How:** `npm i -D prettier`, add `.prettierrc`, add to lint-staged. Optional — ESLint `--fix` already handles most formatting.

### Unify FAQ content between home page and /faq
- **Why:** HomeFAQ (from `copy.ts`) and /faq page have overlapping questions with different answer wording.
- **How:** Share a data source or intentionally differentiate (short on home, detailed on /faq).
