-- =============================================================================
-- ClawCamp — Migration 0012: let admins READ form submissions
-- =============================================================================
-- THE BUG THIS FIXES ("our form submissions aren't arriving"):
--   They ARE arriving. The writes were never broken — anon still holds the
--   INSERT grant 0001 deliberately kept, and a POST to /rest/v1/contacts from
--   the public site returns 201 today. What broke is that NOBODY CAN READ THEM.
--
--   0001 closed the contacts breach by ENABLEing RLS and revoking the anon
--   SELECT grant, then added exactly one SELECT policy:
--
--       CREATE POLICY contacts_select_own ON public.contacts
--         FOR SELECT TO authenticated
--         USING (email = (auth.jwt() ->> 'email'));
--
--   That policy is correct for the dashboard (a signed-in camper reading their
--   own prefs) and was never widened for operators. The consequence: a logged-in
--   ClawCamp admin querying `contacts` sees exactly ONE row — their own — no
--   matter how many host / sponsor / speaker / camper applications have landed.
--   Every submission since v1.0.0 has been written, retained, and invisible
--   outside the Supabase SQL console. There is also no admin UI reading
--   contacts at all (/admin is an events moderation queue only), so nothing on
--   the site ever surfaced them. This migration fixes the read side; the
--   companion UI change adds the panel that uses it.
--
-- WHY is_claw_admin() AND NOT AN EMAIL ALLOWLIST:
--   0006 introduced public.is_claw_admin() precisely to retire hardcoded email
--   allowlists ("the direct replacement for the v1.2 hardcoded ADMIN_EMAILS
--   allowlist"). It is SECURITY DEFINER + STABLE with a pinned search_path and
--   returns TRUE iff the caller holds ANY membership row with role='admin'. For
--   an anon caller auth.uid() is NULL, no membership matches, and it returns
--   false — the hostile-client default-deny. Reusing it keeps "who is an admin"
--   one fact in one table.
--
-- WHAT THIS DELIBERATELY DOES *NOT* DO — the lockdown stays intact:
--   * anon gains NOTHING. The policy is TO authenticated only, and the anon
--     SELECT *grant* stays revoked, so the grant layer denies anon before RLS is
--     even consulted. scripts/rls-probe.sh assertion (a) — "anon GET
--     /rest/v1/contacts must NOT return rows" — still passes unchanged.
--   * No new UPDATE/DELETE. Admins get READ ONLY here. contacts_update_own
--     remains the only UPDATE policy, so an admin still cannot edit or delete
--     somebody else's contact row through PostgREST.
--   * verification_token / magic_link_token: an admin CAN now read these columns,
--     because RLS is row-level, not column-level. That is the one real widening
--     in this file and it is why the policy is gated on a role grant that only
--     an operator with SQL-console access can hand out. The admin UI shipped
--     alongside this migration requests an explicit column list and never
--     selects either token. If you want that enforced in the database rather
--     than by convention, front the panel with a SECURITY DEFINER view over the
--     safe columns and drop this policy — noted as the follow-up.
--
-- IDEMPOTENT: Postgres has no `CREATE POLICY IF NOT EXISTS`, so the CREATE is
--   wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END
--   $$;` — the same guard 0005/0006/0007/0008 use. Deliberately NOT a
--   `DROP POLICY IF EXISTS` + `CREATE`: a drop-then-create leaves a window in
--   which the policy is absent, and it would silently discard a hand-edit made
--   in the SQL console. Re-applying this file is a safe no-op.
-- =============================================================================

DO $$
BEGIN
  CREATE POLICY contacts_select_admin
    ON public.contacts
    FOR SELECT
    TO authenticated
    USING (public.is_claw_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTE ON POLICY COMBINATION: multiple PERMISSIVE policies for the same
-- role/command are OR'd together, so contacts_select_own and
-- contacts_select_admin coexist — a normal user keeps seeing their own row, an
-- admin sees every row. Neither policy has to know about the other.

-- =============================================================================
-- PREREQUISITE — you must hold a role='admin' membership for this to do anything
-- =============================================================================
-- 0006 already seeds one for collin@dabl.club, but that seed is wrapped in an
-- EXCEPTION handler that SKIPS it when the SQL console role cannot read
-- auth.users. If the panel comes up empty after applying this file, the seed was
-- skipped — re-run it (it is ON CONFLICT DO NOTHING, so it is safe either way):
--
--   INSERT INTO public.memberships (profile_id, chapter_id, role)
--   SELECT u.id, c.id, 'admin'
--     FROM auth.users u
--     JOIN public.chapters c ON c.slug = 'sf'
--    WHERE lower(u.email) = lower('collin@dabl.club')
--   ON CONFLICT (profile_id, chapter_id) DO NOTHING;
--
-- Confirm it took, signed in as that user:
--   SELECT public.is_claw_admin();   -- expect: true
--
-- =============================================================================
-- VERIFY (run after applying):
--   -- 1. As an admin's JWT — expect the full submission history:
--   SELECT count(*) FROM public.contacts;
--
--   -- 2. As anon — must still be denied/empty (the 0001 lockdown):
--   --    scripts/rls-probe.sh assertion (a) covers this; re-run the probe.
--
--   -- 3. Backlog by form type, newest first — what the new /admin panel shows:
--   SELECT form_type, count(*), max(created_at)
--     FROM public.contacts GROUP BY form_type ORDER BY 2 DESC;
--
-- HOUSEKEEPING: a probe row was inserted while diagnosing this
--   (name 'ZZ RLS PROBE DO NOT CONTACT', email 'rls-probe@example.invalid').
--   Delete it once you can see the table:
--   DELETE FROM public.contacts WHERE email = 'rls-probe@example.invalid';
-- =============================================================================
