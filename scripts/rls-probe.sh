#!/usr/bin/env bash
# ===========================================================================
# scripts/rls-probe.sh — RLS lockdown assertions for `contacts` + `chapters`
#                        + v1.2.0 events moderation gate + event_* child tables
#                        + v1.3.0 rsvps roster + profiles + media storage
# ===========================================================================
# WHAT: curl-based, anon-key probe that asserts the v1.0.0 contacts lockdown
#       (supabase/migrations/0001_baseline.sql) is actually in effect in prod,
#       that (since v1.1.0) anon CANNOT write the `chapters` table, that
#       (since v1.2.0, supabase/migrations/0003_event_content_and_status.sql)
#       anon CANNOT write the new event_speakers / event_schedule /
#       event_sponsors child tables and CANNOT read non-approved events, and
#       that (since v1.3.0) anon CANNOT raw-insert or read the `rsvps` roster,
#       CANNOT write another user's `media` storage folder, and that `profiles`
#       exposes no private fields.
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
#   (d) anon POST /rest/v1/event_speakers|event_schedule|event_sponsors must be
#       denied — expect 401 or 403 (NOT a 2xx that inserted). These tables grant
#       anon NO write; the only writer is the submit-event Edge Function (which
#       holds the service-role key). This locks in the council exit criterion:
#       "anon cannot insert a child row pointing at an arbitrary event_id except
#       through the Edge Function."
#   (e) anon GET /rest/v1/events?status=neq.approved must return ZERO rows —
#       the events_select_approved RLS policy hides every non-approved row from
#       the hostile client. This proves the HIDDEN_EVENT_IDS replacement:
#       hidden/non-approved rows no longer cross the wire over REST to anon.
#   (f) anon POST /rest/v1/rsvps must be denied — expect 401 or 403 (NOT a 2xx
#       that inserted). The rsvps table (migration 0004) grants anon NO write;
#       the only writer is the submit-rsvp Edge Function (service-role key, with
#       a honeypot). A raw anon insert pointing at an arbitrary event must be
#       rejected, mirroring the event_* child-write lockdown in (d).
#   (g) anon GET /rest/v1/rsvps?select=* must NOT return the roster — expect
#       401/403, an empty JSON array, or 404 pre-migration. It must NEVER return
#       a row containing an email. The public attendee COUNT is served by the
#       rsvp_count SECURITY DEFINER RPC (out of scope here); the roster TABLE
#       itself must be unreadable, mirroring the contacts SELECT lockdown in (a).
#   (h) anon POST to the Storage object endpoint for another user's folder
#       (storage/v1/object/media/<other-uid>/...) must be denied — expect
#       400/401/403 (auth required / per-folder RLS denied), NEVER a 2xx. 404 is
#       pass-with-WARN (bucket not provisioned yet). Authenticated cross-user
#       writes are blocked by the per-folder policy (the object's first path
#       segment must equal auth.uid()); curl-with-anon cannot hold a logged-in
#       token, so this probe asserts the strongest hostile-client case the gate
#       can check unattended: the anon write must not land.
#   (i) anon GET /rest/v1/profiles?select=* SHOULD succeed (profiles is public
#       by design) but MUST NOT leak a private field. The profiles table is kept
#       intentionally PII-free (email / verification_token / magic_link_token
#       live in contacts/auth, never here), so this encodes "anon cannot read
#       another user's profile-PRIVATE fields" as "there are no private fields
#       to read." Pass on 200-with-only-public-fields, an empty array, or 404
#       pre-migration; FAIL if a private field name appears in the body.
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
# Assertion (d): anon WRITE on each event_* child table must be denied.
# Migration 0003 grants anon SELECT-only on event_speakers / event_schedule /
# event_sponsors so the detail page can read child rows, but NO insert. The
# ONLY writer is the submit-event Edge Function (service-role key). A POST
# pointing at an arbitrary event_id must therefore be rejected outright
# (401/403), never a 2xx that inserted. A 404 means the table isn't applied
# yet (migrations apply out-of-band by an admin) — a write is then impossible,
# so we PASS but warn loudly, exactly as (a)/(c) accept more than one safe
# state. A 2xx (the row was inserted) is the only true breach and always FAILS.
# ---------------------------------------------------------------------------
probe_child_write_denied() {
  # $1 = table name, $2 = label, $3 = JSON body
  local table="$1" label="$2" body="$3" code
  echo "[${label}] anon POST /rest/v1/${table} (insert junk child row)"
  code="$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST \
    "${SUPABASE_URL}/rest/v1/${table}" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$body")"

  if [ "$code" = "401" ] || [ "$code" = "403" ]; then
    pass "(${label}) anon POST to ${table} denied with HTTP ${code}"
  elif [ "$code" = "404" ]; then
    pass "(${label}) anon POST to ${table} returned HTTP 404 — table not applied yet, write impossible (WARN: apply migration 0003)"
  elif [ "${code#2}" != "$code" ]; then
    fail "(${label}) anon POST to ${table} returned HTTP ${code} — the row was INSERTED; anon can write ${table}"
  else
    fail "(${label}) anon POST to ${table} returned unexpected HTTP ${code} (expected 401/403, or 404 pre-migration)"
  fi
  echo
}

