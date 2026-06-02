-- ===========================================================================
-- ClawCamp — Migration 0009: hot-FK indexes + self-serve chapter provisioning
-- ===========================================================================
-- WHY THIS FILE EXISTS:
--   v2.0.0 (the final milestone) makes "Start a Chapter" SELF-SERVE: an approved
--   application AUTO-CREATES a `forming` chapters row and assigns the applicant
--   the captain membership — zero manual DB editing. The server-side write is
--   performed by the NEW service-role Edge Function supabase/functions/
--   provision-chapter (the DB half of that slice is what little this migration
--   needs to add). This file ALSO lays down the hot-foreign-key indexes the
--   v2.0 quality-wall slice's query budget references, so the per-page RPC/query
--   plans stay index-backed as the directory grows.
--
--   This file is APPEND-ONLY. It does NOT touch migrations 0001–0008 — they are
--   shipped. It REUSES, never redefines: the chapters table + its status CHECK
--   (0002 §1), the memberships table + its role CHECK + UNIQUE(profile_id,
--   chapter_id) (0006 §1), and the existing per-table RLS lockdowns. It adds NO
--   new anon-facing policy.
--
-- THE TWO THINGS THIS MIGRATION DOES:
--   1) HOT-FK INDEXES (idempotent) on the foreign keys the v2.0 query budget
--      names: events.chapter_id, event_speakers.event_id, event_schedule.event_id,
--      event_sponsors.event_id, rsvps.event_id, chapter_follows.chapter_id. Most
--      already exist from earlier migrations (0002/0003/0004/0007); they are
--      re-declared here with IF NOT EXISTS so this single file documents the
--      whole budget and a fresh apply that runs only 0009 still gets them. Each
--      re-declaration is a safe no-op on an already-applied DB.
--   2) PROVISIONING AUTHORIZATION — confirm (idempotently) that the service-role
--      provision-chapter function can INSERT a chapters row with status='forming'
--      and a memberships row with role='captain'. The service_role key BYPASSES
--      RLS by default, so NO new policy or grant is required — and we add NONE,
--      so the anon lockdown is untouched. The only conditional DDL is a guarded
--      check that 'forming' is an allowed chapters.status value (it already is,
--      from 0002 §1) so the function's insert can never trip the CHECK.
--
-- THE SECURITY POSTURE / THREAT MODEL (anon is a hostile public client — same
--   paragraph as 0006 §3 / 0007 / 0008):
--   The anon key ships in the browser bundle and is held by an untrusted client.
--   For this migration specifically:
--     * NO ANON LOOSENING. The provision-chapter function holds the SERVICE-ROLE
--       key (a server-side secret, never shipped to the browser). service_role
--       bypasses RLS, so it can INSERT chapters/memberships WITHOUT any policy
--       change. We therefore add NO new policy and NO new anon/authenticated
--       grant. 0002 §6 (anon SELECT-only on chapters, no anon write) and 0006 §3
--       (anon NO read/write on memberships; authenticated SELECT-own only, NO
--       write) STILL HOLD verbatim.
--     * NO-SELF-PROMOTE STILL HOLDS. The headline 0006 exit criterion — a member
--       (or anon) cannot grant themselves captain/admin — is unchanged: the only
--       writer of a role='captain' membership is this service-role function, run
--       server-side after an admin approves the application. scripts/rls-probe.sh
--       assertion (j) (a hostile anon POST to /rest/v1/memberships, e.g.
--       role:'captain', is DENIED) continues to pass because we add NO anon write
--       path. assertion (c) (anon cannot write chapters) likewise still holds.
--
-- CONVENTIONS INHERITED FROM 0001–0008 (kept consistent on purpose):
--   * Index names are idiomatic idx_<table>_<column>, matching idx_events_
--     chapter_id (0002 §2), idx_event_*_event_id (0003 §6), idx_rsvps_event_id
--     (0004), idx_chapter_follows_chapter_id (0007 §2) — re-using the EXACT names
--     those migrations chose so the IF NOT EXISTS is a true no-op, never a
--     duplicate index under a second name.
--   * All DDL is idempotent: CREATE INDEX IF NOT EXISTS; and the status-CHECK
--     reconciliation is wrapped in a guarded DO block that only ALTERs if (and
--     only if) 'forming' is NOT already permitted — so re-applying is always a
--     safe no-op and 0002's constraint is left untouched in the normal case.
--   * status / role stay FREE-TEXT + CHECK (NOT Postgres enums) — we do not
--     introduce a type here; we only (defensively) ensure 'forming' is allowed.
--
-- APPLIED OUT-OF-BAND: like 0002–0008, this file is applied by an admin in the
--   hosted Supabase SQL console — anon cannot run DDL. scripts/rls-probe.sh
--   remains the CI gate that asserts the lockdown from a hostile anon client.
-- ===========================================================================

