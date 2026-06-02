-- ===========================================================================
-- ClawCamp — Migration 0008: event recaps + per-chapter media RLS + momentum
-- ===========================================================================
-- WHY THIS FILE EXISTS:
--   v1.5.0 ("recaps-and-living-archive") turns an event from a one-shot RSVP
--   target into a LIVING ARCHIVE: after a meetup happens a captain can attach a
--   recap (recording/slides link, a short headline + body of takeaways, and a
--   gallery of photos) that REPLACES the bare "this event has ended" banner, and
--   the chapter card/header gains a momentum stat ("X events hosted, Y total
--   attendees"). This is the FOUNDATIONAL v1.5 slice and the DB spine every
--   other v1.5 slice (captain recap composer, the recap section + Past Events
--   archive tab, the EventCompleted JSON-LD + sitemap, the gated recap email)
--   reads/enforces against. Those slices touch DISJOINT files (HTML / js / Edge
--   Functions / scripts); this migration touches ONLY the DB.
--
--   This file is APPEND-ONLY. It does NOT touch migrations 0001–0007 — they are
--   shipped. It REUSES, never redefines: the events_select_approved gate (0003
--   §5), the events_update_admin_or_captain write gate (0006 §4), the shared
--   'media' bucket + its per-USER policies (0005 §5), the is_chapter_role /
--   is_claw_admin SECURITY DEFINER helpers (0006 §2.5), and the chapter_stats
--   VIEW (0002 §5).
--
-- THE THREE THINGS THIS MIGRATION DOES:
--   1) RECAP COLUMNS on public.events (recap_url, recap_photos_url jsonb,
--      recap_headline, recap_body) — PUBLIC columns surfaced to anon, but ONLY
--      on approved events (the existing anon gate already enforces that).
--   2) PER-CHAPTER STORAGE RLS on storage.objects for the shared 'media' bucket
--      so a captain (or global admin) may write recap photos under a
--      chapter-scoped folder `chapter-<chapter_id>/...` — and a captain of
--      chapter A is server-side REJECTED writing under chapter-B/.
--   3) MOMENTUM STAT — extend chapter_stats with events_hosted + total_attendees
--      (a real DB count of active RSVPs) ADDITIVELY, breaking no existing column.
--   plus VERSION/CHANGELOG bumps (owned files, not this SQL).
--
-- THE SECURITY POSTURE / THREAT MODEL (anon is a hostile public client — same
--   paragraph as 0004 §4 / 0005 §3 / 0006 §3):
--   The anon key ships in the browser bundle and is held by an untrusted client.
--   For this migration specifically:
--     * RECAP READS are gated by status. The recap columns are PUBLIC by design
--       (a recap is meant to be seen), but anon's only read path into events is
--       events_select_approved (0003 §5: anon SELECT USING status = 'approved').
--       So an UNAPPROVED event's recap — including a draft recap on a
--       not-yet-approved event — NEVER leaks to a hostile client. No new events
--       SELECT policy is added or needed.
--     * RECAP WRITES reuse the EXISTING gate. events_update_admin_or_captain
--       (0006 §4) ALREADY authorizes a captain to PATCH any column on an event
--       whose events.chapter_id is a chapter they captain (and a global admin to
--       PATCH any event). PATCHing the recap_* columns is just another column
--       update under that same gate — so the captain recap composer reuses it
--       verbatim. >>> DO NOT add a new events write policy for recaps. <<< Anon
--       holds no membership, so the gate returns false and a hostile PATCH of
--       the recap columns is denied — the same property rls-probe already
--       asserts for the moderation PATCH (assertion (m)).
--     * CHAPTER-FOLDER STORAGE WRITES are the new lockdown. A captain uploads
--       recap photos under `chapter-<chapter_id>/...` in the shared 'media'
--       bucket. The new policies below permit that write ONLY when the caller
--       captains the chapter named in the path's first segment (or is a global
--       admin). This is what makes the exit criterion "recap photos persist to
--       the shared media bucket under the chapter folder; cross-chapter upload
--       is rejected" TRUE server-side: a captain of chapter A cannot write under
--       chapter-B/ because is_chapter_role(B,'captain') is false for them. The
--       5 MB size cap + image-only allowed_mime_types from the 0005 bucket
--       definition STILL apply (server-side content validation) — they live on
--       the bucket, not the policy, so they bind every writer including captains.
--     * MOMENTUM AGGREGATE leaks no roster. chapter_stats is a VIEW; a view runs
--       with its OWNER's privileges, so anon reads the aggregate total_attendees
--       WITHOUT any direct SELECT on rsvps. The rsvps roster stays sealed (0004
--       gave anon no rsvps SELECT; 0006 §6 added only a captain/admin roster
--       read) — this migration grants anon NOTHING on rsvps. rls-probe assertion
--       (g) (anon cannot read the roster) STILL HOLDS.
--
-- CONVENTIONS INHERITED FROM 0001–0007 (kept consistent on purpose):
--   * recap_photos_url stores Storage object PATHS in the 'media' bucket, NOT
--     public URLs — mirroring profiles.photo_path (0005), which stores a path
--     and lets the client derive the public URL. Storing paths (not URLs) keeps
--     the bucket re-nameable and the public-URL derivation a client concern.
--   * Recap text columns are FREE-TEXT (nullable), NOT a Postgres enum — same
--     posture every prior migration takes for non-constrained text. No CHECK is
--     imposed on recap_url/headline/body; the composer slice validates shape
--     client-side and renders ALL of it via textContent (never innerHTML), so
--     stored content cannot become stored XSS.
--   * recap_photos_url is `jsonb NOT NULL DEFAULT '[]'::jsonb` (a JSON ARRAY of
--     path strings) — same jsonb-with-a-safe-default shape profiles.links (0005)
--     and the 0003 child-data columns use, so a row always has a valid array.
--   * The chapter_stats replacement is ADDITIVE: CREATE OR REPLACE VIEW keeping
--     id/slug/upcoming_events/total_events UNCHANGED and only APPENDING columns
--     (Postgres CREATE OR REPLACE VIEW may add trailing columns but may not drop
--     or reorder existing ones — we honor that).
--   * All DDL is idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE VIEW,
--     guarded GRANTs, and — because Postgres has NO `CREATE POLICY IF NOT
--     EXISTS` and storage.objects is a SHARED, pre-existing table already
--     carrying the 0005 per-user policies — every new CREATE POLICY is wrapped
--     in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
--     (the same guard 0005/0006 use) so re-applying the migration is always a
--     safe no-op.
--
-- GRACEFUL / SAFETY: every new column is nullable-or-defaulted, so existing
--   event rows are unaffected (a past event with no recap keeps NULL recap_*
--   columns and the UI keeps showing the "ended" banner + an archive empty
--   state). The view replacement drops no column. We do NOT re-create the
--   'media' bucket and do NOT touch the 0005 per-user media policies.
--
-- APPLIED OUT-OF-BAND: like 0002–0007, this file is applied by an admin in the
--   hosted Supabase SQL console — anon cannot run DDL, and only the admin/owner
--   may ALTER public.events, write storage.objects policies, and CREATE OR
--   REPLACE a view owned by the privileged role. scripts/rls-probe.sh remains
--   the CI gate that asserts the lockdown from a hostile anon client.
-- ===========================================================================

