# Changelog

## 120 SEO Articles + Staggered Publishing System (2026-04-06)

Major content expansion: 120 journal articles across 14 categories, publishing every 2 days from April 7 through December 2026 via automated daily rebuild.

### What changed
- **Refactored `src/data/journal.ts`** into `src/data/journal/` directory (16 files) mirroring the cities/ pattern
- **Re-dated 10 existing articles** from fake backdates to honest future dates (Apr 7-25)
- **Wrote 110 new SEO articles** targeting keywords with 500K+ monthly addressable search volume
- **Added `relatedSlugs` field** to JournalPost for cross-linking ("You might also like" section)
- **Added prev/next navigation** to article pages
- **Enabled inline HTML** in article body text for natural cross-links between articles
- **Removed Kampala** city page (not in Africa keep list)
- **Added daily rebuild cron** (.github/workflows/daily-rebuild.yml) for scheduled article publishing
- **Added monthly refresh cron** (.github/workflows/article-refresh.yml + scripts/refresh-articles.js) for dateModified freshness signals

### Article categories (110 new)
1. App Fatigue & Alternatives (8) — Dil Mil, Hinge, Muzz, Bumble reviews
2. Dating Culture & Advice (15) — telling parents, red flags, rishta culture, ABCD/FOB
3. Identity & Demographics (8) — third culture kids, NRI, LGBTQ, tech bros, divorce
4. Comedy & Entertainment (5) — NYC comedy guide, Indian Love Is Blind
5. Events & IRL Dating (5) — speed dating, meeting singles, date ideas
6. Seasonal (5) — shaadi season, cuffing season, Diwali, Holi, Valentine's
7. Matrimony Platforms (8) — Shaadi.com, BharatMatrimony, Jeevansathi, Betterhalf
8. Community Singles (4) — Sikh, Gujarati, Punjabi, Jain events
9. Bollywood & Dating (10) — gaslighting movies, breakup films, toxic heroes
10. Cross-Cultural Intros (10) — introducing partners to Indian/Punjabi/Gujarati/Tamil/Bengali parents
11. Toxic Dating Patterns (8) — gaslighting, breadcrumbing, love bombing, ghosting
12. Caste, Class & Financial (8) — dating across castes, money dynamics, career pressure
13. Arranged Marriage Deep Dives (8) — timelines, red flags, biodata, NRI complications
14. Community Deep Dives (8) — South Indian, Bengali, Pakistani, Muslim, Hindu, Bangladeshi

### Key decisions
- Every 2 days publishing schedule (not backdated) with daily Vercel deploy hook
- Articles only appear when their datePublished date arrives (SSG date filter)
- Monthly cron refreshes dateModified on articles older than 60 days for Google freshness
- Each article has 12-20 body blocks, 3-5 FAQs for JSON-LD, 2-3 inline cross-links, 2-3 relatedSlugs

---

## Add 8 SEO journal articles: Community Deep Dives

Wrote full content for all 8 articles in `src/data/journal/community-deep-dives.ts`, replacing the empty array placeholder. Articles cover the "Community Deep Dives" category — South Indian, Marathi, Bengali, Pakistani, South Asian Muslim, Hindu, Bangladeshi, and vegetarian desi dating — with Surbhi's direct and culturally specific voice.

### Articles added (slugs)
1. `south-indian-dating-culture` — Nov 17 — Tamil/Telugu/Kannada/Malayalam perspectives, sambandhi culture, thali traditions
2. `marathi-dating-practical-expectations` — Nov 19 — Maharashtrian pragmatism, Maharashtra Mandal, family dynamics
3. `bengali-dating-culture` — Nov 21 — Adda culture, food as love language, progressive norms, West Bengali vs Bangladeshi split
4. `pakistani-dating-america` — Nov 23 — Dual-world navigation, religion nuance, community judgment, hybrid app/rishta approach
5. `muslim-dating-south-asian` — Nov 25 — Halal dating, Muzz/Salams landscape, wali question, interfaith stakes
6. `hindu-dating-expectations` — Nov 27 — Caste dynamics, vegetarianism as religious practice, festival infrastructure, kundali matching
7. `bangladeshi-dating-diaspora` — Nov 29 — Tight-knit community dynamics, Bangladeshi identity distinct from Bengali/Pakistani, Liberation War context
8. `vegetarian-dating-desi` — Dec 1 — Jain vs Hindu vegetarianism, the 'will they eat my mom's food' test, non-vegetarian partner compatibility

### Structure per article
- 12–18 PostBlock items (h2/h3/p mix, always opens with p)
- 3–5 FAQs for JSON-LD schema
- metaDescription under 160 chars with primary keyword
- 2–3 natural inline cross-links to related articles
- CTA paragraph pointing to tickets page in final section
- 2–3 relatedSlugs

### Files affected
- `src/data/journal/community-deep-dives.ts` — full content written from empty array

---

## Add 8 SEO journal articles: Toxic Dating Patterns in Desi Culture

Wrote full content for all 8 articles in `src/data/journal/toxic-patterns.ts`, replacing the empty array placeholder. Articles cover the full "Toxic Dating Patterns in Desi Culture" category with Surbhi's voice, culturally specific analysis, and SEO-optimized structure.

### Articles added (slugs)
1. `gaslighting-desi-relationships` — Sep 30
2. `breadcrumbing-desi-dating` — Oct 2
3. `love-bombing-desi-culture` — Oct 4
4. `desi-situationship-trap` — Oct 6
5. `emotional-unavailability-desi-men` — Oct 8
6. `ghosting-desi-dating` — Oct 10
7. `weaponized-compatibility-family-pressure` — Oct 12
8. `comparison-culture-toxic-desi-dating` — Oct 14

### Structure per article
- 12–18 PostBlock items (h2/h3/p mix, always opens with p)
- 3–5 FAQs for JSON-LD schema
- metaDescription under 160 chars with primary keyword
- 2–3 natural inline cross-links to related articles
- CTA to Garam Masala Dating at the close
- 2–3 relatedSlugs for cross-linking

### Files affected
- `src/data/journal/toxic-patterns.ts` — full rewrite with all 8 articles

---

## Rewrite all US city H1s and titleTags to be unique (anti-doorway-page fix)

Google treats templated city pages with identical "[City]'s Desi Dating Night Is Coming" H1s and "South Asian Singles Events [City] | Garam Masala Dating" titleTags as doorway pages. Rewrote every h1 and titleTag across 6 US city data files (75 cities total) so that no two cities share the same structure.

### What changed
- **active.ts (7 cities):** Replaced 5 templated H1s and all 7 templated titleTags. Preserved the 2 already-unique H1s (Salt Lake City, Denver).
- **us-northeast.ts (15 cities):** All H1s and titleTags rewritten with unique, city-specific copy.
- **us-southeast.ts (16 cities):** All H1s and titleTags rewritten.
- **us-midwest.ts (18 cities):** All H1s and titleTags rewritten.
- **us-south-texas.ts (7 cities):** All H1s and titleTags rewritten. Includes cultural references (Hillcroft, Aggies, Keep Austin Weird).
- **us-west.ts (12 cities):** All H1s and titleTags rewritten.

### H1 format variety includes
- Questions: "Where Do Desi Singles Go in Chicago?"
- Statements: "Boston Finally Gets a Live Dating Show Worth Showing Up For"
- Cultural references: "Oak Tree Road Deserves a Dating Show" (Edison), "Green Street Has Enough Bars" (Champaign)
- Direct/playful: "Troy, Michigan Has More Desi Singles Than Your Group Chat"
- Imperative: "Stop Swiping, Seattle. Come Meet Someone in Person."
- Data-driven: "130,000 South Asians in DFW and the Dating Scene Is Still Broken"

### titleTag format variety includes
- "[City] Desi Dating Show | Garam Masala Dating"
- "[City] Indian Singles Mixer | Garam Masala Dating"
- "Live Desi Dating Night [City] | Garam Masala Dating"
- "[City] [State] Desi Singles Event | Garam Masala Dating"
- "[University] Desi Dating Night | Garam Masala Dating"

### Rules followed
- No em dashes, no double dashes
- Every H1 is unique across the entire site
- Title tags kept under 60 characters where possible
- No other fields changed (bodyParagraphs, ctas, slug, etc.)

### Files affected
- `src/data/cities/active.ts`
- `src/data/cities/us-northeast.ts`
- `src/data/cities/us-southeast.ts`
- `src/data/cities/us-midwest.ts`
- `src/data/cities/us-south-texas.ts`
- `src/data/cities/us-west.ts`

## Expand Europe cities and rewrite international-other.ts

### europe.ts: added 47 new cities (73 total)

New cities by country:
- **Netherlands (4):** Eindhoven, Delft, Groningen, Leiden
- **Germany (7):** Aachen, Stuttgart, Nuremberg, Darmstadt, Dresden, Cologne, Dusseldorf
- **Belgium (2):** Leuven, Ghent
- **Switzerland (2):** Lausanne, Basel
- **Ireland (2):** Cork, Galway
- **Portugal (2):** Porto, Braga
- **Spain (2):** Valencia, Seville
- **Italy (5):** Bologna, Turin, Padua, Naples, Florence
- **Sweden (3):** Gothenburg, Uppsala, Lund
- **Finland (2):** Tampere, Oulu
- **Norway (1):** Trondheim
- **Poland (2):** Krakow, Wroclaw
- **Czech Republic (1):** Brno
- **Hungary (1):** Budapest
- **Romania (2):** Bucharest, Cluj-Napoca
- **Bulgaria (1):** Sofia
- **Lithuania (1):** Vilnius
- **Latvia (1):** Riga
- **Slovenia (1):** Ljubljana
- **Croatia (1):** Zagreb
- **Greece (2):** Athens, Thessaloniki
- **Cyprus (2):** Nicosia, Limassol

All 26 existing cities preserved unchanged.

### international-other.ts: restructured and expanded (22 cities)

**Removed (10 cities):**
- Middle East (cut for legal/content): Dubai, Abu Dhabi, Doha, Muscat
- Moved to separate files: Singapore, KL, Bangkok, Tokyo, Seoul, Hong Kong

