#!/usr/bin/env bash
# check-banned-patterns.sh — grep-based enforcement of TypeScript banned patterns
# Checks production source code only (excludes __tests__ directories, test-helpers.ts, dist)
# Exit code equals the number of violations found

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ERRORS=0

ok() { echo "  OK: $1"; }
fail() {
  echo ""
  echo "  VIOLATION: $1"
  echo "$2" | sed 's/^/    /'
  local count
  count=$(echo "$2" | grep -c . || true)
  ERRORS=$((ERRORS + count))
}

grep_prod() {
  # grep production files: packages/*/src/**/*.ts excluding __tests__, test-helpers, dist
  grep -rn --include="*.ts" \
    --exclude-dir="__tests__" \
    --exclude-dir="node_modules" \
    --exclude-dir="dist" \
    --exclude="test-helpers.ts" \
    "$@" \
    "$REPO_ROOT/packages" 2>/dev/null || true
}

echo "=== Banned Pattern Check ==="
echo ""

echo "--- 1. 'as any' type casts ---"
result=$(grep_prod -E " as any[^A-Za-z]")
if [[ -n "$result" ]]; then
  fail "'as any' is banned — use explicit types" "$result"
else
  ok "no 'as any' found"
fi

echo ""
echo "--- 2. 'as never' type casts ---"
result=$(grep_prod -E " as never[^A-Za-z]")
if [[ -n "$result" ]]; then
  fail "'as never' is banned — use proper type narrowing" "$result"
else
  ok "no 'as never' found"
fi

echo ""
echo "--- 3. 'as unknown as' double-cast ---"
result=$(grep_prod -E "as unknown as")
if [[ -n "$result" ]]; then
  fail "'as unknown as' is banned — use explicit interfaces/unions" "$result"
else
  ok "no 'as unknown as' found"
fi

echo ""
echo "--- 4. Zod .parse() (must use .safeParse()) ---"
# Find .parse( usages, exclude JSON.parse, parseInt, parseFloat, and other known non-Zod uses
raw=$(grep_prod -E "\.(parse)\(")
result=$(echo "$raw" | grep -vE \
  "(JSON\.parse|parseInt|parseFloat|\.safeParse|parseUrl|parseQuery|parsePath|parseNumber|parseArgs|parseBody|parseConfig|parseVersion|parseParams|parseRequest|parseResponse|parseHeader|parseDate|parseFormData|parseRawBody|URLSearchParams|url\.parse|path\.parse|#|//)" \
  || true)
if [[ -n "$result" ]]; then
  fail "Zod .parse() is banned — use .safeParse() only" "$result"
else
  ok "no banned .parse() calls found"
fi

echo ""
echo "--- 5. process.env outside config boundary ---"
# Allow process.env in: config-loader.ts, define-config.ts, cli.ts, config-template.ts
raw=$(grep_prod -E "process\.env")
result=$(echo "$raw" | grep -vE "(config-loader\.ts|define-config\.ts|cli\.ts|config-template\.ts)" || true)
if [[ -n "$result" ]]; then
  fail "process.env is banned outside config boundary files" "$result"
else
  ok "no out-of-bounds process.env found"
fi

echo ""
echo "--- 6. Record<string, unknown> ---"
result=$(grep_prod -E "Record<string, unknown>")
if [[ -n "$result" ]]; then
  fail "Record<string, unknown> is banned — use explicit interfaces/unions" "$result"
else
  ok "no Record<string, unknown> found"
fi

echo ""
echo "==========================="
if [[ $ERRORS -eq 0 ]]; then
  echo "All banned-pattern checks passed."
  exit 0
else
  echo "Found $ERRORS banned pattern violation(s). See above for details."
  exit 1
fi
