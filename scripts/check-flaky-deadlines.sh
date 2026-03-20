#!/usr/bin/env bash
# check-flaky-deadlines.sh
# Parses flaky-tests.json and warns on any entries past their 30-day deadline.
# Exits with code 1 if any deadlines have expired (for CI enforcement).

set -euo pipefail

MANIFEST="${1:-flaky-tests.json}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="$REPO_ROOT/$MANIFEST"

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "ERROR: flaky-tests.json not found at $MANIFEST_PATH" >&2
  exit 2
fi

# Require jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed" >&2
  exit 2
fi

TODAY=$(date -u +%Y-%m-%d)
TOTAL=$(jq '.quarantined | length' "$MANIFEST_PATH")
EXPIRED=0
EXPIRING_SOON=0

echo "Flaky Test Quarantine Status — $TODAY"
echo "========================================"
echo "Total quarantined tests: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "No quarantined tests. All clear."
  exit 0
fi

echo "Test Details:"
echo "-------------"

while IFS= read -r entry; do
  testName=$(echo "$entry" | jq -r '.testName')
  file=$(echo "$entry" | jq -r '.file')
  quarantinedAt=$(echo "$entry" | jq -r '.quarantinedAt')
  deadline=$(echo "$entry" | jq -r '.deadline')
  reason=$(echo "$entry" | jq -r '.reason')
  rootCause=$(echo "$entry" | jq -r '.rootCause')
  linkedIssue=$(echo "$entry" | jq -r '.linkedIssue // "none"')

  # Compare dates (YYYY-MM-DD lexicographic comparison works for ISO dates)
  if [[ "$deadline" < "$TODAY" || "$deadline" == "$TODAY" ]]; then
    STATUS="EXPIRED"
    EXPIRED=$((EXPIRED + 1))
  else
    # Warn if deadline is within 7 days
    WARN_DATE=$(date -u -d "$deadline - 7 days" +%Y-%m-%d 2>/dev/null || \
                date -u -v-7d -j -f "%Y-%m-%d" "$deadline" +%Y-%m-%d 2>/dev/null || \
                echo "")
    if [ -n "$WARN_DATE" ] && [[ "$TODAY" > "$WARN_DATE" || "$TODAY" == "$WARN_DATE" ]]; then
      STATUS="EXPIRING SOON"
      EXPIRING_SOON=$((EXPIRING_SOON + 1))
    else
      STATUS="OK"
    fi
  fi

  echo "  [$STATUS] $testName"
  echo "    File:         $file"
  echo "    Root cause:   $rootCause"
  echo "    Quarantined:  $quarantinedAt"
  echo "    Deadline:     $deadline"
  echo "    Reason:       $reason"
  echo "    Issue:        $linkedIssue"
  echo ""
done < <(jq -c '.quarantined[]' "$MANIFEST_PATH")

echo "========================================"
echo "Summary: $EXPIRED expired, $EXPIRING_SOON expiring soon, $((TOTAL - EXPIRED - EXPIRING_SOON)) OK"

if [ "$EXPIRED" -gt 0 ]; then
  echo ""
  echo "ACTION REQUIRED: $EXPIRED quarantined test(s) have exceeded the 30-day SLA."
  echo "Each expired test must be fixed or deleted immediately."
  echo "See FLAKY-TESTS.md for the resolution process."
  exit 1
fi

if [ "$EXPIRING_SOON" -gt 0 ]; then
  echo ""
  echo "WARNING: $EXPIRING_SOON quarantined test(s) expire within 7 days."
fi

exit 0