probe_child_write_denied "event_speakers" "d1" '{"event_id":1,"name":"rls-probe"}'
probe_child_write_denied "event_schedule" "d2" '{"event_id":1,"title":"rls-probe"}'
probe_child_write_denied "event_sponsors" "d3" '{"event_id":1,"sponsor_name":"rls-probe"}'

# ---------------------------------------------------------------------------
# Assertion (e): anon must NOT be able to read non-approved events.
# The events_select_approved RLS policy (migration 0003) returns ONLY
# status='approved' rows to anon, replacing the cosmetic client-side
# HIDDEN_EVENT_IDS filter. We ask explicitly for rows where status != approved;
# a correctly-locked-down API returns an empty array. If ANY row whose status
# is not 'approved' comes back, the moderation gate is leaking and we FAIL.
# A 404 means the events table / status column isn't applied yet (out-of-band) —
# PASS-with-WARN, mirroring (a)/(c)/(d). A 401/403 (read fully denied) is also
# an acceptable deny state.
# ---------------------------------------------------------------------------
echo "[e] anon GET /rest/v1/events?select=id,status&status=neq.approved"
EVENTS_RESP="$(curl -s -w $'\n%{http_code}' \
  "${SUPABASE_URL}/rest/v1/events?select=id,status&status=neq.approved&limit=50" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")"
EVENTS_CODE="$(printf '%s' "$EVENTS_RESP" | tail -n1)"
EVENTS_BODY="$(printf '%s' "$EVENTS_RESP" | sed '$d')"

if [ "$EVENTS_CODE" = "404" ]; then
  pass "(e) events read returned HTTP 404 — events/status not applied yet (WARN: apply migration 0003)"
elif [ "$EVENTS_CODE" = "401" ] || [ "$EVENTS_CODE" = "403" ]; then
  pass "(e) anon read of non-approved events denied with HTTP ${EVENTS_CODE}"
elif [ "$EVENTS_CODE" = "200" ] && printf '%s' "$EVENTS_BODY" | tr -d '[:space:]' | grep -qE '^\[\]$'; then
  pass "(e) anon read of non-approved events returned an empty array (moderation gate hides them)"
elif [ "$EVENTS_CODE" = "200" ] && printf '%s' "$EVENTS_BODY" | grep -qiE '"status"[[:space:]]*:[[:space:]]*"(draft|submitted|rejected)"'; then
  fail "(e) anon read returned a NON-APPROVED event — moderation gate leaking: ${EVENTS_BODY:0:200}"
elif [ "$EVENTS_CODE" = "200" ]; then
  fail "(e) anon read of non-approved events returned HTTP 200 with a non-empty body — rows are readable: ${EVENTS_BODY:0:200}"
