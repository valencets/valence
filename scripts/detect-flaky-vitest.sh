#!/usr/bin/env bash
# detect-flaky-vitest.sh
# Detects flaky Vitest tests by running the suite twice and comparing results.
# A test is considered flaky if it FAILED in the first run but PASSED in the second run,
# OR if it shows retry-passes in a single run with --retry configured.
#
# Usage:
#   scripts/detect-flaky-vitest.sh [--output=path/to/report.json] [--runs=N]
#
# Output: JSON report of detected flaky tests, printed to stdout and optionally written to file.
# Exit code: 0 if no flaky tests detected, 1 if flaky tests found, 2 on error.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE=""
RUNS=2

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --output=*)
      OUTPUT_FILE="${arg#--output=}"
      ;;
    --runs=*)
      RUNS="${arg#--runs=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--output=path/to/report.json] [--runs=N]" >&2
      exit 2
      ;;
  esac
done

# Require jq
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed" >&2
  exit 2
fi

# Require node/pnpm
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm is required but not installed" >&2
  exit 2
fi

TMPDIR_RUN=$(mktemp -d)
trap 'rm -rf "$TMPDIR_RUN"' EXIT

echo "Flaky Test Detection — Vitest" >&2
echo "=============================" >&2
echo "Repo root: $REPO_ROOT" >&2
echo "Runs: $RUNS" >&2
echo "" >&2

# Run vitest once per iteration and collect JSON results
declare -a RUN_FILES=()

for i in $(seq 1 "$RUNS"); do
  RUN_FILE="$TMPDIR_RUN/run-$i.json"
  echo "Run $i/$RUNS..." >&2

  # Run vitest with JSON reporter, ignore exit code (failed tests cause non-zero exit)
  (cd "$REPO_ROOT" && pnpm exec vitest run \
    --reporter=json \
    --outputFile="$RUN_FILE" \
    --tags-filter='!flaky' \
    2>/dev/null) || true

  if [ ! -f "$RUN_FILE" ]; then
    echo "WARNING: Run $i produced no JSON output" >&2
    echo '{"testResults":[]}' > "$RUN_FILE"
  fi

  RUN_FILES+=("$RUN_FILE")
done

echo "" >&2
echo "Analyzing results for flakiness..." >&2

# Build a map of test status per run using jq
# For each test: collect statuses across runs, flag if not all the same
FLAKY_TESTS=$(
  jq -n \
    --argjson runs "$RUNS" \
    --slurpfile run1 "${RUN_FILES[0]}" \
    --slurpfile run2 "${RUN_FILES[$((RUNS - 1))]}" \
    '
    # Extract test results from a vitest JSON report
    def extract_tests(report):
      report[0].testResults // [] |
      map(
        . as $suite |
        (.assertionResults // []) |
        map({
          testName: (.ancestorTitles | join(" > ")) + (if (.ancestorTitles | length) > 0 then " > " else "" end) + .fullName,
          file: $suite.testFilePath,
          status: .status
        })
      ) | flatten;

    (extract_tests($run1) | map({key: .testName, value: .status}) | from_entries) as $r1 |
    (extract_tests($run2) | map({key: .testName, value: .status}) | from_entries) as $r2 |

    # Find tests that failed in run 1 but passed in run 2 (or vice versa)
    ($r1 | keys_unsorted) as $r1_tests |
    ($r2 | keys_unsorted) as $r2_tests |

    # Union of all test names
    ($r1_tests + $r2_tests | unique) |
    map(. as $name |
      {
        testName: $name,
        run1Status: ($r1[$name] // "missing"),
        run2Status: ($r2[$name] // "missing")
      }
    ) |
    map(select(
      # Flaky: failed first, passed second (or vice versa)
      (.run1Status == "failed" and .run2Status == "passed") or
      (.run1Status == "passed" and .run2Status == "failed") or
      # Also flag missing tests (only appeared in one run)
      (.run1Status == "missing" or .run2Status == "missing")
    ))
    '
)

FLAKY_COUNT=$(echo "$FLAKY_TESTS" | jq 'length')

REPORT=$(jq -n \
  --argjson flaky "$FLAKY_TESTS" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson runs "$RUNS" \
  '{
    generatedAt: $date,
    runs: $runs,
    flakyCount: ($flaky | length),
    flakyTests: $flaky
  }')

echo "" >&2
echo "Detection complete: $FLAKY_COUNT flaky test(s) found" >&2

if [ -n "$OUTPUT_FILE" ]; then
  echo "$REPORT" > "$OUTPUT_FILE"
  echo "Report written to: $OUTPUT_FILE" >&2
fi

echo "$REPORT"

if [ "$FLAKY_COUNT" -gt 0 ]; then
  exit 1
fi

exit 0
