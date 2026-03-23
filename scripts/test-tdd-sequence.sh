#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/check-tdd-commit-sequence.sh"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

run_git() {
  local repo_dir="$1"
  shift
  git -C "$repo_dir" "$@"
}

setup_repo() {
  local name="$1"
  local repo_dir="$TMP_ROOT/$name"
  mkdir -p "$repo_dir"
  run_git "$repo_dir" init >/dev/null 2>&1
  run_git "$repo_dir" config user.name "Valence Test"
  run_git "$repo_dir" config user.email "test@valence.dev"
  printf 'seed\n' > "$repo_dir/README.md"
  run_git "$repo_dir" add README.md
  run_git "$repo_dir" commit -m "chore(repo): seed repo" >/dev/null 2>&1
  printf '%s\n' "$repo_dir"
}

assert_valid_range() {
  local repo_dir="$1"
  local range="$2"
  (cd "$repo_dir" && bash "$CHECK_SCRIPT" range "$range" >/dev/null)
}

assert_invalid_range() {
  local repo_dir="$1"
  local range="$2"
  local expected="$3"
  set +e
  local output
  output="$(cd "$repo_dir" && bash "$CHECK_SCRIPT" range "$range" 2>&1)"
  local status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    echo "Expected range check to fail but it passed: $range" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "Expected failure output to contain: $expected" >&2
    echo "$output" >&2
    exit 1
  fi
}

valid_repo="$(setup_repo valid)"
printf 'red\n' > "$valid_repo/a.txt"
run_git "$valid_repo" add a.txt
run_git "$valid_repo" commit -m "test(tooling): enforce tdd sequence -- RED" >/dev/null 2>&1
printf 'green\n' > "$valid_repo/a.txt"
run_git "$valid_repo" add a.txt
run_git "$valid_repo" commit -m "fix(tooling): enforce tdd sequence -- GREEN" >/dev/null 2>&1
assert_valid_range "$valid_repo" "HEAD~2..HEAD"
printf 'refactor\n' > "$valid_repo/a.txt"
run_git "$valid_repo" add a.txt
run_git "$valid_repo" commit -m "refactor(tooling): enforce tdd sequence -- REFACTOR" >/dev/null 2>&1
assert_valid_range "$valid_repo" "HEAD~1..HEAD"

invalid_repo="$(setup_repo invalid)"
printf 'green\n' > "$invalid_repo/a.txt"
run_git "$invalid_repo" add a.txt
run_git "$invalid_repo" commit -m "fix(tooling): enforce tdd sequence -- GREEN" >/dev/null 2>&1
assert_invalid_range "$invalid_repo" "HEAD^..HEAD" "scope mismatch for GREEN commit"

echo "TDD sequence checks passed."
