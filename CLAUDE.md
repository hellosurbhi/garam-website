# CLAUDE.md - garammasaladating.com

## What this project is

Garam Masala Dating is a weekly live comedy dating show in NYC (~250 audience). This is the public website + contestant application system + admin dashboard. 98% of traffic is mobile.

The site has three jobs: get someone to understand the show, find the next event, and buy tickets through Eventbrite.

## Tech stack

- Astro static site (SSG) with React islands for interactive components
- Firebase Firestore for contestant applications, subscribers, city requests, notifications
- Firebase Auth for admin access
- jose for contestant prep page auth (weekly rotating passwords)
- Hosted on Vercel
- Styling: CSS custom properties in `:root`, scoped Astro `<style>` blocks, CSS modules for React components

## Project structure

```
src/
  components/
    home/         # landing page sections (HomeHero, HomeShows, HomeFAQ, etc.)
    admin/        # admin dashboard (AdminDashboard, ApplicantCard, ApplicantModal)
    layout/       # PageNav, BaseLayout is in layouts/
  data/           # all content as TypeScript data files (events, copy, press, etc.)
  hooks/          # useGeoData (country/state/city for apply form)
  layouts/        # BaseLayout.astro (wraps every page)
  pages/          # file-based routing (index, apply, tickets, faq, etc.)
  utils/          # breadcrumbs, eventSchema, reactSelectStyles, eventDate
  types/          # application.ts (Firestore types)
api/              # Vercel serverless functions (notify-application, contestant-prep-auth)
public/
  fonts/          # self-hosted woff2 (Playfair, Nunito, Cormorant, JetBrains)
  images/         # all images (logo.svg, hero.avif, host photos, etc.)
  js/             # shader-app.js (WebGL background on 404)
```

## Key pages

- `/` — landing page (hero, marquee, stats, shows, experience, testimonials, FAQ, signup, creators, press, photos, footer)
- `/tickets` — all upcoming + TBA shows with notify modals
- `/apply` — contestant application form (React island, writes to Firestore)
- `/links` — linktree replacement for Instagram bio
- `/faq` — standalone FAQ page
- `/hosts` — host bios (Surbhi + Wyatt)
- `/journal` — blog/journal posts
- `/south-asian-dating-tips` — SEO content hub
- `/cities/[slug]` — city landing pages (expansion markets)
- `/admin` — protected dashboard to view/filter applications (requires Firebase Auth)
- `/contestant-prep` — password-protected prep guide for selected contestants
- `/privacy`, `/terms` — legal pages

## Content architecture

**All user-facing text lives in `src/data/` files, never hardcoded in components.**

- `data/copy.ts` — site-wide copy: taglines, stats, testimonials, FAQs, experience steps, marquee items
- `data/events.ts` — show dates, venues, Eventbrite URLs, taglines
- `data/press.ts` — press mentions (source, url, type)
- `data/socials.ts` — all social URLs (Instagram, TikTok, YouTube, etc.)
- `data/icons.ts` — SVG icon strings for links page + social rows
- `data/journal.ts` — blog post content
- `data/tips.ts` — dating tips content
- `data/cities/` — city landing page data

When adding new content (shows, press, FAQs, testimonials), update the data file — never edit component HTML directly.

## Code rules

### Never do

- Hardcode user-facing text in components. All copy goes in `src/data/` files.
- Hardcode colors, fonts, or spacing values. Use CSS custom properties from `:root`.
- Hardcode external URLs (Eventbrite, YouTube, Instagram) in JSX. Import from data files.
- Add inline `style={}` props in Astro components. Use scoped `<style>` blocks or CSS modules.
- Put API keys or secrets in client-side code. All secrets go in `.env.local`.
- Use `console.log` in committed code.
- Use `any` type in TypeScript.
- Use font-size below 16px on any interactive element (buttons, inputs, links). iOS auto-zooms on focus.
- Use `outline: none` without a visible `:focus-visible` replacement.
- Install npm packages without checking bundle size first.

