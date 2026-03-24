#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_clean_head() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    cat >&2 <<'EOF'
test:visual:ci runs from a clean temporary worktree to match GitHub Actions.
Commit or stash local changes first, then rerun the command.
EOF
    exit 1
  fi
}

require_cmd git
require_cmd docker
require_cmd pnpm
require_cmd node

require_clean_head

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

PLAYWRIGHT_VERSION="$(
  node -e "const fs=require('node:fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); process.stdout.write(pkg.devDependencies['@playwright/test'].replace(/^[^0-9]*/, ''))"
)"
PLAYWRIGHT_IMAGE="${PLAYWRIGHT_CI_IMAGE:-mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble}"
PLAYWRIGHT_ARGS=""
for arg in "$@"; do
  PLAYWRIGHT_ARGS="${PLAYWRIGHT_ARGS} $(printf '%q' "$arg")"
done

WORKTREE_DIR="$(mktemp -d /tmp/valence-visual-ci-XXXXXX)"

cleanup() {
  git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git worktree add --detach "$WORKTREE_DIR" HEAD >/dev/null

cd "$WORKTREE_DIR"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null

docker run --rm \
  --network host \
  -e CI=true \
  -e PGHOST="$PGHOST" \
  -e PGPORT="$PGPORT" \
  -e PGUSER="$PGUSER" \
  -e PGPASSWORD="$PGPASSWORD" \
  -v "$WORKTREE_DIR:/work" \
  -w /work \
  "$PLAYWRIGHT_IMAGE" \
  bash -lc "corepack enable >/dev/null 2>&1 || true; pnpm exec playwright test tests/e2e/visual/${PLAYWRIGHT_ARGS}"

cd "$REPO_ROOT"
while IFS= read -r path; do
  mkdir -p "$(dirname "$path")"
  cp "$WORKTREE_DIR/$path" "$path"
done < <(cd "$WORKTREE_DIR" && find tests/e2e/__snapshots__ -type f)
