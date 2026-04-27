#!/bin/bash
# This file was generated using AI assistance (Cursor AI) and reviewed by the maintainers.
#
# Detect files under code/ changed in a PR whose modifications are NOT fully
# protected by rebase rules.  Two categories:
#   - "Missing rule"  — no rebase rule exists for the file at all
#   - "Incomplete rule" — a rule exists but doesn't reproduce the current content
#
# For "incomplete" detection the script runs the actual rebase handler against
# upstream content and diffs the result against the working tree, reusing the
# test infrastructure from .claude/skills/test-rebase-rules/.
#
# Usage:
#   bash check-unprotected-changes.sh --pr-comment <base>..<head>
#
# Prerequisites (for incomplete-rule detection):
#   - upstream-code remote must be fetched for the current upstream version
#
# Exit codes:
#   0 — All modifications are fully covered
#   1 — Problems found
#   2 — Error
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

OUTPUT_MODE="text"
COMMIT_RANGE=""
for arg in "$@"; do
  case "$arg" in
    --pr-comment)   OUTPUT_MODE="pr-comment" ;;
    *..*)           COMMIT_RANGE="$arg" ;;
  esac
done

if [ -z "$COMMIT_RANGE" ]; then
  REBASE_COMMIT=$(git log --format='%H' --grep="^Rebase against the upstream" -1)
  if [ -z "$REBASE_COMMIT" ]; then
    echo "ERROR: Could not find a rebase commit and no commit range provided." >&2
    exit 2
  fi
  COMMIT_RANGE="${REBASE_COMMIT}..HEAD"
fi

UPSTREAM_VERSION=$(grep '^CURRENT_UPSTREAM_VERSION=' rebase.sh | head -1 | sed 's/.*="\(.*\)"/\1/')

HANDLER_SCRIPT="$REPO_ROOT/.claude/skills/test-rebase-rules/test-rebase-handler.sh"
RUN_ALL_TESTS="$REPO_ROOT/.claude/skills/test-rebase-rules/run-all-tests.sh"

# --- Build the set of files covered by rebase rules ---
COVERED_LIST=$(mktemp)
trap 'rm -f "$COVERED_LIST"' EXIT

while IFS= read -r line; do
  if [[ "$line" =~ \[\[.*==.*\"([^\"]+)\".*\]\] ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
done < <(sed -n '/^resolve_conflicts()/,/^}/p' rebase.sh) >> "$COVERED_LIST"

find .rebase/replace -name '*.json' -type f 2>/dev/null | while IFS= read -r rule_file; do
  code_path="${rule_file#.rebase/replace/}"
  code_path="${code_path%.json}"
  if [[ "$code_path" != code/* ]]; then
    code_path="code/$code_path"
  fi
  echo "$code_path"
done >> "$COVERED_LIST"

find .rebase/add -type f 2>/dev/null | while IFS= read -r f; do echo "${f#.rebase/add/}"; done >> "$COVERED_LIST"
find .rebase/override -type f 2>/dev/null | while IFS= read -r f; do echo "${f#.rebase/override/}"; done >> "$COVERED_LIST"

sort -u -o "$COVERED_LIST" "$COVERED_LIST"

# --- Collect changed files and classify ---
MISSING_RULE=()
TO_TEST=()

while IFS= read -r file_path; do
  case "$file_path" in
    */package-lock.json)      continue ;;
    code/extensions/che-*)    continue ;;
    */che/*.ts|*/che/*.js)     continue ;;
  esac

  if grep -qxF "$file_path" "$COVERED_LIST"; then
    TO_TEST+=("$file_path")
  else
    MISSING_RULE+=("$file_path")
  fi
done < <(git diff --name-only "$COMMIT_RANGE" -- code/)

# --- Test files that have rules: are rules complete? ---
INCOMPLETE_RULE=()
HAS_UPSTREAM=false
if [ -n "$UPSTREAM_VERSION" ]; then
  git rev-parse "upstream-code/$UPSTREAM_VERSION" > /dev/null 2>&1 && HAS_UPSTREAM=true
fi

if [ "$HAS_UPSTREAM" = true ] && [ ${#TO_TEST[@]} -gt 0 ] && [ -f "$RUN_ALL_TESTS" ]; then
  TEST_OUTPUT=$(bash "$RUN_ALL_TESTS" "${TO_TEST[@]}" 2>&1) || true

  while IFS= read -r line; do
    if [[ "$line" =~ ^\|\ \`([^\`]+)\`\ \| ]]; then
      failed_file="${BASH_REMATCH[1]}"
      INCOMPLETE_RULE+=("$failed_file")
    fi
  done < <(echo "$TEST_OUTPUT" | sed -n '/^### Failures/,/^### /p' | grep '^| `')
fi

# --- Output ---
TOTAL_ISSUES=$(( ${#MISSING_RULE[@]} + ${#INCOMPLETE_RULE[@]} ))

if [ "$OUTPUT_MODE" = "pr-comment" ]; then
  if [ $TOTAL_ISSUES -eq 0 ]; then
    exit 0
  fi

  echo "<!-- rebase-rules-check -->"
  echo "### Rebase Rules Check"
  echo ""
  echo "The following files were modified in this PR but their changes are **not fully protected** by rebase rules."
  echo "Without proper rules, these changes **will be lost** during the next upstream rebase."
  echo ""

  if [ ${#MISSING_RULE[@]} -gt 0 ]; then
    echo "#### Missing rules (no rebase rule exists)"
    echo ""
    echo "| # | File |"
    echo "|---|------|"
    i=1
    for f in "${MISSING_RULE[@]}"; do
      echo "| $i | \`$f\` |"
      ((i++))
    done
    echo ""
  fi

  if [ ${#INCOMPLETE_RULE[@]} -gt 0 ]; then
    echo "#### Incomplete rules (rule exists but doesn't cover new changes)"
    echo ""
    echo "| # | File |"
    echo "|---|------|"
    i=1
    for f in "${INCOMPLETE_RULE[@]}"; do
      echo "| $i | \`$f\` |"
      ((i++))
    done
    echo ""
  fi

  echo "Comment \`/add-rebase-rules\` on this PR to add or update the rules automatically."
  exit 1
fi

# Default text mode
if [ $TOTAL_ISSUES -eq 0 ]; then
  echo "All modified files in code/ are fully covered by rebase rules."
  exit 0
fi

echo "Found $TOTAL_ISSUES file(s) with rebase rule problems:"
echo ""
if [ ${#MISSING_RULE[@]} -gt 0 ]; then
  echo "Missing rules:"
  for f in "${MISSING_RULE[@]}"; do echo "  - $f"; done
  echo ""
fi
if [ ${#INCOMPLETE_RULE[@]} -gt 0 ]; then
  echo "Incomplete rules:"
  for f in "${INCOMPLETE_RULE[@]}"; do echo "  - $f"; done
  echo ""
fi
echo "Comment /add-rebase-rules on this PR to fix automatically."
exit 1
