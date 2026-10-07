#!/usr/bin/env bash
# secret-scan — one credential scanner for both the local hook and CI.
#
# Sourced by .githooks/pre-commit (diff mode) and executed directly by CI
# (tracked-file mode) so the two can never drift apart.
#
# Usage:
#   secret-scan.sh --tracked        scan every git-tracked file
#   secret-scan.sh --files <path>…  scan the given files
#   … | secret-scan.sh --stdin      scan text piped in
#
# Exit: 0 = clean, 1 = findings. Findings are always masked; candidate values
# are never echoed.

set -uo pipefail

SECRET_PATTERNS=(
  'AIza[0-9A-Za-z_-]{35}'
  'sk-[A-Za-z0-9]{32,}'
  'sk-proj-[A-Za-z0-9_-]{20,}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'github_pat_[A-Za-z0-9_]{50,}'
  'AKIA[0-9A-Z]{16}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  '(GEMINI|OPENAI|OPENWEATHER|VITE_OPENWEATHER|ANTHROPIC)_API_KEY[[:space:]]*=[[:space:]]*[A-Za-z0-9_-]{16,}'
)

# Placeholder scrubbing: forgive only the placeholder token itself, never the
# rest of the line, so a real credential next to the word "example" still
# matches. Whole-word guards keep keys that merely CONTAIN those letters intact.
scrub_placeholders() {
  printf '%s\n' "$1" | sed -E \
    -e 's/your_[A-Za-z0-9_-]*/ /g' \
    -e 's/<[^>]*>/ /g' \
    -e 's/[xX]{4,}/ /g' \
    -e 's/(^|[^A-Za-z0-9_])([Ee][Xx][Aa][Mm][Pp][Ll][Ee]|[Ss][Aa][Mm][Pp][Ll][Ee]|[Pp][Ll][Aa][Cc][Ee][Hh][Oo][Ll][Dd][Ee][Rr]|[Dd][Uu][Mm][Mm][Yy]|[Rr][Ee][Dd][Aa][Cc][Tt][Ee][Dd])([^A-Za-z0-9_]|$)/\1 \3/g'
}

# Files whose contents legitimately contain key-shaped base64 or the pattern
# text itself. Keep this list narrow.
scan_skips_path() {
  case "$1" in
    .githooks/*) return 0 ;;
    .obsidian/themes/*) return 0 ;;
  esac
  return 1
}

mask_excerpt() {
  printf '%s' "$1" | cut -c1-60 | sed -E 's/[A-Za-z0-9_-]{12,}/[REDACTED]/g'
}

# scan_text <label> — reads stdin, prints one masked finding per hit.
scan_text() {
  local label="$1" scrubbed pattern hits hit
  scrubbed=$(scrub_placeholders "$(cat)")
  [ -n "$scrubbed" ] || return 0
  for pattern in "${SECRET_PATTERNS[@]}"; do
    # Case-sensitive on purpose: these shapes are case-sensitive in reality, and
    # a case-insensitive match flags ordinary minified JS (e.g. "AKIA" followed
    # by identifier characters). -e is required because the PEM pattern starts
    # with "-----", which grep would parse as command-line flags.
    hits=$(printf '%s\n' "$scrubbed" | grep -En -e "$pattern") || true
    [ -n "$hits" ] || continue
    while IFS= read -r hit; do
      [ -n "$hit" ] || continue
      printf '%s — looks like a credential: %s\n' "$label" "$(mask_excerpt "$hit")"
    done <<< "$hits"
  done
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:---tracked}" in
    --tracked)
      found=0
      while IFS= read -r file; do
        [ -n "$file" ] || continue
        [ -f "$file" ] || continue
        scan_skips_path "$file" && continue
        # Blob lines (inline fonts/images) can contain key-shaped base64 runs.
        out=$(grep -Ev '^[[:space:]]*$|data:(font|image)/' -- "$file" 2>/dev/null | scan_text "$file") || true
        if [ -n "$out" ]; then
          printf '%s\n' "$out"
          found=1
        fi
      done < <(git ls-files)
      exit "$found"
      ;;
    --files)
      shift
      found=0
      for file in "$@"; do
        [ -f "$file" ] || continue
        scan_skips_path "$file" && continue
        out=$(grep -Ev '^[[:space:]]*$|data:(font|image)/' -- "$file" 2>/dev/null | scan_text "$file") || true
        if [ -n "$out" ]; then
          printf '%s\n' "$out"
          found=1
        fi
      done
      exit "$found"
      ;;
    --stdin)
      out=$(scan_text "stdin") || true
      [ -n "$out" ] && printf '%s\n' "$out"
      [ -n "$out" ] && exit 1
      exit 0
      ;;
    *)
      echo "usage: secret-scan.sh [--tracked|--files <path>…|--stdin]" >&2
      exit 2
      ;;
  esac
fi