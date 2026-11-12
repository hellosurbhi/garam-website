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

| Route                      | What it does                                                      |
| -------------------------- | ----------------------------------------------------------------- |
| `/`                        | Landing page — hero, next show, social proof, FAQ, newsletter     |
| `/links`                   | Linktree replacement for Instagram bio                            |
| `/apply`                   | Contestant application form (autosaves via /api/save-application) |
| `/admin`                   | Protected dashboard to review applications (Firebase Auth)        |
| `/contestant-prep`         | Password-protected prep guide for selected contestants            |
| `/faq`                     | Frequently asked questions                                        |
| `/cities`                  | Events directory by city                                          |
| `/journal`                 | Blog / articles                                                   |
| `/south-asian-dating-tips` | Dating tips content hub                                           |

## Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Start dev server with HMR                 |
| `npm run build`        | Build and verify the packaged server      |
| `npm run test:runtime` | Check the existing Vercel server artifact |
| `npm run lint`         | Run ESLint                                |
| `npm run preview`      | Preview production build locally          |

## Deployment

The site deploys to **Vercel**. The production branch is `main`. Git previews allow review of feature branches before merge. Enable previews in the Vercel project as part of rollout and verify a Ready preview for the exact commit under review. `npm run build` generates Astro's static pages and server function, then checks that the packaged server starts in isolation and handles ticket redirects and safe API requests. This check runs in CI and Vercel builds before release. It blocks external fetches except the authenticated, read-only Redis PING with one bounded retry and does not submit customer data. Security headers (CSP, HSTS, X-Frame-Options) are configured in `vercel.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This is a solo-operated project — open an issue before sending a PR.

Code conventions and AI-assistant rules live in `CLAUDE.md`.

## Licensing

Source code is licensed under the [MIT License](LICENSE).

Brand assets, host photography, the WebGL hero shader, and all editorial content (journal articles, city pages, tips) are proprietary and are NOT covered by the MIT License. See [NOTICE](NOTICE) for details.

### Automatic deployment cleanup

`Keep current Vercel deployment` runs when a same-repo PR merges, after successful Vercel deployment statuses and hourly. It removes a finished Git preview only after GitHub confirms its commit belongs to a merged PR and its branch has no open PR. The hourly run retries builds that were still running at merge or missed an event. Unmatched previews stay subject to the existing Vercel retention policy. A manual run with `dry_run` checked lists what cleanup would delete and deletes nothing. The production cleanup protects the live deployment, rollback, custom domains and newer ready builds. Inspect Deployment Storage and Functions Storage separately. Earlier daily peaks can still appear after a deletion. See [Vercel's storage accounting](https://vercel.com/docs/deployment-storage#pricing).

Cleanup also listens for successful GitHub deployment statuses from `vercel[bot]` in the `Production` environment. This deployment-status trigger ignores previews and failures. The retained classic Vercel status trigger can also request cleanup; the serialized cleanup script rechecks and protects the live production deployment. The hourly schedule remains a fallback.

One-time setup: add a Vercel token scoped to the owning team as the repository Actions secret `VERCEL_TOKEN`. The existing `VERCEL_DEPLOY_HOOK` cannot authorize cleanup. The workflow reports failure if the token is absent. No token belongs in source control. The script defaults to a dry run; the workflow explicitly uses `--apply`.

Packaged runtime checks use local Redis allow/deny fixtures when Redis is configured. They verify the rate-limit integration, including HTTP 429 on denial, without contacting the production database. The packaged smoke test also sends a real authenticated PING using the Redis connection exercised by the artifact. It requires PONG within five seconds per attempt, waits 250 ms before retrying a temporary network failure, HTTP 429 or HTTP 5xx once and fails if the retry fails. Authentication and invalid-response failures do not get retries. Production builds fail if no Redis connection was exercised; unconfigured local and CI builds explicitly report the health check as skipped. The PING does not write keys or change rate-limit counters.

### Ticket-page city waitlists

Purchasable upcoming shows appear first on the homepage and tickets page. The five markets with the most unique emails appear below them, with dated waitlists before undated waitlists. A date alone does not make a show purchasable: presales and sold-out shows do not qualify. Chicago December 4 and San Diego December 24 are withdrawn, but both markets remain eligible for Notify Me.

Demand includes leads from any signup source and contestant applications with explicit city interest or entered location. Email addresses are normalized and deduplicated within each market across both collections. Known test submissions, reserved synthetic identities, deleted records, invalid emails and inferred geolocation are excluded. Selected city interest takes precedence over entered location. Popup and Spice List records count only when they have an explicit market slug because their legacy city fields could be IP-prefilled. Editing either city input sends a request-only `cityInputSource: "entered"` marker; the capture API resolves the city into the existing `sourceCitySlug` field. Unchanged prefills and unknown markets are not promoted to explicit interest. No Firestore schema change is required. Metro aliases live in `src/data/waitlistMarkets.ts`; Edison counts under New York. Ambiguous locations are excluded. Markets with purchasable upcoming shows are excluded before selecting five, and equal counts sort alphabetically.

`src/lib/waitlistRanking.server.ts` refreshes the server-only `systemConfig/ticketWaitlistRankingV3` aggregate after 24 hours. The versioned path prevents reuse of rankings computed without explicit-city provenance. Both collections must load successfully before publishing counts. Only email, normalized email, city, source city slug, source and deletion status are read; only city slugs, counts and refresh time are cached. No raw emails are sent to the browser. The island loads event inventory server-side and sends only compact presentation props, allowing a GET response cached at the CDN for one hour. Its selection timestamps match the static ticket list so the sections do not contradict each other; coordinated expiry without a rebuild is tracked in BUGS.md. Refresh failure retains a previous valid V3 aggregate, with a 15-second deadline and retry on the next request. Without a valid aggregate, a city-request prompt replaces the waitlists while static purchase links remain available.

Browser critical-flow smoke tests mock lead capture and updates and block unmocked mutations. The reserved smoke identity is rejected by the capture API and Firestore lead-create rules and excluded from rankings. Browser smoke signup responses are simulated; database write tests use the Firebase emulator. Deploy the Firestore rules through the normal rules release process to activate that database backstop. On November 5, 2026, 599 verified historical smoke records were removed with owner approval. A follow-up query found zero remaining and verified that all 650 non-test records were unchanged.

### Rescheduled show links

Keep each show's `slug` unchanged when rescheduling. Set `previousDate` on the first move and retain additional former dates in `previousDates` on later moves. Never discard recorded dates. Update `isoDate` and the display date as usual. `src/utils/eventRedirects.ts` automatically generates permanent redirects for both event pages and ticket routes from current and historical date URLs to the canonical slug. No per-show redirect configuration is needed. Conflicting aliases fail the build instead of pointing at another show. Redirect aliases are excluded from the sitemap.

After a production deployment containing the current build, run `npm run test:redirects`. It checks each generated event alias for HTTP 308, the expected canonical path and preserved `utm_source`, `utm_campaign` and `eid`. It does not follow ticket destinations or submit forms. All aliases are checked with at most four simultaneous requests before reporting failures together. A missing alias or stripped query fails the check.

## Production monitoring

The [monitoring runbook](docs/operations/production-monitoring.md) explains isolated pre-release tests, real production signup checks, guarded test cleanup and the release gates for deployed rules and external watchdogs. Local browser checks build their own nonsecret Firebase fixture and block unmocked writes.
