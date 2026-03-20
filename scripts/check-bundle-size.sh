#!/usr/bin/env bash
# check-bundle-size.sh — verifies that the CMS admin client bundle stays within size budget
# Budget is 14KB (14336 bytes) gzipped for first-flight performance.
# TODO: Current bundle is ~76KB gzipped — bundle splitting is needed to meet this budget.
#       Track in: packages/cms/src/admin/editor/admin-client.ts

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_PATH="$REPO_ROOT/packages/cms/dist/admin-client.js"
MAX_GZIP_BYTES=14336  # 14KB (first-flight target — bundle splitting needed, see TODO above)

if [[ ! -f "$BUNDLE_PATH" ]]; then
  echo "ERROR: Bundle not found at $BUNDLE_PATH"
  echo "       Run 'pnpm build' before checking bundle size."
  exit 1
fi

GZIP_BYTES=$(gzip -c "$BUNDLE_PATH" | wc -c)
GZIP_KB=$(echo "scale=1; $GZIP_BYTES / 1024" | bc)

echo "=== Bundle Size Check ==="
echo ""
echo "  File:     $BUNDLE_PATH"
echo "  Gzipped:  ${GZIP_BYTES} bytes (${GZIP_KB} KB)"
echo "  Budget:   ${MAX_GZIP_BYTES} bytes (14 KB)"
echo ""

if [[ $GZIP_BYTES -gt $MAX_GZIP_BYTES ]]; then
  OVER=$(echo "scale=1; ($GZIP_BYTES - $MAX_GZIP_BYTES) / 1024" | bc)
  echo "  FAIL: Bundle exceeds 14KB gzip budget by ${OVER} KB"
  echo "        Bundle splitting is needed — see TODO in scripts/check-bundle-size.sh"
  exit 1
else
  REMAINING=$(echo "scale=1; ($MAX_GZIP_BYTES - $GZIP_BYTES) / 1024" | bc)
  echo "  PASS: Bundle is within budget (${REMAINING} KB remaining)"
  exit 0
fi
