# CLAUDE.md - garamasolidating.com

## What this project is

Garam Masala Dating is a weekly live comedy dating show in NYC (~250 audience). This is the public website + contestant application system + admin dashboard. 98% of traffic is mobile.

The site has three jobs: get someone to understand the show, find the next event, and buy tickets through Eventbrite.

## Tech stack

- React SPA with Vite (considering migration to SSR/SSG later)
- Firebase Firestore for contestant applications
- Firebase Auth for admin access
- Hosted on Vercel
- Styling: CSS custom properties in `:root`, component-level CSS

## Project structure

```
src/
  components/
    ui/           # shared reusable components (Button, Section, Accordion, etc.)
    layout/       # Nav, Footer, MobileMenu, SEOHead
    home/         # landing page sections
    admin/        # admin dashboard components
  hooks/          # useScrolled, useIntersectionObserver, useMediaQuery
  lib/            # constants, utils, formatDate, eventSchema
  styles/         # tokens.ts, global.css
  pages/          # route-level page components
```

## Key pages

- `/` — landing page (hero, next show, social proof, video, FAQ, newsletter, hosts, footer)
- `/links` — linktree replacement for Instagram bio
- `/apply` — contestant application form (writes to Firestore)
- `/admin` — protected dashboard to view/filter submitted applications (requires Firebase Auth)
- `/contestant-prep` — password-protected prep guide for selected contestants

## Code rules

### Never do

- Hardcode colors, fonts, or spacing values in components. Import from tokens.
- Hardcode external URLs (Eventbrite, YouTube, Instagram) in JSX. Import from `lib/constants.ts`.
- Run continuous CSS animations when elements are off-screen. Use IntersectionObserver.
- Add inline `style={}` props. Use CSS modules or classes.
- Put API keys or secrets in client-side code. All secrets go in `.env.local` (never committed) and are accessed through server functions or Vercel environment variables.
- Duplicate component patterns. If a button/heading/section-wrapper already exists in `ui/`, use it.
- Use `console.log` in committed code. Remove before pushing.
- Use `any` type in TypeScript. Type everything.
- Install new npm packages without checking bundle size on bundlephobia.com first.

### Always do

- Mobile-first CSS: base styles are mobile, media queries scale up to desktop.
- All touch targets minimum 48x48px.
- All `<img>` tags need `loading="lazy"`, `width`, `height`, and descriptive `alt` text.
- Font minimum 16px on all mobile form inputs (prevents iOS auto-zoom).
- Semantic HTML: use `<nav>`, `<main>`, `<section>`, `<header>`, `<footer>`, `<article>`.
- Every page gets meta title, description, and OG tags via the SEOHead component.
- Test on a real phone, not just Chrome DevTools.
- Run `npm run lint` before committing.

### Component patterns

- Shared UI components live in `src/components/ui/` and are generic (no page-specific logic).
- Page-specific sections live in `src/components/home/`, `src/components/admin/`, etc.
- Hooks that are used by more than one component live in `src/hooks/`.
- If you're about to copy-paste styling from another component, stop and extract a shared component instead.

### Design tokens

All colors, fonts, spacing, and breakpoints come from `src/styles/tokens.ts` (or CSS custom properties in `:root`). The brand colors are:

- Spice red: #e83c22 (primary CTA, accents)
- Electric yellow: #FFD600 (highlights, badges)
- Off-white: #FFF8F0 (background)
- Charcoal: #1A1A1A (text)
- Spice red dark: #c43318 (hover states)
- Spice orange: #FF6D00 (secondary accent)

Font families: Playfair Display (headings), Outfit (body). Maximum two families loaded.

### Firestore rules

Applications collection: public can create (with field validation), only authenticated admins can read/update/delete. All other collections default deny. Never use `allow read, write: if true`.

### External services

- Eventbrite: ticket links stored in `lib/constants.ts`, never called via API from the client
- YouTube: use facade pattern (thumbnail + play button, load iframe on click)
- Instagram: link out, don't embed (embeds are heavy)
- Firebase: Firestore for data, Auth for admin access. No Firebase hosting.

### Performance budget

- Total page weight: under 500KB
- JavaScript: under 100KB gzipped
- LCP: under 2.5 seconds on mobile 4G
- Lighthouse performance: 90+
- Lighthouse accessibility: 90+

### Git workflow

- All changes go through PRs to `main`. No direct pushes.
- CI runs lint, type-check, build, and security scan on every PR.
- CodeRabbit reviews every PR automatically.
- Branch protection requires passing CI before merge.

### Environment variables

- `VITE_FIREBASE_*` — Firebase config (client-safe, but don't add admin/service keys)
- `CONTESTANT_PREP_PASSWORD` — current valid password for contestant prep page
- `CONTESTANT_PREP_SALT` — salt for weekly password rotation
- Never commit `.env.local`. The `.env.example` file shows what's needed without real values.

## Team context

- Surbhi — co-creator, runs the show. Makes product decisions.
- Wyatt — co-host and co-organizer
- Sidd — college intern, handles Facebook/Reddit outreach
- Owen — handles event listing submissions
- Discount codes are team members' first names in caps (SIDD, OWEN, etc.)

## When in doubt

- Ask before adding a new dependency.
- Prefer deleting code to adding code.
- If a component is over 150 lines, it probably needs to be split.
- Ship the smallest working version first, then iterate.
