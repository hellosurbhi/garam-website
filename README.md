# Garam Masala Dating

Website, contestant application system, and admin dashboard for [Garam Masala Dating](https://garammasaladating.com) — the #1 live comedy dating show in NYC.

## Tech Stack

- **Frontend:** Astro SSG + React islands, TypeScript
- **Data:** Firebase Firestore (applications), Firebase Auth (admin)
- **Hosting:** Vercel with static prerendering
- **Styling:** CSS custom properties, component-level CSS modules

## Quick Start

```bash
git clone https://github.com/hellosurbhi/garam-masala-dating.git
cd garam-masala-dating
nvm install 24  # node 24.15.0 or newer 24.x required; jsdom and undici set the floor and installs are engine-gated
npm install -g npm@11  # required: the lockfile is written by npm 11 and installs are gated on it
npm install
cp .env.example .env.local  # fill in your own Firebase project values
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following:

| Variable                              | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `PUBLIC_FIREBASE_API_KEY`             | Firebase client API key                        |
| `PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                           |
| `PUBLIC_FIREBASE_PROJECT_ID`          | Firestore project ID                           |
| `PUBLIC_FIREBASE_STORAGE_BUCKET`      | Cloud Storage bucket                           |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                   |
| `PUBLIC_FIREBASE_APP_ID`              | Firebase app ID                                |
| `FIREBASE_ADMIN_CLIENT_EMAIL`         | Service account email (server-side only)       |
| `FIREBASE_ADMIN_PRIVATE_KEY`          | Service account private key (server-side only) |
| `CONTESTANT_PREP_SALT`                | Salt for weekly password rotation              |

`PUBLIC_`-prefixed variables are exposed to the client in Astro. `FIREBASE_ADMIN_*` variables are used only in Vercel serverless functions.

## Project Structure

```
src/
  components/
    admin/        # Admin dashboard (login, applicant list, modals)
    home/         # Landing page sections
    ui/           # Shared reusable components
    layout/       # Nav, Footer, SEOHead
  pages/          # Route-level page components
  data/           # Static content (events, cities, journal, tips)
  hooks/          # Custom React hooks
  lib/            # Firebase init
  utils/          # Date formatting, location display
  styles/         # Global CSS, design tokens
  types/          # TypeScript type definitions
api/              # Vercel serverless functions (Firebase Admin)
scripts/          # Build-time scripts (prerender, data migration)
```

## Pages

| Route                      | What it does                                                  |
| -------------------------- | ------------------------------------------------------------- |
| `/`                        | Landing page — hero, next show, social proof, FAQ, newsletter |
| `/links`                   | Linktree replacement for Instagram bio                        |
| `/apply`                   | Contestant application form (writes to Firestore)             |
| `/admin`                   | Protected dashboard to review applications (Firebase Auth)    |
| `/contestant-prep`         | Password-protected prep guide for selected contestants        |
| `/faq`                     | Frequently asked questions                                    |
| `/cities`                  | Events directory by city                                      |
| `/journal`                 | Blog / articles                                               |
| `/south-asian-dating-tips` | Dating tips content hub                                       |

## Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start dev server with HMR                 |
| `npm run build`        | Build and verify the packaged server      |
| `npm run test:runtime` | Check the existing Vercel server artifact |
| `npm run lint`         | Run ESLint                                |
| `npm run preview`      | Preview production build locally          |

## Deployment

The site deploys to **Vercel**. Git deployments run from `main`; feature-branch previews are disabled through `git.deploymentEnabled` in `vercel.json` and the project-level `previewDeploymentsDisabled` setting to prevent older branches from creating previews. `npm run build` generates Astro's static pages and server function, then checks that the packaged server starts in isolation and handles ticket redirects and safe API requests. This check runs in CI and Vercel builds before release. It blocks external fetches and does not submit customer data. Security headers (CSP, HSTS, X-Frame-Options) are configured in `vercel.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This is a solo-operated project — open an issue before sending a PR.

Code conventions and AI-assistant rules live in `CLAUDE.md`.

## Licensing

Source code is licensed under the [MIT License](LICENSE).

Brand assets, host photography, the WebGL hero shader, and all editorial content (journal articles, city pages, tips) are proprietary and are NOT covered by the MIT License. See [NOTICE](NOTICE) for details.

### Automatic deployment cleanup

`Keep current Vercel deployment` runs after successful Vercel commit statuses and hourly. It deletes older finished deployments for this project, preserves the ready production target and custom domains, and stops if production changes during cleanup. In-progress deployments and ready builds newer than the live target are preserved until a successful release replaces it. Deleted deployments stop contributing to Deployment Storage and Functions Storage immediately. The recovery period only allows restoration; it does not continue charging storage. The Usage dashboard can still reflect earlier daily peaks. See [Vercel's storage accounting documentation](https://vercel.com/docs/deployment-storage#pricing). Hobby includes 10 GB of Deployment Storage, not a single interchangeable 20 GB pool; inspect Functions Storage separately.

One-time setup: add a Vercel token scoped to the owning team as the repository Actions secret `VERCEL_TOKEN`. The existing `VERCEL_DEPLOY_HOOK` cannot authorize cleanup. The workflow reports failure if the token is absent. No token belongs in source control. The script defaults to a dry run; the workflow explicitly uses `--apply`.

Packaged runtime checks use local Redis allow/deny fixtures when Redis is configured. They verify the rate-limit integration, including HTTP 429 on denial, without contacting the production database. Live Redis connectivity requires a separate production check.

### Ticket-page city waitlists

Dated shows appear first. Chicago December 4, 2026 collects Notify Me signups until a ticket link is supplied. The bottom ten undated cities are ranked by unique normalized email per explicitly selected city, excluding cities with upcoming listed shows. Only notify, waitlist and city-request sources count; geolocation and general newsletter submissions do not. Equal counts sort alphabetically.

`src/lib/waitlistRanking.server.ts` refreshes a server-only aggregate in `systemConfig/ticketWaitlistRanking` on the first request after 24 hours. The waitlist server island is cached at the CDN for one hour. It reads only email, city, source city slug and source from leads; it stores only city slugs, counts and refresh time in the aggregate. Existing Firebase admin configuration is used. No scheduled deployments or new service credentials are required. If refresh fails, the previous aggregate remains available. If no aggregate can be loaded, a city-request prompt replaces the list; static ticket purchase links remain available.

Browser critical-flow smoke tests mock lead capture and updates and block unmocked mutations. The reserved smoke identity is rejected by the capture API and excluded from rankings. On November 5, 2026, 599 verified historical smoke records were removed with owner approval. A follow-up query found zero remaining and verified that all 650 non-test records were unchanged.

### Rescheduled show links

Keep each show's `slug` unchanged when rescheduling. Set `previousDate` on the first move and retain additional former dates in `previousDates` on later moves. Never discard recorded dates. Update `isoDate` and the display date as usual. `src/utils/eventRedirects.ts` automatically generates permanent redirects for both event pages and ticket routes from current and historical date URLs to the canonical slug. No per-show redirect configuration is needed. Conflicting aliases fail the build instead of pointing at another show. Redirect aliases are excluded from the sitemap.
