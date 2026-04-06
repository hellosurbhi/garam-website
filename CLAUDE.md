# CLAUDE.md - garammasaladating.com

## What this is

Live comedy dating show in NYC (~250 audience). Public website + contestant application + admin dashboard. 98% mobile traffic. Three jobs: explain the show, find the next event, buy tickets via Eventbrite.

## Tech stack

Astro SSG + React islands | Firebase Firestore + Auth | Vercel hosting | CSS custom properties + scoped styles + CSS modules

## Structure

- `src/data/` — **all content lives here** (events, copy, press, socials, journal, tips, cities, icons). Never hardcode text in components.
- `src/components/home/` — landing page sections. `admin/` — dashboard. `layout/` — PageNav.
- `src/layouts/BaseLayout.astro` — wraps every page (meta, OG, nav, footer).
- `src/pages/` — file-based routing. Key: `/`, `/tickets`, `/apply`, `/links`, `/faq`, `/hosts`, `/journal`, `/cities/[slug]`, `/admin`, `/contestant-prep`.
- `api/` — Vercel serverless (notify-application, contestant-prep-auth).
- `public/fonts/` — self-hosted woff2. `public/images/` — all images.

## Rules

- **No hardcoded copy.** All user-facing text in `src/data/` files. New FAQs, stats, testimonials → update data files.
- **No hardcoded colors/fonts.** Use CSS custom properties from `:root` in `index.css`.
- **No font-size below 16px** on interactive elements (iOS auto-zoom).
- **No `outline: none`** without `:focus-visible` replacement.
- **No `any` types.** No `console.log` in committed code.
- **Mobile-first CSS.** Touch targets 48px min. All `<img>` need `loading="lazy"`, `width`, `height`, `alt`.
- **Every page** gets `<main id="main-content">`, unique title/description, OG tags via BaseLayout.
- **Blog posts** pass `ogType="article"` + `article:published_time` meta.
- **Errors** use `role="alert"` + `aria-describedby`. Decorative SVGs get `aria-hidden="true"`.
- **Commit early and often.** Run `npm run lint` before committing.

## Brand colors

`--brand-red` #DC2626 | `--brand-red-dark` #b91c1c | `--electric-yellow` #FFD600 | `--off-white` #FFF8F0 | `--charcoal` #1A1A1A | `--spice-orange` #FF6D00

Fonts: Playfair Display (headings), Nunito (body), Cormorant Garamond (decorative).

## Key architecture

- Firestore: field-level validation on all public-write collections (see `firestore.rules`)
- Eventbrite: links in `data/events.ts`, show cards link directly to Eventbrite URLs
- Sitemap: auto-generated via `@astrojs/sitemap`
- ErrorBoundary wraps ApplyPage
- Global `prefers-reduced-motion` kills all animations
- Env vars: `PUBLIC_FIREBASE_*` (client), `FIREBASE_ADMIN_*` + `RESEND_API_KEY` + `CONTESTANT_PREP_SALT` (server). See `.env.example`.

## Team

Surbhi (co-creator, product decisions) | Wyatt (co-host) | Sidd (intern, outreach) | Owen (event listings). Discount codes = first names in caps.