else
  fail "(e) unexpected HTTP ${EVENTS_CODE} from anon events read — body: ${EVENTS_BODY:0:200}"
fi
echo

# ---------------------------------------------------------------------------
# Assertion (f): anon raw-INSERT on rsvps must be denied.
# Migration 0004's rsvps table grants anon NO write — the only writer is the
# submit-rsvp Edge Function (service-role key + honeypot). A raw anon POST
# pointing at an arbitrary event must be rejected outright (401/403), never a
# 2xx that inserted. A 404 means the table isn't applied yet (migrations apply
# out-of-band by an admin) — a write is then impossible, PASS-with-WARN. This
# reuses the exact event_* child-write helper so the lockdown is asserted the
# same way for every service-role-only insert table.
# ---------------------------------------------------------------------------
probe_child_write_denied "rsvps" "f" '{"event_id":1,"email":"rls-probe@claw.camp"}'

# ---------------------------------------------------------------------------
# Assertion (g): anon must NOT be able to read the rsvps roster.
# The rsvps table holds attendee emails; anon gets NO select. The public
# attendee COUNT is served by the rsvp_count SECURITY DEFINER RPC (which never
# returns rows), so the roster TABLE itself must be unreadable. We model this on
# the contacts SELECT probe in (a): hard-fail the instant the body contains an
# email, or returns a non-empty array of rows. 401/403 (denied), an empty array
# (RLS hides all rows), or 404 pre-migration are all acceptable safe states.
# ---------------------------------------------------------------------------
echo "[g] anon GET /rest/v1/rsvps?select=*"
RSVPS_RESP="$(curl -s -w $'\n%{http_code}' \
  "${SUPABASE_URL}/rest/v1/rsvps?select=*&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")"
RSVPS_CODE="$(printf '%s' "$RSVPS_RESP" | tail -n1)"
RSVPS_BODY="$(printf '%s' "$RSVPS_RESP" | sed '$d')"

# Hard fail if the roster ever leaks an email address.
if printf '%s' "$RSVPS_BODY" | grep -qiE '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'; then
  fail "(g) rsvps roster leaked an email address — anon can read the roster: ${RSVPS_BODY:0:200}"
elif [ "$RSVPS_CODE" = "404" ]; then
  pass "(g) rsvps read returned HTTP 404 — rsvps table not applied yet, roster unreadable (WARN: apply migration 0004)"
elif [ "$RSVPS_CODE" = "401" ] || [ "$RSVPS_CODE" = "403" ]; then
  pass "(g) anon read of rsvps roster denied with HTTP ${RSVPS_CODE}"
elif [ "$RSVPS_CODE" = "200" ] && printf '%s' "$RSVPS_BODY" | tr -d '[:space:]' | grep -qE '^\[\]$'; then
  pass "(g) anon read of rsvps roster returned an empty array (RLS hides all rows)"
elif [ "$RSVPS_CODE" = "200" ]; then
  fail "(g) anon read of rsvps roster returned HTTP 200 with a non-empty body — rows are readable: ${RSVPS_BODY:0:200}"
else
  fail "(g) unexpected HTTP ${RSVPS_CODE} from anon rsvps read — body: ${RSVPS_BODY:0:200}"
fi
echo

# ---------------------------------------------------------------------------
# Assertion (h): anon must NOT be able to write another user's storage folder.
# The single `media` bucket uses a per-folder RLS policy: an object's first
# path segment must equal auth.uid(), so user A can never write under user B's
# folder. That authenticated cross-user case needs a logged-in token, which a
# curl-with-anon probe cannot hold — so we assert the strongest case the gate
# CAN exercise unattended: an UNAUTHENTICATED POST to the Storage object-insert
# endpoint for some other user's folder must be rejected (400/401/403 — auth
# required / RLS denied), and must NEVER return a 2xx. A 404 means the bucket
# isn't provisioned yet (migration 0005, out-of-band) — PASS-with-WARN.
# ---------------------------------------------------------------------------
echo "[h] anon POST /storage/v1/object/media/<other-uid>/evil.txt"
STORAGE_CODE="$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST \
  "${SUPABASE_URL}/storage/v1/object/media/00000000-0000-0000-0000-000000000000/evil.txt" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: text/plain" \
  --data-binary 'rls-probe')"

