#!/usr/bin/env bash
# Runs API Extractor in check mode for all packages.
# Exits non-zero if any .api.md file changed from the committed baseline.
# Usage: ./scripts/api-check.sh

set -euo pipefail

PACKAGES=(core db cms telemetry ui valence graphql)
FAILED=()

for pkg in "${PACKAGES[@]}"; do
  echo "Checking API surface: packages/$pkg"
  if ! npx api-extractor run --config "packages/$pkg/api-extractor.json" 2>&1; then
    FAILED+=("$pkg")
  fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: API surface changed in: ${FAILED[*]}"
  echo ""
  echo "Review the diff in the *.api.md files, then run:"
  echo "  pnpm api:update"
  echo "to accept the changes and commit the updated baselines."
  exit 1
fi

echo ""
echo "API surface check passed for all packages."
