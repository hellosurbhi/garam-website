# CLAUDE.md - garammasaladating.com

## What this is

Live comedy dating show in NYC (~250 audience). Public website + contestant application + admin dashboard. 98% mobile traffic. Three jobs: explain the show, find the next event, buy tickets via Eventbrite.

## Tech stack

Astro SSG + React islands | Firebase Firestore + Auth | Vercel hosting | CSS custom properties + scoped styles + CSS modules

## Structure

```
src/
  data/           # ALL content lives here — events, copy, press, socials, journal, tips, cities, icons
  components/
    home/         # landing page sections (HomeHero, HomeShows, HomeFAQ, etc.)
    admin/        # dashboard (AdminDashboard, ApplicantCard, ApplicantModal)
    layout/       # PageNav
  layouts/        # BaseLayout.astro — wraps every page (meta, OG, nav, footer)
  pages/          # file-based routing
  hooks/          # useGeoData (country/state/city for apply form)
  utils/          # breadcrumbs, eventSchema, reactSelectStyles, eventDate
  types/          # application.ts (Firestore types)
api/              # Vercel serverless (notify-application, contestant-prep-auth)
public/
  fonts/          # self-hosted woff2 (Playfair, Nunito, Cormorant, JetBrains)
  images/         # all images (logo.svg, hero.avif, host photos)
```

Key pages: `/` `/tickets` `/apply` `/links` `/faq` `/hosts` `/journal` `/cities/[slug]` `/admin` `/contestant-prep` `/privacy` `/terms`

## Content architecture

**All user-facing text lives in `src/data/` files, never hardcoded in components.**

- `data/copy.ts` — site taglines, stats, testimonials, FAQs, experience steps, marquee items
- `data/events.ts` — show dates, venues, Eventbrite URLs, taglines
- `data/press.ts` — press mentions
- `data/socials.ts` — all social URLs
- `data/journal.ts` / `data/tips.ts` — blog content
- `data/cities/` — city landing page data

When adding new content (shows, press, FAQs, testimonials), update the data file — never edit component HTML.

## Code rules

### Never do

- Hardcode user-facing text in components. All copy goes in `src/data/`.
- Hardcode colors, fonts, or spacing. Use CSS custom properties from `:root`.
- Hardcode external URLs in JSX. Import from data files.
- Use font-size below 16px on interactive elements (buttons, inputs, links). iOS auto-zooms.
- Use `outline: none` without a visible `:focus-visible` replacement.
- Add inline `style={}` props in Astro components. Use scoped `<style>` or CSS modules.
- Use `any` type in TypeScript. Type everything.
- Use `console.log` in committed code.
- Install npm packages without checking bundle size first.
- Put secrets in client-side code. All secrets in `.env.local`.

### Always do

- Mobile-first CSS: base styles are mobile, media queries scale up.
- All touch targets minimum 48x48px.
- All `<img>` tags need `loading="lazy"`, `width`, `height`, and descriptive `alt`.
- Every page gets `<main id="main-content">`, unique title/description, OG tags via BaseLayout.
- Blog posts pass `ogType="article"` + include `article:published_time` meta.
- Form inputs need `aria-label` or `<label>`, `required` where applicable, `aria-describedby` for errors.
- Error messages use `role="alert"`. Decorative SVGs get `aria-hidden="true"`.
- Run `npm run lint` before committing.
- Commit after each meaningful change, not one giant blob.

## Design tokens

Colors from `:root` in `src/index.css`:

- `--brand-red` #DC2626 (primary CTA, accents)
- `--brand-red-dark` #b91c1c (hover states)
- `--electric-yellow` #FFD600 (highlights, badges)
- `--off-white` #FFF8F0 (page background)
- `--charcoal` #1A1A1A (body text)
- `--spice-orange` #FF6D00 (secondary accent)
- `--muted` #888 (secondary text — needs contrast fix, see BUGS.md)

Fonts: Playfair Display (headings), Nunito (body), Cormorant Garamond (decorative italic). Self-hosted woff2.

## Key architecture decisions

- Firestore: field-level validation on all public-write collections (see `firestore.rules`)
- Eventbrite: links in `data/events.ts`, show cards link directly to Eventbrite URLs
- Sitemap: auto-generated via `@astrojs/sitemap` at build time
- ErrorBoundary wraps ApplyPage (prevents white screen on React crash)
- Global `prefers-reduced-motion` kills all animations site-wide
- Hero images preloaded (AVIF, conditional on viewport size)
- `country-state-city` package lazy-loaded only on apply page
- Astro SSG: zero JS on static pages, React islands only on apply/admin/prep

## Environment variables

- `PUBLIC_FIREBASE_*` — Firebase config (client-safe, Astro PUBLIC_ prefix)
- `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` — server-side only
- `CONTESTANT_PREP_SALT` — weekly password rotation salt
- `RESEND_API_KEY` / `NOTIFICATION_EMAIL` — email notifications
- See `.env.example` for the full list. Never commit `.env.local`.

## JSON-LD schemas

Organization + WebSite on homepage. Event schema per upcoming show. FAQPage on homepage + blog posts. Article on journal/tips posts. BreadcrumbList on all pages. Logo: `https://garammasaladating.com/images/logo.svg`.

## Performance budget

- Total page weight: under 500KB
- JavaScript: under 100KB gzipped (static pages should ship zero JS)
- LCP: under 2.5s on mobile 4G
- Lighthouse performance: 90+, accessibility: 90+

## When in doubt

- Ask before adding a new dependency.
- Prefer deleting code to adding code.
- Add new content to data files, not component HTML.
- If a component is over 150 lines, split it.
- Ship the smallest working version first, then iterate.
- If a fix feels hacky, step back and do it right.