### Always do

- Mobile-first CSS: base styles are mobile, media queries scale up.
- All touch targets minimum 48x48px.
- All `<img>` tags need `loading="lazy"`, `width`, `height`, and descriptive `alt` text.
- Every page has `<main id="main-content">` landmark.
- Every page gets meta title, description, OG tags, and canonical via BaseLayout.
- Blog posts pass `ogType="article"` and include `article:published_time` meta.
- All form inputs need `aria-label` or associated `<label>`, `required` where applicable.
- Error messages use `role="alert"` and link to inputs via `aria-describedby`.
- Decorative SVGs get `aria-hidden="true"`.
- Run `npm run lint` before committing.
- Commit after each meaningful change, not in one giant blob.

### Design tokens

All colors come from CSS custom properties in `src/index.css` `:root`:

- `--brand-red`: #DC2626 (primary CTA, accents)
- `--brand-red-dark`: #b91c1c (hover states)
- `--electric-yellow`: #FFD600 (highlights, badges)
- `--off-white`: #FFF8F0 (page background)
- `--charcoal`: #1A1A1A (body text)
- `--spice-orange`: #FF6D00 (secondary accent)
- `--muted`: #888 (secondary text — needs contrast fix, see BUGS.md)

Font families: Playfair Display (headings), Nunito (body), Cormorant Garamond (decorative italic). Self-hosted as woff2 in `public/fonts/`.

### Firestore rules

- `applications`: public create with field validation, admin-only read/update/delete
- `notifications`, `city_requests`, `subscribers`: public create with field-level validation (type, length, required fields), admin-only read/update/delete
- Validation functions: `validNotification()`, `validCityRequest()`, `validSubscriber()`

### External services

- Eventbrite: ticket links in `data/events.ts`, show cards link directly to Eventbrite URLs
- Firebase: Firestore for data, Auth for admin. No Firebase hosting.
- Resend: email notifications for new applications (`api/notify-application.ts`)
- Vercel: hosting, serverless functions, analytics, speed insights

### JSON-LD schemas

- Organization + WebSite on homepage
- Event schema for each upcoming show (auto-generated via `buildEventSchemas`)
- FAQPage on homepage and blog posts with FAQs
- Article on journal + tips posts
- BreadcrumbList on all pages
- Logo URL: `https://garammasaladating.com/images/logo.svg`

### Performance

- Astro SSG: zero JS on static pages, React islands only on apply/admin/prep
- Hero images preloaded (AVIF, conditional on viewport)
- Fonts preloaded (Playfair + Nunito)
- Sitemap auto-generated via `@astrojs/sitemap`
- `country-state-city` package lazy-loaded only on apply page
- ErrorBoundary wraps ApplyPage (prevents white screen on crash)
- Global `prefers-reduced-motion` kills all animations

### Git workflow

- All changes go through PRs to `main`. No direct pushes.
- CI runs lint, type-check, build, and security scan on every PR.
- Husky pre-commit: lint-staged + test suite.

### Environment variables

- `PUBLIC_FIREBASE_*` — Firebase config (client-safe, Astro PUBLIC_ prefix)
- `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` — server-side only
- `CONTESTANT_PREP_SALT` — salt for weekly password rotation
- `RESEND_API_KEY` — email notification service
- `NOTIFICATION_EMAIL` — where application notifications go
- See `.env.example` for the full list.

## Team context

- Surbhi — co-creator, runs the show. Makes product decisions.
- Wyatt — co-host and co-organizer
- Sidd — college intern, handles Facebook/Reddit outreach
- Owen — handles event listing submissions
- Discount codes are team members' first names in caps (SIDD, OWEN, etc.)

## When in doubt

- Ask before adding a new dependency.
- Prefer deleting code to adding code.
- Add new content to data files, not component HTML.
- If a component is over 150 lines, split it.
- Ship the smallest working version first, then iterate.