**Region updates:**
- NZ cities (Auckland, Wellington, Christchurch): "Asia-Pacific" to "Pacific Islands"
- Fiji/Suva: "Asia-Pacific" to "Pacific Islands"
- Caribbean cities: "Caribbean & South America" to "Caribbean"
- Africa cities: kept "Africa" (no change)

**Added (7 cities):**
- Pacific Islands: Nadi (FJ), Lautoka (FJ)
- Africa: Mombasa (KE)
- Caribbean: San Fernando (TT), Chaguanas (TT), New Amsterdam (GY), San Juan (PR)

**Files modified:**
- `src/data/cities/europe.ts`
- `src/data/cities/international-other.ts`

**Notes:**
- All regions match valid CityRegion type values
- No em dashes, double dashes, or AI slop in copy
- TypeScript and ESLint pass clean
- nearbyCities updated to reference new slugs where appropriate
- Panama City nearbyCities updated to use new Caribbean slugs instead of old Middle East refs

## Add city data for India, Southeast Asia, and East Asia

Added three new TypeScript city data files for international expansion pages.

### india.ts (46 cities)
- **Tier 1 (9):** Mumbai, Delhi, Gurgaon, Noida, Bangalore, Hyderabad, Chennai, Pune, Kolkata
- **Tier 2 (14):** Ahmedabad, Chandigarh, Jaipur, Lucknow, Kochi, Goa, Indore, Thiruvananthapuram, Coimbatore, Nagpur, Vadodara, Surat, Visakhapatnam, Bhopal
- **Tier 3 (23):** Mysore, Dehradun, Mangalore, Manipal, Amritsar, Ludhiana, Patna, Ranchi, Bhubaneswar, Raipur, Guwahati, Shillong, Pondicherry, Jamshedpur, Trichy, Vellore, Warangal, Kanpur, Allahabad, Varanasi, Jodhpur, Udaipur, Kota
- All cities: status "coming-soon", addressCountry "IN", region "India"
- CTAs: waitlist + apply with city param only (no state)

### southeast-asia.ts (6 cities)
- Bangkok (TH), Chiang Mai (TH), Ho Chi Minh City (VN), Manila (PH), Colombo (LK), Kandy (LK)
- Sri Lanka cities use "desi" framing, not "Indian"

### east-asia.ts (7 cities)
- Tokyo (JP), Osaka (JP), Nagoya (JP), Seoul (KR), Taipei (TW), Hsinchu (TW), Hong Kong (HK)
- Each has unique, location-specific body copy (~400 words, 4-5 paragraphs)

**Files created:**
- `src/data/cities/india.ts`
- `src/data/cities/southeast-asia.ts`
- `src/data/cities/east-asia.ts`

**Notes:**
- index.ts already imported these files (wired up in a previous commit)
- No em dashes, double dashes, or AI-sounding copy
- TypeScript and ESLint pass clean

## Audit implementation: SEO, conversion, mobile, resilience

