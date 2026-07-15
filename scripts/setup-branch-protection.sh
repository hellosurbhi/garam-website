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
#   - Requires the CI check to be green before any merge to main
#   - Requires the branch to be up-to-date with main (no stale merges)
#   - Blocks even admins from bypassing (that's how the last bad merge happened)
#
# The required check:
#   Lint, Types, Test, Build: ESLint + astro check + Vitest + astro build
#   (single job in .github/workflows/ci.yml, runs on every pull_request)
#
# WHY only this one check (2026-07-14): a required check must come from a job
# that reports on every PR, or merges deadlock waiting for a check that never
# starts (hit on PR #139). "Smoke Tests" runs only on schedule and
# workflow_dispatch, so it never reports on PRs; mutation testing (Stryker)
# runs in the local pre-push hook and has no workflow at all. Earlier versions
# of this script required both plus three job names ("Lint & Type Check",
# "Unit Tests", "Build") that were consolidated into the single job above.
# Requiring any check that does not report on PRs re-creates the deadlock.
# If you add a check here, its workflow must trigger on pull_request and the
# string must match the job's `name:` exactly.
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
#       "Lint, Types, Test, Build"
#     ]
#   },
#   "enforce_admins": true,
#   "required_pull_request_reviews": null,
#   "restrictions": null
# }
# EOF
#
# echo "Done. Main is locked. The CI check must pass before any merge."
