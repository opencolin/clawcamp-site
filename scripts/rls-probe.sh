#!/usr/bin/env bash
# ===========================================================================
# scripts/rls-probe.sh — RLS lockdown assertions for the `contacts` table
# ===========================================================================
# WHAT: curl-based, anon-key probe that asserts the v1.0.0 contacts lockdown
#       (supabase/migrations/0001_baseline.sql) is actually in effect in prod.
#
# CONTRACT: this script FAILS before the lockdown is applied and PASSES after.
#   (a) anon GET  /rest/v1/contacts?select=*  must NOT return contact rows —
#       expect 401, or an empty JSON array. It must never return rows that
#       contain verification_token / magic_link_token / email.
#   (b) anon PATCH /rest/v1/contacts?email=eq.<someone> must be denied —
#       expect 401 or 403 (NOT a 2xx / 204 that silently overwrote a row).
#
# Exits non-zero on ANY failed assertion (CI-gate friendly).
#
# TEMPLATE: this is the canonical probe every FUTURE insert-only table must
#   clone. When you add a new anon-insert table, copy this file, swap the
#   table name, and wire it into the same CI gate so the breach can't regress.
#
# The anon key is PUBLIC by design (it ships in the browser bundle); every
# policy assumes a hostile client holding this key. Override via env if needed.
# ===========================================================================

set -u

SUPABASE_URL="${SUPABASE_URL:-https://mrnccntqmkxjazznejfc.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI}"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

echo "RLS probe against: ${SUPABASE_URL}"
echo "Using public anon key (hostile-client simulation)."
echo

# ---------------------------------------------------------------------------
# Assertion (a): anon SELECT on contacts must be denied or empty.
# ---------------------------------------------------------------------------
echo "[a] anon GET /rest/v1/contacts?select=*"
SELECT_RESP="$(curl -s -w $'\n%{http_code}' \
  "${SUPABASE_URL}/rest/v1/contacts?select=*&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")"
SELECT_CODE="$(printf '%s' "$SELECT_RESP" | tail -n1)"
SELECT_BODY="$(printf '%s' "$SELECT_RESP" | sed '$d')"

# Hard fail if any sensitive column ever appears in the body.
if printf '%s' "$SELECT_BODY" | grep -qiE 'verification_token|magic_link_token'; then
  fail "(a) response leaked a token column (verification_token/magic_link_token) — lockdown NOT applied"
elif [ "$SELECT_CODE" = "401" ] || [ "$SELECT_CODE" = "403" ]; then
  pass "(a) anon SELECT denied with HTTP ${SELECT_CODE}"
elif [ "$SELECT_CODE" = "200" ] && printf '%s' "$SELECT_BODY" | tr -d '[:space:]' | grep -qE '^\[\]$'; then
  pass "(a) anon SELECT returned an empty array (RLS hides all rows)"
elif [ "$SELECT_CODE" = "200" ]; then
  fail "(a) anon SELECT returned HTTP 200 with a non-empty body — rows are readable: ${SELECT_BODY:0:200}"
else
  fail "(a) unexpected HTTP ${SELECT_CODE} from anon SELECT — body: ${SELECT_BODY:0:200}"
fi
echo

# ---------------------------------------------------------------------------
# Assertion (b): anon PATCH-by-email on contacts must be denied.
# We target a clearly non-existent address; a locked-down API rejects the
# request outright (401/403) rather than returning a 2xx/204 "row updated".
# ---------------------------------------------------------------------------
echo "[b] anon PATCH /rest/v1/contacts?email=eq.<someone>"
PATCH_TARGET="rls-probe-nobody@claw.camp"
PATCH_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -X PATCH \
  "${SUPABASE_URL}/rest/v1/contacts?email=eq.$(printf '%s' "$PATCH_TARGET" | sed 's/@/%40/')" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"name":"rls-probe-tamper"}')"

if [ "$PATCH_CODE" = "401" ] || [ "$PATCH_CODE" = "403" ]; then
  pass "(b) anon PATCH denied with HTTP ${PATCH_CODE}"
else
  fail "(b) anon PATCH returned HTTP ${PATCH_CODE} (expected 401/403) — anon can still overwrite contacts"
fi
echo

# ---------------------------------------------------------------------------
# Summary / exit code
# ---------------------------------------------------------------------------
echo "----------------------------------------"
echo "RLS probe: ${PASS} passed, ${FAIL} failed."
if [ "$FAIL" -ne 0 ]; then
  echo "RESULT: FAIL — contacts lockdown is NOT in effect. Apply migration 0001."
  exit 1
fi
echo "RESULT: PASS — contacts is locked down (anon cannot read or overwrite)."
exit 0
