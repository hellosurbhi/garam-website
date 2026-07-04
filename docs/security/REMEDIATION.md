# Security Remediation Log

This file tracks completed security remediations. Its purpose is to provide a durable record so future audits can see what was fixed, when, and why.

---

## PR #96 — Dependabot + CodeQL sweep (2026-07-03)

**Branch:** `security/resolve-dependabot-codeql`
**Plan:** `~/.claude/plans/image-2-review-and-glittery-anchor.md`
**Issues resolved:** 3 Dependabot alerts + 14 CodeQL findings = 17 total

### Dependabot (3 alerts)

All three were dev-only transitive dependencies (via `@lhci/cli` and `firebase-tools`). Fixed via `npm overrides` in `package.json`:

| Alert | Package         | Severity | Fix                   |
| ----- | --------------- | -------- | --------------------- |
| #1    | `tmp <= 0.2.3`  | LOW      | Override to `^0.2.6`  |
| #3    | `uuid < 11.1.1` | MEDIUM   | Override to `^11.1.1` |
| #5    | `tmp < 0.2.6`   | HIGH     | Override to `^0.2.6`  |

Note: these are dev-scope only and do not reach production (`npm audit --omit=dev` reported 0 vulns before this fix). The overrides are belt-and-suspenders.

### CodeQL (14 findings across 4 classes)

**Missing workflow permissions (4 MEDIUM findings)**
All four `.github/workflows/*.yml` files lacked explicit `permissions:` blocks, defaulting to `contents: write` on some plan types.

| File                | Fix                                              |
| ------------------- | ------------------------------------------------ |
| `ci.yml`            | Added `permissions: { contents: read }`          |
| `smoke-tests.yml`   | Added `permissions: { contents: read }`          |
| `link-check.yml`    | Added `permissions: { contents: read }`          |
| `daily-rebuild.yml` | Added `permissions: {}` (cron-only, no checkout) |

**Client-side lat/long storage (2 HIGH findings)**
`js/clear-text-storage-of-sensitive-data` — lat/long written to `sessionStorage` in `leadAttribution.ts`.

Fix: dropped client-side coordinate storage entirely. `/api/capture-lead` now reads `x-vercel-ip-latitude` / `x-vercel-ip-longitude` from its own request headers (server-trusted, client cannot spoof). Removes one browser round-trip.

Files changed: `src/lib/leadAttribution.ts`, `src/lib/leadSubmission.ts`, `src/pages/api/geo.ts`, `src/pages/api/capture-lead.ts`.

**Stack trace leakage (3 MEDIUM findings)**
`js/stack-trace-exposure` — raw `error.message` or `error.stack` returned in HTTP 500 responses in API routes.

Fix: replaced all `error instanceof Error ? error.message : String(error)` patterns with generic "Internal server error" responses. Stack traces now go to Vercel logs only.

Files changed: `src/pages/api/notify-application.ts`, `api/notify-application.ts`, `api/contestant-prep-auth.ts`.

**Incomplete URL sanitization (2 HIGH findings)**
`js/incomplete-url-substring-sanitization` — `url.includes("garammasaladating.com")` as an allowlist check can be bypassed with `garammasaladating.com.attacker.com`.

Fix: replaced `.includes()` pattern with proper `URL` parsing + hostname comparison.

Files changed: `src/lib/leadAttribution.ts`, `src/pages/api/capture-lead.ts`.

**Incomplete URL scheme check (1 HIGH finding)**
`js/incomplete-url-scheme-check` — `url.startsWith("http")` matches both `http://` and `https://` and could be bypassed with `httpmalicious://`.

Fix: explicit `url.startsWith("https://") || url.startsWith("http://")` check.

**Incomplete multi-character sanitization (2 HIGH findings)**
`js/incomplete-multi-character-sanitization` — partial string replacement using `.replace("&", "")` (replaces first match only, not all occurrences).

Fix: replaced with `.replaceAll()` for all sanitization calls in the test harness and llms.txt endpoint.

---

## GitHub Rulesets — garam-website (2026-07-03)

Branch protection on `main` via GitHub Ruleset (not Classic, which is deprecated):

- Restrict deletions
- Require pull request (1 review on external contributions; Surbhi as owner bypasses)
- Require status checks: Lint, Types, Test, Build

---

## Open Dependabot alerts (post-PR #96, as of 2026-07-03)

The 3 Dependabot alerts are dev-only and resolved via npm overrides. GitHub may still show them as "open" until the next Dependabot re-scan detects the overrides. No additional action needed.

---

## Security contact

Vulnerability reports: see `SECURITY.md` in the repo root.