if [ "$STORAGE_CODE" = "400" ] || [ "$STORAGE_CODE" = "401" ] || [ "$STORAGE_CODE" = "403" ]; then
  pass "(h) anon write to another user's storage folder denied with HTTP ${STORAGE_CODE}"
elif [ "$STORAGE_CODE" = "404" ]; then
  pass "(h) anon storage write returned HTTP 404 — media bucket not provisioned yet, write impossible (WARN: apply migration 0005)"
elif [ "${STORAGE_CODE#2}" != "$STORAGE_CODE" ]; then
  fail "(h) anon storage write returned HTTP ${STORAGE_CODE} — the object was STORED; anon can write another user's folder"
else
  fail "(h) anon storage write returned unexpected HTTP ${STORAGE_CODE} (expected 400/401/403, or 404 pre-provisioning)"
fi
echo

# ---------------------------------------------------------------------------
# Assertion (i): profiles is public-SELECT by design but must leak NO private
# field. The profiles table (migration 0005) is kept intentionally PII-free —
# email / verification_token / magic_link_token live in contacts/auth, never
# here — so "anon cannot read another user's profile-PRIVATE fields" reduces to
# "there are no private fields to read." A 200 carrying only public fields, an
# empty array, or a 404 pre-migration are all safe. We FAIL the instant a known
# private field NAME appears in the response body.
# ---------------------------------------------------------------------------
echo "[i] anon GET /rest/v1/profiles?select=*"
PROFILES_RESP="$(curl -s -w $'\n%{http_code}' \
  "${SUPABASE_URL}/rest/v1/profiles?select=*&limit=5" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")"
PROFILES_CODE="$(printf '%s' "$PROFILES_RESP" | tail -n1)"
PROFILES_BODY="$(printf '%s' "$PROFILES_RESP" | sed '$d')"

# Hard fail if a known private field name is ever present in the body.
if printf '%s' "$PROFILES_BODY" | grep -qiE 'verification_token|magic_link_token|"email"'; then
  fail "(i) profiles exposed a private field (email/verification_token/magic_link_token) — profiles must stay PII-free: ${PROFILES_BODY:0:200}"
elif [ "$PROFILES_CODE" = "404" ]; then
  pass "(i) profiles read returned HTTP 404 — profiles table not applied yet (WARN: apply migration 0005)"
elif [ "$PROFILES_CODE" = "401" ] || [ "$PROFILES_CODE" = "403" ]; then
  pass "(i) anon read of profiles denied with HTTP ${PROFILES_CODE}"
elif [ "$PROFILES_CODE" = "200" ]; then
  pass "(i) anon read of profiles returned HTTP 200 with only public fields (no private field leaked)"
else
  fail "(i) unexpected HTTP ${PROFILES_CODE} from anon profiles read — body: ${PROFILES_BODY:0:200}"
fi
echo

# ---------------------------------------------------------------------------
# Summary / exit code
# ---------------------------------------------------------------------------
echo "----------------------------------------"
echo "RLS probe: ${PASS} passed, ${FAIL} failed."
if [ "$FAIL" -ne 0 ]; then
  echo "RESULT: FAIL — RLS lockdown is NOT fully in effect (contacts, chapters, events, event_* child tables, rsvps, profiles, and/or media storage). Apply the migrations."
  exit 1
fi
echo "RESULT: PASS — contacts is locked down, anon cannot write chapters, anon cannot write the event_* child tables, anon reads ONLY approved events, anon cannot raw-insert or read the rsvps roster, anon cannot write another user's media storage folder, and profiles exposes no private fields."
exit 0
