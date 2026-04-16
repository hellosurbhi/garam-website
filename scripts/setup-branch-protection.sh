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
# NOTE: This script is intentionally commented out by default. To enable it,
# uncomment the following block and run the script. The block includes
# prerequisite checks that will abort with actionable messages if `gh` is
# missing or not authenticated for the target repository.
#
# REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
#
# echo "Preparing to configure branch protection for main on ${REPO}..."
#
# # -- Prerequisite checks --------------------------------------------------
# if ! command -v gh >/dev/null 2>&1; then
#   echo "Error: GitHub CLI 'gh' is not installed or not in PATH." >&2
#   echo "Install it from https://cli.github.com/ and authenticate with 'gh auth login'." >&2
#   exit 1
# fi
#
# if ! gh auth status >/dev/null 2>&1; then
#   echo "Error: 'gh' appears to be unauthenticated." >&2
#   echo "Run 'gh auth login' to authenticate, or 'gh auth status' for details." >&2
#   exit 1
# fi
#
# # Validate access to the target repository and get canonical name
# if ! REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
#   echo "Error: unable to access the repository via 'gh'." >&2
#   echo "Confirm you have permission and that the repository exists: 'gh repo view <owner>/<repo>'" >&2
#   exit 1
# fi
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
