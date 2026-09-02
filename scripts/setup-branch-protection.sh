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
#   - Requires the CI checks to be green before any merge to main
#   - Requires the branch to be up-to-date with main (no stale merges)
#   - Blocks even admins from bypassing (that's how the last bad merge happened)
#
# The required checks (every job in .github/workflows/ci.yml, which triggers on
# every pull_request):
#   Lint, Types, Test, Build: ESLint + astro check + Vitest + astro build
#   Firestore/Storage rules (emulator): npm run test:rules against the Firebase
#     emulator, the only gate on firestore.rules/storage.rules
#
# THIS SCRIPT IS NOT THE ENFORCEMENT, and while it stays commented out it changes
# nothing at all. Protection today comes from the "Protect Main" GitHub Ruleset,
# edited by hand in Settings, then Rules. As of 2026-09-02 that ruleset lists
# only "Lint, Types, Test, Build", so the emulator job runs but does not block a
# merge; adding the second string there by hand is the fix, and it is open as
# [NON-BLOCKING-RULES-GATE] in BUGS.md until someone confirms the merge box shows
# two required checks. The contexts array below is the same list in API form, for
# whenever the repo is on GitHub Pro or public and this can run unattended.
#
# WHY every ci.yml job and nothing else (2026-09-02): a required check must come
# from a job that reports on every PR, or merges deadlock waiting for a check
# that never starts (hit on PR #139). Both jobs above run on every PR with no
# path filter and no conditional skip, so both always report; a CI job that is
# not listed here is advisory only and its failure does not block a merge, which
# is how a rules regression could have merged green. "Smoke Tests" runs only on
# schedule and workflow_dispatch, so it never reports on PRs; mutation testing
# (Stryker) runs in the local pre-push hook and has no workflow at all. Earlier
# versions of this script required both plus three job names ("Lint & Type
# Check", "Unit Tests", "Build") that were consolidated into the single job
# above. Requiring any check that does not report on PRs re-creates the
# deadlock; adding a ci.yml job without adding it here leaves it non-blocking.
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
#       "Lint, Types, Test, Build",
#       "Firestore/Storage rules (emulator)"
#     ]
#   },
#   "enforce_admins": true,
#   "required_pull_request_reviews": null,
#   "restrictions": null
# }
# EOF
#
# echo "Done. Main is locked. Both CI checks must pass before any merge."
