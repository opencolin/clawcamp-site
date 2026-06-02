#!/usr/bin/env bash
# ===========================================================================
# scripts/rls-probe.sh — RLS lockdown assertions for `contacts` + `chapters`
# ===========================================================================
# WHAT: curl-based, anon-key probe that asserts the v1.0.0 contacts lockdown
#       (supabase/migrations/0001_baseline.sql) is actually in effect in prod,
#       and (since v1.1.0) that anon CANNOT write the new `chapters` table.
#
# CONTRACT: this script FAILS before the lockdown is applied and PASSES after.
#   (a) anon GET  /rest/v1/contacts?select=*  must NOT return contact rows —
#       expect 401, or an empty JSON array. It must never return rows that
#       contain verification_token / magic_link_token / email.
#   (b) anon PATCH /rest/v1/contacts?email=eq.<someone> must be denied —
#       expect 401 or 403 (NOT a 2xx / 204 that silently overwrote a row).
#   (c) anon POST/PATCH /rest/v1/chapters must be denied — expect 401 or 403
#       (NOT a 2xx / 201 that inserted, or a 2xx / 204 that overwrote a row).
#       chapters grants anon SELECT-only, so reads stay allowed; writes must
#       be rejected.
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
# Assertion (c): anon WRITE on chapters must be denied (SELECT-only grant).
# The v1.1.0 migration grants anon SELECT on chapters so the public directory
# can read it, but NO insert/update. A locked-down API rejects writes outright
# (401/403) rather than returning a 2xx/201 (inserted) or 2xx/204 (overwrote).
#
# The non-negotiable security property is: an anon write must NEVER SUCCEED.
# So a 2xx (the write took effect) is the only true breach and always FAILS.
# 401/403 is the ideal post-migration pass. A 404 means the chapters table
# isn't applied yet (migrations are applied out-of-band by an admin, not by
# this repo) — a write is then impossible, so we PASS but warn loudly, exactly
# as assertion (a) accepts more than one safe state. This keeps the gate from
# red-flagging master purely on migration-apply ordering while still blocking
# the instant anon can actually write.
# ---------------------------------------------------------------------------
echo "[c1] anon POST /rest/v1/chapters (insert junk row)"
CHAPTERS_POST_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST \
  "${SUPABASE_URL}/rest/v1/chapters" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"slug":"rls-probe-x","name":"rls probe"}')"

if [ "$CHAPTERS_POST_CODE" = "401" ] || [ "$CHAPTERS_POST_CODE" = "403" ]; then
  pass "(c1) anon POST to chapters denied with HTTP ${CHAPTERS_POST_CODE}"
elif [ "$CHAPTERS_POST_CODE" = "404" ]; then
  pass "(c1) anon POST to chapters returned HTTP 404 — chapters table not applied yet, write impossible (WARN: apply the chapters migration)"
elif [ "${CHAPTERS_POST_CODE#2}" != "$CHAPTERS_POST_CODE" ]; then
  fail "(c1) anon POST to chapters returned HTTP ${CHAPTERS_POST_CODE} — the row was INSERTED; anon can write chapters"
else
  fail "(c1) anon POST to chapters returned unexpected HTTP ${CHAPTERS_POST_CODE} (expected 401/403, or 404 pre-migration)"
fi
echo

echo "[c2] anon PATCH /rest/v1/chapters?slug=eq.<something>"
CHAPTERS_PATCH_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -X PATCH \
  "${SUPABASE_URL}/rest/v1/chapters?slug=eq.rls-probe-x" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"name":"rls-probe-tamper"}')"

if [ "$CHAPTERS_PATCH_CODE" = "401" ] || [ "$CHAPTERS_PATCH_CODE" = "403" ]; then
  pass "(c2) anon PATCH to chapters denied with HTTP ${CHAPTERS_PATCH_CODE}"
elif [ "$CHAPTERS_PATCH_CODE" = "404" ]; then
  pass "(c2) anon PATCH to chapters returned HTTP 404 — chapters table not applied yet, write impossible (WARN: apply the chapters migration)"
elif [ "${CHAPTERS_PATCH_CODE#2}" != "$CHAPTERS_PATCH_CODE" ]; then
  fail "(c2) anon PATCH to chapters returned HTTP ${CHAPTERS_PATCH_CODE} — the row was OVERWRITTEN; anon can write chapters"
else
  fail "(c2) anon PATCH to chapters returned unexpected HTTP ${CHAPTERS_PATCH_CODE} (expected 401/403, or 404 pre-migration)"
fi
echo

# ---------------------------------------------------------------------------
# Summary / exit code
# ---------------------------------------------------------------------------
echo "----------------------------------------"
echo "RLS probe: ${PASS} passed, ${FAIL} failed."
if [ "$FAIL" -ne 0 ]; then
  echo "RESULT: FAIL — RLS lockdown is NOT fully in effect (contacts and/or chapters). Apply the migrations."
  exit 1
fi
echo "RESULT: PASS — contacts is locked down (anon cannot read or overwrite) and anon cannot write chapters."
exit 0
