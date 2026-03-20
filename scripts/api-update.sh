#!/usr/bin/env bash
# Runs API Extractor in update mode for all packages.
# Regenerates *.api.md baselines to reflect the current API surface.
# Usage: ./scripts/api-update.sh

set -euo pipefail

PACKAGES=(core db cms telemetry ui valence graphql)

for pkg in "${PACKAGES[@]}"; do
  echo "Updating API report: packages/$pkg"
  npx api-extractor run --local --config "packages/$pkg/api-extractor.json" 2>&1
done

echo ""
echo "API reports updated. Review the diffs and commit the *.api.md files."
