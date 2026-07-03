# Garam Masala Dating — Full Site Audit

Complete inventory of every page, component, interaction, and visual pattern. Use this to plan the visual refactor.

---

## Current Design DNA

**Aesthetic:** Dark, cinematic, jewel-toned. Near-black background (#0a0a0a) with grain texture overlay, gold/crimson/pink accents, serif headings.

**Fonts (4 loaded):**

| Font               | Weight           | Usage                                 |
| ------------------ | ---------------- | ------------------------------------- |
| Playfair Display   | 400–700 + italic | Headings, display text                |
| DM Sans            | 400–600          | Body text, UI labels, buttons         |
| Cormorant Garamond | 400–500 + italic | Brand name, accent text, blog content |
| JetBrains Mono     | 400              | "Season 2026" label, technical text   |

**Color Palette:**

| Token                    | Hex               | Usage                                              |
| ------------------------ | ----------------- | -------------------------------------------------- |
| `--crimson`              | #C41E3A           | Admin buttons, error states                        |
| `--gold` / `--gold-dark` | #D4A843 / #C9A84C | Highlights, borders, focus rings, section dividers |
| `--accent-pink`          | #ff2d9b           | Apply CTA, text selection highlight                |
| `--cream`                | #FFF8F0           | Form panel backgrounds                             |
| `--text`                 | #2D2420           | Dark text on light backgrounds                     |
| `--text-ivory`           | #F5EDE4           | Light text on dark backgrounds                     |
| Background               | #0a0a0a           | Global body background                             |

**Visual Effects:**

- Grain overlay: SVG fractal noise, z-index 50, 0.035 opacity, animated 4-frame shift (hidden on mobile)
- Hero parallax: Mouse-tracking image shift (18px intensity, lerp 0.08)
- Hero grid: 7x5 white lines at 6% opacity over hero image
- Vignette: Multi-layer radial + linear gradients darkening hero edges

---

## Page-by-Page Breakdown

### 1. `/` — Landing Page (index.astro)

**Layout:** BaseLayout (no overlay)
**Components:** Hero.astro, Nav.astro

**What's on the page:**

- Full-screen hero image with parallax + grid overlay + vignette
- Fixed nav bar (brand name, season label, Follow dropdown, Apply button)
- Title: "Garam Masala Dating" with italicized "ala"
- Subtitle with creator bio links (Surbhi, Wyatt, Top Secret Comedy Club)
- Event table: animated rows listing upcoming shows
  - Active events = clickable links to Eventbrite
  - Past events = dimmed/disabled
  - Scroll indicator animation at bottom

**Interactive elements:**

| Element                   | Type            | Destination                    |
| ------------------------- | --------------- | ------------------------------ |
| Nav "Follow" button       | Dropdown toggle | Instagram, TikTok, YouTube     |
| Nav "Apply" button        | Internal link   | `/apply`                       |
| Event rows (active)       | External links  | Eventbrite URLs                |
| Creator names in subtitle | External links  | Instagram profiles, venue site |

**JS behavior:** Hero parallax (requestAnimationFrame), nav dropdown toggle + outside-click close

---

### 2. `/links` — Linktree Replacement (links.astro)

**Layout:** BaseLayout with dark overlay
**Components:** None (pure Astro + inline JS)

**What's on the page:**

- Header: back link to `/`, avatar, title, subtitle
- 7 link buttons (vertical stack):

| Button                      | Style                    | Destination                            |
| --------------------------- | ------------------------ | -------------------------------------- |
| "Apply to Be on the Show"   | Gold primary, pulse glow | `/apply`                               |
| "Instagram"                 | Glass/transparent        | External                               |
| "TikTok"                    | Glass/transparent        | External                               |
| "YouTube"                   | Glass/transparent        | External                               |
| "As Seen In"                | Glass/transparent        | Opens press modal                      |
| "Upcoming Shows & Tickets"  | Glass/transparent        | Opens events modal                     |
| "Booking & Press Inquiries" | Glass/transparent        | `mailto:contact@garammasaladating.com` |

- Social icons row: Instagram, TikTok, YouTube, Email (18px SVGs)
- Footer: "Made with love and a lot of spice"

**Modals (2):**

| Modal        | Trigger                 | Content                                                       |
| ------------ | ----------------------- | ------------------------------------------------------------- |
| Events modal | "Upcoming Shows" button | List of upcoming events with city, date, ticket link or "TBA" |
| Press modal  | "As Seen In" button     | Scrollable list of press mentions with podcast/article badges |

**JS behavior:** `setupDialog()` — showModal on trigger click, close on backdrop click or close button

---

### 3. `/apply` — Application Form (apply.astro + ApplyPage.tsx React island)

**Layout:** BaseLayout with dark overlay
**Components:** ApplyPage.tsx (client:load)

**What's on the page:**

- Full-screen modal overlay (dark, click-to-close = history.back)
- Light cream panel (max-width form container)
- Type toggle: "For myself" / "For a friend" (nomination mode)

**Form fields:**

| Field         | Type              | Required                | Notes                                  |
| ------------- | ----------------- | ----------------------- | -------------------------------------- |
| Name          | Text input        | Yes                     |                                        |
| Age           | Number input      | Yes                     | Must be >= 18                          |
| Gender        | Dropdown          | Yes                     |                                        |
| Orientation   | Dropdown          | Yes                     |                                        |
| Country       | Searchable select | Yes                     | Cascading (country-state-city lib)     |
| State         | Searchable select | Yes                     | Filtered by country                    |
| City          | Searchable select | Yes                     | Filtered by state                      |
| Height        | Text input        | No                      |                                        |
| Instagram     | Text input        | Yes                     | @ prefix                               |
| Community     | Dropdown          | Yes                     | 13 options (Hindu, Muslim, Sikh, etc.) |
| Income        | Dropdown          | Yes                     | 5 brackets                             |
| Referrer Name | Text input        | Only in nomination mode |                                        |
| Photo         | File upload       | Yes                     | 10MB max, preview shown                |
| Pitch         | Textarea          | No                      | "Why would you be great?"              |

**Interactive behaviors:**

- Real-time validation with error scrolling to first error
- Photo preview with "Change" button
- Loading spinner on submit
- Toast notifications (success/error, 5s auto-dismiss)
- Conditional fields (referrer name only shows in nomination mode)

**Data flow:** Photo → Firebase Storage → URL, Form data → Firestore `applications` collection, then fire-and-forget POST to `/api/notify-application`

---

### 4. `/faq` — FAQ Page (faq.astro)

**Layout:** BaseLayout with dark overlay
**Components:** None (pure Astro + inline JS)

**What's on the page:**

- Header: "FAQ" eyebrow label, title, intro text
- Divider
- 10 FAQ accordion items (question + hidden answer)
- Footer: contact email link

**Interactive elements:**

| Element              | Type             | Behavior                                        |
| -------------------- | ---------------- | ----------------------------------------------- |
| FAQ question buttons | Accordion toggle | Click to expand/collapse, only 1 open at a time |
| Chevron icon         | CSS transform    | Rotates 180deg on open                          |
| Email link           | Mailto           | contact@garammasaladating.com                   |

**JS behavior:** Accordion toggle with aria-expanded, single-open mode (clicking one closes others)

**SEO:** FAQPage JSON-LD schema with all 10 Q&A pairs

---

### 5. `/journal` — Blog Index (journal/index.astro)

**Layout:** BaseLayout with dark overlay
**Components:** None

**What's on the page:**

- Header: "Journal" eyebrow, title, description
- Divider
- Card list of journal posts (staggered animation)
  - Each card: date, title, excerpt, "Read ->" link

**Interactive elements:** Card links to `/journal/[slug]`

**Content:** 1 post ("What We Learned From 100 Desi Blind Dates")

---

### 6. `/journal/[slug]` — Blog Post (journal/[slug].astro)

**Layout:** BaseLayout with dark overlay
**Components:** AuthorBio.astro

**What's on the page:**

- Back link: "<- Journal"
- Header: publish date, author, title
- Divider
- Article body: h3 headings + paragraphs (from data)
- Author bio section (avatar, name, bio)
- Footer: "<- All posts" + "Apply to be on the show ->"

**SEO:** Article JSON-LD + BreadcrumbList

---

### 7. `/south-asian-dating-tips` — Tips Index (south-asian-dating-tips/index.astro)

**Layout:** BaseLayout with dark overlay
**Components:** None

**Structure:** Same pattern as Journal index. "Dating Tips" eyebrow, title with italicized "Tips", card list.

**Content:** 3 tip articles

---

### 8. `/south-asian-dating-tips/[slug]` — Tips Post

**Structure:** Same as journal post, but first paragraph is bold "lead" (Answer Engine Optimization pattern — answer-first for Google).

---

### 9. `/cities` — Cities Index (cities/index.astro)

**Layout:** BaseLayout with dark overlay
**Components:** None

**What's on the page:**

- Header: "Cities" eyebrow, "Where We Show Up" title
- Divider
- City card list:
  - City name + status badge (active/coming-soon/past)
  - Arrow icon (gold for active, muted for inactive)
  - Different styling per status

**Cities:** Manhattan, San Diego, Jersey City, Chicago, Edinburgh (coming soon), India Tour (coming soon)

---

### 10. `/cities/[slug]` — City Detail (cities/[slug].astro)

**What's on the page:**

- Eyebrow: city display name
- H1 from city data
- Divider
- Body paragraphs
- CTA buttons (primary gold + secondary muted, from city.ctas array)
- Back link: "<- All cities"

**SEO:** LocalBusiness JSON-LD + optional Event schema

---

### 11. `/admin` — Admin Dashboard (admin.astro + AdminPage.tsx React island)

**Layout:** BaseLayout (noindex)
**Components:** AdminPage.tsx -> AdminLogin.tsx or AdminDashboard.tsx

**States:**

1. **Not authenticated:** Login form (email, password, shake animation on error)
2. **Authenticated:** Full dashboard

**Dashboard features:**

- White header with logout button
- Filter bar: gender dropdown + city dropdown + "Clear all"
- Contestant prep link section (generate + copy magic link)
- Application card grid (3-col -> 2-col -> 1-col responsive)
  - Each card: photo (or placeholder), name+age, location, Instagram link, status badge
  - Hover: lift card, show delete/restore button
  - Click: opens detail modal
- Deleted applications section (collapsible)
- Toast notifications

**ApplicantModal (detail view):**

- Full-screen overlay with backdrop blur
- Large photo (400px)
- Close button (top-right)
- Info grid (2-col): age, gender, orientation, location, height, community, income, Instagram, type, referrer
- Pitch quote block
- Status dropdown (New, Contacted, Cast, Rejected)
- Notes textarea (auto-saves on blur)
- Delete/Restore button

---

### 12. `/contestant-prep` — Prep Guide (contestant-prep.astro + ContestantPrepPage.tsx)

**Layout:** BaseLayout (noindex)
**Access:** Magic link with `?date=YYYY-MM-DD&sig=<hmac>`, expires midnight ET of show date

**States:** Loading spinner -> Authed (guide) or Error (expired link)

**Guide content:**

1. Welcome header
2. 6 Golden Rules (numbered cards)
3. 13 interview questions (numbered list)
4. 4 "Come Prepared With" items (checkbox cards)
5. What to Wear (paragraph)
6. Bring Your Friends (paragraph)
7. Arrival times (5:20 PM guys, 5:30 PM girls)
8. Gender-specific callout boxes
9. "See you on stage" footer

**Styling:** Inline React styles (not CSS modules) — deep dark bg, gold accents, Cormorant font

---

### 13. `/404` — Not Found

- Centered: chili emoji, "Page not found", "<- Back to home" link
- Cream background

---

## Shared Components

| Component  | File             | Used On              | Notes                                                           |
| ---------- | ---------------- | -------------------- | --------------------------------------------------------------- |
| Nav        | Nav.astro        | `/` (landing)        | Fixed header: brand + season + Follow dropdown + Apply CTA      |
| Hero       | Hero.astro       | `/` (landing)        | Full-screen parallax hero with grid + vignette                  |
| BaseLayout | BaseLayout.astro | All pages            | Meta tags, fonts, analytics, grain overlay, optional bg overlay |
| AuthorBio  | AuthorBio.astro  | Journal + Tips posts | Avatar + name + bio block                                       |
| GTM        | gtm.astro        | All (via layout)     | Google Tag Manager script                                       |
| PostHog    | posthog.astro    | All (via layout)     | PostHog analytics script                                        |

**Missing shared components:**

- No shared Footer component (each page handles its own)
- No shared Modal component (links page has inline dialog CSS, admin has React modal)
- No shared Button component
- No shared Card component
- No component library / ui/ directory

---

## Data Sources

| File                       | What It Contains                                        |
| -------------------------- | ------------------------------------------------------- |
| `src/data/events.ts`       | Event list (date, city, Eventbrite URL, hidden flag)    |
| `src/data/socials.ts`      | Social URLs + creator URLs                              |
| `src/data/press.ts`        | Press mentions (title, source, URL, type)               |
| `src/data/cities.ts`       | City pages (SEO, body copy, CTAs, status)               |
| `src/data/journal.ts`      | Blog posts (title, body blocks, SEO)                    |
| `src/data/tips.ts`         | Dating tip articles (same structure as journal)         |
| `src/types/application.ts` | Application interface + community/income/status options |

---

## API Endpoints

| Endpoint                        | Method  | Auth           | Purpose                          |
| ------------------------------- | ------- | -------------- | -------------------------------- |
| `/api/notify-application`       | POST    | None           | Email admin when someone applies |
| `/api/contestant-prep-auth`     | POST    | HMAC signature | Verify magic link for prep page  |
| `/api/generate-contestant-link` | POST    | Firebase token | Generate magic link (admin only) |
| `/api/_verify-token`            | Utility | N/A            | Shared JWT verification helper   |

---

## Key Decisions for the Refactor

### What touches every page (change once, updates everywhere):

- BaseLayout.astro (grain overlay, fonts, meta, analytics)
- Nav.astro (only used on landing — other pages have no shared nav)
- `src/index.css` (color tokens, font declarations, global reset)
- Font files in `/public/fonts/`

### What's page-specific (needs individual attention):

- Every page has its own `<style>` block with scoped CSS
- Links page has all styling inline (464+ lines of scoped CSS)
- Apply form uses CSS modules (ApplyPage.module.css)
- Admin uses CSS modules (4 separate .module.css files)
- Contestant prep uses inline React styles (no CSS file at all)
- Landing page (index.astro) has extensive scoped styles

### Patterns that could be unified:

- **Subpage header** (eyebrow label + h1 + description + divider) — appears on FAQ, Journal, Tips, Cities
- **Card lists** (journal cards, tip cards, city cards) — same layout, different content
- **Back link** ("<- Journal", "<- All cities") — appears on all detail pages
- **Footer CTAs** ("Apply to be on the show ->") — appears on journal + tips posts
- **Button styles** — currently 5+ different button patterns (gold primary, glass, outline, pink, crimson)
- **Modal pattern** — links page uses `<dialog>`, admin uses React overlay, could unify

### What will NOT change (functionality):

- Firebase integration (Firestore, Storage, Auth)
- Application form fields and validation logic
- Admin dashboard data management
- Contestant prep magic link system
- API endpoints
- SEO/JSON-LD schemas
- Analytics (PostHog, GTM, Vercel)

---

## Questions to Decide Before Starting

1. **Scope:** Visual-only refresh (new colors/fonts/spacing) or structural changes (new pages, different layouts, new components)?

2. **Landing page:** You said you have a new landing page ready — is it a .pen file, a Figma design, or code? Does it keep the current hero/events structure or is it completely new?

3. **Nav:** Currently Nav only appears on the landing page. Should all pages get a shared nav? Should the Follow dropdown + Apply CTA pattern stay?

4. **Footer:** No shared footer exists. Should there be one? What goes in it?

5. **Content pages** (journal, tips, cities): Keep the current dark-overlay + card-list pattern, or rethink the layout?

6. **Links page:** Keep as linktree replacement, or integrate those links elsewhere (footer, nav)?

7. **Apply form:** Visual refresh only (new colors/spacing), or rethink the form UX?

8. **Admin dashboard:** Include in the refactor, or leave as-is (internal tool)?

9. **Contestant prep:** Include in the refactor, or leave as-is (limited audience)?

10. **Design system:** Build a proper shared component library (Button, Card, Modal, Header) first, then skin pages? Or page-by-page?

11. **Brand:** Keeping the color palette (gold/crimson/pink on dark)? Changing fonts? New logo/wordmark?
