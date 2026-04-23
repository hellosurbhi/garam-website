# CLAUDE.md - garammasaladating.com

## What this is

#1 Live comedy dating show in NYC (~250/week audience + touring across USA and Intl.). Public website + contestant application + admin dashboard. 70% mobile traffic. Three jobs: explain the show, find the next event, buy tickets via Eventbrite.

## Tech stack

Astro SSG + React islands | Firebase Firestore + Auth | Vercel hosting | CSS custom properties + scoped styles + CSS modules

## Structure

```plaintext
src/
  data/           # ALL content lives here: events, copy, press, socials, journal, tips, cities, icons
  components/
    home/         # landing page sections (HomeHero, HomeShows, HomeFAQ, etc.)
    admin/        # dashboard (AdminDashboard, ApplicantCard, ApplicantModal)
    layout/       # PageNav
  layouts/        # BaseLayout.astro: wraps every page (meta, OG, nav, footer)
  pages/          # file-based routing
  hooks/          # useGeoData (country/state/city for apply form)
  utils/          # breadcrumbs, eventSchema, reactSelectStyles, eventDate
  types/          # application.ts (Firestore types)
api/              # Vercel serverless (notify-application, contestant-portal-auth)
public/
  fonts/          # self-hosted woff2 (Playfair, Nunito, Cormorant, JetBrains)
  images/         # all images (logo.svg, hero.webp, host photos)
```

Key pages: `/` `/tickets` `/apply` `/links` `/faq` `/hosts` `/journal` `/cities/[slug]` `/admin` `/contestant-portal` `/privacy` `/terms`

## Content architecture

**All user-facing text lives in `src/data/` files, never hardcoded in components.**

- `data/copy.ts`: site taglines, stats, testimonials, FAQs, experience steps, marquee items
- `data/events.ts`: show dates, venues, Eventbrite URLs, taglines
- `data/press.ts`: press mentions
- `data/socials.ts`: all social URLs
- `data/journal.ts` / `data/tips.ts`: blog content
- `data/cities/`: city landing page data

When adding new content (shows, press, FAQs, testimonials), update the data file: never edit component HTML.

## Code rules

## No band-aid fixes: ever

Always implement the industry best-practice, sustainable fix. Never apply a short-term workaround that creates inconsistency, adds one-off config files, or patches around a platform limitation. If the proper solution requires a bigger change (restructuring, migrating to the correct API, etc.), do the bigger change. Every fix should be industry best practice. Research best practices and justify why you are making any and all changes even if it is a one line change.

- If a tool/platform doesn't support something (e.g., path aliases), restructure to use the platform correctly: don't add workaround configs.
- All imports, patterns, and conventions must be consistent across the entire codebase. One file doing something differently is not acceptable.
- Ask "what would a senior engineer do for a production app?" not "what's the quickest fix?"
- Shared logic is always extracted and modularized. Duplication is never acceptable.

## Branch safety

- Never commit or push while on `main` or `master`.
- Before `git add`, `git commit`, or `git push`, check `git branch --show-current`.
- If the current branch is `main` or `master`, create or switch to a feature branch first.
- Do not use `main` or `master` as a working branch for implementation work.

## Aesthetic choices: intentional, never revert

This site was designed by a professional front-end designer. Every aesthetic decision is deliberate. Code review (CodeRabbit or otherwise) must **never** change these without explicit instruction:

- **Custom cursor** (`BaseLayout.astro`): intentional desktop-only design. Do not remove for "performance" or "mobile-first" reasons. It is already gated to `pointer: fine` (no touch devices) and `prefers-reduced-motion: no-preference` (accessible).
- **Padding, margin, gap values**: every spacing value was set deliberately. Do not increase padding "for breathing room". Touch nothing.
- **Color hex values**: do not change color implementations. You may suggest using a CSS variable instead of a hardcoded hex, but do not change the actual color.
- **Section backgrounds**: section background color alternation is intentional contrast design and MANDATORY when you createe any new sections/move anything around. No section color should match the color of the section above or below. NEVER BLACK OR DARK BACKGROUND.
- **Font sizes, letter-spacing, line-height**: typographic choices are intentional.
- **WebGL shader / hero gradient** (`public/js/shader-app.js`): commissioned designer asset — do not modify. This is the ONLY thing in the hero section that cannot be touched. All other hero content (text, eyebrow, subheading, CTAs) is fair game to edit. If there is a bug in the shader, report it; do not "fix" it aesthetically.

