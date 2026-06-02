#!/usr/bin/env bash
# ClawCamp smoke test: assert HTTP 200 + a known string on key pages.
# Usage: scripts/smoke.sh [BASE_URL]   (default: https://claw.camp)
set -euo pipefail
BASE="${1:-https://claw.camp}"
fail=0
# Body goes to a temp file (NOT a $(...) capture): some pages ship NUL bytes,
# which bash strips from command substitutions and which make grep treat its
# input as binary — both silently break an in-variable needle match. We write
# the body to a file, capture the HTTP code separately, and grep -a the file.
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
check() {
  path="$1"; needle="$2"
  code="$(curl -fsSL --max-time 20 -o "$BODY_FILE" -w '%{http_code}' "$BASE$path" 2>/dev/null)" || { echo "FAIL $path (request error / non-2xx)"; fail=1; return; }
  if [ "$code" != "200" ]; then echo "FAIL $path (HTTP $code)"; fail=1; return; fi
  if ! grep -aq "$needle" "$BODY_FILE"; then echo "FAIL $path (missing '$needle')"; fail=1; return; fi
  echo "OK   $path"
}
check "/" "ClawCamp"
check "/events" "ClawCamp"
check "/chapters" "ClawCamp"
check "/chapters?slug=san-francisco" "ClawCamp"
check "/events/detail/?id=173" "ClawCamp"
[ "$fail" -eq 0 ] && echo "smoke: all checks passed" || { echo "smoke: FAILED"; exit 1; }
