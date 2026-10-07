#!/usr/bin/env bash
#
# publication-guard.sh — stops declared owner-only records from publishing.
#
# Why this exists (audit A01 / issue #116): `.gitignore` removes nothing that is already in
# the index. A record can be named private in the ignore file and still be tracked and
# published, because ignore rules never apply to files Git already knows about, and a
# rename carries the file to a path no rule mentions. The secret scanner does not cover
# this either: it matches credential shapes, while these records leak *identity and
# context* — a real name, a filesystem path, a project inventory — which has no shape.
#
# The declared paths live in `.githooks/lib/private-records.txt` (paths only), resolved
# against `--repo` so this can be driven against disposable fixtures.
#
#   bash .githooks/lib/publication-guard.sh [options]
#
#     --repo <path>      repository to inspect (default: this script's repository)
#     --mode <mode>      staged (default) | index | range
#     --range <revs>     revision range for --mode range (e.g. origin/main..HEAD)
#     --override <why>   pass anyway, with a reason. You own the consequences.
#     -h, --help         this text
#
#   exit 0  allow (nothing declared private is being published)
#   exit 1  reject (a declared record is staged, indexed, or arriving by rename)
#   exit 2  usage error
#
# Rejection prints paths only, never contents: echoing what it protects would spread it.
# A missing declaration list is a hard failure, not a silent pass — a boundary that
# degrades to "no records declared" is worse than no boundary, because it reports green.
#
# Deliberate override, recorded in the commit message by the operator:
#   bash .githooks/lib/publication-guard.sh --override "reason"
#
# Scope note: this is a local + CI guard. It cannot protect a machine that never runs the
# hook, which is exactly why ci.yml runs it too (see #96 for the private-engineering
# precedent: the caveat is the same, the branch is different).

set -uo pipefail

RED=''; YELLOW=''; DIM=''; RESET=''
if [ -t 2 ]; then
  RED=$'\033[31m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; RESET=$'\033[0m'
fi

usage() {
  sed -n '3,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

MODE="staged"
REPO=""
RANGE=""
OVERRIDE_REASON=""

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="${2:-}"; shift 2 ;;
    --repo=*) REPO="${1#--repo=}"; shift ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --mode=*) MODE="${1#--mode=}"; shift ;;
    --range) RANGE="${2:-}"; shift 2 ;;
    --range=*) RANGE="${1#--range=}"; shift ;;
    --override) OVERRIDE_REASON="${2:-}"; shift 2 ;;
    --override=*) OVERRIDE_REASON="${1#--override=}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "publication-guard: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$MODE" in
  staged|index|range) ;;
  *)
    echo "publication-guard: unknown --mode '$MODE' (expected staged, index, or range)" >&2
    exit 2
    ;;
esac

if [ "$MODE" = "range" ] && [ -z "$RANGE" ]; then
  echo "publication-guard: --mode range requires --range <revs>" >&2
  exit 2
fi

if [ -z "$REPO" ]; then
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fi

if [ ! -d "$REPO/.git" ] && [ ! -f "$REPO/.git" ]; then
  echo "publication-guard: '$REPO' is not a Git work tree" >&2
  exit 2
fi

RECORD_LIST="$REPO/.githooks/lib/private-records.txt"
if [ ! -f "$RECORD_LIST" ]; then
  {
    echo ""
    echo "${RED}✖ Publication check blocked — declared-record list is missing${RESET}"
    echo "  Expected: ${RECORD_LIST#"$REPO"/}"
    echo "  Without the declaration this check cannot distinguish an owner-only record from"
    echo "  a product file, so it refuses to report a pass it cannot justify."
    echo ""
  } >&2
  exit 1
fi

if [ -n "$OVERRIDE_REASON" ]; then
  {
    echo ""
    echo "${YELLOW}⚠ Publication guard overridden${RESET}"
    echo "  Reason: $OVERRIDE_REASON"
    echo "  Record this line in the commit message; an unjustified override is the same"
    echo "  failure as no guard, with a paper trail that says otherwise."
    echo ""
  } >&2
  exit 0
fi

# Declared records: `#` comments and blank lines dropped, leading `./` and `/` normalised.
records=()
while IFS= read -r raw || [ -n "$raw" ]; do
  entry="$(printf '%s' "$raw" | sed 's/[[:space:]]*$//')"
  case "$entry" in
    ''|'#'*) continue ;;
  esac
  entry="${entry#./}"
  entry="${entry#/}"
  entry="${entry%/}"
  [ -n "$entry" ] || continue
  records+=("$entry")
done < "$RECORD_LIST"

# Candidate paths being published, per mode. Rename-aware: a rename is reported as its
# old path and its new path, because carrying a declared record to an innocent filename is
# the evasion this guard exists to catch.
collect_candidates() {
  if [ "$MODE" = "index" ]; then
    git -C "$REPO" ls-files -z 2>/dev/null |
      while IFS= read -r -d '' path; do printf '%s\n' "$path"; done
    return
  fi

  local diff_args=(--name-status --find-renames --diff-filter=ACMR -z)
  if [ "$MODE" = "range" ]; then
    git -C "$REPO" diff "${diff_args[@]}" "$RANGE" 2>/dev/null
  else
    git -C "$REPO" diff --cached "${diff_args[@]}" 2>/dev/null
  fi |
    while IFS= read -r -d '' field; do
      case "$field" in
        R*|C*)
          IFS= read -r -d '' old || break
          IFS= read -r -d '' new || break
          printf '%s\n' "$old" "$new"
          ;;
        A|M|T|U|X|B)
          IFS= read -r -d '' path || break
          printf '%s\n' "$path"
          ;;
        *)
          # Unknown status field: fail closed rather than silently skip a path.
          printf '%s\n' "$field"
          ;;
      esac
    done
}

is_declared_private() {
  local path="${1#./}"
  local entry
  for entry in "${records[@]}"; do
    # shellcheck disable=SC2254 # glob matching is the point: entries may carry * and ?
    case "$path" in
      $entry|$entry/*) return 0 ;;
    esac
  done
  return 1
}

violations=()
while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue
  if is_declared_private "$candidate"; then
    violations+=("$candidate")
  fi
done < <(collect_candidates)

if [ "${#violations[@]}" -gt 0 ]; then
  {
    echo ""
    echo "${RED}✖ Publication blocked — declared owner-only record present (mode: $MODE)${RESET}"
    echo ""
    for violation in "${violations[@]}"; do
      echo "  • $violation"
    done
    echo ""
    echo "${YELLOW}How to fix${RESET}"
    echo "  1. Keep the file, stop tracking it:  git rm --cached <path>"
    echo "     (the ignore rules in .gitignore then hold, and the local copy stays on disk)"
    echo "  2. Or move it out of the repository entirely."
    echo "  3. If the declaration is wrong, correct .githooks/lib/private-records.txt."
    echo ""
    echo "${DIM}Intentional? bash .githooks/lib/publication-guard.sh --override \"reason\"${RESET}"
    echo "${DIM}Declared list: .githooks/lib/private-records.txt${RESET}"
    echo ""
  } >&2
  exit 1
fi

exit 0
