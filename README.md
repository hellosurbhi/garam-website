# Garam Masala Dating

Website, contestant application system, and admin dashboard for [Garam Masala Dating](https://garammasaladating.com) — a weekly live comedy dating show in NYC.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Data:** Firebase Firestore (applications), Firebase Auth (admin)
- **Hosting:** Vercel with static prerendering
- **Styling:** CSS custom properties, component-level CSS modules

## Quick Start

```bash
git clone https://github.com/your-org/garam-masala-dating.git
cd garam-masala-dating
npm install
cp .env.example .env.local  # then fill in your values
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following:

| Variable                            | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase client API key                        |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                           |
| `VITE_FIREBASE_PROJECT_ID`          | Firestore project ID                           |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Cloud Storage bucket                           |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                   |
| `VITE_FIREBASE_APP_ID`              | Firebase app ID                                |
| `FIREBASE_ADMIN_CLIENT_EMAIL`       | Service account email (server-side only)       |
| `FIREBASE_ADMIN_PRIVATE_KEY`        | Service account private key (server-side only) |
| `CONTESTANT_PREP_SALT`              | Salt for weekly password rotation              |

`VITE_`-prefixed variables are exposed to the client. `FIREBASE_ADMIN_*` variables are used only in Vercel serverless functions.

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

1. Create a branch off `main`
2. Run `npm run lint` before committing
3. Open a PR — CI runs lint, type-check, and build
4. All PRs require passing CI before merge

Code conventions and project rules live in `CLAUDE.md`.

.env.example

# Firebase (client-safe — these are public config, not secrets)

PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side only — used by API routes)

FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Contestant prep page password rotation

CONTESTANT_PREP_SALT=

# Resend (email notifications for new applications)

RESEND_API_KEY=
NOTIFICATION_EMAIL=
