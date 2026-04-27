#!/bin/bash
# This file was generated using AI assistance (Cursor AI) and reviewed by the maintainers.
#
# Detect files under code/ changed since the last rebase that have no rebase
# rule.  Such modifications would be silently lost on the next upstream rebase.
#
# How it works:
#   1. Finds the last rebase commit (message starts with "Rebase against the upstream")
#   2. Lists files in code/ changed since that commit
#   3. Filters out Che-only additions (che-* extensions, che/ subdirs) and lockfiles
#   4. For remaining files, checks whether a rebase rule exists in:
#        - resolve_conflicts() elif chain in rebase.sh
#        - .rebase/replace/  (from→by rules)
#        - .rebase/add/      (JSON fragments merged in)
#        - .rebase/override/  (JSON overrides)
#   5. Reports any uncovered files
#
# Usage:
#   bash check-unprotected-changes.sh                   # default: changes since last rebase
#   bash check-unprotected-changes.sh <base>..<head>     # explicit commit range
#   bash check-unprotected-changes.sh --verbose          # show covered files too
#   bash check-unprotected-changes.sh --pr-comment       # output as GitHub PR comment (markdown)
#   bash check-unprotected-changes.sh --list             # output bare file paths only
#
# Exit codes:
#   0 — All modifications are covered by rebase rules (or are Che-only additions)
#   1 — Unprotected modifications found
#   2 — Error (can't find rebase commit, etc.)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

VERBOSE=false
OUTPUT_MODE="text"
COMMIT_RANGE=""
for arg in "$@"; do
  case "$arg" in
    --verbose|-v)   VERBOSE=true ;;
    --pr-comment)   OUTPUT_MODE="pr-comment" ;;
    --list)         OUTPUT_MODE="list" ;;
    *..*)           COMMIT_RANGE="$arg" ;;
  esac
done

# --- Locate the last rebase commit ---
if [ -z "$COMMIT_RANGE" ]; then
  REBASE_COMMIT=$(git log --format='%H' --grep="^Rebase against the upstream" -1)
  if [ -z "$REBASE_COMMIT" ]; then
    if [ "$OUTPUT_MODE" = "list" ]; then
      exit 2
    fi
    echo "ERROR: Could not find a rebase commit in the history."
    echo "Expected a commit whose message starts with 'Rebase against the upstream'."
    exit 2
  fi
  REBASE_MSG=$(git log -1 --format='%s' "$REBASE_COMMIT")
  COMMIT_RANGE="${REBASE_COMMIT}..HEAD"
fi

if [ "$OUTPUT_MODE" = "text" ]; then
  if [ -n "${REBASE_MSG:-}" ]; then
    echo "=== Unprotected Changes Check ==="
    echo "Base: $REBASE_COMMIT (${REBASE_MSG})"
  else
    echo "=== Unprotected Changes Check ==="
    echo "Range: $COMMIT_RANGE"
  fi
  echo ""
fi

# --- Build the set of files covered by rebase rules ---
COVERED_LIST=$(mktemp)
trap 'rm -f "$COVERED_LIST"' EXIT

# 1. Parse resolve_conflicts() elif chain for explicit file paths.
while IFS= read -r line; do
  if [[ "$line" =~ \[\[.*==.*\"([^\"]+)\".*\]\] ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
done < <(sed -n '/^resolve_conflicts()/,/^}/p' rebase.sh) >> "$COVERED_LIST"

# 2. .rebase/replace/ rules
find .rebase/replace -name '*.json' -type f 2>/dev/null | while IFS= read -r rule_file; do
  code_path="${rule_file#.rebase/replace/}"
  code_path="${code_path%.json}"
  if [[ "$code_path" != code/* ]]; then
    code_path="code/$code_path"
  fi
  echo "$code_path"
done >> "$COVERED_LIST"

# 3. .rebase/add/ rules
find .rebase/add -type f 2>/dev/null | while IFS= read -r rule_file; do
  echo "${rule_file#.rebase/add/}"
done >> "$COVERED_LIST"

# 4. .rebase/override/ rules
find .rebase/override -type f 2>/dev/null | while IFS= read -r rule_file; do
  echo "${rule_file#.rebase/override/}"
done >> "$COVERED_LIST"

sort -u -o "$COVERED_LIST" "$COVERED_LIST"

# --- Check changed files ---
UNCOVERED=()
COVERED_COUNT=0
SKIPPED_COUNT=0

while IFS= read -r file_path; do
  # Skip package-lock.json (handled by resolve_package_lock during rebase)
  case "$file_path" in
    */package-lock.json) ((SKIPPED_COUNT++)); continue ;;
  esac

  # Skip Che-only additions — these don't exist in upstream and won't conflict
  case "$file_path" in
    code/extensions/che-*) ((SKIPPED_COUNT++)); continue ;;
    */che/*.ts|*/che/*.js)  ((SKIPPED_COUNT++)); continue ;;
  esac

  if grep -qxF "$file_path" "$COVERED_LIST"; then
    ((COVERED_COUNT++))
    continue
  fi

  UNCOVERED+=("$file_path")
done < <(git diff --name-only "$COMMIT_RANGE" -- code/)

# --- Output ---

# --list mode: bare file paths, nothing else
if [ "$OUTPUT_MODE" = "list" ]; then
  for f in "${UNCOVERED[@]+${UNCOVERED[@]}}"; do
    echo "$f"
  done
  [ ${#UNCOVERED[@]} -eq 0 ] && exit 0 || exit 1
fi

# --pr-comment mode: markdown for a GitHub PR comment
if [ "$OUTPUT_MODE" = "pr-comment" ]; then
  if [ ${#UNCOVERED[@]} -eq 0 ]; then
    exit 0
  fi
  cat <<'HEADER'
<!-- rebase-rules-check -->
### Missing Rebase Rules

The following files were modified in this PR but do not have corresponding rebase rules.
Without these rules, the changes **will be lost** during the next upstream rebase.

| # | File |
|---|------|
HEADER
  i=1
  for f in "${UNCOVERED[@]}"; do
    echo "| $i | \`$f\` |"
    ((i++))
  done
  echo ""
  echo "Comment \`/add-rebase-rules\` on this PR to add the missing rules automatically."
  exit 1
fi

# Default text mode
if [ "$VERBOSE" = true ]; then
  echo "Covered: $COVERED_COUNT | Skipped: $SKIPPED_COUNT | Uncovered: ${#UNCOVERED[@]}"
  echo ""
  echo "Rebase rules on file:"
  sed 's/^/  /' "$COVERED_LIST"
  echo ""
fi

if [ ${#UNCOVERED[@]} -eq 0 ]; then
  echo "All modified files in code/ are covered by rebase rules (or are Che-only additions)."
  echo "  Covered: $COVERED_COUNT  Skipped (lockfiles/Che-only): $SKIPPED_COUNT"
  exit 0
fi

echo "**Found ${#UNCOVERED[@]} file(s) modified since the last rebase without rebase rules:**"
echo ""
for f in "${UNCOVERED[@]}"; do
  echo "  - $f"
done
echo ""
echo "These changes will be lost on the next upstream rebase unless a rule is added."
echo ""
echo "To fix, for each file above either:"
echo "  1. Add a .rebase/replace/<path>.json with {\"from\": ..., \"by\": ...} rules"
echo "  2. Add a .rebase/add/<path> or .rebase/override/<path> JSON fragment"
echo "  3. Add an elif branch in resolve_conflicts() in rebase.sh"
exit 1
