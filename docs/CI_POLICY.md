# CI Policy

This repo should feel production-grade without burning GitHub Actions minutes on checks that do not match the risk of a small event website.

## Hot Path

These checks run during normal development.

- `pre-commit`: runs `lint-staged` only, so staged JS/TS/Astro/CSS/Markdown/JSON is fixed before it lands.
- `pre-push`: runs `npm run verify:quick`, which is whole-repo ESLint plus Astro type/content checks.
- Pull requests to `main`: run one CI job with one dependency install, then `npm run lint`, `npm run check`, `npm run test`, and `npm run build`.

The PR job intentionally does not install browsers or run Playwright. Static checks, unit tests, and the production build catch the normal regressions without multiplying install cost across several jobs.

## Scheduled Checks

These checks run on a cadence instead of every commit.

- Weekly production smoke: runs Playwright against `https://garammasaladating.com` every Monday.
- Weekly link check: crawls production links every Monday.
- Daily rebuild: triggers the Vercel deploy hook so scheduled journal articles can publish on their `datePublished` day.
- Daily post-show emails: sends idempotent post-show emails the morning after a show.
- Monthly mutation testing: runs Stryker on the 1st of each month.
- Monthly article freshness refresh: updates stale `dateModified` metadata on the 1st of each month.

The daily rebuild and post-show email workflows are operational jobs, not QA jobs. They stay scheduled because they publish content and contact contestants.

## Guardrails

- Do not put Playwright, Stryker, or full production crawls back into every PR/push without a specific reason.
- Do not make quality checks memory-dependent when they can run on a sensible schedule.
- Do not split CI into multiple jobs that each run `npm ci` unless parallelism is worth the extra billable minutes.
- Keep local hooks fast enough that they stay enabled.