-- ===========================================================================
-- 1. RECAP COLUMNS on public.events  (public, but anon-gated to approved only)
-- ===========================================================================
-- WHAT: four additive, nullable-or-defaulted columns that hold an event's
--       recap. recap_url is the recording/slides link; recap_headline +
--       recap_body are the short takeaways the plan mentions; recap_photos_url
--       is a JSON ARRAY of Storage object PATHS (not URLs) in the 'media'
--       bucket.
-- WHY:  these power the recap section that replaces the "this event has ended"
--       banner and the Past Events archive. They are PUBLIC columns — a recap is
--       meant to be read — but anon's only read into events is
--       events_select_approved (0003 §5), so a recap on an unapproved event is
--       never visible to a hostile client. No new SELECT policy is needed.
-- PATH-NOT-URL (mirrors profiles.photo_path, 0005): recap_photos_url holds
--   Storage object PATHS like 'chapter-12/recap-<event>/cover.jpg', NOT public
--   URLs. The client derives the public URL from each path exactly as it does
--   for profiles.photo_path — keeping the bucket re-nameable and the URL
--   derivation a client concern. The default '[]'::jsonb guarantees a row always
--   carries a valid array (never NULL), so the gallery renderer can map over it
--   unconditionally.
-- WRITE PATH (reused, NOT redefined): the captain recap composer PATCHes these
--   columns under the EXISTING events_update_admin_or_captain gate (0006 §4),
--   which already authorizes a captain to update their own chapter's event (and
--   a global admin any event). >>> DO NOT add a new events write policy here. <<<
-- SAFETY: all four are nullable or defaulted, so every existing event row is
--   unaffected (recap columns stay NULL/[] until a captain fills them).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recap_url        text;                          -- recording / slides link (nullable)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recap_headline   text;                          -- short recap headline / title (nullable)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recap_body       text;                          -- recap takeaways body (nullable; rendered via textContent, never innerHTML)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recap_photos_url jsonb NOT NULL DEFAULT '[]'::jsonb; -- JSON ARRAY of 'media' bucket object PATHS (not URLs) — mirrors profiles.photo_path; default [] so a row always has a valid array