-- ===========================================================================
-- 1. HOT-FK INDEXES  (the v2.0 quality-wall query-budget surface)
-- ===========================================================================
-- WHAT: a CREATE INDEX IF NOT EXISTS on each foreign key the v2.0 query budget
--       names. These are the join/filter columns the public pages hit on every
--       render:
--         * events.chapter_id          — "events for this chapter" (chapter
--                                          detail) + the chapter_stats view's
--                                          per-chapter COUNT (0002 §5 / 0008 §3).
--         * event_speakers.event_id    — the event-detail page's speaker fetch.
--         * event_schedule.event_id    — the event-detail page's agenda fetch.
--           (Confirmed real table name: `event_schedule`, per 0003 §4 — NOT
--            event_agenda.)
--         * event_sponsors.event_id    — the event-detail page's sponsor fetch.
--         * rsvps.event_id             — rsvp_count (0004) + chapter_stats'
--                                          total_attendees (0008 §3).
--         * chapter_follows.chapter_id — the per-chapter follower count (0007).
-- WHY:  v2.0's query budget requires every hot child-lookup / aggregate to be
--       index-backed so a page render stays a handful of indexed reads as the
--       directory and event archive grow — no sequential scans on the FKs.
-- IDEMPOTENT / NO-OP NOTE: every index below ALREADY exists from an earlier
--       migration (see the §-references above) and is re-declared here under its
--       EXACT existing name with IF NOT EXISTS, so on an already-applied database
--       each statement is a confirmed no-op. They are gathered here so this one
--       file is the single, legible statement of the v2.0 query budget — and so a
--       fresh environment that applies only 0009 still materializes them.
CREATE INDEX IF NOT EXISTS idx_events_chapter_id          ON public.events           (chapter_id);   -- also created in 0002 §2 (no-op if present)
CREATE INDEX IF NOT EXISTS idx_event_speakers_event_id    ON public.event_speakers   (event_id);     -- also created in 0003 §6 (no-op if present)
CREATE INDEX IF NOT EXISTS idx_event_schedule_event_id    ON public.event_schedule   (event_id);     -- also created in 0003 §6 (no-op if present); table is event_schedule
CREATE INDEX IF NOT EXISTS idx_event_sponsors_event_id    ON public.event_sponsors   (event_id);     -- also created in 0003 §6 (no-op if present)
CREATE INDEX IF NOT EXISTS idx_rsvps_event_id             ON public.rsvps            (event_id);     -- also created in 0004     (no-op if present)
CREATE INDEX IF NOT EXISTS idx_chapter_follows_chapter_id ON public.chapter_follows  (chapter_id);   -- also created in 0007 §2 (no-op if present)

