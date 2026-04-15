#!/usr/bin/env bash
# =============================================================================
# BRANCH PROTECTION SETUP
# =============================================================================
# This script is commented out because branch protection on private repos
# requires GitHub Pro ($4/month) or making the repo public.
#
# When you're ready, do one of the following:
#   A) Upgrade to GitHub Pro at github.com/settings/billing
#   B) Make the repo public: GitHub repo → Settings → Danger Zone → Change visibility
#
# Then uncomment everything below and run:
#   chmod +x scripts/setup-branch-protection.sh
#   ./scripts/setup-branch-protection.sh
#
# What this does once enabled:
#   - Requires all 5 CI checks to be green before any merge to main
#   - Requires the branch to be up-to-date with main (no stale merges)
#   - Blocks even admins from bypassing (that's how the last bad merge happened)
#
# The 5 required checks:
#   1. Lint & Type Check  — ESLint + astro check
#   2. Unit Tests         — Vitest
#   3. Build              — astro build
#   4. Mutation Testing   — Stryker (score must stay above 60%)
#   5. Smoke Tests        — Playwright across 4 viewports, local build
# =============================================================================

# set -euo pipefail
#
# REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
#
# echo "Configuring branch protection for main on ${REPO}..."
#
# gh api \
#   --method PUT \
#   -H "Accept: application/vnd.github+json" \
#   "/repos/${REPO}/branches/main/protection" \
#   --input - <<'EOF'
# {
#   "required_status_checks": {
#     "strict": true,
#     "contexts": [
#       "Lint & Type Check",
#       "Unit Tests",
#       "Build",
#       "Mutation Testing",
#       "Smoke Tests"
#     ]
#   },
#   "enforce_admins": true,
#   "required_pull_request_reviews": null,
#   "restrictions": null
# }
# EOF
#
# echo "Done. Main is locked. All 5 CI checks must pass before any merge."
