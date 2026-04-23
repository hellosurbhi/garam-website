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
npm install
cp .env.example .env.local  # fill in your own Firebase project values
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following:

| Variable                              | Purpose                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `PUBLIC_FIREBASE_API_KEY`             | Firebase client API key                                        |
| `PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                                           |
| `PUBLIC_FIREBASE_PROJECT_ID`          | Firestore project ID                                           |
| `PUBLIC_FIREBASE_STORAGE_BUCKET`      | Cloud Storage bucket                                           |
| `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                                   |
| `PUBLIC_FIREBASE_APP_ID`              | Firebase app ID                                                |
| `FIREBASE_ADMIN_CLIENT_EMAIL`         | Service account email (server-side only)                       |
| `FIREBASE_ADMIN_PRIVATE_KEY`          | Service account private key (server-side only)                 |
| `CONTESTANT_PREP_SALT`                | Salt for weekly password rotation (gates `/contestant-portal`) |

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

| Route                         | What it does                                                 |
| ----------------------------- | ------------------------------------------------------------ |
| `/`                           | Landing page: hero, next show, social proof, FAQ, newsletter |
| `/tickets`                    | Quick-buy page linking to Eventbrite                         |
| `/apply`                      | Contestant application form (writes to Firestore)            |
| `/faq`                        | Frequently asked questions                                   |
| `/hosts`                      | Host bios and backstory                                      |
| `/links`                      | Linktree replacement for Instagram bio                       |
| `/journal`                    | Blog / articles index                                        |
| `/journal/[slug]`             | Individual blog post                                         |
| `/cities/[slug]`              | City landing page (NYC, Chicago, etc.)                       |
| `/south-asian-dating-tips`    | Dating tips content hub                                      |
| `/admin`                      | Protected dashboard to review applications (Firebase Auth)   |
| `/contestant-portal`          | Password-protected prep guide for selected contestants       |
| `/privacy`                    | Privacy policy                                               |
| `/terms`                      | Terms of service                                             |
| `/api/contestant-portal-auth` | Server: validates contestant portal password                 |
| `/api/notify-application`     | Server: sends email on new application                       |

## Scripts

| Command                   | What it does                                |
| ------------------------- | ------------------------------------------- |
| `npm run dev`             | Start dev server with HMR                   |
| `npm run build`           | Type-check and build for production         |
| `npm run build:prerender` | Build + generate static HTML with Puppeteer |
| `npm run lint`            | Run ESLint                                  |
| `npm run preview`         | Preview production build locally            |

## Deployment

The site deploys to **Vercel**. The production build uses `build:prerender` to generate static HTML for key pages via Puppeteer. Security headers (CSP, HSTS, X-Frame-Options) are configured in `vercel.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This is a solo-operated project — open an issue before sending a PR.

Code conventions and AI-assistant rules live in `CLAUDE.md`.

## Licensing

Source code is licensed under the [MIT License](LICENSE).

Brand assets, host photography, the WebGL hero shader, and all editorial content (journal articles, city pages, tips) are proprietary and are NOT covered by the MIT License. See [NOTICE](NOTICE) for details.