-- ===========================================================================
-- 2. PROVISIONING AUTHORIZATION  (service-role writer — NO anon loosening)
-- ===========================================================================
-- WHAT: the NEW supabase/functions/provision-chapter Edge Function, on an
--       approved "Start a Chapter" application, INSERTs:
--         (a) a public.chapters row with status='forming', and
--         (b) a public.memberships row with role='captain' for the applicant.
--       This section makes that write authorized + safe WITHOUT loosening anon.
--
-- >>> THE FUNCTION USES THE SERVICE-ROLE KEY, WHICH BYPASSES RLS. <<<
--   service_role is a Postgres superuser-adjacent role in Supabase: RLS policies
--   do NOT apply to it. So the provision-chapter function can INSERT into
--   chapters and memberships with NO new policy and NO new grant. We therefore
--   add NEITHER here. This is deliberate and is the whole point of routing
--   trusted writes through a service-role Edge Function rather than loosening the
--   anon-facing policies:
--     * chapters: 0002 §6 leaves anon SELECT-only (no anon INSERT/UPDATE/DELETE);
--       0006 §5 added an authenticated UPDATE gate for captains/admins. NEITHER
--       grants an INSERT to anon or authenticated — only service_role inserts a
--       new chapter, and it does so by bypassing RLS. UNCHANGED here.
--     * memberships: 0006 §3 gives anon NOTHING and authenticated SELECT-own only,
--       with NO write policy at all (the no-self-promote guarantee). The captain
--       membership is inserted ONLY by this service-role function (bypassing RLS),
--       NEVER by the browser. UNCHANGED here. >>> DO NOT add a memberships write
--       policy or grant for anon/authenticated — doing so would regress the 0006
--       no-self-promote exit criterion that rls-probe assertion (j) guards. <<<
--
-- WHY status='forming' (NOT 'active'): provisioning creates a FORMING chapter —
--   the product framing is "this city is forming", and a chapter graduates to
--   'active' via the existing captain/admin chapters UPDATE gate (0006 §5), never
--   at creation time. The function hard-codes status='forming'.
--
-- THE STATUS-CHECK RECONCILIATION (guarded; normally a no-op):
--   chapters.status already carries CHECK (status IN ('active','forming',
--   'archived')) from 0002 §1, so 'forming' is ALREADY allowed and the function's
--   insert cannot trip the CHECK. We nonetheless (defensively + idempotently)
--   verify 'forming' is permitted and, ONLY if some environment's constraint were
--   to lack it, widen the constraint to include it. The guard checks the live
--   constraint text first, so in the normal (already-correct) case this block
--   does NOTHING and 0002's constraint is left exactly as-is.
-- ROLE CHECK: memberships.role already allows 'captain' (0006 §1's CHECK (role IN
--   ('member','captain','admin'))), so no analogous reconciliation is needed for
--   the captain insert — it is already a valid value.
DO $$
DECLARE
  has_forming boolean;
BEGIN
  -- Does ANY CHECK constraint on public.chapters already admit 'forming'?
  -- We test by inspecting every CHECK constraint's source text for the token.
  SELECT EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_class     rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'chapters'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%''forming''%'
  ) INTO has_forming;

  IF NOT has_forming THEN
    -- Defensive ONLY: some environment's chapters.status CHECK does not permit
    -- 'forming'. Replace it with the canonical 0002 constraint so the provisioning
    -- insert is valid. In the normal case (0002 applied) we never reach here.
    ALTER TABLE public.chapters
      DROP CONSTRAINT IF EXISTS chapters_status_check;
    ALTER TABLE public.chapters
      ADD  CONSTRAINT chapters_status_check
      CHECK (status IN ('active', 'forming', 'archived'));
    RAISE NOTICE 'chapters.status CHECK widened to include ''forming'' (was missing in this environment)';
  END IF;
END $$;

-- NOTE (no new objects below): this migration intentionally creates NO table, NO
--   view, NO policy, and NO grant. Its entire footprint is (1) idempotent hot-FK
--   indexes for the v2.0 query budget and (2) a guarded, normally-no-op check
--   that chapters.status admits 'forming'. The provision-chapter Edge Function
--   does all writing through the service-role key, which bypasses RLS — so the
--   anon lockdown (and the 0006 no-self-promote guarantee) is preserved exactly.
