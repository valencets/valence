#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-branch}"
ARG="${2:-}"
TDD_SEQUENCE_START="${TDD_SEQUENCE_START:-}"

extract_scope() {
  local line="$1"
  if [[ "$line" =~ ^[a-z]+\(([a-z0-9][a-z0-9-]*)\):\  ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

extract_suffix() {
  local line="$1"
  if [[ "$line" =~ \ --\ (RED|GREEN|REFACTOR)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi
  printf '\n'
}

is_tdd_commit() {
  local line="$1"
  [[ "$line" =~ \ --\ (RED|GREEN|REFACTOR)$ ]]
}

validate_transition() {
  local previous_line="$1"
  local current_line="$2"
  local current_suffix="$3"
  local current_scope="$4"

  if [[ -z "$previous_line" ]]; then
    echo "TDD sequence error: $current_suffix commit has no previous commit to pair with:" >&2
    echo "  $current_line" >&2
    return 1
  fi

  local previous_scope
  previous_scope="$(extract_scope "$previous_line" || true)"
  local previous_suffix
  previous_suffix="$(extract_suffix "$previous_line")"

  if [[ "$previous_scope" != "$current_scope" ]]; then
    echo "TDD sequence error: scope mismatch for $current_suffix commit:" >&2
    echo "  previous: $previous_line" >&2
    echo "  current:  $current_line" >&2
    echo "Expected both commits to share the same scope." >&2
    return 1
  fi

  case "$current_suffix" in
    GREEN)
      if [[ "$previous_suffix" != "RED" ]]; then
        echo "TDD sequence error: GREEN commit must immediately follow a RED commit in the same scope:" >&2
        echo "  previous: $previous_line" >&2
        echo "  current:  $current_line" >&2
        return 1
      fi
      ;;
    REFACTOR)
      if [[ "$previous_suffix" != "GREEN" ]]; then
        echo "TDD sequence error: REFACTOR commit must immediately follow a GREEN commit in the same scope:" >&2
        echo "  previous: $previous_line" >&2
        echo "  current:  $current_line" >&2
        return 1
      fi
      ;;
  esac
}

validate_branch_range() {
  local range="$1"
  local commits_output
  commits_output="$(git rev-list --reverse "$range")"
  if [[ -z "$commits_output" ]]; then
    exit 0
  fi

  if [[ -n "$TDD_SEQUENCE_START" ]] && git rev-parse --verify "$TDD_SEQUENCE_START" >/dev/null 2>&1; then
    commits_output="$(git rev-list --reverse "$range" "^${TDD_SEQUENCE_START}^")"
    if [[ -z "$commits_output" ]]; then
      exit 0
    fi
  fi

  local first_commit="${commits_output%%$'\n'*}"

  local previous_line=""
  if git rev-parse --verify "${first_commit}^" >/dev/null 2>&1; then
    previous_line="$(git log -1 --format='%s' "${first_commit}^")"
  fi

  while IFS= read -r commit; do
    local line
    line="$(git log -1 --format='%s' "$commit")"
    local suffix
    suffix="$(extract_suffix "$line")"

    if [[ "$suffix" == "GREEN" || "$suffix" == "REFACTOR" ]]; then
      local scope
      scope="$(extract_scope "$line" || true)"
      validate_transition "$previous_line" "$line" "$suffix" "$scope"
    fi

    previous_line="$line"
  done <<< "$commits_output"
}

validate_current_commit() {
  local message_file="$1"
  local current_line
  current_line="$(head -n1 "$message_file")"
  local current_suffix
  current_suffix="$(extract_suffix "$current_line")"

  if [[ "$current_suffix" != "GREEN" && "$current_suffix" != "REFACTOR" ]]; then
    exit 0
  fi

  local previous_line=""
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    previous_line="$(git log -1 --format='%s' HEAD)"
  fi

  local current_scope
  current_scope="$(extract_scope "$current_line" || true)"
  validate_transition "$previous_line" "$current_line" "$current_suffix" "$current_scope"
}

resolve_branch_range() {
  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    local base
    base="$(git merge-base HEAD "$upstream")"
    printf '%s..HEAD\n' "$base"
    return 0
  fi

  if git rev-parse --verify origin/development >/dev/null 2>&1; then
    local development_base
    development_base="$(git merge-base HEAD origin/development)"
    printf '%s..HEAD\n' "$development_base"
    return 0
  fi

  if git rev-parse --verify origin/master >/dev/null 2>&1; then
    local master_base
    master_base="$(git merge-base HEAD origin/master)"
    printf '%s..HEAD\n' "$master_base"
    return 0
  fi

  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    printf 'HEAD^..HEAD\n'
    return 0
  fi

  echo "TDD sequence error: unable to resolve branch range. Configure an upstream or fetch origin/development." >&2
  exit 1
}

case "$MODE" in
  commit-msg)
    if [[ -z "$ARG" || ! -f "$ARG" ]]; then
      echo "check-tdd-commit-sequence: missing commit message file" >&2
      exit 1
    fi
    validate_current_commit "$ARG"
    ;;
  branch)
    validate_branch_range "$(resolve_branch_range)"
    ;;
  range)
    if [[ -z "$ARG" ]]; then
      echo "check-tdd-commit-sequence: missing git range" >&2
      exit 1
    fi
    validate_branch_range "$ARG"
    ;;
  *)
    echo "Usage: $0 {commit-msg <msg-file>|branch|range <git-range>}" >&2
    exit 1
    ;;
esac
