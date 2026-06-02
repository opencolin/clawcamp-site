#!/usr/bin/env bash
# ClawCamp smoke test: assert HTTP 200 + a known string on key pages.
# Usage: scripts/smoke.sh [BASE_URL]   (default: https://claw.camp)
set -euo pipefail
BASE="${1:-https://claw.camp}"
fail=0
check() {
  path="$1"; needle="$2"
  body="$(curl -fsSL --max-time 20 -w '\n%{http_code}' "$BASE$path" 2>/dev/null)" || { echo "FAIL $path (request error / non-2xx)"; fail=1; return; }
  code="$(printf '%s' "$body" | tail -n1)"
  if [ "$code" != "200" ]; then echo "FAIL $path (HTTP $code)"; fail=1; return; fi
  if ! printf '%s' "$body" | grep -q "$needle"; then echo "FAIL $path (missing '$needle')"; fail=1; return; fi
  echo "OK   $path"
}
check "/" "ClawCamp"
check "/events" "ClawCamp"
check "/chapters" "ClawCamp"
check "/events/detail/?id=173" "ClawCamp"
[ "$fail" -eq 0 ] && echo "smoke: all checks passed" || { echo "smoke: FAILED"; exit 1; }
