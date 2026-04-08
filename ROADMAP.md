# Garam Masala Dating — Full-Time Growth Roadmap

> Created 2026-04-08. This is the master document for growing GMD from a hobby site to a full-time revenue machine. Contains all research, best practices, and actionable items. Intended to survive across sessions — don't delete, keep updating.

---

## Table of Contents

1. [Revenue Model & Projections](#1-revenue-model--projections)
2. [Conversion Optimization Research](#2-conversion-optimization-research)
3. [SEO & AEO Research](#3-seo--aeo-research)
4. [Monetization Research](#4-monetization-research)
5. [Actionable Roadmap](#5-actionable-roadmap)
6. [Codebase Cleanup Items](#6-codebase-cleanup-items)
7. [Architecture Decisions](#7-architecture-decisions)

---

## 1. Revenue Model & Projections

### Current Revenue (April 2026)
- $15 tickets × 250 seats = $3,750 gross/show
- Minus Eventbrite fees (~$1.29 + 3.7% per ticket) = ~$3,250 net/show
- At bi-weekly shows ≈ $6,500-7,000/month

### Target Revenue Streams

| Stream | Monthly Estimate | Implementation Effort |
|--------|-----------------|----------------------|
| Ticket sales (current) | $6,500-7,000 | — |
| VIP tier ($30-50) | +$2,000-4,000 | Low — Eventbrite config |
| Sponsorships | +$3,000-8,000 | Medium — media kit + outreach |
| Email-driven ticket sales | +$1,000-2,000 | Medium — Klaviyo setup |
| Merchandise | +$1,000-2,000 | Medium — Fourthwall/Shopify |
| Ad revenue (content pages) | +$500-2,500 | Low — AdSense → Mediavine |
| **Total potential** | **$14,000-25,500/mo** | |

### VIP Tier Details
- Standard: $15 (current)
- Priority: $30 (front-row seating, priority mixer)
- VIP: $49 (front row + meet hosts + priority mixer + drink token)
- "Rule of Three" pricing psychology — anchor high, middle feels reasonable
- If 15% of 250 seats go VIP: +$1,375/show minimum

### Sponsorship Tiers
**Target sponsors:** Dil Mil, Hinge, Bumble, Hennessy, Grey Goose, chai brands, South Asian restaurants, Glossier, Fenty, Netflix (South Asian content), local NYC businesses

| Tier | Price/Show | Includes |
|------|-----------|----------|
| Presenting | $3,000-5,000 | Logo everywhere, 60s host mention, product placement, social package (3 posts + stories), 10 tickets + VIP, category exclusivity |
| Gold | $1,500-2,500 | Logo on signage, 30s mention, 1 post + stories, 4 tickets |
| Silver | $500-1,000 | Logo on signage, story mention, 2 tickets |
| In-Kind | Trade value | Product for gift bags/prizes, logo + social mention |

**Media kit needs:** One-page overview, audience demographics, reach numbers (10M+ views, 2K+ attendees, email list), social proof, tiers, past sponsors, contact.

---

## 2. Conversion Optimization Research

### Benchmark Data (Source: Wisepops 2026, 1B popup displays)

| Metric | Value |
|--------|-------|
| Average popup conversion rate | 4.82% |
| Mobile popup conversion | 4.98% (36% higher than desktop) |
| Top 10% of campaigns | 57.7% conversion |
| With countdown timer | 12.84% (vs 4.73% without — **171% increase**) |
| With incentive | 7.45% (vs 4.60%) |
| Multi-step popups | 5.17% (vs 4.62%) |
| Optimal delay | 11-15 seconds (6.45% CVR) |
| Best pageview trigger | After 2 pages (9.84% CVR) |
| 3-field forms | 7.86% (highest) |
| New visitors only | 8.30% |

### Social Proof That Converts (In Order of Effectiveness)
1. **Video clips from actual shows** — people need to SEE the energy
2. **User-generated content** — audience TikToks/Reels embedded
3. **Specific numbers** — "40+ sold out shows", "2,000+ audience members"
4. **Testimonials with names** — already have (Priya, Dev, Ava & Rohan)
5. **Press logos** — already have
6. **Star rating badge** — "4.9/5 from 2,000+ attendees"

### Urgency/Scarcity Tactics
- **Countdown timer** on show cards — "Starts in X days" (171% conversion lift)
- **Ticket quantity** — "Only X tickets remaining" (pull from Eventbrite API or estimate)
- **Price tier deadlines** — "Early bird ends Friday"
- **Sold out badges** on past shows (already doing this)
- **Do NOT use:** fake urgency, fake scarcity, spin-to-win popups (cheapens the brand)

### Checkout Friction Reduction
- Eventbrite checkout is external (can't control their UX)
- Minimize clicks to reach Eventbrite — CTA visible without scrolling on mobile
- Open Eventbrite in new tab (`target="_blank"`) so users don't lose the site
- "Secure checkout via Eventbrite" trust badge near CTA
- Pre-populate UTM params so users land on exact event page

### Mobile-Specific (98% of traffic)
- CTA button thumb-reachable (bottom 40% of screen)
- Sticky "Get Tickets" bar on scroll for home + tickets pages
- Tap targets 48px minimum (already in design standards)
- Page load under 2.5s LCP
- **No interstitials on mobile** — Google penalizes mobile interstitial ads

### Email Marketing Benchmarks
- Welcome series: 45-50% open rates, 8-12% conversion rates
- Event announcement campaigns: expect 2-5% ticket conversion per send
- 5,000 subscribers × 3% conversion = 150 ticket sales = $2,250/campaign
- Email marketing ROI: $36 return per $1 spent (industry average)
- Subject lines under 50 characters get 23% higher open rates

### Email Automation Flows (Priority Order)
1. **Welcome Series (5 emails, 14 days):** "You're in" → social proof → BTS → FAQ → direct CTA
2. **Show Announcement:** New show → 48hr follow-up to non-openers
3. **Pre-Event Hype:** 7 days → 3 days → day of
4. **Post-Event:** Recap + clip → next show announcement
5. **Win-Back:** 60-day inactive re-engagement

### Popup Best Practices
- **Content pages (journal, tips, cities):** 50% scroll depth OR 15s delay, email capture
- **Home/tickets pages:** DO NOT use email capture popups (these are conversion pages)
- **Exit intent:** Desktop only (unreliable on mobile, Google penalizes)
- **Frequency:** Once per session, suppress 30 days after conversion
- **Mobile:** Scroll-triggered slide-up from bottom (not full-screen), easily dismissable (48px close)

---

## 3. SEO & AEO Research

### AEO (AI Engine Optimization) — How to Appear in ChatGPT/Gemini/Claude/Perplexity

**Key finding:** FAQPage schema has 2.7x higher AI citation rate (41% vs 15% without). Pages with attribute-rich schema earn 61.7% citation rate.

**Implementation checklist:**
- [x] robots.txt allows GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended
- [ ] Add OAI-SearchBot (OpenAI's ChatGPT search discovery bot)
- [ ] Add Claude-SearchBot, Applebot-Extended, DuckAssistBot, meta-externalagent, Amazonbot, cohere-ai
- [ ] Create `/llms.txt` — markdown file telling LLMs what this site is (844K+ sites adopted)
- [ ] Add `<link rel="alternate" type="text/markdown" href="/llms.txt" />` to `<head>`
- [ ] Add Speakable schema on homepage and FAQ (marks passages for AI voice/citation extraction)
- [ ] Ensure definition-led openings: "[Entity] is a [category] that [differentiator]"
- [ ] Include specific citable numbers ("250-person audience", "weekly shows since 2022")
- [ ] Refresh date-sensitive pages quarterly (AI models weight content freshness)

**Platform-specific:**
- **ChatGPT:** Favors depth, comprehensiveness. Uses GPTBot (training) + OAI-SearchBot (search)
- **Perplexity:** Real-time web search, heavily weights recency
- **Gemini:** Google authority signals + Knowledge Graph
- **Claude:** Uses ClaudeBot for citation retrieval

### Google Knowledge Panel Path

**Steps:**
1. Create Wikidata entry: "Garam Masala Dating" → instance of: live event series, official website, inception 2022, country US, located in NYC, all social links
2. Create Crunchbase listing, LinkedIn Company page
3. Ensure consistent NAP (Name, Address, Phone) across all external listings
4. Organization schema `sameAs` must link to: Wikidata, all social profiles, Eventbrite, press mentions
5. Add `alternateName: ["Garam Masala Dating Show", "GMS Dating"]` to disambiguate from spice/movie
6. Claim the panel once it appears (Google search → "Claim this knowledge panel")
7. **Timeline:** 3-6 months for entity recognition, 6-12 months for panel

### Entity Signal Tightening
- Every page title includes "Garam Masala **Dating**" (not just "Garam Masala")
- Every meta description includes "dating show" or "live dating show"
- Organization schema name: "Garam Masala Dating"
- Add `alternateName` array to Organization schema
- Win specific keywords first: "garam masala dating", "south asian dating show nyc", "indian singles event nyc", "desi dating show" — NOT the ambiguous "garam masala" head term

### Schema Upgrades
- [ ] Event → ComedyEvent (officially supported, more specific, same rich results)
- [ ] Add `performer` array (Surbhi + Wyatt as Person types)
- [ ] Add `doorTime`, `maximumAttendeeCapacity: 250`, `typicalAgeRange: "21-"`, `isAccessibleForFree: false`
- [ ] FAQPage schema on homepage (currently only on /faq)
- [ ] FAQPage schema on city pages with local questions
- [ ] Speakable schema on homepage + FAQ
- [ ] AggregateRating on testimonials (if enough data points)

### Local SEO (Multi-City Events)
- Dedicated city pages with unique content (already have 325 pages)
- Each page needs: unique local copy, FAQs, local evidence, cultural context, nearby city cross-links
- LocalBusiness + Event schema per city (already have)
- Target keywords per city: "[City] dating events", "[City] singles events", "South Asian dating [city]"
- Google Business Profile per active city
- Get listed on local event directories (Time Out, Eventbrite, local culture blogs)

### Social Search Optimization (TikTok, Instagram)
- 49% of Americans use TikTok as a search engine (64% of Gen Z)
- Instagram public content from professional accounts indexed by Google since July 2025
- **Captions:** Use natural search phrases ("The live dating show South Asian singles in NYC are obsessed with")
- **Spoken keywords:** TikTok transcribes audio — SAY keywords out loud in videos
- **On-screen text:** TikTok OCR scans text overlays — add "NYC Dating Show" etc.
- **3-5 targeted hashtags:** #southasiandating #nycsingles #livedatingshow #desidating #comedydatingshow
- **Instagram bio keywords:** "Live Comedy Dating Show | NYC | South Asian Singles"
- **Alt text on every post** — descriptive for search indexing
- **Reels:** Instagram prioritizes Reels in search, create with spoken/on-screen keywords

### Featured Snippets & People Also Ask
- Featured snippets dropped 64% visibility (AI Overviews replacing them)
- **People Also Ask visibility EXPLODED 34.7%** — 63% of PAA interactions on mobile
- Structure: H2 question heading → 40-60 word direct answer → then expand
- Target PAA questions: "What is a live dating show?", "South Asian dating events in NYC", "How to attend a live dating show", "Best singles events in NYC"

### robots.txt Complete AI Crawler List (2026)
```
User-agent: GPTBot          # OpenAI training
User-agent: OAI-SearchBot   # ChatGPT search indexing
User-agent: ChatGPT-User    # User-initiated fetches
User-agent: ClaudeBot        # Anthropic citation retrieval
User-agent: Claude-SearchBot # Claude search
User-agent: anthropic-ai    # Anthropic training
User-agent: PerplexityBot   # Perplexity search
User-agent: Google-Extended  # Gemini training
User-agent: Applebot-Extended # Apple Intelligence
User-agent: DuckAssistBot   # DuckDuckGo AI
User-agent: Amazonbot        # Amazon/Alexa AI
User-agent: cohere-ai       # Cohere AI
User-agent: Bytespider       # ByteDance/TikTok AI
User-agent: meta-externalagent # Meta AI
User-agent: FacebookBot      # Meta content preview
```
All should be `Allow: /` for maximum AI visibility.

### llms.txt Format
Located at `/llms.txt`, written in Markdown. Required: H1 with project name. Optional: blockquote summary, H2 sections with links.
```markdown
# Garam Masala Dating

> Garam Masala Dating is New York City's live comedy dating show for South Asian singles...

## About
- [Homepage](https://garammasaladating.com/): Main landing page...
## Tickets & Events
...
```

---

## 4. Monetization Research

### Ad Revenue Expectations

| Network | RPM (per 1K pageviews) | Monthly Revenue (100K) | Requirement |
|---------|----------------------|----------------------|-------------|
| Google AdSense | $1-5 | $100-500 | None |
| Mediavine | $15-25 | $1,500-2,500 | 50K sessions |
| Raptive (AdThrive) | $20-30 | $2,000-3,000 | 100K pageviews |

**Jump from AdSense to Mediavine is 5-10x revenue for the same traffic.**

### Where to Place Ads
**YES (content pages only):**
- `/journal/[slug]` — in-article after 2nd paragraph, mid-article, end
- `/south-asian-dating-tips/[slug]` — same pattern
- `/cities/[slug]` — in-content
- `/faq` — between FAQ sections

**NEVER on conversion pages:**
- `/` (home), `/tickets`, `/apply`, `/links`, `/hosts`

### Eventbrite Conversion Tracking
- **UTM Parameters:** `?utm_source=website&utm_medium=cta&utm_campaign={show-date}&utm_content={placement}`
- **Meta Pixel + CAPI:** Eventbrite dashboard > Marketing > Tracking Pixels > Add Meta Pixel ID + CAPI token → fires `Purchase` event on checkout
- **GA4:** Same tracking pixels section, fires pageview + purchase events
- **Post-purchase redirect:** Set in Eventbrite to `/thank-you` page on your domain
- **Eventbrite Tracking Links:** Create per-channel (website, IG bio, email, SMS, partners)
- **Eventbrite API:** Orders endpoint for real-time sales data by source

### Content Marketing Funnel
**Stage 1 (Top): SEO Discovery** — Journal/tips/cities pages capture search traffic
**Stage 2 (Middle): Email Capture** — Content readers become subscribers via forms/popups
**Stage 3 (Bottom): Email→Ticket** — Automation flows convert subscribers to buyers at 2-5%

**Content that converts:**
- "Best things to do in NYC this weekend" type posts
- Show recaps with photos/clips (FOMO + social proof)
- "What it's like to go on a date in front of 250 people" (curiosity)
- City landing pages (local SEO capture)
- Dating tips with contextual show CTAs

**Content that does NOT convert:**
- Generic listicles with no show connection
- Content without any CTA (informational dead ends)
- Pure sales pitches disguised as articles

---

## 5. Actionable Roadmap

### Phase 1: Fix What's Broken ⬜

#### 1.1 PostHog Distinct ID Bug
- **Problem:** Apply form (`src/components/apply/useApplyForm.ts:291`) calls `trackLeadEvent('apply_submitted')` but NEVER calls `identifyLead()`. Applicants stay anonymous.
- **Also:** Race condition — PostHog generates anonymous ID on page load, `identifyLead()` called later on form submit. Anonymous session exists separately.
- **Fix:** Add `identifyLead(email, { name, city })` in `useApplyForm.ts` before `trackLeadEvent`. Consider `posthog.reset()` before `identify()` for clean merge.
- **Files:** `src/components/apply/useApplyForm.ts`, `src/lib/analytics.ts`

#### 1.2 Create `.env.example`
- All env vars from `.env.local` with placeholder values, grouped by service
- **File:** `.env.example` (new)

#### 1.3 Merge ENHANCEMENT.md into ENHANCEMENTS.md
- Merge unique items from ENHANCEMENT.md into ENHANCEMENTS.md
- Delete ENHANCEMENT.md
- **Files:** `ENHANCEMENT.md` (delete), `ENHANCEMENTS.md` (update)

### Phase 2: Image Cleanup ⬜

#### 2.1 Delete Redundant Formats
- `public/images/hosts.JPG` (315KB) — DELETE (webp + avif already exist)

#### 2.2 Organize Into Subfolders
```
public/images/
├── hero/           # hero.webp, hero.avif, hero-mobile.webp, hero-mobile.avif
├── hosts/          # hosts.webp, hosts.avif, surbhi.webp, wyatt.avif
├── show/           # keep descriptive names or rename numbered → descriptive
├── promo/          # after-party, on-stage, tickets-hero, links-hero, testimonial-reaction,
│                   # pure-chaos, the-match, the-crowd, magic-moment, cupid-garden, higgs-field
├── journal/        # journal-featured.webp
├── ai-art/         # hf-01 → hf-26 (keep numbered, pool-assigned via slugToImageIndex)
└── (root)          # logo.svg, favicon.svg, og-image.jpg
```

#### 2.3 Update All Image References
- Grep every image path, update to new subfolder paths
- **Files to update:** `HomePhotos.astro`, `HomeHero.astro`, `HomeStats.astro`, `HomeTestimonials.astro`, `hosts.astro`, `links.astro`, `BaseLayout.astro`, `src/data/images.ts`

### Phase 3: Unified Modal System ⬜

#### 3.1 Create Common Modal Base
- `src/components/ui/Modal.astro` — shared Astro modal (backdrop, close, escape, focus trap, ARIA)
- `src/components/ui/ModalReact.tsx` — shared React modal (same behavior for client-side)
- `src/components/ui/Modal.module.css` — shared styles

#### 3.2 Create Common Lead Capture Modal
- `src/components/LeadCaptureModal.astro` — accepts `copy` prop for context-specific text
- Same 2-step email → phone flow everywhere
- Same server-side lead capture (see Phase 8)
- Same PostHog tracking (`identifyLead` + `trackLeadEvent`)
- **Props:** `source`, `heading`, `subheading`, `emailPlaceholder`, `successMessage`

#### 3.3 Refactor Existing Modals
- `NotifyModal.astro` → use `Modal.astro` base
- `TermsModal.tsx` → use `ModalReact.tsx` base
- `ApplicantModal.tsx` → use `ModalReact.tsx` base

### Phase 4: Email Capture on Every Page ⬜

#### 4.1 Spice List Section Above Footer on ALL Pages
- **What:** Full-width "Join the Spice List" section that appears ABOVE the footer on every page
- **NOT inside the footer** — separate section with its own background (keep the full-width dark background)
- **Implementation:** Create `src/components/SpiceListSection.astro` and add it to `BaseLayout.astro` before `HomeFooter`
- **Uses:** `LeadCaptureModal` component internally
- **Copy:** "Get cheap & free tickets before anyone else. Just discount codes and show announcements."

#### 4.2 Links Page (`src/pages/links.astro`)
- **Reorder:** "Get on the List" FIRST (most prominent), Apply second (less prominent, already in header)
- "Get on the List" opens LeadCaptureModal with copy: "Cheap and free tickets, exclusive drops"

#### 4.3 FAQ Page (`src/pages/faq.astro`)
- Add 3-5 new FAQ questions with organic email capture CTAs embedded in answers:
  1. "When is the next Garam Masala Dating show?" — ends with "drop your email" link → modal
  2. "Is Garam Masala Dating free?" — "Add your email for discount codes and free ticket drops" → modal
  3. "What cities is Garam Masala Dating in?" — "Don't see your city? Tell us where you are" → modal with city field
  4. "How is Garam Masala Dating different from Indian Matchmaking?" — entity differentiation
  5. "Can I attend if I'm not South Asian?" — inclusive messaging + broader SEO
- All links must be crawlable `<a href>` (not just JS click handlers) for SEO
- Progressive enhancement: link to `/tickets`, modal trigger on top

#### 4.4 Journal Pages (`src/pages/journal/[slug].astro`)
- **Mid-article CTA** (after ~3rd content block): "We host a live dating show for South Asian singles. Weekly in NYC, traveling to new cities. [Get tickets →](/tickets) or [join our list] for discount codes."
- **End-of-article:** Full LeadCaptureModal embed
- **"Don't see your city?"** section after CTA
- **Keep existing "Apply to be on the show" link**

#### 4.5 Hosts Page (`src/pages/hosts.astro`)
- After EACH host bio: inline CTA "Want to see [host] live? [Get tickets →](/tickets)"
- Keep Apply + Tickets buttons after both bios
- Spice list section appears via BaseLayout (Phase 4.1)

#### 4.6 Tickets Page (`src/pages/tickets.astro`)
- After all event cards, add "Don't see your city?" section
- "We're expanding fast. Tell us where you are." → LeadCaptureModal with city field

### Phase 5: CSS & Code Quality ⬜

#### 5.1 Fix Hardcoded Colors
- `src/components/ApplyPage.module.css` — `#3d3532` (7x), `#888`, `#555`, `#444`, `#666`, various rgba → CSS variables
- `src/components/admin/ApplicantModal.module.css` — lightbox rgba values → CSS variables
- `src/components/admin/ApplicantCard.tsx` — inline `style={{ color: '#fff' }}` → CSS classes
- `src/index.css` — add new variables: `--apply-brown`, `--hover-light`, `--lightbox-bg`

#### 5.2 Extract Shared Admin Display Logic
- Create `src/components/admin/ApplicantInfo.tsx` — shared component for Instagram parsing, status badges, info display
- Used by both `ApplicantCard.tsx` and `ApplicantModal.tsx`

#### 5.3 Extract Event Date Parsing Utility
- `HomeHero.astro` and `HomeShows.astro` both parse event dates with duplicate logic
- Extract `parseMonth()`, `parseDay()`, `isUpcoming()` to shared utility (may already exist in `src/utils/eventDate.ts` — check and extend)

#### 5.4 Split Large Files
- `HomeShows.astro` (456 lines) — extract event card into separate component, extract request-city dialog
- `HomeHero.astro` (408 lines) — extract hero pill / next-show logic
- `ApplyPage.tsx` (565 lines) — extract form sections into sub-components

#### 5.5 Move Hardcoded Copy to Data Files
From ENHANCEMENTS.md (CodeRabbit items):
- HomeShows copy → `src/data/copy.ts`
- HomeHero text → `src/data/copy.ts`
- HomeVideo text → `src/data/copy.ts`
- ApplyPage form copy → `src/data/applyForm.ts`
- NotifyModal copy → `src/data/copy.ts`

### Phase 6: Enrich City Pages (SEO) ⬜

#### 6.1 Add FAQ Sections to ALL City Pages
- Every city page gets 3-5 locally relevant FAQ questions:
  - "Where is the dating show in [city]?"
  - "How to get tickets for Garam Masala Dating in [city]?"
  - "When is the next show in [city]?"
  - "Is there a South Asian dating scene in [city]?"
- Add FAQPage JSON-LD alongside existing LocalBusiness schema
- **Files:** City data files in `src/data/cities/`, `src/pages/cities/[slug].astro`

#### 6.2 Enrich City Content
- Add more unique local substance to each city page:
  - Local cultural context (South Asian community size, notable neighborhoods)
  - Venue information (even if "coming soon" — describe the type of venue we're looking for)
  - Internal cross-links to nearby cities (already have `nearbyCities`)
  - Local event scene context
- **Never reduce, template, or noindex any city page. Only add more.**

#### 6.3 Add Email Capture to City Pages
- City pages should have the LeadCaptureModal for "Don't see your city?" / "Notify me when we come to [city]"
- Already partially done via NotifyModal on active/TBA cities — extend to all

### Phase 7: Schema & Discoverability Upgrades ⬜

#### 7.1 Upgrade Event Schema to ComedyEvent
- `src/utils/eventSchema.ts` — `@type: "Event"` → `@type: "ComedyEvent"`
- Add `performer`, `doorTime`, `maximumAttendeeCapacity: 250`, `typicalAgeRange: "21-"`, `isAccessibleForFree: false`

#### 7.2 FAQPage Schema on Homepage
- `src/pages/index.astro` — add FAQPage JSON-LD using FAQ data from `src/data/copy.ts`

#### 7.3 Entity Signal Tightening
- All page titles include "Garam Masala **Dating**"
- All meta descriptions include "dating show" or "live dating show"
- Add `alternateName: ["Garam Masala Dating Show", "GMS Dating"]` to Organization schema
- Verify Organization schema in `src/pages/index.astro`

#### 7.4 Create `/llms.txt`
- `public/llms.txt` — markdown file for AI discoverability
- Add `<link rel="alternate" type="text/markdown" href="/llms.txt" />` to BaseLayout

#### 7.5 Update `robots.txt`
- Add all missing AI crawlers (OAI-SearchBot, Claude-SearchBot, Applebot-Extended, DuckAssistBot, meta-externalagent, Amazonbot, cohere-ai)

#### 7.6 Speakable Schema
- Add `SpeakableSpecification` to homepage and FAQ marking most citable passages

### Phase 8: Server-Side Lead Capture ⬜

#### 8.1 Create Lead Capture API Endpoint
- `src/pages/api/capture-lead.ts` — POST endpoint using Firebase Admin SDK (server-side)
- Accepts: email, phone, source, attribution data
- Writes to Firestore `leads` collection
- **Removes 353KB Firebase client bundle from all marketing pages**
- Firebase client stays ONLY on `/apply` (needs Storage) and `/admin` (needs Auth)

### Phase 9: Conversion Enhancements ⬜

#### 9.1 Sticky "Get Tickets" Bar on Mobile
- Fixed bottom bar on home + tickets pages
- Shows next show date + "Get Tickets" CTA
- Appears after scrolling past hero
- 48px height, brand-red, pure CSS (zero JS)

#### 9.2 Countdown Timer on Show Cards
- "Starts in X days" on each upcoming show card
- Server-rendered at build time for SSG
- Optional client-side JS for live countdown on tickets page

#### 9.3 Social Proof on Tickets Page
- "4.9/5 from 2,000+ attendees" badge
- 2-3 embedded TikTok/Instagram clips
- "Secure checkout via Eventbrite" trust badge

#### 9.4 Post-Purchase Thank You Page
- `src/pages/thank-you.astro` — redirect target from Eventbrite post-purchase
- "You're in!" + show details + "Apply to be on stage" + social share + email signup + next show

#### 9.5 Standardize Eventbrite UTM Params
- Create `buildEventbriteUrl(baseUrl, placement)` utility
- Every Eventbrite link gets: `utm_source=website&utm_medium=cta&utm_campaign={date}&utm_content={placement}`

### Phase 10: Performance ⬜

#### 10.1 Code-Split citySearch (666KB)
- Dynamic import `country-state-city` only when city field is focused
- Currently loads synchronously in ApplyPage bundle

#### 10.2 Responsive Images
- Add `srcset` and `sizes` attributes
- Serve 320px, 640px, 1200px variants
- Use `<picture>` with AVIF/WebP/JPG fallback chain
- Consider Astro's `<Image>` component for auto-optimization

#### 10.3 Preconnect Hints
- Add `<link rel="preconnect">` for PostHog, GTM, Facebook in BaseLayout

#### 10.4 Skeleton Loaders
- Show branded loading state during React hydration (ApplyPage, AdminPage)

#### 10.5 Prefetch Key Pages
- Add `data-astro-prefetch` to Apply and Tickets nav links
- Or `<link rel="prefetch" href="/apply" />` in homepage

### Phase 11: Security ⬜

#### 11.1 Rate Limiting on API Endpoints
- `api/notify-application.ts`, `api/city-search.ts`
- Vercel Edge rate limiting or token bucket

#### 11.2 CAPTCHA on Application Form
- Cloudflare Turnstile (free, privacy-friendly) before form submission

#### 11.3 File-Type Validation on Photo Uploads
- Validate JPEG/PNG/WebP only, < 5MB, client AND server

### Phase 12: External Actions (Not Code) ⬜

#### 12.1 Wikidata Entry
- Create item: "Garam Masala Dating", instance of: live event series, official website, inception 2022, country US, located in NYC

#### 12.2 Google Business Profile
- Create as "Event planner", NYC service area
- Weekly Google Posts with upcoming shows

#### 12.3 Crunchbase + LinkedIn Company Page
- Cross-links improve entity recognition

#### 12.4 IMDb Listing
- Triggers Knowledge Panel recognition, establishes as entertainment entity

#### 12.5 Klaviyo Setup
- Connect Firestore leads → Klaviyo
- Build welcome series (5 emails)
- Build show announcement + hype flows

#### 12.6 Eventbrite Meta Pixel + CAPI
- Dashboard config: add Meta Pixel ID + Conversions API token

#### 12.7 VIP Ticket Tier
- Configure in Eventbrite: Standard $15, Priority $30, VIP $49

#### 12.8 Sponsorship Outreach
- Create media kit (Canva/Figma)
- Create `/sponsors` or `/partner` page
- Begin outreach to target brands

#### 12.9 Google AdSense
- Apply for AdSense
- Add to journal, tips, city pages ONLY
- Apply to Mediavine at 50K sessions

---

## 6. Codebase Cleanup Items

### From ENHANCEMENTS.md (CodeRabbit PR #11)
These are logged but not yet addressed:

- [ ] Add loading="lazy" to admin photo images (`ApplicantModal.tsx:97`)
- [ ] Move HomeShows copy into src/data/ (`HomeShows.astro:26`)
- [ ] Split request-city flow out of HomeShows (`HomeShows.astro:209`)
- [ ] Add aria-hidden to HomeShows close icon SVG (`HomeShows.astro:72`)
- [ ] Replace hardcoded colors in HomeShows (`HomeShows.astro:231`)
- [ ] Increase HomeShows modal close button hit area to 48px (`HomeShows.astro:405`)
- [ ] Add :focus-visible to HomeShows modal inputs (`HomeShows.astro:431`)
- [ ] Replace hardcoded white in HomeVideo (`HomeVideo.astro:84`)
- [ ] Move ApplyPage form copy into src/data/ (`ApplyPage.tsx:78`)
- [ ] FieldGroup/react-select accessibility wiring (`ApplyPage.tsx:256`)
- [ ] Add aria-invalid/aria-describedby to remaining apply fields (`ApplyPage.tsx:275`)
- [ ] Move HomeHero text into src/data/ (`HomeHero.astro:37`)
- [ ] Use nyOffset for timezone-aware event end times (`HomeHero.astro:85`)
- [ ] Fix font-size below 16px on interactive elements (`HomeHero.astro:224`)
- [ ] Split HomeVideo component (`HomeVideo.astro:184`)
- [ ] Move HomeVideo copy into src/data/ (`HomeVideo.astro:10`)
- [ ] Add aria-describedby to request-city form fields (`HomeShows.astro:83`)
- [ ] Guard city autocomplete against API failure (`HomeShows.astro:170`)
- [ ] Add aria-describedby on newsletter signup fields (`HomeSignup.astro:14`)
- [ ] Move NotifyModal copy into src/data/ + split component (`NotifyModal.astro:184`)
- [ ] Finish NotifyModal inline error accessibility wiring (`NotifyModal.astro:11`)
- [ ] Reset NotifyModal state on reopen (`NotifyModal.astro:76`)

### From CLS Audit (ENHANCEMENT.md)
- [ ] Apply page skeleton loader (HIGH)
- [ ] Admin modal error message min-height reservation (HIGH)
- [ ] Photo upload placeholder div (HIGH)
- [ ] Nomination section max-height transition (HIGH)
- [ ] Geo dropdown always-render pattern (HIGH)
- [ ] Scrollbar-width compensation on scroll-lock (HIGH)
- [ ] Admin dashboard skeleton rows (MEDIUM)
- [ ] Contestant prep section pre-reserve (MEDIUM)

### Additional Cleanup
- [ ] Shared UI components: `Button.astro`, `Section.astro`
- [ ] Astro Content Collections for journal/tips
- [ ] Astro `<Image>` component for auto image optimization
- [ ] Prettier configuration (optional)
- [ ] Unify FAQ content between homepage and /faq
- [ ] Copyright year → dynamic `new Date().getFullYear()`

---

## 7. Architecture Decisions

### Stay on Astro (Decision: 2026-04-08)
**Verdict:** Astro is the right framework. Not switching to Next.js.
- 98% static content → Astro SSG ships zero JS on static pages
- React islands only where needed (apply form, admin)
- Next.js would ship MORE JavaScript (React runtime on every page)
- The "messy" feeling is organization, not framework. Same problems would exist in Next.js.
- Migration would take ~2 weeks and gain nothing.

### Firebase Client Only on Apply + Admin
- Marketing pages use server-side API endpoint for lead capture
- Apply page keeps Firebase client (needs Storage for photo upload)
- Admin keeps Firebase client (needs Auth)

### Ads Only on Content Pages
- Never on home, tickets, apply, links, hosts
- Only on journal, tips, city pages
- Start with AdSense, graduate to Mediavine at 50K sessions

### City Pages Are Sacred
- All 325 pages have unique SEO-optimized copy
- Never template, noindex, or reduce city content
- Only enrich with more unique content, FAQs, local evidence

### Hero Is Intentional
- Don't touch hero layout, copy, shader, or gradient
- Already communicates: #1 dating show, details, CTAs

### External Review Suggestions Need Critical Evaluation
- Don't blindly implement Codex/CodeRabbit suggestions
- Evaluate each against existing design decisions and SEO strategy

---

## 8. Complete Site Architecture Reference

### Pages (17 total)

| Route | Purpose | React Island? | Key Components |
|-------|---------|---------------|----------------|
| `/` | Landing / conversion hub | No (Astro only) | HomeHero, HomeMarquee, HomeExperience, HomeShows, HomeStats, HomePress, HomeTestimonials, HomeCreators, HomeVideo, HomeFAQ, HomeSignup |
| `/tickets` | Event listing + ticket purchase | No | Event cards, NotifyModal |
| `/apply` | Contestant application form | Yes (`client:only="react"`) | ApplyPage, useApplyForm, PhotoUploadField, TermsModal |
| `/links` | Linktree replacement (IG bio) | No | Events modal, Press modal |
| `/faq` | FAQ page | No | 13 Q&A pairs, FAQPage schema |
| `/hosts` | Host bios (Surbhi + Wyatt) | No | Photos, bios, Person schema |
| `/journal` | Journal hub page | No | Article list |
| `/journal/[slug]` | Individual blog posts | No | Article schema, AuthorBio, related articles |
| `/south-asian-dating-tips/[slug]` | Dating tips articles | No | Same as journal |
| `/cities` | Cities hub with regions | No | Region browser, city grid |
| `/cities/[slug]` | Individual city pages (325) | No | LocalBusiness + Event schema, NotifyModal |
| `/admin` | Protected admin dashboard | Yes (`client:load`) | AdminDashboard, ApplicantCard, ApplicantModal |
| `/contestant-prep` | Password-protected prep guide | Yes (`client:idle`) | ContestantPrepPage |
| `/privacy` | Privacy policy | No | Static content |
| `/terms` | Terms of service | No | Static content |
| `/404` | Custom 404 page | No | WebGL shader animation |

### Home Page Components (15 total, 2,757 lines)

| Component | Lines | Purpose |
|-----------|-------|---------|
| HomeHero.astro | 408 | WebGL shader hero, next-show pill, 2 CTAs |
| HomeShows.astro | 456 | Upcoming shows grid, "Notify Me" modal, "Request City" dialog |
| HomeSignup.astro | 256 | "Join the Spice List" — email → phone 2-step |
| HomeFooter.astro | 230 | Footer with social links, nav sections |
| HomeCreators.astro | 198 | Surbhi + Wyatt bios with photos |
| HomeExperience.astro | 192 | "How the Night Works" 6-step process |
| HomeFAQ.astro | 186 | 4-5 FAQ items with reveal animation |
| HomeVideo.astro | 184 | YouTube/Instagram video embeds |
| HomeNav.astro | 135 | Top navigation, logo, CTA buttons |
| HomePhotos.astro | 124 | Photo grid section |
| HomeTestimonials.astro | 111 | Testimonial carousel |
| HomeStats.astro | 101 | 5 stats (40+ shows, 2K+ audience, etc.) |
| HomePhotoBreak.astro | 63 | Full-width photo break |
| HomePress.astro | 60 | Press mentions |
| HomeMarquee.astro | 53 | Scrolling ticker (sold-out, views, etc.) |

### Data Files

| File | Lines | Content |
|------|-------|---------|
| `data/copy.ts` | ~200 | Site taglines, stats, testimonials, FAQs, experience steps, marquee items |
| `data/events.ts` | 132 | 40+ show events with dates, venues, Eventbrite URLs, taglines |
| `data/socials.ts` | ~30 | All social URLs (IG, TikTok, YT, Threads, X, FB, email) |
| `data/press.ts` | ~30 | Press mentions (Doctor Lawyer Comedian, Gen Zenophobic, Big Silly World) |
| `data/icons.ts` | ~100 | SVG icon definitions and social icons |
| `data/images.ts` | ~60 | Image pools (26 AI art + 13 show photos) with deterministic slug-to-image mapping |
| `data/cities/*.ts` | 9,051 | 325 cities across 16 files organized by region |
| `data/journal/*.ts` | 10,000+ | 17 journal categories (most are drafts) |
| `data/tips.ts` | ~200 | Dating tips articles |

### City Data Files (16 files, 9,051 lines total)

| File | Lines | Cities | Region |
|------|-------|--------|--------|
| active.ts | 199 | 2-3 | Manhattan, Jersey City (live shows) |
| us-northeast.ts | 427 | 6+ | Boston, Philadelphia, NYC area |
| us-southeast.ts | 452 | 8+ | Atlanta, Charlotte, Miami, Nashville |
| us-midwest.ts | 515 | 8+ | Chicago, Minneapolis, Columbus, Cleveland |
| us-south-texas.ts | 204 | 4 | Dallas, Houston, Austin, San Antonio |
| us-west.ts | 347 | 12+ | San Jose, Seattle, Portland, Phoenix, Vegas |
| canada.ts | 786 | 8+ | Toronto, Vancouver, Montreal, Calgary, Ottawa |
| india.ts | 1,320 | 14+ | Mumbai, Delhi, Bangalore, Hyderabad, Pune |
| uk.ts | 1,250 | 10+ | London, Manchester, Birmingham, Glasgow |
| australia.ts | 264 | 4+ | Sydney, Melbourne, Brisbane |
| europe.ts | 2,120 | 20+ | Paris, Berlin, Amsterdam, Zurich, Stockholm |
| southeast-asia.ts | 177 | 3+ | Singapore, Bangkok, Kuala Lumpur |
| east-asia.ts | 206 | 4+ | Tokyo, Seoul, Hong Kong, Shanghai |
| international-other.ts | 618 | 10+ | Africa, Caribbean, Pacific, Middle East |
| types.ts | 56 | — | CityData interface definition |
| index.ts | 110 | — | Aggregator + helpers |

### CityData Interface
```typescript
interface CityData {
  slug: string;
  displayName: string;
  titleTag: string;
  metaDescription: string;
  h1: string;
  bodyParagraphs: string[];     // 3-5 unique paragraphs per city
  ctas: CityCta[];              // Usually 2 (apply + waitlist/tickets)
  status: "active" | "coming-soon" | "past";
  badgeLabel: string;           // "Weekly Shows" / "Coming Soon"
  areaServed: string;           // LocalBusiness schema
  includeEventSchema: boolean;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
  venueName?: string;
  eventScheduleFrequency?: string; // ISO 8601 for recurring events
  region: CityRegion;
  nearbyCities: string[];       // 3-5 nearby city slugs for cross-linking
}
```

---

## 9. Complete Analytics & Tracking Reference

### Three Analytics Systems Running in Parallel

**1. PostHog** (`phc_qqPeeEMxGcVmknbpgvkgbNUbMEaBMQu2fXWyPV6kAmxD`)
- **API Host:** `https://us.i.posthog.com`
- **Loading:** Deferred via `requestIdleCallback` with 3s timeout (src/components/posthog.astro)
- **Events tracked:**
  - `lead_email_submitted` — when email captured (HomeSignup, NotifyModal)
  - `lead_phone_submitted` — when phone captured (HomeSignup, NotifyModal)
  - `notify_modal_opened` — when notify modal opens
  - `popup_opened` — when 30s homepage popup fires
  - `apply_submitted` — when application form submitted (BUT MISSING identifyLead — bug!)
- **User identification:** `identifyLead(email, properties)` calls `posthog.identify(email, {...})`
- **Lead attribution:** Tracks landing page, referrer, UTM params via `src/lib/leadAttribution.ts`

**2. Google Tag Manager** (`GTM-KQCBBL2W`)
- **Loading:** Deferred via `requestIdleCallback` with 3s timeout (src/components/gtm.astro)
- **Noscript fallback:** iframe for non-JS users
- **All events** pushed to `window.dataLayer` in parallel with PostHog

**3. Meta Pixel** (ID: `1469248418329402`)
- **Loading:** Deferred via `requestIdleCallback` with 3s timeout (src/components/meta-pixel.astro)
- **Events:** PageView on every page
- **Noscript fallback:** Image pixel

**4. Vercel Analytics**
- `@vercel/analytics` — Real User Monitoring (RUM)
- `@vercel/speed-insights` — Core Web Vitals tracking
- Injected in BaseLayout.astro

### Lead Attribution System (`src/lib/leadAttribution.ts`)
- Captures on first page load: landing page, referrer host, UTM params (source, medium, campaign, content, term)
- Stores in sessionStorage (first-click attribution)
- Attached to every lead/application written to Firestore
- Also captures `posthogDistinctId` via `window.posthog?.get_distinct_id?.()`

### PostHog Bug — Root Cause Analysis
1. PostHog loads async (2-3s delay), generates anonymous UUID as distinct_id
2. User browses pages — all events attributed to anonymous ID
3. User submits email form → `identifyLead(email)` called → `posthog.identify(email)`
4. PostHog merges anonymous session with email-identified profile
5. **But:** Events fired BEFORE identify (like `popup_opened`, `notify_modal_opened`) remain on anonymous profile
6. **Critical:** Apply form (`useApplyForm.ts:291`) NEVER calls `identifyLead()` — applicants stay permanently anonymous
7. **Your testing:** Each visit creates new anonymous ID. Multiple test submissions create multiple profiles.

### Email Capture Points (Current)

| Location | Type | Captures | PostHog Identify? | File |
|----------|------|----------|-------------------|------|
| Home popup (30s delay) | Modal | Email → phone | YES (HomeSignup.astro:61) | index.astro:135 |
| Home "Spice List" section | Inline form | Email → phone | YES (HomeSignup.astro:61) | HomeSignup.astro |
| "Notify Me" (tickets/cities) | Modal | Email → city → phone | YES (NotifyModal.astro:107) | NotifyModal.astro |
| Application form (/apply) | Full form | All fields + photo | **NO — BUG** | useApplyForm.ts:291 |
| Request City (home shows) | Mini dialog | City + email | Partial | HomeShows.astro |

### Pages WITH Email Capture
- `/` (home) — popup + spice list section + notify modal

### Pages WITHOUT Email Capture (Gaps to Fill)
- `/links` — no email capture at all
- `/faq` — no email capture
- `/journal/[slug]` — only "Apply" link at bottom
- `/hosts` — only Apply + Tickets buttons
- `/tickets` — only notify modal for TBA cities, no catch-all
- `/cities/[slug]` — only notify modal for specific city
- `/south-asian-dating-tips/[slug]` — no email capture

---

## 10. Complete Image Inventory

### Total: 54 files, ~4.5MB

**Root level (19 files):**
| File | Size | Used By | Notes |
|------|------|---------|-------|
| hero.webp | 94K | HomeHero.astro | Primary hero image |
| hero.avif | 71K | HomeHero.astro | AVIF variant |
| hero-mobile.webp | 83K | HomeHero.astro | Mobile viewport hero |
| hero-mobile.avif | 57K | HomeHero.astro | Mobile AVIF variant |
| hosts.webp | 88K | hosts.astro | Host photo |
| hosts.avif | 81K | hosts.astro | Host photo AVIF |
| hosts.JPG | 315K | **REDUNDANT — DELETE** | 4x larger than webp |
| after-party.webp | ~80K | HomePhotos.astro | Show photo |
| on-stage.webp | ~80K | HomePhotos.astro | Show photo |
| tickets-hero.webp | ~80K | tickets.astro | Tickets page hero |
| links-hero.webp | ~80K | links.astro | Links page hero |
| testimonial-reaction.webp | ~80K | HomeTestimonials.astro | Testimonial photo |
| pure-chaos.webp | ~80K | HomeStats.astro | Stats section photo |
| the-match.webp | ~80K | HomePhotos.astro | Show photo |
| the-crowd.webp | ~80K | HomeStats.astro | Crowd photo |
| magic-moment.webp | ~80K | HomePhotos.astro | Show photo |
| cupid-garden.webp | ~80K | ? | May be show photo |
| higgs-field.webp | ~80K | ? | May be show photo |
| journal-featured.webp | ~80K | Journal pages | Featured article image |
| surbhi.webp | ~50K | hosts.astro, HomeCreators | Surbhi portrait |
| wyatt.avif | 23K | hosts.astro, HomeCreators | Wyatt portrait (missing .webp fallback) |

**AI Art subfolder (26 files):**
- `ai-art/hf-01.webp` through `ai-art/hf-26.webp` (~110K each, ~2.9MB total)
- AI-generated images used as journal/tips article hero images
- Assigned via `slugToImageIndex()` in `src/data/images.ts` — deterministic, order-stable
- **Keep numbered** — renaming would break slug-to-image mapping

**Show subfolder (5 files):**
- `show/show-01.webp` through `show/show-05.webp` (~40K each, ~200K total)
- Real event photography used as city page hero images
- **Rename to descriptive** — these are not pool-assigned

**Other (3 files):**
- `og-image.jpg` (48K) — Open Graph social sharing image
- `hqdefault.jpg` — YouTube thumbnail (possibly orphaned)
- `photo.jpg` — Unknown purpose (check if referenced)

**Orphaned images to verify:** hqdefault.jpg, photo.jpg, cupid-garden.webp, higgs-field.webp

---

## 11. Complete Bundle & Performance Analysis

### Dependencies & Bundle Sizes

| Package | Disk Size | Shipped JS | Used Where |
|---------|-----------|------------|------------|
| country-state-city | 17MB | **666KB** | /apply only (city autocomplete) |
| firebase | 39MB | **353KB** | /apply (Firestore + Storage), /admin (Auth) |
| react + react-dom (19.2) | — | **178KB** | All React islands |
| react-select | 1.1MB | ~50KB | /apply (dropdown) |
| lucide-react | 44MB | Minimal | Icons (tree-shaken) |
| @vercel/analytics | — | ~5KB | All pages |
| jose | — | ~10KB | JWT verification (server) |

### Build Output (`dist/_astro`)

| File | Size | Notes |
|------|------|-------|
| citySearch chunk | **666KB** | country-state-city data embedded — NEEDS dynamic import |
| Firebase chunk | **353KB** | Full Firebase client — NEEDS lazy loading |
| Client chunk | **178KB** | React runtime + island hydration |
| Events data | 90KB | Event data hardcoded in bundle |
| ApplyPage | 35KB | Form component |
| AdminDashboard | 19KB | Admin UI |
| **Total JS** | **~1.5MB** | |

### Performance Budget vs Reality

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Total page weight | <500KB | ~500KB (static), ~1.5MB (/apply) | FAIL on /apply |
| JavaScript | <100KB gzipped (static) | 0KB (static pages) | PASS for static |
| LCP | <2.5s mobile 4G | ~2-3s | BORDERLINE |
| Lighthouse Performance | 90+ | ~85-90 (estimate) | BORDERLINE |
| Lighthouse Accessibility | 90+ | ~90+ | PASS |

### After Optimization (Projected)

| Metric | Current | After Fixes | Improvement |
|--------|---------|-------------|-------------|
| Home JS | ~700KB | ~100KB | -86% |
| Apply JS | 1.2MB | ~400KB | -67% |
| LCP | ~2-3s | ~1s | -50% |
| Image bandwidth (mobile) | ~2.5MB | ~1.2MB | -52% |

### What Ships Zero JS (Static Pages)
- `/` (home) — zero client JS (all Astro components)
- `/tickets` — zero (NotifyModal is Astro-only)
- `/faq` — zero
- `/hosts` — zero
- `/journal/[slug]` — zero
- `/cities/[slug]` — zero
- `/links` — zero
- `/privacy`, `/terms` — zero

### What Ships Client JS
- `/apply` — ApplyPage React island: 666KB + 353KB + 178KB + 35KB = **1.2MB**
- `/admin` — AdminDashboard: 353KB + 178KB + 19KB = **550KB**
- `/contestant-prep` — ContestantPrepPage: 178KB + ~20KB = **~200KB**

---

## 12. Complete CSS Architecture Reference

### Design Tokens (src/index.css, 148 lines)

**Colors:**
```css
--brand-red: #DC2626        /* Primary CTA, accents */
--brand-red-rgb: 220, 38, 38
--brand-red-dark: #b91c1c    /* Hover states */
--electric-yellow: #FFD600   /* Highlights, badges */
--off-white: #FFF8F0         /* Page background */
--off-white-rgb: 255, 248, 240
--charcoal: #1A1A1A          /* Body text */
--ink: #111                  /* Darkest text */
--spice-orange: #FF6D00      /* Secondary accent */
--muted: #6b6b6b             /* Secondary text (WCAG AA fixed) */
--text-secondary: #555
--text-tertiary: #777
--cream-warm: #FFF0E2
```

**Legacy admin aliases:**
```css
--cream: #FFF8F0
--text: #1A1A1A
--text-light: #595959
--border: rgba(0, 0, 0, 0.1)
--success: #22C55E
```

**Fonts:**
```css
--font-playfair: "Playfair Display"    /* Headings, 400-700 */
--font-body: "Nunito"                  /* Body, variable 200-1000 */
--font-cormorant: "Cormorant Garamond" /* Decorative italic */
```

**Layout & Accessibility:**
```css
--dialog-gutter: 16px
--backdrop: rgba(0, 0, 0, 0.5)
--touch-target: 48px
```

### Font Loading (214KB total)
| Font | Size | Preloaded? | Format |
|------|------|------------|--------|
| Playfair Display | 81KB (3 variants) | YES | WOFF2 |
| Nunito Variable | 95KB | YES | WOFF2 |
| Cormorant Garamond | 60KB (2 variants) | **NO — should preload italic** | WOFF2 |

All use `font-display: swap` and `unicode-range: U+0000-00FF` (Latin subset).

### CSS Module Files (6 total, ~2,500 lines)
1. `ApplyPage.module.css` — **1,902 lines** (LARGEST — forms, modals, success)
2. `AdminDashboard.module.css` — admin UI
3. `ApplicantModal.module.css` — modal styling
4. `AdminLogin.module.css` — login form
5. `ContestantPrepPage.module.css` — prep guide
6. `ErrorBoundary.module.css` — error display

### Hardcoded Values That Need CSS Variables
**ApplyPage.module.css:**
- `#3d3532` (brown, used 7 times) → needs `--apply-brown`
- `#888` → should use `--muted`
- `#555` → should use `--text-secondary`
- `#444` → should use `--text-secondary`
- `#666` → should use `--muted`
- `rgba(0,0,0,0.04/0.06/0.08)` hover states → need `--hover-*` variables

**ApplicantModal.module.css:**
- `rgba(0,0,0,0.45/0.65/0.92)` → need `--lightbox-*` variables

**ApplicantCard.tsx:**
- Inline `style={{ color: '#fff' }}` (3 instances) → CSS classes

---

## 13. Complete JSON-LD Schema Reference

### Homepage (`/`)
- **Organization:** name, url, logo, description, foundingDate (2022), sameAs (all socials), contactPoint
- **WebSite:** name, url (for Knowledge Graph)
- **Event (multiple):** One per upcoming event — name, startDate/endDate (NY timezone), eventStatus, attendanceMode, location (Place + PostalAddress), organizer, offers (price, currency, availability), image
- **MISSING:** FAQPage schema (HomeFAQ displays FAQs but no schema)

### FAQ Page (`/faq`)
- **FAQPage:** 13 Q&A pairs, mainEntity array
- **BreadcrumbList:** Home → FAQ

### City Pages (`/cities/[slug]`)
- **LocalBusiness:** areaServed, name, URL
- **Event (conditional):** eventScheduleFrequency, venue, organizer, performers
- **BreadcrumbList:** Home → Cities → [City Name]
- **MISSING:** FAQPage schema with local questions

### Journal Posts (`/journal/[slug]`)
- **Article:** headline, datePublished, dateModified, author (Person: Surbhi), publisher (Organization with logo), description, mainEntityOfPage
- **FAQPage (conditional):** if post has FAQs
- **BreadcrumbList:** Home → Journal → [Title]
- OG type: article, includes article:published_time, article:modified_time

### Dating Tips (`/south-asian-dating-tips/[slug]`)
- Same as journal: Article + optional FAQPage + BreadcrumbList

### Hosts Page (`/hosts`)
- **Person (x2):** Surbhi (jobTitle: "Stand-Up Comedian & Co-Creator"), Wyatt (jobTitle: "Co-Creator/Host"), worksFor: "Garam Masala Dating"
- **BreadcrumbList:** Home → Hosts

### Other Pages with Breadcrumbs
- `/apply` — Home → Apply
- `/tickets` — Home → Tickets

---

## 14. Complete Security Headers Reference (vercel.json)

```json
"X-Content-Type-Options": "nosniff",
"X-Frame-Options": "DENY",
"Referrer-Policy": "strict-origin-when-cross-origin",
"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
"Cross-Origin-Opener-Policy": "same-origin"
```

**CSP (Content Security Policy):**
- `default-src 'self'`
- `script-src` allows: GTM, GA, Facebook, TikTok, PostHog, Vercel Live, Instagram embed + `'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`
- `connect-src` includes: Firebase, PostHog, GTM, Facebook, Instagram, Eventbrite, Vercel
- `img-src` includes: Firebase Storage, social platforms, data: URIs
- `font-src 'self'` (local fonts only)
- `frame-src` includes: Eventbrite, YouTube, Instagram
- `worker-src 'self' blob:`

**Cache Control:**
- `/fonts/(.*)` → `public, max-age=31536000, immutable` (1 year)
- `/images/(.*)` → `public, max-age=31536000, immutable` (1 year)

**CSP Issue:** `'unsafe-inline'` for scripts required by GTM/analytics inline scripts. Nonce-based CSP would be better but requires Astro middleware coordination.

---

## 15. API Endpoints Reference

| Endpoint | Method | Purpose | Auth | Notes |
|----------|--------|---------|------|-------|
| `/api/notify-application` | POST | Send email notification via Resend | None | **No rate limiting — vulnerability** |
| `/api/city-search` | GET | City autocomplete from country-state-city | None | Returns top 5 + exact match |
| `/api/contestant-prep-auth` | GET/POST | Verify contestant prep link signature | HMAC-SHA256 | Uses CONTESTANT_PREP_SALT |
| `/api/generate-contestant-link` | POST | Generate signed prep link | Firebase ID token | Admin-only |

### Firestore Collections
- **`applications`** — contestant applications (name, age, gender, orientation, location, instagram, community, income, pitch, photoURL, status, notes, createdAt)
- **`leads`** — email/phone captures (email, phone, source, sourcePage, landingPage, referrerHost, UTM params, city, posthogDistinctId, createdAt)

---

## 16. Recommended llms.txt (Full Content)

```markdown
# Garam Masala Dating

> Garam Masala Dating is New York City's live comedy dating show for South Asian singles. Two real singles go on a blind date on stage in front of a 250-person audience, hosted by comedians Surbhi and Wyatt Feegrado. Shows are weekly in Manhattan and monthly in Jersey City. The show also features a singles mixer after every performance where all audience members can meet each other. Founded in 2022, Garam Masala Dating has sold out 40+ shows and been featured in multiple podcasts and press outlets.

## About
- [Homepage](https://garammasaladating.com/): Main landing page with upcoming shows, testimonials, press mentions, and FAQ
- [Meet the Hosts](https://garammasaladating.com/hosts): Surbhi and Wyatt Feegrado — the stand-up comedians behind the show
- [FAQ](https://garammasaladating.com/faq): Everything about attending, applying, what to expect, and how the show works

## Tickets & Events
- [Tickets](https://garammasaladating.com/tickets): All upcoming show dates, venues, and ticket links
- [Apply to Be a Contestant](https://garammasaladating.com/apply): Apply to go on a blind date on stage

## Content
- [Journal](https://garammasaladating.com/journal): Articles about South Asian dating culture, identity, community stories
- [Dating Tips](https://garammasaladating.com/south-asian-dating-tips): South Asian dating advice and cultural insights

## Cities
- [All Cities](https://garammasaladating.com/cities): Find shows near you — NYC, Jersey City, and expanding
- [NYC Shows](https://garammasaladating.com/cities/manhattan): Weekly shows in Manhattan
- [Jersey City Shows](https://garammasaladating.com/cities/jersey-city): Monthly shows in Jersey City

## Social
- [Instagram](https://www.instagram.com/garammasaladating)
- [TikTok](https://tiktok.com/@garammasaladating)
- [YouTube](https://www.youtube.com/@GaramMasalaDating)
- [Threads](https://www.threads.com/@garammasaladating)
- [X/Twitter](https://x.com/GaramDatingShow)
- [Facebook](https://www.facebook.com/profile.php?id=61573350599215)

## Legal
- [Privacy Policy](https://garammasaladating.com/privacy)
- [Terms of Service](https://garammasaladating.com/terms)
```

---

## 17. Recommended Wikidata Entry Properties

| Property | Value | QID/Notes |
|----------|-------|-----------|
| instance of (P31) | live event series | Find closest QID |
| official website (P856) | https://garammasaladating.com | |
| inception (P571) | 2022 | |
| country (P17) | United States | Q30 |
| located in the administrative territorial entity (P131) | New York City | Q60 |
| genre (P136) | comedy | Q40831 |
| social media followers (P8687) | [current count] | |
| Instagram username (P2003) | garammasaladating | |
| TikTok username (P7085) | garammasaladating | |
| YouTube channel ID (P2397) | @GaramMasalaDating | |
| described at URL (P973) | any press articles | |

---

## 18. Email Welcome Series Content Outline

### Email 1: Immediate — "You're In"
- Subject: "Welcome to the Spice List"
- Content: Next show dates, what to expect, one embedded show clip
- CTA: "Get Tickets" button
- Tone: Warm, excited, brief

### Email 2: Day 2 — Social Proof
- Subject: "Why 2,000+ people keep coming back"
- Content: 2-3 testimonials, press mentions, audience photo
- CTA: "See What the Hype Is About" → tickets
- Tone: FOMO, authentic

### Email 3: Day 5 — Behind the Scenes
- Subject: "How a bar bet became NYC's biggest dating show"
- Content: Origin story of Surbhi + Wyatt starting the show, growth journey
- CTA: "Meet the Hosts" → /hosts
- Tone: Personal, storytelling

### Email 4: Day 9 — How It Works
- Subject: "What actually happens at a Garam Masala show"
- Content: Step-by-step show format, FAQ answers, what to wear
- CTA: "Get Your Tickets" → tickets
- Tone: Informative, reassuring

### Email 5: Day 14 — Direct Ask
- Subject: "Your ticket is waiting"
- Content: Next show date, countdown, final push
- CTA: "Buy Now" → Eventbrite with UTM
- Tone: Urgent but not pushy

---

## 19. Page-Level SEO Reference (Current Titles & Descriptions)

| Page | Title | Description |
|------|-------|-------------|
| `/` | Garam Masala Dating \| NYC's Live South Asian Dating Show | NYC's hottest live South Asian dating show. Watch real singles find love on stage. Hosted by Surbhi & Wyatt. |
| `/tickets` | Tickets & Upcoming Shows \| Garam Masala Dating | Get tickets to upcoming shows. NYC's #1 live South Asian dating show and singles mixer, now in LA, SF, San Diego, and more. |
| `/apply` | Apply to Be a Contestant \| Garam Masala Dating | Think you've got what it takes to go on a blind date in front of 250 people? Apply now. |
| `/faq` | FAQ – Garam Masala Dating \| Live South Asian Dating Show NYC | Everything you need to know about tickets, how the show works, who can apply. |
| `/hosts` | Meet the Hosts — Surbhi & Wyatt \| Garam Masala Dating | Meet the stand-up comedians behind Garam Masala Dating. |
| `/cities` | South Asian Dating Events by City \| Garam Masala Dating | Find shows near you. Live comedy dating shows in cities across the US, Canada, UK, Australia, and beyond. |
| `/links` | Links \| Garam Masala Dating | (Linktree replacement) |

---

## 20. Social URLs Reference

```typescript
export const SOCIAL_URLS = {
  instagram: "https://www.instagram.com/garammasaladating",
  tiktok: "https://tiktok.com/@garammasaladating",
  youtube: "https://www.youtube.com/@GaramMasalaDating",
  threads: "https://www.threads.com/@garammasaladating",
  x: "https://x.com/GaramDatingShow",
  facebook: "https://www.facebook.com/profile.php?id=61573350599215",
  email: "mailto:contact@garammasaladating.com",
};

export const CREATOR_URLS = {
  surbhi: "https://www.instagram.com/lordmakemetaller/",
  wyatt: "https://www.instagram.com/wyattfeegrado/",
  venue: "https://topsecretcomedyclub.com/",
};
```

---

## 21. Conversion Funnel Diagram

```
DISCOVERY
├── Google Search → City pages, journal, tips, FAQ
├── TikTok/Instagram → /links → site
├── Word of mouth → direct traffic
├── Press → /hosts or /
└── Email/SMS campaign → /tickets

LANDING
├── / (home) — hero + shows + social proof + FAQ + spice list
├── /cities/[slug] — local landing with event info
├── /journal/[slug] — content with embedded CTAs
└── /links — IG bio redirect hub

ENGAGEMENT (choose one)
├── "Get Tickets" → /tickets → Eventbrite (PURCHASE)
├── "Apply" → /apply → Firestore (APPLICATION)
├── Email capture → Spice list / Notify modal / FAQ link (LEAD)
└── City request → Modal (LEAD + DEMAND SIGNAL)

PURCHASE FLOW
/tickets → Click "Get Tickets" → Eventbrite (external)
  → Purchase → /thank-you (recapture)
  → "Apply to be on stage" + "Share" + "Next show" + email signup

EMAIL NURTURE
Lead captured → Klaviyo welcome series (5 emails, 14 days)
  → Show announcement → Pre-event hype → PURCHASE
  → Post-event recap → Next show → REPEAT PURCHASE
```

### Missing Measurement Points
- Eventbrite conversion (external — need Meta CAPI + UTMs)
- Application completion rate (form-level analytics missing)
- Email popup → capture rate
- Phone step completion rate
- Which content pages drive the most leads
- Repeat visitor → ticket conversion
- Mobile vs desktop conversion differences

---

## 22. Sources & References

### AEO/SEO
- [AEO 2026 Guide — FinTech Grid](https://fintechgrid.io/post/aeo-answer-engine-optimization-the-new-seo-for-chatgpt-perplexity-2026-guide)
- [GEO Guide — Frase.io](https://www.frase.io/blog/what-is-generative-engine-optimization-geo)
- [Schema Markup for AEO — AirOps](https://www.airops.com/blog/schema-markup-aeo)
- [FAQ Schema for AI Search — Frase.io](https://www.frase.io/blog/faq-schema-ai-search-geo-aeo)
- [llms.txt Specification](https://llmstxt.org/)
- [llms.txt — Semrush](https://www.semrush.com/blog/llms-txt/)
- [ComedyEvent — Schema.org](https://schema.org/ComedyEvent)
- [Google Event Structured Data](https://developers.google.com/search/docs/appearance/structured-data/event)
- [AI Bots and Robots.txt — Paul Calvano](https://paulcalvano.com/2025-08-21-ai-bots-and-robots-txt/)
- [AI Search Crawlers — Momentic](https://momenticmarketing.com/blog/ai-search-crawlers-bots)

### Knowledge Panel
- [How to Get a Knowledge Panel — Stackmatix](https://www.stackmatix.com/blog/how-to-get-google-knowledge-panel)
- [Wikipedia, Wikidata, Brand Entity — Ryan Shojae](https://ryanshojae.com/wikipedia-wikidata-and-brand-entity-step-by-step-guide/)
- [Wikidata for SEO — Semrush](https://www.semrush.com/blog/seo-professionals-how-to-get-started-with-wikidata/)

### Social Search
- [Social Search Optimization — Sked Social](https://skedsocial.com/blog/social-search-how-to-optimize-for-discoverability-on-tiktok-and-instagram-2025)
- [TikTok SEO — ALM Corp](https://almcorp.com/blog/tiktok-seo/)
- [Instagram Search Results — SEO Sherpa](https://seosherpa.com/instagram-search-results/)

### Conversion & Monetization
- [Wisepops 2026 Popup Statistics (1B Displays)](https://wisepops.com/blog/popup-stats)
- [Eventbrite Meta Pixel Setup](https://www.eventbrite.com/help/en-us/articles/558547/how-to-create-a-tracking-pixel-with-meta/)
- [Eventbrite Tracking Links](https://www.eventbrite.com/help/en-us/articles/835126/how-to-create-promotional-tracking-links/)
- [Klaviyo Email & SMS 2026](https://www.klaviyo.com/blog/email-sms-marketing-priorities-2026)
- [CRO for Event Ticket Sales — Ticket Fairy](https://www.ticketfairy.com/blog/turning-clicks-into-tickets-conversion-rate-optimization-for-event-ticket-sales-in-2026)
- [FOMO Psychology — Ticket Fairy](https://www.ticketfairy.com/blog/the-psychology-of-ticket-sales-using-urgency-fomo-ethically-in-2026-event-marketing)
- [Brand Partnerships — Ticket Fairy](https://www.ticketfairy.com/blog/live-music-event-brand-partnerships-guide-2025-how-they-drive-success)
- [Sponsorship Pricing — Ticket Fairy](https://www.ticketfairy.com/blog/festival-sponsorship-pricing-strategy-cpm-lies-throughput-tells-the-truth)

### Google/Platform Docs
- [OpenAI: ChatGPT Search](https://help.openai.com/en/articles/9237897)
- [Google: Structured Data Gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
- [Google: Robots Meta Tags](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google: Avoid Intrusive Interstitials](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)
- [Google: Scaled Content Abuse](https://developers.google.com/search/docs/advanced/guidelines/auto-gen-content)
- [Coalition for Better Ads Standards](https://www.betterads.org/standards/)
