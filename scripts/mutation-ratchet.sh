#!/bin/bash
# Mutation regression ratchet: blocks pushes where the mutation score drops
# vs the previous recorded run. Ratchet state lives in .stryker-tmp/last-score.txt
# (gitignored, local per clone). Fresh clones start at 0 so the first real push
# establishes a baseline without blocking.
#
# Called from .husky/pre-push when the global ~/.git-hooks/pre-push is absent.
# When the global hook IS present it runs its own identical ratchet, so we skip
# here to avoid running Stryker twice per push.
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)

# Only run when test files have changed in the last 7 days.
RECENT_TEST_CHANGES=$(git log --since=7.days --name-only --format="" -- "**/*.test.*" "**/*.spec.*" 2>/dev/null | grep -c '.' || true)
RECENT_TEST_CHANGES=${RECENT_TEST_CHANGES:-0}
if [ "$RECENT_TEST_CHANGES" -eq 0 ]; then
  echo "Stryker: no test file changes in 7 days, skipping." >&2
  exit 0
fi

echo "Running Stryker mutation tests (regression ratchet)..." >&2
STRYKER_TMP="$REPO_ROOT/.stryker-tmp"
mkdir -p "$STRYKER_TMP"
LAST_SCORE_FILE="$STRYKER_TMP/last-score.txt"
LAST_SCORE=$(cat "$LAST_SCORE_FILE" 2>/dev/null || echo "0")
STRYKER_OUT=$(mktemp)

if npx stryker run 2>&1 | tee "$STRYKER_OUT" >&2; then
  CURRENT_SCORE=$(grep -oE 'Final mutation score of [0-9]+\.?[0-9]*' "$STRYKER_OUT" \
    | grep -oE '[0-9]+\.?[0-9]*$' | tail -1 || echo "0")
  rm -f "$STRYKER_OUT"
  CURRENT_SCORE="${CURRENT_SCORE:-0}"
  echo "Stryker mutation score: $CURRENT_SCORE%" >&2

  if (( $(echo "$CURRENT_SCORE < $LAST_SCORE" | bc -l 2>/dev/null || echo 0) )); then
    echo "STRYKER FAILED: Mutation score dropped from $LAST_SCORE% to $CURRENT_SCORE%." >&2
    exit 1
  fi

  echo "$CURRENT_SCORE" > "$LAST_SCORE_FILE"
  echo "Stryker: passed ($CURRENT_SCORE%)" >&2
else
  rm -f "$STRYKER_OUT"
  echo "Stryker run failed." >&2
  exit 1
fi
