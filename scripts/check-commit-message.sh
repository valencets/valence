#!/usr/bin/env bash
set -euo pipefail

MSG_FILE="${1:-}"
if [[ -z "$MSG_FILE" || ! -f "$MSG_FILE" ]]; then
  echo "commit-msg: missing commit message file" >&2
  exit 1
fi

FIRST_LINE="$(head -n1 "$MSG_FILE")"

if [[ "$FIRST_LINE" =~ ^(Merge|Revert|fixup!|squash!) ]]; then
  exit 0
fi

PATTERN='^(feat|fix|refactor|test|docs|chore)\([a-z0-9][a-z0-9-]*\): .+( -- (RED|GREEN|REFACTOR))?$'

if [[ ! "$FIRST_LINE" =~ $PATTERN ]]; then
  echo "Invalid commit message:" >&2
  echo "  $FIRST_LINE" >&2
  echo "" >&2
  echo "Expected:" >&2
  echo "  <type>(<scope>): <description>" >&2
  echo "Required TDD suffixes for code commits:" >&2
  echo "  test(...) -- RED" >&2
  echo "  feat(...) -- GREEN" >&2
  echo "  fix(...) -- GREEN" >&2
  echo "  refactor(...) -- REFACTOR" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  test(db): reject empty passwords -- RED" >&2
  echo "  fix(db): reject empty passwords -- GREEN" >&2
  echo "  refactor(tooling): tighten commit hooks -- REFACTOR" >&2
  exit 1
fi

TYPE="${FIRST_LINE%%(*}"
SUFFIX=""

if [[ "$FIRST_LINE" =~ \ --\ (RED|GREEN|REFACTOR)$ ]]; then
  SUFFIX="${BASH_REMATCH[1]}"
fi

case "$TYPE" in
  test)
    if [[ "$SUFFIX" != "RED" ]]; then
      echo "Invalid TDD tag for test commit:" >&2
      echo "  $FIRST_LINE" >&2
      echo "" >&2
      echo "Expected test commits to end with '-- RED'." >&2
      exit 1
    fi
    ;;
  feat|fix)
    if [[ "$SUFFIX" != "GREEN" ]]; then
      echo "Invalid TDD tag for implementation commit:" >&2
      echo "  $FIRST_LINE" >&2
      echo "" >&2
      echo "Expected feat/fix commits to end with '-- GREEN'." >&2
      exit 1
    fi
    ;;
  refactor)
    if [[ "$SUFFIX" != "REFACTOR" ]]; then
      echo "Invalid TDD tag for refactor commit:" >&2
      echo "  $FIRST_LINE" >&2
      echo "" >&2
      echo "Expected refactor commits to end with '-- REFACTOR'." >&2
      exit 1
    fi
    ;;
  docs|chore)
    if [[ -n "$SUFFIX" ]]; then
      echo "Invalid TDD tag for non-code commit:" >&2
      echo "  $FIRST_LINE" >&2
      echo "" >&2
      echo "Docs/chore commits must not include RED/GREEN/REFACTOR tags." >&2
      exit 1
    fi
    ;;
esac

if [[ "$FIRST_LINE" =~ ^(feat|fix|refactor|test|docs|chore)\([a-z0-9][a-z0-9-]*\):\ (RED|GREEN|REFACTOR)\ -- ]]; then
  echo "Invalid commit message:" >&2
  echo "  $FIRST_LINE" >&2
  echo "" >&2
  echo "Place the TDD tag at the end of the message, not at the start of the description." >&2
  echo "Example:" >&2
  echo "  test(db): reject empty passwords -- RED" >&2
  exit 1
fi