**CodeRabbit rule:** Any review comment that suggests removing, changing, or "improving" the above should be discussed explicitly before ever implementing. You may offer alternative _implementations_ (e.g., CSS var vs hex) but never alter the _result_.

### Never do

- Hardcode user-facing text in components. All copy goes in `src/data/`.
- Hardcode colors, fonts, or spacing. Use CSS custom properties from `:root`.
- Hardcode external URLs in JSX. Import from data files.
- **NEVER use any form of dash as a separator in ANY user-facing copy, titles, meta descriptions, aria-labels, JSON-LD schemas, or written prose.** This covers all four forms: em dash (—), en dash (–), double dash (--), and standalone single dash used as a separator (word - word or word- word). This includes journal articles, masterclass slides, page titles, component text, testimonials, FAQs, tips, and hot-take badges. The ONLY acceptable hyphen is one that is literally part of a compound word with no spaces (e.g., `mobile-first`, `stand-up`, `co-host`, `first-date`). Replace all separator dashes with commas, colons, periods, or parentheses depending on context. Replace range dashes with the word "to" (e.g., `20 to 30 seconds`, `$50k to $100k`). This rule is NON-NEGOTIABLE: dashes are a dead giveaway for AI-generated content and must never appear on this site.
- Do not use font-size below 16px on interactive elements (buttons, inputs, links): iOS will auto-zoom.
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
- `--muted` #888 (secondary text: needs contrast fix, see BUGS.md)

Fonts: Playfair Display (headings), Nunito (body), Cormorant Garamond (decorative italic). Self-hosted woff2.

## Key architecture decisions

- Firestore: field-level validation on all public-write collections (see `firestore.rules`)
- Eventbrite: links in `data/events.ts`, show cards link directly to Eventbrite URLs
- Sitemap: auto-generated via `@astrojs/sitemap` at build time
- ErrorBoundary wraps ApplyPage (prevents white screen on React crash)
- Global `prefers-reduced-motion` kills all animations site-wide
- Hero image: `hero.webp` (used in links.astro hero section)
- `country-state-city` package lazy-loaded only on apply page
- Astro SSG: zero JS on static pages, React islands only on apply/admin/prep

## Environment variables

- `PUBLIC_FIREBASE_*`: Firebase config (client-safe, Astro PUBLIC\_ prefix)
- `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY`: server-side only
- `CONTESTANT_PREP_SALT`: weekly password rotation salt
- `RESEND_API_KEY` / `NOTIFICATION_EMAIL`: email notifications
- See `.env.example` for the full list. Never commit `.env.local`.

## JSON-LD schemas

Organization + WebSite on homepage. Event schema per upcoming show. FAQPage on homepage + blog posts. Article on journal/tips posts. BreadcrumbList on all pages. Logo: `https://garammasaladating.com/images/logo.svg`.

## Performance budget

- LCP: under 2.5s on mobile 4G
- Lighthouse performance: 90+, accessibility: 90+

## When in doubt

- Ask before adding a new dependency.
- Prefer deleting code to adding code.
- Add new content to data files, not component HTML.
- If a component is over 150 lines, split it.
- Ship the smallest working version first, then iterate.
- If a fix feels hacky, step back and do it right.

## Design rules (MANDATORY)

**Every design decision, no matter how small, must look intentional and polished.**

- CTAs inside cards must be full-width (`display: block; width: 100%`), never `inline-block` left-floating
- Buttons always need `:active { transform: scale(0.97) }` press feedback
- Multi-line body text in cards: left-align is correct. Single-line headings and standalone CTAs: center-align
- Before writing any UI code that touches layout, spacing, alignment, or visual treatment: invoke the `emil-design-eng` skill to validate the approach
- When in doubt about any visual choice: ask "would this look embarrassing next to Linear or Vercel?" If yes, rethink it

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Any UI change, layout, spacing, alignment, animation → invoke emil-design-eng FIRST
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