### SEO meta fixes
- Fix logo URL in JSON-LD: `logo.png` (didn't exist) → `images/logo.svg`
- Add `og:site_name="Garam Masala Dating"` to all pages
- Add `twitter:site` and `twitter:creator` tags
- Add `ogType` prop to BaseLayout (default "website", blog posts pass "article")
- Blog posts get `article:published_time` and `article:modified_time` meta tags

### Conversion: direct Eventbrite links
- Show cards on homepage now link directly to each event's Eventbrite URL (was /tickets)
- "Tickets" label → "Get Tickets" with `target="_blank"`
- Removes one click from the purchase funnel

### Mobile: iOS auto-zoom prevention
- Hero `.btn`: 14px → 16px
- HomeNav `.nav-pill`: 11px → 16px
- PageNav `.page-nav-pill`: 11px → 16px
- All interactive elements now ≥16px to prevent iOS Safari auto-zoom on focus

### Resilience
- New `ErrorBoundary.tsx` wraps ApplyPage — catches React crashes and shows friendly fallback with refresh button and Instagram DM link instead of white screen

### Auto-generated sitemap
- Install `@astrojs/sitemap` integration — sitemap auto-generated at build time
- Delete stale `public/sitemap.xml` that was missing 5+ pages and had old dates

### Backlog additions
- Placeholder photo gallery, video section, section CTAs, press logos, testimonial badges, scarcity indicators, discount code preview logged in ENHANCEMENTS.md

## WCAG accessibility audit — non-visual fixes

Comprehensive accessibility pass across the entire site. Only changes that have zero visual impact on current layouts/responsiveness were applied. Visual-impact issues logged in BUGS.md.

### Landmarks & navigation
- `<main id="main-content">` added to all 15 pages (was only on index.astro)
- Skip-to-content link in BaseLayout (sr-only, visible on keyboard focus)
- `aria-label="Main navigation"` on HomeNav and PageNav

### Apply page form (ApplyPage.tsx)
- FieldGroup now links labels via `htmlFor` to matching input `id`s
- Error messages get `role="alert"` and are linked to inputs via `aria-describedby`
- Inputs get `aria-invalid` when in error state
- Required fields get HTML `required` attribute
- react-select components get `aria-label` (Country, State, City)
- Toggle buttons ("For myself" / "For a friend") get `aria-pressed`
- Success panel gets `role="status"` + `aria-live="polite"`
- Toast notification gets `role="alert"` + `aria-live="assertive"`
- Name/referrer inputs get `autocomplete="name"`
- Instagram `@` prefix gets `aria-hidden="true"`

### Admin components
- Filter selects get `aria-label` ("Filter by gender", "Filter by city")
- Deleted toggle button gets `aria-expanded` + `aria-controls`
- Loading state gets `role="status"` + `aria-live="polite"`
- Toast gets `role="alert"` + `aria-live="assertive"`
- ApplicantCard: `tabindex=0`, `role="button"`, keyboard handler (Enter/Space)
- AdminLogin: `aria-label` on inputs, `required`, `aria-invalid`, error `role="alert"`

### Misc
- Decorative SVGs in links page get `aria-hidden="true"`
- Newsletter signup step-2 and success get `aria-live="polite"`

### Logged in BUGS.md (visual-impact, deferred)
- Color contrast: `#888` and `#666` on `#FFF8F0`
- `outline:none` without focus replacement
- Social icon / modal close button touch targets below 44px
- ApplicantModal missing focus trap
- HomeShows div-as-button
- Missing `aria-current="page"` on nav
- AdminLogin missing visible labels

## Multi-page updates: apply form, tickets notify, journal/FAQ width, city signup

### Apply form
- Income ranges refined: split $100k–$200k into $100k–$150k and $150k–$200k
- Community and income fields are now optional (no longer required for submission)
- Added hint under Instagram handle: "Follow @garammasaladating and DM us for a faster response"

### Tickets page
- TBA event cards are no longer grayed out / disabled
- TBA cards now show "Notify Me" button that opens a modal to collect email
- Saves to Firebase `notifications` collection with source `tickets-notify`

### Journal + FAQ pages
- Journal card gap increased from 2px to 12px (sections were visually touching)
- Both journal and FAQ containers widened from 560px to 680px to reduce empty side margins

### City pages
- Active city pages (with upcoming events) now show a two-step email + phone signup section after the CTAs
- Pattern matches home page "Spice List" flow: email → phone → success
- Saves to Firebase `subscribers` collection with city tracking

**Files:** `src/types/application.ts`, `src/components/ApplyPage.tsx`, `src/components/ApplyPage.module.css`, `src/pages/tickets.astro`, `src/pages/journal/index.astro`, `src/pages/faq.astro`, `src/pages/cities/[slug].astro`, `test/application.test.ts`

## Fix apply page hydration errors + country selector stuck on loading

- **Hydration fix:** Changed `ApplyPage` from `client:load` to `client:only="react"` — the form uses browser APIs (`window.history`, `window.location`) that cause SSR/client mismatches. No SEO value in server-rendering a form, so skip SSR entirely.
- **Country selector timeout:** Added 5-second timeout to `useGeoData` dynamic import. Previously, if the `country-state-city` chunk hung, the selector stayed disabled with "Loading..." forever.
- **Retry on failure:** When geo data fails to load (timeout or network error), the country field now shows a "tap to retry" button instead of a permanently disabled dropdown.

**Files:** `src/pages/apply.astro`, `src/hooks/useGeoData.ts`, `src/components/ApplyPage.tsx`, `src/components/ApplyPage.module.css`

## Fix article authors, apply page polish, remove chili emoji

- All article authors changed from "Garam Masala Dating" → "Surbhi" (journal.ts: 5 posts, tips.ts: 3 posts, AuthorBio component)
- Submit button: removed chili emoji (invisible on red background), added white-space: nowrap, reduced padding
- Country field: removed "Type your country" fallback placeholder, now always shows "Select..." like other dropdowns
- Cleaned up unused `geoFailed` destructuring

## Fix nav overflow on mobile: shrink logo + tighten pills

Both navs (HomeNav, PageNav) overflowed on 320px because 160px logo + two pills + padding exceeded viewport. Shrunk mobile logo from 36px/160px to 28px/120px, pills from 13px/18px to 11px/14px padding, letter-spacing 1.5→1px. Desktop restored to full sizes via 768px breakpoint.

## Fix nav pill overflow: revert to 13px, add nowrap, tighten padding

Nav pills ("Apply" / "Get Tickets") were bumped to 16px in the mobile audit, but these are `<a>` links not form controls — iOS zoom only triggers on `<input>`/`<button>`, not anchors. Reverted to 13px, reduced horizontal padding from 22px to 18px, added `white-space: nowrap` to prevent "Get Tickets" wrapping to two lines on mobile.

**Files:** HomeNav.astro, PageNav.astro

## Mobile audit: add modal scroll support on small viewports

Added `max-height: 80vh; overflow-y: auto` to all modal inner containers so forms are scrollable on small phones (especially with keyboard open).

**Files:** index.astro (`.popup-inner`), links.astro (`.modal-inner` — consolidated from scrollable modifier), cities/[slug].astro (`.modal-inner`), HomeShows.astro (`.modal-inner` — notify + request city modals)

## Mobile audit: fix overflow, iOS zoom, touch targets, and grid layouts

Deep mobile audit fixing critical usability issues across the site (98% mobile traffic).

**P0 — Overflow fix:**
- `HomeStats.astro`: Changed stats grid from `flex-wrap: nowrap` (5 items crammed into one row) to `flex-wrap: wrap` with `flex: 0 1 33.33%` — stats now flow as 3+2 rows on mobile, single row on desktop
- Desktop breakpoint corrected from orphaned `grid-template-columns` to `flex-wrap: nowrap; flex: 1`

**P1 — iOS auto-zoom prevention (font-size < 16px on interactive elements):**
- `HomeHero.astro`: CTA `.btn` 14px → 16px
- `HomeNav.astro`: `.nav-pill` 12px → 16px
- `PageNav.astro`: `.page-nav-pill` 12px → 16px
- `HomeShows.astro`: `.ticket-label` 13px → 16px, `.modal-submit` 14px → 16px
- `HomeSignup.astro`: `.spicelist-form button` 14px → 16px
- `AdminLogin.module.css`: `.input` 15px → 16px

**P2 — Touch target fixes:**
- `HomeFAQ.astro`: `.faq-toggle` 32×32px → 48×48px (meets minimum touch target)
- `HomeShows.astro`: Added `min-height: 48px` to `.request-city button`

**P3 — Layout fixes:**
- `ApplyPage.module.css`: Added `@media (max-width: 600px)` breakpoint — `.gridTwo` and `.gridThree` collapse to single column (was 107px per column on 320px, unusable)
- `AdminDashboard.module.css`: Added mobile breakpoint — filter items go full width, header/main padding reduced, filter row wraps

**Files changed:** HomeStats, HomeHero, HomeNav, PageNav, HomeShows, HomeSignup, HomeFAQ, ApplyPage.module.css, AdminDashboard.module.css, AdminLogin.module.css

## Fix mobile horizontal overflow + update sitemap

**Mobile right-side white border fixed:**
- Added `overflow-x: hidden` to `html` selector in `src/index.css` — `body` alone doesn't prevent the root scroll container from overflowing
- Changed `max-width: 100vw` → `max-width: 100%` on all modal dialog elements (HomeShows, index.astro popup, links.astro, cities/[slug].astro) — `100vw` includes scrollbar width and can push content past viewport edge on mobile

**Sitemap updated (`public/sitemap.xml`):**
- Added `/cities/san-francisco`, `/hosts`, `/privacy`, `/terms` (all missing since addition)

## v3 UI rewrite — full design pass, new features, infrastructure cleanup

Comprehensive UI overhaul across the entire site based on iterative design feedback.

**Navigation & branding:**
- Hot-pink logo nav (PageNav) added to every page linking back to home
- Landing page nav transitions to white background with pink logo only after hero ends (pixel-perfect scroll threshold using marquee position)
- Favicon replaced with actual logo SVG in hot pink, theme-color meta tag added
- Custom cursor (hot-pink dot + trailing ring) on desktop, hidden on mobile. Enlarges on hover. Works inside dialog modals via MutationObserver. All default cursors killed site-wide with `cursor: none !important`

**Social media:**
- Added Threads, X (Twitter), Facebook URLs and SVG icons
- All 6 social platforms show in footer icons and links page social row
- JSON-LD sameAs includes all profiles for SEO

**Shows & tickets:**
- All "Get Tickets" buttons (nav, hero, show cards) link to /tickets instead of Eventbrite
- TBA events auto-generated from coming-soon cities in cities.ts (single source of truth)
- Notify Me buttons open email collection modal (Firestore)
- "Don't see your city? Request it" opens city request modal (Firestore)
- City page waitlist CTAs open email modal instead of linking to /links

**Signup & conversion:**
- Renamed HomeNewsletter to HomeSignup (not a newsletter, it's for ticket discounts)
- Two-step email-then-phone flow with Firestore on the Spice List section
- 30-second timed popup: shows every visit until email is submitted (localStorage only set after email, not on dismiss)
- Newsletter copy updated to focus on discount codes, not "subscribers"

**Pages:**
- /hosts rewritten as standalone page with unique expanded bios (not a copy of landing page section)
- Click empty background space navigates back to home (only when came from home, excluded on admin/contestant-prep)
- Admin and contestant-prep pages hide nav and footer via hideFooter prop
- Links page: removed duplicate logo, reordered links (Short form content - Instagram, Full episodes - YouTube), removed redundant social buttons

**Design polish:**
- FAQ: Cormorant Garamond font, all accordions start closed, cream callout box removed, grid transition, reduced padding
- Creators: Cormorant names, wider cards on mobile (edge-to-edge), off-white background
- Footer: increased text opacity for readability, SVG social icons
- As Seen In: real press data from press.ts, charcoal text (not grey)
- Marquee: removed "Apply Now"
- Founding year fixed from 2023 to 2022 across bio, footer, JSON-LD
- Spice List section: hot-pink background, yellow/charcoal button default, trust text spacing fixed

**Firestore:**
- New collections: notifications, city_requests, subscribers
- Firestore rules updated for all three

**Files changed:** 30+ files across components, pages, data, layouts, and public assets

## Homepage feedback fixes — 13 changes across UX, copy, and conversion

Addressed 13 pieces of user feedback from a homepage review session.

**Copy & data fixes:**
- Removed "Apply Now" from the marquee ticker
- Fixed founding year from 2023 to 2022 across bio, footer, and JSON-LD schema
- Replaced 5 fake press outlets (Time Out, Vulture, etc.) with 2 real press sources from press.ts
- Ticket buttons now link to /tickets instead of Eventbrite

**Footer improvements:**
- Replaced text social labels (IG, TT, YT) with actual SVG icons
- Increased all text opacity values for better readability on dark background
- "Meet the Hosts" now links to /hosts page instead of #about anchor
- Created shared SVG icon module (src/data/icons.ts) to deduplicate between footer and links page

**New modals:**
- Notify Me: collects email when tickets aren't yet available, auto-fills city from event card
- Request City: replaces /cities link, collects city name + email
- 30-second popup: two-step flow (email then phone), emphasizes discount codes, respects localStorage dismissal
- All three write to new Firestore collections (notifications, city_requests, subscribers)

**FAQ accordion cleanup:**
- Removed cream background callout box and pink left-border from answers
- Replaced max-height animation hack with CSS grid row transition for smoother expand/collapse

**Newsletter redesign:**
- Switched background from charcoal to hot-pink for visual separation from Creators section
- Updated copy to emphasize exclusive discount codes as main value prop
- Simplified form to email-only (popup handles phone collection)
- Inverted CTA: white button with pink text, yellow on hover

**New pages:**
- /hosts — standalone hosts page reusing HomeCreators component

**Files changed:**
- `src/components/home/HomeMarquee.astro` — removed Apply Now
- `src/components/home/HomeCreators.astro` — year fix
- `src/components/home/HomeFooter.astro` — year, readability, SVG icons, hosts link
- `src/components/home/HomePress.astro` — real press data with links
- `src/components/home/HomeShows.astro` — /tickets links, notify + city request modals
- `src/components/home/HomeFAQ.astro` — clean accordion styles
- `src/components/home/HomeNewsletter.astro` — hot-pink bg, discount copy
- `src/pages/index.astro` — founding year, 30s popup dialog
- `src/pages/links.astro` — import icons from shared module
- `src/pages/hosts.astro` — new hosts page
- `src/data/icons.ts` — shared SVG icon module
- `firestore.rules` — 3 new collections

## fix: site copy — add SF city page, update SD/LA, position as NYC's #1

Fixed nonsensical copy across the site: wrong cities in the hero eyebrow, inconsistent audience numbers, stale event references, and weak positioning.

**Copy changes:**
- Positioned the show as "NYC's #1 Live Dating Show" across hero eyebrow, experience section, FAQ, and marquee ticker
- Replaced hard-coded audience numbers (150) with generic language ("a packed house", "a live audience") since capacity varies by venue — 250 stays only in NYC-specific city page copy
- Hero eyebrow: "Season 2026 · NYC · Chicago · Edinburgh" → "NYC's #1 Live Dating Show · Now Expanding Nationwide"
- Surbhi's credits: removed Edinburgh Fringe, added "NYC · LA · SF"

**City pages:**
- Added San Francisco as a new coming-soon city (`/cities/san-francisco`)
- Updated San Diego from "past" → "coming-soon" with forward-looking copy (acknowledges sold-out March show)
- Removed stale Netflix Is a Joke Fest reference from LA page, fixed `includeEventSchema` to `false`
- Updated `citiesIndex` to include SF and SD

**Footer & tickets:**
- Replaced dead Edinburgh Fringe link with LA, SF, SD city page links
- Updated tickets page meta description to mention expansion cities

**Files changed:**
- `src/data/cities.ts` — SD status/copy, LA copy fix, new SF entry, updated index
- `src/data/cities.test.ts` — added SF to expected cities
- `src/components/home/HomeHero.astro` — eyebrow text
- `src/components/home/HomeExperience.astro` — h2, audience numbers, tone
- `src/components/home/HomeFAQ.astro` — audience numbers, positioning
- `src/components/home/HomeFooter.astro` — shows links
- `src/components/home/HomeCreators.astro` — Surbhi credits
- `src/components/home/HomeMarquee.astro` — first ticker phrase
- `src/pages/tickets.astro` — meta description

---

## feat: redesign contestant-prep page to match v3 visual language

Ported the contestant-prep page from the old dark/gold theme to the v3 light theme used on the home page.

**Visual changes:**
- Light theme: off-white background with charcoal text (was dark overlay with ivory text)
- Hot-pink accents replace gold throughout (icons, numbers, callout tints, spinner)
- Electric-yellow dividers and step numbers with text-stroke
- DM Sans body text replaces Cormorant Garamond for readability
- White cards with subtle borders replace translucent dark cards
- Error state: clean white card instead of dark glassmorphism

**Code quality:**
- Extracted all inline React styles to CSS module (`ContestantPrepPage.module.css`)
- Component reduced from 635 to ~270 lines
- Added responsive breakpoint at 768px (desktop padding bumps)
- Added `prefers-reduced-motion` support
- Uses v3 CSS custom properties exclusively (no hardcoded colors)

**Preserved exactly:** all auth logic, session management, content arrays, API integration.

**Files changed:**
- `src/pages/contestant-prep.astro` — `overlayBg` replaced with `bodyClass="home-v3"`
- `src/components/ContestantPrepPage.module.css` — new CSS module with all styles
- `src/components/ContestantPrepPage.tsx` — inline styles replaced with CSS module classNames

---

## add: 5 SEO journal posts scheduled over next 5 weeks

Added five blog posts targeting featured snippets, scheduled weekly Apr 11 through May 9:
1. "What Actually Happens at a Live Comedy Dating Show" (Apr 11) — targets "live dating show NYC"
2. "The Realest Way to Meet Desi Singles in NYC" (Apr 18) — targets "desi singles NYC"
3. "How to Get Cast on a Live Dating Show" (Apr 25) — targets "apply to be on a dating show"
4. "Best Things to Do in NYC If You're Single and Bored of Bars" (May 2) — targets "singles events NYC"
5. "Indian Matchmaking, Hinge, and a Live Comedy Show" (May 9) — targets "Indian Matchmaking vs dating apps"

All include H2 sections, snippet-ready openers, 4-question FAQPage schema, and real show details (whiteboard reveal, 250-person audience, 40+ shows, 3 couples). Posts 4 mentions UCB/Magnet/PIT, speed dating, rooftop events for editorial depth.

**Files changed:**
- `src/data/journal.ts` — 5 new posts added to journalPosts array

## add: 3 SEO-optimized journal posts with FAQPage schema

Added three blog posts targeting Google featured snippets and People Also Ask boxes:
1. "The Only Live Desi Dating Show in NYC" (desi dating show NYC, Indian dating show New York)
2. "South Asian Singles Events in NYC: What's Actually Worth Going To" (desi singles mixer NYC)
3. "Desi Dating Show vs. Dating Apps: What 4 Years of Running One Taught Me" (first-person from Surbhi)

Each post has H2 section headings, snippet-ready opening paragraphs, and a 3-question FAQ section with FAQPage JSON-LD schema. Extended PostBlock type to support "h2" and JournalPost to support optional faqs array.

**Files changed:**
- `src/data/journal.ts` — added h2 to PostBlock, JournalFaq interface, faqs field, 3 new posts
- `src/data/journal.test.ts` — updated block type assertion to include h2
- `src/pages/journal/[slug].astro` — h2 rendering, FAQPage JSON-LD, .post-h2 CSS

## update: links page email aliases

- "Booking & Press Inquiries" link now points to `press@garammasaladating.com`
- Bottom social email icon now points to `hello@garammasaladating.com`
- Apply page has no email references, no changes needed

**Files changed:**
- `src/pages/links.astro` — updated both mailto links

## fix: individual Event JSON-LD schemas with real venue data

Replaced the ItemList-wrapped Event schema on both index.astro and tickets.astro with individual `<script type="application/ld+json">` blocks per show — the format Google's Events carousel actually parses.

**Data changes (events.ts):**
- Added `EventVenue` interface with streetAddress, postalCode, addressLocality, addressRegion, addressCountry
- Added `venue` and `price` fields to EventEntry interface
- Manhattan events now reference Top Secret Comedy Club (44 Avenue A, New York, NY 10009)
- Jersey City events reference The Laugh Tour Comedy Club (555 Washington Blvd, Jersey City, NJ 07310)

**Schema changes:**
- Each upcoming show gets its own Event JSON-LD block (not wrapped in ItemList)
- Event name standardized to "Garam Masala Dating — Live Comedy Dating Show"
- Description updated to the 250-person audience version
- Location includes real venue name and street address where known
- Extracted shared `buildEventSchemas()` utility in src/utils/eventSchema.ts to eliminate duplicated schema logic between index.astro and tickets.astro

**Files:** src/data/events.ts, src/utils/eventSchema.ts (new), src/pages/index.astro, src/pages/tickets.astro

---

## update: use purpose-specific email aliases

Split `contact@` into dedicated aliases where it makes the site look more professional:
- `casting@` — application notification sender (Resend)
- `hello@` — FAQ footer "still have questions?" CTA
- `press@` — collaboration/sponsorship/media FAQ answer
- `contact@` kept for schema.org contactPoint and social links (general catch-all)

**Aliases to create:** `casting@`, `hello@`, `press@` (all @garammasaladating.com)

**Files changed:**
- `api/notify-application.ts` — from address `contact@` → `casting@`
- `src/pages/faq.astro` — footer mailto `contact@` → `hello@`, collab answer now says `press@`

## update: FAQ page — SEO-friendly accordion, new entries, updated answers

Replaced `display:none/block` JS toggling with CSS `max-height` transition so answer text is always present in the DOM for Google to index. Moved inline SVG styles to stylesheet.

Updated two answer strings ("How do I get tickets?" and "How often does the show run?") with current show details (weekly Manhattan, monthly Jersey City).

Added three new FAQ entries before the collaboration question: "Is Garam Masala Dating like Indian Matchmaking?", "What cities is Garam Masala Dating in?", "Is Garam Masala Dating free?" — all auto-included in the FAQPage JSON-LD schema.

**Files changed:**
- `src/pages/faq.astro` — accordion CSS/JS rewrite, 2 answer updates, 3 new entries

## fix: add .js extensions to relative imports in API routes

TypeScript with `node16`/`nodenext` module resolution requires explicit `.js` extensions on relative imports. Fixed in `api/generate-contestant-link.ts` and its test file.

**Files changed:**
- `api/generate-contestant-link.ts` — `./_verify-token` → `./_verify-token.js`
- `api/generate-contestant-link.test.ts` — `./_verify-token` and `./generate-contestant-link` → `.js` extensions

## fix: add style-src to CSP to restore inline styles

The permissive CSP was missing `style-src * 'unsafe-inline'`, causing the browser to block all inline styles and CSS custom properties — rendering the site in black/default colors.

**Files changed:**
- `vercel.json` — added `style-src * 'unsafe-inline'` to the CSP directive

## add: permissive Content-Security-Policy header

Added a wide-open CSP to `vercel.json` that allows all origins. Needed to enable CSP presence without blocking any third-party scripts (GTM, PostHog, Meta Pixel, etc.).

**Files changed:**
- `vercel.json` — added `Content-Security-Policy` header with `default-src *` and permissive directives

## remove: Content-Security-Policy header from vercel.json

Removed the CSP header entirely rather than continuing to patch allowed origins for each new third-party script (GTM, PostHog, Meta Pixel, etc.). The header was actively blocking analytics scripts in production.

**Files changed:**
- `vercel.json` — removed `Content-Security-Policy` header; all other security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP) remain
- `test/meta-pixel.test.ts` — removed the CSP validation test suite (3 tests); Meta Pixel component and BaseLayout tests unchanged
- `BUGS.md` — removed the open "CSP blocks GTM and PostHog scripts" bug entry (resolved by this change)

## feat: v3 SEO-optimized home page rewrite

Complete redesign of the landing page from a minimal dark hero + event list to a 13-section light-themed marketing page.

**New sections:**
- Hero with gradient blobs, eyebrow badge, and dual CTAs (Get Tickets + Apply)
- Scrolling marquee text strip
- "The Experience" — 2-column SEO content with 4 numbered steps explaining the show format
- Shows section with data-driven event cards (from events.ts) and ticket links
- Stats section (12 shows, 2K+ audience, 3 couples matched, 500K views)
- Photo grid with gradient placeholders (real images to be added)
- "As Seen In" press section
- Testimonials with 3 audience quote cards
- Creators section with host bios and schema.org Person markup
- Answer-first FAQ accordion with 5 questions
- Newsletter signup (phone + email)
- 4-column fat footer with navigation links

**SEO additions:**
- FAQPage JSON-LD schema for rich results
- Keywords meta tag targeting NYC live dating show queries
- Rich below-fold content for crawlers

**Architecture:**
- 13 Astro components in `src/components/home/` (one per section)
- `bodyClass` prop added to BaseLayout for page-specific body overrides
- v3 color palette tokens (--hot-pink, --electric-yellow, --charcoal, etc.) added to `:root`
- All sections mobile-first responsive with 768px breakpoint
- Scroll-reveal animations via IntersectionObserver
- Sticky nav with scroll state detection
- No React hydration — all interactivity via vanilla JS

**Removed:**
- Old Hero.astro (parallax photo background) — replaced by CSS gradient blobs
- Old Nav.astro (dark glassmorphism) — replaced by light pill-button nav
- Custom cursor stripped (banned for mobile-first site)

**Files:** src/pages/index.astro, src/layouts/BaseLayout.astro, src/index.css, 13 new files in src/components/home/, 2 deleted components

---

## fix: code review round — photo state, DST offsets, storage auth, toast cleanup, touch targets

Verified and fixed findings from code review:

**Functional fixes:**
- Clear `photoFile`/`photoPreview` when file selection is empty or exceeds 5 MB limit, preventing stale photo submission
- Compute correct EST/EDT offset (`-05:00` or `-04:00`) for Event JSON-LD instead of hardcoding `-04:00`. Extracted `nyOffset()` to shared `src/utils/timezone.ts` used by both index.astro and tickets.astro
- Fix useGeoData perpetual loading on import failure — added `geoFailed` state so `loading` becomes false when the dynamic import rejects
- Fix AdminDashboard toast timeout leak — use ref + cleanup to prevent `setToast` on unmounted component

**Security:**
- Add `request.auth != null` to storage write rule (was unauthenticated)
- Revert storage read rule to `allow read: if true` since ApplyPage's `getDownloadURL` runs without auth
- Add `signInAnonymously` before Storage upload in ApplyPage so writes succeed with auth-required rules

**UI/accessibility:**
- Bump ApplicantCard action button touch target from 44px to 48px per project standards

**Tests:**
- Add 2 tests for photoUrl URL scheme validation (non-https and invalid URL)
- Add import failure test for useGeoData

**Files modified:** ApplyPage.tsx, useGeoData.ts, AdminDashboard.tsx, ApplicantCard.tsx, storage.rules, index.astro, tickets.astro, timezone.ts (new), notify-application.test.ts, useGeoData.importError.test.ts (new), useGeoData.test.ts

## fix: use dynamic EST/EDT timezone offset in tickets.astro Event schema

The tickets page JSON-LD was hardcoding `-04:00` (EDT) for event startDate/endDate. Added the same `nyOffset()` helper already used in index.astro to compute the correct America/New_York offset per event, handling the EST/EDT boundary correctly.

- **Modified:** `src/pages/tickets.astro`

## feat: add /tickets page for SEO

New standalone `/tickets` page showing all upcoming Garam Masala Dating shows with Eventbrite links. Targets "garam masala dating tickets" and related search queries.

- Event cards with date, city, and "Get Tickets" CTA linking to Eventbrite
- TBA events (Edinburgh, India Tour) shown dimmed with "Coming Soon" label
- Empty state with Instagram follow prompt when no upcoming shows
- Event ItemList JSON-LD schema (same as homepage) for rich search results
- BreadcrumbList JSON-LD for search navigation
- Added `/tickets` to sitemap.xml (priority 0.9, weekly changefreq)

- **Created:** `src/pages/tickets.astro`
- **Modified:** `public/sitemap.xml`

## fix: add missing Event JSON-LD fields flagged by Google Search Console

Added `performer` (Surbhi + Wyatt Feegrado) to Event schemas in index.astro and city pages. Added `price`, `priceCurrency`, and `validFrom` to the `offers` object. The `offers.url` uses the existing Eventbrite ticketing links from `src/data/events.ts`.

- **Modified:** `src/pages/index.astro`, `src/pages/cities/[slug].astro`

## fix: 5 more audit issues (storage auth, photoUrl validation, file size mismatch, toast dedup, geo error handling)

Second round of code audit fixes:

**Security:**
- Restricted Firebase Storage photo reads to authenticated users (was `allow read: if true`)
- Added URL scheme validation for photoUrl in admin email — only https links render
- Aligned client-side file size limit to 5 MB to match storage rules (was 10 MB client-side, causing silent rejections between 5-10 MB)

**Code quality:**
- Extracted `showToast` helper in AdminDashboard, replacing 5 duplicate setTimeout/setToast patterns
- Added `.catch` to dynamic `country-state-city` import in useGeoData so a failed chunk load doesn't hang the geo selectors in loading state forever

**Files modified:** storage.rules, api/notify-application.ts, ApplyPage.tsx, AdminDashboard.tsx, useGeoData.ts

## fix: 10 bugs from code audit (operator precedence, stale closure, date overflow, security hardening, canonical link)

Fixed 10 issues identified in a comprehensive code audit across 13 files:

**Functional bugs:**
- Fixed operator precedence in ApplicantCard that silently prevented card-level delete button from rendering (`onDelete ?? onRestore` → `(onDelete ?? onRestore)`)
- Fixed stale closure in ApplicantModal Escape key handler — pressing Escape after editing notes now saves current value instead of discarding changes
- Fixed isEventPast overflow where "Dec 2026" was parsed as day=2026, creating a date in ~2031. Added day range guard (1-31)
- Fixed UTC date comparison in next-show detection — switched from `toISOString().slice(0,10)` to `toLocaleDateString("en-CA")` for local timezone
- Added FileReader.onerror handler on photo upload so corrupted files show an error instead of silently hanging
- Made handleDelete await the Firestore update before closing the modal, preventing lost error feedback

**Security hardening:**
- Switched ContestantPrepPage session token from localStorage to sessionStorage (cleared on tab close)
- Added autocomplete attributes to admin login form for password managers
- Added null-safe optional chaining to all FAQ accordion DOM queries

**SEO / data model:**
- Added missing `<link rel="canonical">` tag to BaseLayout (was only in og:url)
- Set `site` in astro.config.mjs so each page gets its own canonical URL automatically
- Added optional `startTime`/`endTime` fields to EventEntry to avoid hardcoded 20:00-22:00 in event schema

**Files modified:** ApplicantCard.tsx, ApplicantModal.tsx, eventDate.ts, ApplyPage.tsx, AdminDashboard.tsx, ContestantPrepPage.tsx, AdminLogin.tsx, faq.astro, BaseLayout.astro, astro.config.mjs, events.ts, index.astro, eventDate.test.ts

## fix: hide back button when landing directly on /apply

The back button on the apply page now only shows when there's browser history to go back to. Users arriving directly (e.g. from Instagram bio link) no longer see a useless back button.

- **Modified:** `src/components/ApplyPage.tsx` — added `canGoBack` state checked via `window.history.length` on mount

## feat: success confirmation screen and improved error toast on apply form

Replaced the brief success toast with a full confirmation panel after form submission. The panel thanks the applicant, encourages following @garammasaladating on Instagram (increases odds), explains that most contestants start as audience Stealers, offers a 20% off coupon code (STEALER), and links to the next upcoming show's tickets (dynamically computed from events data). Updated the error toast with friendlier copy that directs users to DM @garammasaladating on Instagram. Toast styling updated to support longer messages.

- **Modified:** `src/components/ApplyPage.tsx` — added `submitted` state, success panel with next-show link, updated error toast copy
- **Modified:** `src/components/ApplyPage.module.css` — success panel styles, wider toast for error messages
- **Imports:** `events` from `@/data/events` for dynamic next-show lookup

## feat: email notifications on contestant application submission

Added email notifications via Resend so Surbhi gets an email with applicant details (name, age, location, Instagram, pitch, etc.) every time someone submits the contestant application form. The notification is fire-and-forget — if the email fails to send, the application is still saved to Firestore and the user sees the normal success message.

- **New file:** `api/notify-application.ts` — Vercel serverless function that sends the notification email via Resend
- **Modified:** `src/components/ApplyPage.tsx` — fires a non-blocking POST to the notification endpoint after Firestore write
- **New dependency:** `resend` (server-side only, zero client bundle impact)
- **New env vars:** `RESEND_API_KEY`, `NOTIFICATION_EMAIL` (must be set in Vercel dashboard)

## fix: links page modals always visible and not closable

The two `<dialog>` modals (events and press) on `/links` were permanently visible at the bottom of the page, stacked on each other, and could not be closed. Root cause: `.modal-dialog` had `display: flex` set unconditionally, overriding the browser's native `display: none` for closed `<dialog>` elements. Moved `display: flex` and alignment properties into `.modal-dialog[open]` only.

- **File:** `src/pages/links.astro` (CSS section)

## v1.0.0: Migrate from Vite SPA to Astro with React islands

Major architecture migration. The site was a React 19 SPA with Vite, react-router-dom, and a Puppeteer prerender script. It is now an Astro static site with React islands for the 3 interactive pages.

### Phase 1: Replace firebase-admin with jose
- Replaced 48MB `firebase-admin` SDK with `jose` (~45KB) for JWT verification in Vercel serverless functions
- New `api/_verify-token.ts` fetches Google's X.509 public certs, caches 1 hour, verifies signature/issuer/audience
- Same `verifyIdToken()` interface preserved — only the import in `generate-contestant-link.ts` changed
- npm audit vulnerabilities: 17 down to 9

### Phase 2: Astro migration
- Installed `astro`, `@astrojs/react`, `@astrojs/vercel` with static output mode
- Created `BaseLayout.astro` replacing `index.html` + `usePageMeta` hook (props for title, description, OG, noindex)
- **Static pages (zero client JS):** landing, FAQ, links, cities (6), journal (3), tips (3), 404
- **React islands (client:load):** apply form, admin dashboard, contestant prep
- JSON-LD schemas now render at build time in Astro frontmatter (not useEffect injection)
- Nav dropdown: vanilla JS (~15 lines) replaces React useState
- FAQ accordion: vanilla JS toggle replaces React useState
- Links page modals: `<dialog>` elements replace React state
- Hero parallax: inline `<script>` replaces React hook
- All `<Link to>` replaced with `<a href>` (no more react-router-dom)
- Puppeteer prerender script deleted (Astro generates static HTML natively)
- 21 pages generated in ~3.8s build time

### Phase 3: Package cleanup
- Removed: react-router-dom, @vitejs/plugin-react, puppeteer, @types/react-select, firebase-admin
- Added: astro, @astrojs/react, @astrojs/vercel, jose
- Version bumped from 0.0.0 to 1.0.0
- Scripts updated to astro dev/build/preview

### What stayed the same
- Visual design unchanged — all pages look identical
- Firebase client SDK (Firestore, Auth, Storage) unchanged
- Vercel API functions (`/api/`) unchanged
- CSS architecture (custom properties + CSS modules for React islands) unchanged
- All data files (events, cities, journal, tips, press, socials) unchanged

---

## feat: static prerendering for SEO + social crawlers

Added a Puppeteer-based post-build step that prerenderes all 18 public routes to static HTML. Social crawlers (Facebook, Twitter, LinkedIn, Slack, iMessage) and non-Google search engines now see fully rendered pages with content, meta tags, and JSON-LD schemas — instead of an empty React shell.

**Prerender script:** `scripts/prerender.ts`
- Starts a local server on `dist/`, visits each route with Puppeteer, waits for React + useEffect to run, saves the rendered HTML
- All useEffect-based JSON-LD (Organization, Breadcrumb, FAQ, Article, Event schemas) is captured in the static output
- 18 routes prerendered: homepage, apply, faq, links, cities (6), journal (3), tips (3)
- Client-only routes excluded: /admin, /contestant-prep

**Build commands:**
- `npm run build` — standard Vite build (no prerendering)
- `npm run build:prerender` — build + prerender all public routes
- Vercel configured to use `build:prerender` via vercel.json `buildCommand`

**No existing code changed.** The prerender is purely additive — a post-build step. Can be removed at any time with zero impact.

**Files added:** `scripts/prerender.ts`
**Files changed:** `package.json` (new script + puppeteer devDependency), `vercel.json` (buildCommand)

---

## seo: replace SVG OG image + add Event schema to homepage

**OG image fix:**
- Replaced `og-image.svg` (406 bytes, unsupported by most social platforms) with `og-image.jpg` (1200x630 JPEG, 194KB)
- Updated all references: `index.html`, `OrganizationSchema.tsx`, `AuthorBio.tsx`, `JournalPostPage.tsx`, `TipPostPage.tsx`
- Social link previews now render correctly on Twitter/X, iMessage, Slack, WhatsApp, LinkedIn, Facebook

**Event schema on homepage:**
- New `EventsSchema.tsx` component renders ItemList of Event JSON-LD for all upcoming non-hidden events
- Added to the `LandingPage` function in `App.tsx`
- Events appear in Google Rich Results with dates, venues, and ticket links

**Files added:** `src/components/EventsSchema.tsx`, `public/og-image.jpg`
**Files changed:** `index.html`, `src/App.tsx`, `src/components/OrganizationSchema.tsx`, `src/components/AuthorBio.tsx`, `src/pages/JournalPostPage.tsx`, `src/pages/TipPostPage.tsx`

---

## fix: dynamic import country-state-city + migrate inline styles to CSS modules

**Bundle size fix:**
- Created `useGeoData` hook (`src/hooks/useGeoData.ts`) that dynamically imports `country-state-city` on mount
- Removed static import from ApplyPage — the 8.3MB geo data now loads asynchronously instead of blocking page render
- Country select shows loading indicator while module loads
- Removed redundant `vendor-geo` manual chunk from vite.config.ts

**Inline styles to CSS modules migration (168 occurrences across 5 files):**
- `AdminLogin.tsx` → `AdminLogin.module.css` (7 styles, shake animation)
- `ApplicantModal.tsx` → `ApplicantModal.module.css` (29 styles, hover handlers → CSS `:hover`)
- `AdminDashboard.tsx` → `AdminDashboard.module.css` (34 styles, responsive grid, data-copied attribute)
- `ApplyPage.tsx` → `ApplyPage.module.css` (53 styles, form elements, type toggles via `data-active`, keyframes)
- `LinksPage.tsx` → `LinksPage.module.css` (45 styles, removed hover `useState` from LinkButton/SocialIcon, 6 keyframes)

All JS-based hover state (`useState` + `onMouseEnter`/`onMouseLeave`) replaced with CSS `:hover`. Dynamic values (animation delays, status badge colors) kept as minimal inline styles. react-select style configs untouched.

**Files changed:** `src/hooks/useGeoData.ts` (new), `vite.config.ts`, `ApplyPage.tsx`, `LinksPage.tsx`, `AdminDashboard.tsx`, `ApplicantModal.tsx`, `AdminLogin.tsx`, plus 5 new `.module.css` files.

## security: migrate admin auth to Firebase Authentication

Replaced the password-based admin authentication with Firebase Authentication (email/password). This is a critical security fix — Firestore rules were `allow read, write: if true`, meaning anyone with the Firebase project ID could read all application data.

**Firebase Auth integration:**
- Added `firebase/auth` to the client SDK exports in `firebase.ts`
- Created `api/_firebase-admin.ts` shared helper for server-side ID token verification using `firebase-admin`
- `AdminLogin.tsx` now uses `signInWithEmailAndPassword()` instead of POST to `/api/admin-auth`
- `AdminPage.tsx` uses `onAuthStateChanged()` for persistent session management (replaces sessionStorage)
- `AdminDashboard.tsx` gets Firebase ID tokens via `auth.currentUser.getIdToken()` for API calls

**Firestore rules locked down:**
- `allow create: if true` (applications can still be submitted without auth)
- `allow read, update, delete: if request.auth != null` (only authenticated users can view/manage applications)

**API endpoint updates:**
- `generate-contestant-link.ts` now verifies Firebase ID tokens via `firebase-admin` instead of HMAC session tokens
- Removed `admin-auth.ts` (no longer needed)

**Files affected:** `src/lib/firebase.ts`, `src/components/admin/AdminLogin.tsx`, `src/pages/AdminPage.tsx`, `src/components/admin/AdminDashboard.tsx`, `api/generate-contestant-link.ts`, `api/_firebase-admin.ts` (new), `firestore.rules`, `vite.config.ts`

**Setup required:** Create a Firebase Auth email/password user in the Firebase Console. Set `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` as Vercel environment variables.

**Deleted:** `api/admin-auth.ts`

---

## seo: full SEO/AEO technical pass — schema markup, breadcrumbs, author bios, sitemap, noindex

Comprehensive SEO and AEO audit and implementation across the entire site.

**Global Organization schema:**
- New `OrganizationSchema.tsx` component injected at the App level. Every page now has Organization JSON-LD with name, URL, sameAs (Instagram, TikTok, YouTube), logo, and contactPoint.

**Dynamic BreadcrumbList schema:**
- New `BreadcrumbSchema.tsx` component generates BreadcrumbList JSON-LD from the current route. Resolves display names for dynamic segments (city pages, journal posts, tip posts). Skipped on homepage, admin, and contestant-prep.

**Author bios on all article pages:**
- New `AuthorBio.tsx` component rendered below article content on `/journal/:slug` and `/south-asian-dating-tips/:slug`. Includes logo, organization name, and bio text styled to match existing design system.
- Added `publisher.logo` (ImageObject) to Article JSON-LD in both `JournalPostPage.tsx` and `TipPostPage.tsx`.

**noindex on private routes:**
- Extended `usePageMeta` hook with optional `noindex` parameter that injects `<meta name="robots" content="noindex, nofollow">` into `<head>`.
- Applied to `AdminPage.tsx` and `ContestantPrepPage.tsx`.

**Sitemap expanded (9 → 18 URLs):**
- Added: `/links`, `/cities` index, `/cities/jersey-city`, `/cities/los-angeles`, `/cities/salt-lake-city`, `/cities/denver`, `/journal` index, 2 journal post URLs.
- Updated `changefreq` to weekly for city pages with active shows.

**robots.txt updated:**
- Added `Disallow: /contestant-prep` (auth-gated page).

**Hero image alt text fixed:**
- Changed empty `alt=""` to descriptive `alt="Garam Masala Dating live comedy dating show"` in `Hero.tsx`.

**Broken links audit:**
- Created `BROKEN_LINKS.md` — no broken internal links found. External links (Eventbrite, social) flagged for manual verification.

**Files created:** `OrganizationSchema.tsx`, `BreadcrumbSchema.tsx`, `AuthorBio.tsx`, `BROKEN_LINKS.md`
**Files modified:** `usePageMeta.ts`, `App.tsx`, `AdminPage.tsx`, `ContestantPrepPage.tsx`, `JournalPostPage.tsx`, `TipPostPage.tsx`, `Hero.tsx`, `sitemap.xml`, `robots.txt`

## perf: fix remaining PageSpeed issues — mobile animation, parallax, dead code cleanup

Addresses remaining performance issues after the initial PageSpeed optimization pass.

**GrainOverlay hidden on mobile:**
- Added `@media (max-width: 768px) { display: none }` — the SVG feTurbulence filter animation was consuming GPU budget and blocking LCP paint on mobile devices. Imperceptible at 0.035 opacity on small screens.

**useMouseParallax optimized:**
- Skip entirely on touch devices via `(pointer: coarse)` media query — the rAF loop was running 60fps on phones where mouse events never fire
- Added convergence detection — loop stops when offset matches target, restarts on next mousemove. Eliminates continuous 60fps overhead when mouse is stationary.

**TableOfContents useEffect bug fixed:**
- Added `[tick]` dependency array — was firing on every render, creating/cancelling timeouts in a tight loop

**country-state-city isolated:**
- Moved to dedicated `vendor-geo` chunk in manualChunks — the 8.7MB library data no longer inflates ApplyPage chunk (now 15KB). Loads only when /apply is visited.

**Dead code removed:**
- Deleted `SubpageBackground.tsx` (exported but never imported)
- Deleted `src/assets/hero.jpeg` (855KB) and `src/assets/hero-mobile.jpeg` (799KB) — superseded by optimized AVIF/WebP in `public/images/`

**Files modified:** `src/components/GrainOverlay/GrainOverlay.module.css`, `src/hooks/useMouseParallax.ts`, `src/components/TableOfContents/TableOfContents.tsx`, `vite.config.ts`
**Files deleted:** `src/components/SubpageBackground/SubpageBackground.tsx`, `src/assets/hero.jpeg`, `src/assets/hero-mobile.jpeg`

---

## perf: PageSpeed optimization — code splitting, image + font optimization, security headers

Improved Desktop Performance score from 63 to 90+ by addressing all major PageSpeed Insights issues.

**Code splitting (biggest impact):**
- All 9 route pages now lazy-loaded with `React.lazy` + `Suspense` — homepage initial JS drops from 2,634 KB to ~80 KB gzipped
- Vendor chunks split: `vendor-react` (17 KB gz), `vendor-firebase` (93 KB gz, loaded only on /apply and /admin), `vendor-select` (31 KB gz)
- Fixed Firebase type import leak in `application.ts` — changed `import { Timestamp }` to `import type { Timestamp }` to prevent Firebase SDK from being pulled into the main bundle

**Hero image optimization:**
- Converted hero images to AVIF (~71 KB desktop, ~57 KB mobile) and WebP (~94 KB, ~83 KB) from original JPEG (~855 KB, ~799 KB)
- Moved images to `public/images/` for stable preload URLs
- Added `<picture>` sources for AVIF → WebP → JPEG fallback chain
- Added `fetchPriority="high"`, explicit `width`/`height`, and `decoding="async"` to LCP image
- Added `<link rel="preload">` for hero AVIF images in `index.html`

**Font self-hosting:**
- Replaced Google Fonts `@import` (4-request waterfall chain) with 6 self-hosted woff2 files in `public/fonts/`
- Trimmed from ~20+ font files to 6 by using variable font files and dropping unused weights
- Added `font-display: swap` on all `@font-face` declarations
- Added `<link rel="preload">` for critical fonts (Playfair Display, DM Sans)

**Security headers (vercel.json):**
- Added CSP, HSTS, X-Frame-Options, X-Content-Type-Options, COOP, Referrer-Policy
- Added immutable cache headers for `/fonts/` and `/images/`

**Files modified:** `src/App.tsx`, `src/types/application.ts`, `vite.config.ts`, `src/components/Hero/Hero.tsx`, `src/index.css`, `index.html`, `vercel.json`
**Files added:** `public/images/hero.{avif,webp,jpeg}`, `public/images/hero-mobile.{avif,webp,jpeg}`, `public/fonts/*.woff2` (6 files)
**Dev dependency added:** `sharp` (used for AVIF conversion)

---

## seo: update meta tags with desi/South Asian keywords

Updated `<title>`, meta description, Open Graph, and Twitter Card tags across three routes for better SEO targeting.

**Changes:**
- `/` (landing): title and description updated in `index.html` + OG/Twitter tags
- `/apply`: added `usePageMeta` hook call with contestant-focused copy
- `/links`: added `usePageMeta` hook call with links hub copy

**Files modified:** `index.html`, `src/pages/ApplyPage.tsx`, `src/pages/LinksPage.tsx`

## feat: add Jersey City page + venue-aware Event schema

Added `/cities/jersey-city` with The Laugh Tour Comedy Club as a named venue and monthly recurrence in the Event schema.

**Changes:**
- `CityData` interface: added `badgeLabel`, optional `venueName`, optional `eventScheduleFrequency` fields
- Jersey City entry: status "active", badgeLabel "Monthly Shows", venueName "The Laugh Tour Comedy Club", eventScheduleFrequency "P1M"
- `buildCityJsonLd`: uses `venueName` for location.name, injects `eventSchedule` with `repeatFrequency` when present
- `/cities` index: Jersey City appears second (after Manhattan, before Coming Soon cities), labeled "Monthly Shows"
- `CitiesIndexPage`: uses `city.badgeLabel` directly instead of status-based lookup

**Files modified:** `src/data/cities.ts`, `src/pages/CityPage.tsx`, `src/pages/CitiesIndexPage.tsx`

## feat: expand /cities routes — 5 cities + index page

Expanded city pages from 2 to 5, added a `/cities` index page, and introduced city-type-aware JSON-LD.

**Cities added/updated:**
- Manhattan — updated copy + H1, "Weekly Shows" status, Event schema included
- San Diego — reframed to past tense, no Event schema
- Los Angeles — new, "Coming Soon", Wyatt/Netflix Is a Joke crossover, Event schema included
- Salt Lake City — new, "Coming Soon", Wyatt/Happy Valley Comedy crossover, LocalBusiness only
- Denver — new, "Coming Soon", Wyatt/Comedy Works crossover, LocalBusiness only

**Architecture:**
- `CityData.status` field: `"active" | "coming-soon" | "past"` drives index badges and copy tone
- `CityData.includeEventSchema` flag: `buildCityJsonLd` conditionally emits Event schema block
- `/cities` index page: ordered card list with status badges ("Weekly Shows" / "Coming Soon")

**Files created:** `src/pages/CitiesIndexPage.tsx`
**Files modified:** `src/data/cities.ts` (5 cities, new fields), `src/pages/CityPage.tsx` (conditional schema, footer links), `src/App.tsx` (route + overlay)

## feat: add /faq, /cities/[city], and /journal SEO routes

Built three new SEO-optimized route groups in one pass. All pages use the existing dark overlay, inline style pattern, and design system tokens (Playfair/Cormorant/DM Sans, gold accents).

**Architecture:**
- `src/hooks/usePageMeta.ts` — lightweight hook that sets `document.title`, `<meta name="description">`, and injects/removes `<script type="application/ld+json">` via `useEffect`. No new dependencies.
- `src/data/journal.ts` — 2 posts as typed `PostBlock[]` objects with slug, title, metaDescription, excerpt, and body.
- `src/data/cities.ts` — Manhattan and San Diego city data with editorial copy, CTAs, and schema fields.

**Routes added:**
- `/faq` — 10-item accordion FAQ with FAQPage JSON-LD schema
- `/cities/:city` — Dynamic city page (Manhattan, San Diego); LocalBusiness + Event JSON-LD; 404 for unknown slugs
- `/journal` — Post index, reverse-chrono, with excerpt and date
- `/journal/:slug` — Full article view with Article JSON-LD; 404 for unknown slugs

**Files created:** `src/hooks/usePageMeta.ts`, `src/data/journal.ts`, `src/data/cities.ts`, `src/pages/FaqPage.tsx`, `src/pages/CityPage.tsx`, `src/pages/JournalPage.tsx`, `src/pages/JournalPostPage.tsx`

**Files modified:** `src/App.tsx` (4 new routes + SubpageOverlay prefix matching for `/cities/*` and `/journal/*`), `CHANGELOG.md`

## chore: add sitemap.xml

Added `public/sitemap.xml` with the homepage URL, weekly change frequency, and priority 1.0.

**Files affected:** `public/sitemap.xml` (new)

## chore: add robots.txt

Added `public/robots.txt` to allow all crawlers to index public pages while blocking `/admin` and `/api/`. Includes Sitemap reference pointing to the production domain.

**Files affected:** `public/robots.txt` (new)

## feat: replace contestant prep password with magic links

Replaced the weekly-rotating password system with per-show magic links. Admin now clicks "Copy Link" next to a show in the dashboard to get a unique, shareable URL. Contestants open the link and are automatically authenticated — no password entry needed. Links expire at midnight ET on the day of the show.

**Architecture:**
- Token scheme: `HMAC-SHA256(CONTESTANT_PREP_SALT, showDate)` embedded as `?date=YYYY-MM-DD&sig=<hex>` URL params
- ContestantPrepPage auto-authenticates from URL params on mount; falls back to localStorage session on reload; shows "Link expired" error if invalid or no params
- Admin dashboard shows upcoming shows with a "Copy Link" button per show that calls `POST /api/generate-contestant-link`

**Files added:**
- `api/generate-contestant-link.ts` — admin-authenticated endpoint that generates show magic links

**Files modified:**
- `api/contestant-prep-auth.ts` — rewritten to validate `{ date, sig }` instead of `{ password }`
- `src/pages/ContestantPrepPage.tsx` — removed password form; auto-auth from URL params
- `src/components/admin/AdminDashboard.tsx` — replaced password panel with per-show link generator
- `src/data/events.ts` — added `isoDate` (YYYY-MM-DD) field to events with specific dates

**Files deleted:**
- `api/contestant-prep-password.ts` — weekly password fetcher, no longer needed
- `api/lib/weekly-password.ts` — weekly password utilities, no longer needed

## fix: events below the fold on mobile

On mobile, the event dates in the TableOfContents were pushed below the visible viewport due to `align-items: flex-end` pinning content to the bottom of a `min-height: 100vh` container with 100px top padding. Changed mobile wrapper to `align-items: center` and reduced top padding to 60px so events are immediately visible. Also bumped mobile font sizes for date (0.88rem) and city (0.82rem) for readability.

**Files:**
- `src/components/CenterBox/CenterBox.module.css` — mobile wrapper alignment and padding
- `src/components/TableOfContents/TableOfContents.module.css` — mobile font sizes

## feat: add NYC 4/19 event, remove roman numerals

Added "420 Blazin' in Love" New York City event on April 19 with Eventbrite ticket link. Removed the roman numeral labels (I, II, III…) from all events since past events make the sequential numbering meaningless.

**Files:**
- `src/data/events.ts` — new event entry, removed `numeral` field from interface and all objects
- `src/pages/LinksPage.tsx` — removed numeral `<span>` elements, switched keys from `event.numeral` to `event.date`
- `src/components/TableOfContents/TableOfContents.tsx` — removed numeral span
- `src/components/TableOfContents/TableOfContents.module.css` — removed `.numeral` class

## feat: password-protected contestant prep guide at /contestant-prep

Added a full contestant prep guide page for show contestants, gated by a weekly-rotating password.

**Password system:**
- Deterministic weekly password generated via HMAC-SHA256 from current week's Monday date (ET timezone) + a secret salt. Rotates automatically every Sunday 11:59 PM ET without needing a cron job.
- Two new Vercel Serverless Functions: `api/contestant-prep-auth.ts` (validates password, returns session token) and `api/contestant-prep-password.ts` (returns current password for admin use).
- Session stored in localStorage with auto-expiration each Sunday night.

**Page content:** Welcome message, Golden Rules, 13 questions contestants will be asked, "Come Prepared With" checklist, wardrobe guidance, arrival times, and notes for guys/girls. Styled with the site's dark/warm design system.

**Admin integration:** AdminDashboard now shows the current week's contestant prep password with a "Copy" button, fetched from the serverless API.

**New env var:** `CONTESTANT_PREP_SALT` (server-only, no VITE_ prefix) — must be set in Vercel dashboard for production.

**Files:**
- New: `api/lib/weekly-password.ts`, `api/contestant-prep-auth.ts`, `api/contestant-prep-password.ts`, `src/pages/ContestantPrepPage.tsx`
- Modified: `src/App.tsx`, `src/components/admin/AdminDashboard.tsx`, `.env.local`, `package.json`

## feat: add Vercel Analytics

Wired up the `@vercel/analytics` React component (package was already installed but unused). Imported `Analytics` from `@vercel/analytics/react` and added `<Analytics />` inside `BrowserRouter` in `App.tsx`. Automatically tracks page views and web vitals on Vercel deployments.

**Files:** `src/App.tsx`

## fix: links page title hyperlink, cursor pointer, press order

Three UX fixes on the `/links` page:

1. **Title now links home:** Wrapped "Garam Masala Dating" `<h1>` in `<Link to="/">` so clicking it navigates back to the landing page.
2. **Cursor pointer on title:** Added `cursor: pointer` and `textDecoration: none` to the link wrapper.
3. **Press items newest-first:** Kept `press.ts` in chronological order (oldest first, append new items at end) and added `[...pressItems].reverse()` at render time so the modal displays newest first.

**Files:** `src/pages/LinksPage.tsx`, `src/data/press.ts`

## fix: backdrop dismiss navigates back instead of always to landing page

Clicking the dark backdrop area outside the Apply form now calls `navigate(-1)` instead of `navigate("/")`, matching the "Back" button behavior. Users arriving from `/links` return to `/links`, not `/`.

Also replaced remaining hardcoded hex colors with CSS variables across inline styles:
- `#22C55E` → `var(--success)` in ApplyPage, AdminDashboard, ApplicantModal
- `#4A0E1B` → `var(--surface-dark)` in ApplyPage
- `#F5EDE4` → `var(--text-ivory)` in ApplyPage, Nav.module.css, CenterBox.module.css
- `#E2C97E` → `var(--gold-accent)` in CenterBox.module.css

**Files:** `src/pages/ApplyPage.tsx`, `src/components/admin/AdminDashboard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/Nav/Nav.module.css`, `src/components/CenterBox/CenterBox.module.css`

## chore: full code cleanup, bug fixes, and CSS consolidation

Systematic cleanup pass across the entire codebase addressing bugs, dead code, inconsistent patterns, and duplicated logic.

**Critical bug fixed:** Admin login compared against hardcoded `"secret"` instead of the `VITE_ADMIN_PASSWORD` env var — no one could log in with the intended password. Now reads from env.

**Medium bugs fixed:**
- `var(--font-dm)` typo in LinksPage (non-existent CSS variable) → `var(--font-dm-sans)`
- Debug `console.log` in AdminDashboard leaked all applicant PII to browser console — removed
- Admin dashboard showed infinite "Loading..." on fetch error — added error state with retry button

**Dead code removed:**
- Unused `searchableLocation()` export from `locationDisplay.ts`
- Pointless `sortedPress = pressItems` alias in LinksPage
- All `console.log`/`console.error` statements (toasts already handle user feedback)

**CSS variable consolidation:**
- Added `--success`, `--accent-pink`, `--text-ivory`, `--gold-accent`, `--surface-dark` to `:root`
- Replaced hardcoded `#ff2d9b`, `#C9A84C`, font-family strings in Nav.module.css and CenterBox.module.css with CSS variables
- `::selection` now uses `var(--accent-pink)` instead of hardcoded hex

**Shared constants extracted:**
- Created `src/data/socials.ts` — single source of truth for social URLs and creator links (was duplicated across Nav, LinksPage, CenterBox)
- Created `src/utils/reactSelectStyles.ts` — shared react-select style configs with proper `CSSObjectWithLabel` types replacing `Record<string, unknown>`

**ESLint fixes:**
- Ternary-as-statement in ApplicantCard → if/else
- `useCallback` self-reference in useMouseParallax → moved `animate` inside useEffect
- `setState` in useEffect body in AdminPage → lazy state initializer
- Removed dead `href !== "#"` checks that TS now catches as unreachable

**Files:**
- `src/components/admin/AdminLogin.tsx` — env var password
- `src/components/admin/AdminDashboard.tsx` — remove console, add error state, use shared styles
- `src/components/admin/ApplicantCard.tsx` — fix lint
- `src/pages/ApplyPage.tsx` — remove console, use shared styles
- `src/pages/LinksPage.tsx` — fix font typo, remove alias, use shared socials
- `src/pages/AdminPage.tsx` — lazy state initializer
- `src/components/Nav/Nav.tsx` — use shared socials
- `src/components/CenterBox/CenterBox.tsx` — use shared socials
- `src/components/Nav/Nav.module.css` — CSS variables
- `src/components/CenterBox/CenterBox.module.css` — CSS variables
- `src/index.css` — new CSS variables
- `src/hooks/useMouseParallax.ts` — fix lint
- `src/utils/locationDisplay.ts` — remove dead export
- `src/data/socials.ts` — **new** shared social URLs
- `src/utils/reactSelectStyles.ts` — **new** shared react-select styles
- `BUGS.md` — **new** bug tracker

## refactor: remove dates from press items

Removed the `date` field from the `PressItem` interface and all press data objects. The "As Seen In" modal no longer displays dates — items appear in array order (newest first by convention). The date-based sort was replaced with a direct reference to `pressItems`.

**Files:** `src/data/press.ts`, `src/pages/LinksPage.tsx`

## feat: consolidate press appearances into "As Seen In" modal

Replaced the individual Gen Zenophobic and Big Silly World podcast buttons on the links page with a single "As Seen In" button that opens a modal listing all press appearances in reverse chronological order. Each entry shows a type badge (podcast/article/press), source name, formatted date, and external link. Renamed "Press & Collaborations" to "Booking & Press Inquiries" to clarify it's for new inquiries. Press items are stored in a simple array in `src/data/press.ts` for easy addition. Also added body scroll lock and Escape-to-close for both modals.

**Files:** `src/data/press.ts` (new), `src/pages/LinksPage.tsx`

## feat: location migration script for legacy freetext city records

Added `scripts/migrate-locations.ts` — a one-time migration that backfills legacy Firestore applications (freetext `city` only) with structured `country`/`state`/`city` fields. Uses `country-state-city` package to build a reverse index, resolves common aliases (NYC → New York City, SF → San Francisco, etc.), and disambiguates multi-state cities via a preference map (e.g. San Diego → CA, not TX). Defaults to dry-run; pass `--execute` to write. No schema or app code changes needed — the three-field structure was already in place.

**Files:** `scripts/migrate-locations.ts`, `package.json` (added `migrate:locations` script)

## simplify: replace admin filters with Gender + City multi-select

Stripped the admin Applications filter bar from 7 filters (sort, location text, gender, orientation, community, income, status) down to two `react-select` multi-select dropdowns: **Gender** and **City**. City options are derived dynamically from existing application data. Both filters AND together. Removed unused imports (`COMMUNITY_OPTIONS`, `INCOME_OPTIONS`, `searchableLocation`), the `SortOption` type, and `FILTER_STYLE` const. Default sort remains newest-first with rejected pushed to bottom.

**Files:** `src/components/admin/AdminDashboard.tsx`

## ux: Apply page backdrop dismiss and dynamic Instagram placeholder

Two UX improvements to the Apply page:

1. **Click-outside-to-dismiss** — clicking the dark background area outside the form navigates back to `/`, giving a modal-like backdrop dismiss feel. Inner content div stops propagation so form interactions are unaffected.
2. **Dynamic Instagram placeholder** — when "For a friend" tab is selected, the Instagram handle placeholder changes to `yourfriendshandle` (reverts to `yourhandle` for "For myself").

**Files:** `src/pages/ApplyPage.tsx`

## feat: cascading Country/State/City location selector

Replaced the freetext "City" input on the application form with a structured, cascading location selector (Country → State → City). Uses `country-state-city` for geographic data and `react-select` for searchable dropdowns. Country defaults to United States. State appears when country is selected; City appears when state is selected. Stores structured `country`, `state`, and `city` fields in Firestore.

Admin dashboard handles both old freetext records (shows `"New York City"`) and new structured records (shows `"Brooklyn, NY"`). Location filter now searches across city, state, and country fields.

**Files:**
- `package.json` — added `react-select`, `country-state-city`, `@types/react-select`
- `src/types/application.ts` — added optional `country?`, `state?` fields
- `src/utils/locationDisplay.ts` — new file with `formatLocation()` and `searchableLocation()` helpers
- `src/pages/ApplyPage.tsx` — replaced city input with 3 cascading `<Select>`, updated FormState/validation/submission
- `src/components/admin/ApplicantCard.tsx` — uses `formatLocation(app)` instead of `app.city`
- `src/components/admin/ApplicantModal.tsx` — uses `formatLocation(app)`, label changed to "Location"
- `src/components/admin/AdminDashboard.tsx` — uses `searchableLocation(app)` in filter, placeholder changed to "Location…"

**Decisions:**
- `country` and `state` are optional on the `Application` type so old Firestore docs without them still satisfy the type — no data migration needed
- `formatLocation` falls back to `app.city` when `app.state` is missing (legacy compat)
- react-select styles custom-matched to existing ivory/gold design system

## feat: add podcast links to LinksPage

- Added "Gen Zenophobic Podcast" (Wyatt's podcast) and "Big Silly World Podcast" links
- Both link to their YouTube episodes where Garam Masala Dating was promoted
- Placed after YouTube and before "Upcoming Shows & Tickets" with Mic icon
- Imported `Mic` from lucide-react

**Files:** `src/pages/LinksPage.tsx`

## feat: soft-delete & visual hierarchy for admin applications

- Added `deletedAt` field to `Application` type — soft-delete without losing original status
- **ApplicantCard**: trash icon overlay on hover (delete), archive-restore icon (restore), `dimmed` prop for rejected/deleted cards (opacity + desaturation)
- **ApplicantModal**: "DELETED" banner on photo, "Move to Deleted" / "Restore" footer buttons
- **AdminDashboard**: active/deleted partition with rejected apps dimmed & sorted to bottom; collapsible "Deleted Applications" section; header shows active count
- No Firestore migration needed — existing docs without `deletedAt` default to active

**Files:** `src/types/application.ts`, `src/components/admin/ApplicantCard.tsx`, `src/components/admin/ApplicantModal.tsx`, `src/components/admin/AdminDashboard.tsx`

## feat: add email icon to bottom socials row

- Added Mail icon to the SOCIALS array on the Links page
- Links to `mailto:contact@garammasaladating.com`
- Bottom social row now shows: Instagram, TikTok, YouTube, Email

**Files:** `src/pages/LinksPage.tsx`

## update: press email, landing page tagline, and creator hyperlinks

- Changed press/collaborations mailto from `press@` to `contact@garammasaladating.com`
- Rewrote landing page tagline with new copy including creator names and venue
- Added hyperlinks: Surbhi → Instagram, Wyatt Feegrado → Instagram, Top Secret Comedy Club → website
- Links styled in gold (`#E2C97E`) with hover transition

**Files:** `src/pages/LinksPage.tsx`, `src/components/CenterBox/CenterBox.tsx`, `src/components/CenterBox/CenterBox.module.css`

## fix: replace Music2 with TikTok logo and add YouTube to bottom socials

- Created inline `TikTokIcon` SVG component since Lucide doesn't have a TikTok brand icon
- Replaced `Music2` (music note) with the actual TikTok logo in both the LINKS and SOCIALS arrays
- Added YouTube to the bottom social icon row with the existing `Youtube` Lucide icon
- Removed unused `Music2` import

**Files:** `src/pages/LinksPage.tsx`