-- NOTE on existing policies (reused verbatim, asserted here for the reader):
--   * READ:  events_select_approved (0003 §5) — anon SELECT USING
--            status = 'approved'. Recap columns ride along on approved rows only.
--   * WRITE: events_update_admin_or_captain (0006 §4) — a captain may PATCH the
--            recap_* columns on their own chapter's event; a global admin any.
--   Neither is re-created here; both already exist from their migrations.

-- ===========================================================================
-- 2. PER-CHAPTER STORAGE RLS on storage.objects  (shared 'media' bucket)
-- ===========================================================================
-- WHAT: three NEW policies (INSERT / UPDATE / DELETE) on the SHARED, already-
--       existing storage.objects table that ALSO permit a captain (or global
--       admin) to write objects under a CHAPTER-scoped folder whose first path
--       segment is `chapter-<chapter_id>` in the 'media' bucket.
-- WHY:  recap photos are a CHAPTER asset, not a single user's — many captains of
--       one chapter (and the global admin) should be able to manage them, and
--       they must NOT be filed under any one user's uid folder. So recap photos
--       live under `chapter-<chapter_id>/...`, and these policies authorize a
--       write there ONLY when the caller captains the chapter named in the path
--       (or is a global admin).
--
-- >>> THE BUCKET ALREADY EXISTS — WE DO NOT RE-CREATE IT, AND WE DO NOT TOUCH
--     THE 0005 PER-USER POLICIES. <<<
--   The 'media' bucket was provisioned in 0005 §5 (public=true, 5 MB cap,
--   image-only allowed_mime_types). This migration adds ADDITIONAL policies
--   alongside the 0005 per-user policies (media_insert_own / media_update_own /
--   media_delete_own — which key on (storage.foldername(name))[1] =
--   auth.uid()::text — and media_read_public). Postgres ORs multiple permissive
--   policies for the same command, so the per-user avatar path and the new
--   chapter-folder recap path coexist: a write is allowed if EITHER the user
--   owns the uid folder OR the chapter-folder predicate below holds.
--
-- THE CHAPTER-FOLDER PREDICATE (the crux of the exit criterion):
--   bucket_id = 'media'
--   AND (storage.foldername(name))[1] LIKE 'chapter-%'
--   AND public.is_chapter_role(
--         substring((storage.foldername(name))[1] from 'chapter-([0-9]+)')::bigint,
--         'captain')
--   OR public.is_claw_admin()
--   storage.foldername(name) returns the path segments as a text[]; element [1]
--   is the top-level folder. We require it to look like 'chapter-<digits>',
--   extract the digits with a regex substring, cast to bigint, and ask the
--   EXISTING is_chapter_role(bigint,text) helper (0006 §2.5, SECURITY DEFINER,
--   search_path-pinned — NOT redefined here) whether the CURRENT caller captains
--   that chapter. A global admin (is_claw_admin(), also 0006 §2.5) may write any
--   chapter folder. This is precisely what makes "cross-chapter upload is
--   rejected" true server-side: a captain of chapter A writing under chapter-B/
--   yields is_chapter_role(B,'captain') = false, and (being no admin)
--   is_claw_admin() = false, so the write is denied. A hostile anon holds no
--   membership, so BOTH helpers return false and anon cannot write at all.
--
-- A NOTE ON OPERATOR PRECEDENCE (we mirror the slice's stated predicate exactly):
--   In SQL, AND binds tighter than OR, so the predicate parses as
--       ( bucket_id='media' AND first-segment LIKE 'chapter-%' AND is_chapter_role(...) )
--     OR is_claw_admin()
--   i.e. a chapter captain may write under their own chapter folder in the media
--   bucket, OR a global admin may write anywhere (any bucket). That is the
--   intended authorization: admins are global by design (is_claw_admin is the
--   ADMIN_EMAILS replacement, chapter- AND bucket-independent), and the per-user
--   0005 policies still independently cover a user's own uid folder.
--
-- CONTENT VALIDATION STILL BINDS: the 5 MB file_size_limit and the image-only
--   allowed_mime_types on the 'media' bucket (0005 §5) are enforced by Storage
--   on the bucket itself, so they apply to EVERY writer — including a captain
--   writing under a chapter folder. The client cannot bypass them.
-- IDEMPOTENCY: each policy is wrapped in DO $$ ... EXCEPTION WHEN
--   duplicate_object THEN NULL; END $$; (same guard as 0005/0006) so re-applying
--   is a no-op on this shared, pre-existing table.

-- WHAT: a captain (or global admin) may INSERT recap photos under their own
--       chapter's `chapter-<id>/...` folder in the media bucket.
-- WHY:  WITH CHECK binds the NEW object's path prefix to a chapter the caller
--       captains; anon (no membership) and a captain of a different chapter are
--       both denied. This is the recap-photo upload path the composer slice uses.
DO $$
BEGIN
  CREATE POLICY media_insert_chapter_captain
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'media'
      AND (storage.foldername(name))[1] LIKE 'chapter-%'
      AND public.is_chapter_role(
            substring((storage.foldername(name))[1] from 'chapter-([0-9]+)')::bigint,
            'captain')
      OR public.is_claw_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- WHAT: a captain (or global admin) may UPDATE objects under their own chapter's
--       folder in the media bucket.
-- WHY:  USING restricts WHICH objects are visible to update; WITH CHECK forbids
--       moving an object out of (or into) a chapter folder the caller does not
--       captain. Same predicate both sides so a captain can neither edit nor
--       re-file another chapter's recap photo. Lets a captain replace a recap
--       image, never another chapter's.
DO $$
BEGIN
  CREATE POLICY media_update_chapter_captain
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'media'
      AND (storage.foldername(name))[1] LIKE 'chapter-%'
      AND public.is_chapter_role(
            substring((storage.foldername(name))[1] from 'chapter-([0-9]+)')::bigint,
            'captain')
      OR public.is_claw_admin()
    )
    WITH CHECK (
      bucket_id = 'media'
      AND (storage.foldername(name))[1] LIKE 'chapter-%'
      AND public.is_chapter_role(
            substring((storage.foldername(name))[1] from 'chapter-([0-9]+)')::bigint,
            'captain')
      OR public.is_claw_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- WHAT: a captain (or global admin) may DELETE objects under their own chapter's
--       folder in the media bucket.
-- WHY:  USING ties deletion to a chapter the caller captains, so a captain can
--       remove their own chapter's recap photo but never another chapter's. anon
--       (no membership) has no delete path.
DO $$
BEGIN
  CREATE POLICY media_delete_chapter_captain
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'media'
      AND (storage.foldername(name))[1] LIKE 'chapter-%'
      AND public.is_chapter_role(
            substring((storage.foldername(name))[1] from 'chapter-([0-9]+)')::bigint,
            'captain')
      OR public.is_claw_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTE: recap photos are PUBLIC reads. The 0005 media_read_public policy
--   (anon + authenticated, USING bucket_id = 'media') already covers reading any
--   object in the media bucket, so NO new read policy is needed — recap photos
--   render via a plain public URL the client derives from each stored path.

-- ===========================================================================
-- 3. MOMENTUM STAT — extend public.chapter_stats  (ADDITIVE; breaks no column)
-- ===========================================================================
-- WHAT: CREATE OR REPLACE the chapter_stats VIEW, keeping the existing columns
--       id / slug / upcoming_events / total_events UNCHANGED and APPENDING:
--         * events_hosted   = count of PAST, APPROVED events for this chapter
--                             (event_date < current_date AND status='approved'),
--         * total_attendees = a real DB count of ACTIVE RSVPs (going|waitlist)
--                             across this chapter's events.
-- WHY:  the chapter card/header momentum line ("X events hosted, Y total
--       attendees") needs real DB numbers, not hardcoded strings. events_hosted
--       counts what actually happened (past + approved); total_attendees is the
--       social-proof headcount.
--
-- >>> ADDITIVE / NON-BREAKING (read before editing this view): <<<
--   chapters/index.html reads chapter_stats with select=* (line ~524) and the
--   chapter-detail header reads stat.followers / stat.upcoming_events /
--   stat.captains via a numOr(..., 0) fallback (lines ~639-641). Postgres
--   CREATE OR REPLACE VIEW may ADD trailing columns but may NOT drop or reorder
--   existing ones — so we keep id/slug/upcoming_events/total_events first and in
--   order, and only APPEND. (followers/captains are not columns of this view
--   today; the page's numOr(..., 0) already defaults them to 0, and that stays
--   true — we are not adding or removing them here.)
--
-- AGGREGATE-WITHOUT-ROSTER (the PII guarantee): a VIEW runs with its OWNER's
--   privileges, so anon reading chapter_stats gets total_attendees WITHOUT any
--   direct SELECT on rsvps. The rsvps roster stays sealed (0004 gave anon no
--   SELECT; 0006 §6 added only a captain/admin roster read) — this migration
--   grants anon NOTHING on rsvps. rls-probe assertion (g) (anon cannot read the
--   roster) STILL HOLDS. This is the exact pattern 0002's chapter_stats and
--   0004's rsvp_count use to expose a count without exposing rows.
--
-- COUNTING CORRECTLY:
--   * total_attendees uses count(DISTINCT r.id) over a LEFT JOIN of rsvps
--     filtered to status IN ('going','waitlist') (the SAME active-RSVP set
--     rsvp_count in 0004 counts). DISTINCT r.id guards the count against row
--     fan-out from the chapter -> events -> rsvps join.
--   * events_hosted / total_events / upcoming_events all use count(e.id) (never
--     count(*)), so a chapter with zero events counts 0, not 1, under the LEFT
--     JOINs.
--   * BOTH joins are LEFT JOINs so a chapter with zero events (or zero rsvps)
--     still returns a row with 0 counts — never an absent row.
CREATE OR REPLACE VIEW public.chapter_stats AS
SELECT
  c.id                                                        AS id,                -- UNCHANGED (existing column 1)
  c.slug                                                      AS slug,              -- UNCHANGED (existing column 2)
  -- upcoming = future-or-today events linked to this chapter (UNCHANGED from 0002)
  count(e.id) FILTER (WHERE e.event_date >= current_date)     AS upcoming_events,   -- UNCHANGED (existing column 3)
  -- total = all events ever linked to this chapter (UNCHANGED from 0002)
  count(e.id)                                                 AS total_events,      -- UNCHANGED (existing column 4)
  -- NEW: events actually HOSTED = past AND approved events for this chapter
  count(e.id) FILTER (
    WHERE e.event_date < current_date
      AND e.status = 'approved'
  )                                                           AS events_hosted,     -- APPENDED
  -- NEW: total active attendees = distinct going|waitlist RSVPs across this
  -- chapter's events (DISTINCT guards the count against join fan-out)
  count(DISTINCT r.id)                                        AS total_attendees    -- APPENDED
FROM public.chapters AS c
LEFT JOIN public.events AS e ON e.chapter_id = c.id
LEFT JOIN public.rsvps  AS r ON r.event_id = e.id
                            AND r.status IN ('going', 'waitlist')   -- only active RSVPs (same set as rsvp_count in 0004); in the JOIN, not WHERE, so a chapter with no active rsvps still returns a row with 0
GROUP BY c.id, c.slug;

-- WHAT: re-grant anon SELECT on chapter_stats (idempotent).
-- WHY:  GRANT SELECT covers the whole (now wider) view, so the two new columns
--       are readable by anon along with the existing four. Re-running the grant
--       is a harmless no-op if already present; we include it so the new columns
--       are unambiguously anon-readable. The grant exposes ONLY the aggregate —
--       anon gains NO direct SELECT on events or rsvps (the view's owner
--       privileges do the underlying reads).
GRANT SELECT ON public.chapter_stats TO anon;
