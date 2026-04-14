#!/usr/bin/env bash
# One-time setup: configure required status checks on main.
# Run this once after cloning or setting up the repo.
# Prerequisites: gh CLI installed and authenticated (gh auth login).
#
# After running, GitHub will block any merge to main unless all 5 checks pass:
#   - Lint & Type Check
#   - Unit Tests
#   - Build
#   - Mutation Testing
#   - Smoke Tests
#
# enforce_admins: true prevents repo admins from bypassing the gate.

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

echo "Configuring branch protection for main on ${REPO}..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint & Type Check",
      "Unit Tests",
      "Build",
      "Mutation Testing",
      "Smoke Tests"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF

echo "Done. Main is locked. All 5 CI checks must pass before any merge."
