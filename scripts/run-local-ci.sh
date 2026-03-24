#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
export LHCI_PORT="${LHCI_PORT:-3111}"

run_step() {
  echo ""
  echo "==> $1"
  shift
  "$@"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd pnpm
require_cmd npx
require_cmd curl

if command -v pg_isready >/dev/null 2>&1; then
  echo ""
  echo "==> Checking PostgreSQL readiness"
  if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; then
    cat >&2 <<EOF
Local CI requires PostgreSQL before integration, E2E, and Lighthouse steps can run.

Expected connection:
  PGHOST=$PGHOST
  PGPORT=$PGPORT
  PGUSER=$PGUSER

Start PostgreSQL locally, or point these env vars at a running instance, then rerun:
  pnpm ci:local
EOF
    exit 2
  fi
else
  cat >&2 <<'EOF'
Missing required command: pg_isready
Install PostgreSQL client tools so local CI can verify the database prerequisite.
EOF
  exit 1
fi

run_step "Lint" pnpm lint
run_step "Banned patterns" pnpm check:patterns
run_step "Typecheck" pnpm build
run_step "Bundle size" pnpm check:size
run_step "Security audit" pnpm audit --audit-level=high
run_step "API review" pnpm api:check
run_step "Unit tests" pnpm test
run_step "Contract tests" npx vitest run --config vitest.contracts.config.ts tests/contracts/
run_step "Integration tests" npx vitest run tests/integration/
run_step "Visual regression (Ubuntu parity)" pnpm test:visual:ci
run_step "Coverage gate" bash -lc 'cd packages/cms && npx vitest run --coverage --coverage.thresholds.statements=75'
run_step "E2E shard 1/2" env PLAYWRIGHT_OUTPUT_DIR=/tmp/valence-e2e-shard-1 PLAYWRIGHT_REPORT_DIR=/tmp/valence-playwright-report-shard-1 pnpm test:e2e --grep-invert Visual --shard=1/2
run_step "E2E shard 2/2" env PLAYWRIGHT_OUTPUT_DIR=/tmp/valence-e2e-shard-2 PLAYWRIGHT_REPORT_DIR=/tmp/valence-playwright-report-shard-2 pnpm test:e2e --grep-invert Visual --shard=2/2

echo ""
echo "==> Lighthouse"
node --import tsx tests/e2e/server-start.mjs >/tmp/valence-lhci-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${LHCI_PORT}/admin/login" | grep -q '200\|302'; then
    pnpm test:lighthouse || true
    exit 0
  fi
  sleep 2
done

echo "Lighthouse server failed to become ready." >&2
cat /tmp/valence-lhci-server.log >&2 || true
exit 1
