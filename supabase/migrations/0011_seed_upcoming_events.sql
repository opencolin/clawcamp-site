-- =============================================================================
-- ClawCamp — Migration 0011: seed the current upcoming-event slate
-- =============================================================================
-- WHY THIS FILE EXISTS:
--   As of 2026-08-11 the `events` table held 163 approved rows but only ONE with
--   an event_date in the future (ClawCon Stockholm, id 63). Everything the
--   public calendars were advertising — the SF Summer Camp run, Nairobi, and the
--   luma.com/claw meetup slate — was missing, so /, /events and the hero map all
--   rendered an effectively empty upcoming section.
--
--   This migration backfills that slate from the two canonical sources:
--     * https://clawcamp.org/   (the org site; source = 'clawcamp')
--     * https://luma.com/claw   (the OpenClaw Meetups calendar; source = 'openclaw')
--
-- WHY A MIGRATION AND NOT AN INSERT FROM THE APP:
--   0003 REVOKEd the anon INSERT grant on `events`; the only browser-facing
--   write path is the submit-event Edge Function, which forces status='submitted'
--   and would park all nine rows in the /admin moderation queue. These rows are
--   operator-curated, not public submissions, so they are seeded here with
--   status='approved' and applied out-of-band in the Supabase SQL console —
--   the same way 0002/0003 are applied (anon cannot run DDL/seed).
--
-- IDEMPOTENCY: every row is an INSERT ... SELECT guarded by NOT EXISTS on the
--   `link`, matching the "guarded NOT EXISTS" seed convention 0003's header
--   sets out. Re-running this file inserts nothing the second time. ClawCon
--   Stockholm is deliberately ABSENT — id 63 already carries it, and the guard
--   would skip it anyway.
--
-- COLUMN CONVENTIONS (matched against existing source='openclaw' rows):
--   city       lowercase slug, and MUST have an entry in cityCoords
--              (js/clawcamp-map.js) or the event renders with no map dot.
--              'sunnyvale' was missing and is added in that file alongside this.
--   location   human display string, "Venue, City, Region, Country".
--   time_range "6:00 PM - 9:00 PM" — local to the event, plain hyphen, no tz
--              suffix (the existing openclaw rows omit it; the card shows the
--              city next to it).
--   event_type community | workshop | flagship | hackathon — free text, no
--              CHECK, but these four are the values the site's filter chips key
--              on. Anything else is invisible to the type filter.
--   status     'approved' — 0003's events_select_approved policy hides every
--              other value from anon, so a seed row that forgets this is
--              silently invisible on the public site.
--
-- MULTI-DAY EVENTS: `events` has a single event_date, but four of these span a
--   range (the passports, Summer Camp Week, the Summit). Each is seeded with its
--   END date so the row stays in the "upcoming" bucket until the event actually
--   finishes, which is how clawcamp.org itself lists them; the full span is
--   stated in the description so the card still reads correctly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. clawcamp.org — the ClawCamp-run slate
-- ---------------------------------------------------------------------------

-- Global Summer Camp Passport — spans Jun 20 - Aug 16 (seeded at the end date).
INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawCamp Global Summer Camp Passport',
  DATE '2026-08-16',
  'san-francisco',
  'San Francisco, CA',
  NULL,
  'community',
  'A season-long passport to ClawCamp Global Summer Camp events worldwide (Jun 20 - Aug 16). RSVP to receive updates, early access to tickets, exclusive discounts, partner invitations, and priority access to upcoming events.',
  'https://lu.ma/clawcamp-global-passport',
  'https://clawcamp.us/wp-content/uploads/clawcamp/events/260603_clawcampglobalsummercampsquaremedium_ef906330.jpg',
  'clawcamp', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://lu.ma/clawcamp-global-passport'
);

-- SF Summer Camp Week — spans Aug 8 - Aug 16 (seeded at the end date).
INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'SF Summer Camp Week',
  DATE '2026-08-16',
  'san-francisco',
  'San Francisco, CA',
  NULL,
  'community',
  'A week of ClawCamp Summer Camp events in San Francisco (Aug 8 - Aug 16). RSVP to receive updates, early access to tickets, exclusive discounts, and partner invitations.',
  'https://luma.com/clawcamp-passport',
  'https://clawcamp.us/wp-content/uploads/clawcamp/events/260603_clawcampsfsummercampsquaremedium_66213043.jpg',
  'clawcamp', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/clawcamp-passport'
);

-- SF Summer Camp Summit — Aug 15-16. Flagship: the anchor event of the week.
INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawCamp SF Summer Camp Summit',
  DATE '2026-08-16',
  'san-francisco',
  'San Francisco, CA',
  NULL,
  'flagship',
  'A two-day summit focused on advancing proficiency and mastery of personal agentic systems (Aug 15 - Aug 16).',
  'https://luma.com/clawcamp-sf-summer-camp',
  'https://clawcamp.us/wp-content/uploads/clawcamp/events/260806_sfsummitwlogoslarge_84558224.jpg',
  'clawcamp', true, true, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/clawcamp-sf-summer-camp'
);

-- ClawCamp Nairobi — Aug 21, single day.
INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawCamp Nairobi',
  DATE '2026-08-21',
  'nairobi',
  'Nairobi, Kenya',
  '10:00 AM - 5:00 PM',
  'community',
  'Join ClawCamp at Nairobi for a day of talks, workshops and networking.',
  'https://luma.com/clawcamp-nairobi',
  'https://clawcamp.us/crm-app/uploads/events/import_535d4dc231e0.png',
  'clawcamp', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/clawcamp-nairobi'
);

-- Campfire, Step SF Week edition — Aug 24, single evening.
INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawCamp Campfire - Step SF Week Edition',
  DATE '2026-08-24',
  'san-francisco',
  'San Francisco, CA',
  '6:00 PM - 9:00 PM',
  'community',
  'An evening focused on advancing proficiency and mastery of personal agentic systems.',
  'https://luma.com/clawcamp-stepsf',
  'https://clawcamp.us/wp-content/uploads/clawcamp/events/260805_cc_step_campfirelarge_eb7a9326.jpg',
  'clawcamp', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/clawcamp-stepsf'
);

-- ---------------------------------------------------------------------------
-- 2. luma.com/claw — the OpenClaw Meetups calendar
-- ---------------------------------------------------------------------------
-- Times below are the event's LOCAL time, converted from the UTC start/end the
-- Luma calendar publishes (e.g. ClawCon Seattle 2026-08-12T00:30Z in
-- America/Los_Angeles is Aug 11, 5:30 PM PDT — note the date rolls back a day).
-- image_url uses the same cdn-cgi transform prefix as the existing
-- source='openclaw' rows so card art is sized consistently.
-- ClawCon Stockholm (2026-09-08) is intentionally omitted — already id 63.

INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawCon Seattle',
  DATE '2026-08-11',
  'seattle',
  '2205 7th Ave, Seattle, WA, United States',
  '5:30 PM - 8:30 PM',
  'community',
  NULL,
  'https://luma.com/clawcon-seattle',
  'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=500,height=500/uploads/y4/90200b41-239f-431e-863d-65175634c753.png',
  'openclaw', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/clawcon-seattle'
);

INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'Clawstin - August Meetup',
  DATE '2026-08-13',
  'austin',
  'Pershing Hall, Austin, TX, United States',
  '6:00 PM - 8:00 PM',
  'community',
  NULL,
  'https://luma.com/ctxe78xv',
  'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=500,height=500/event-covers/49/48d244f7-1c97-4642-83c5-8f692cf2e1f1.png',
  'openclaw', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/ctxe78xv'
);

INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'ClawBuilders x Stan - Agents For Personal Payments + Content Distribution Workshop',
  DATE '2026-08-31',
  'toronto',
  'Toronto, Ontario, Canada',
  '5:00 PM - 8:00 PM',
  'workshop',
  NULL,
  'https://luma.com/qx6mgyob',
  'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=500,height=500/uploads/3v/30677c75-8caf-49ca-af7b-d5c3b49fd524.png',
  'openclaw', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/qx6mgyob'
);

INSERT INTO public.events
  (name, event_date, city, location, time_range, event_type, description, link, image_url, source, is_external, is_featured, status)
SELECT
  'AI Workshop: Getting Started with OpenClaw',
  DATE '2026-09-11',
  'sunnyvale',
  '456 W Olive Ave, Sunnyvale, CA, United States',
  '1:00 PM - 5:00 PM',
  'workshop',
  NULL,
  'https://luma.com/sep-openclaw-workshop',
  'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=500,height=500/uploads/px/80fa10de-6069-4e70-9bc6-cd128af422fe.jpg',
  'openclaw', true, false, 'approved'
WHERE NOT EXISTS (
  SELECT 1 FROM public.events WHERE link = 'https://luma.com/sep-openclaw-workshop'
);

-- =============================================================================
-- VERIFY (run after applying):
--   SELECT event_date, city, event_type, name FROM public.events
--    WHERE event_date >= CURRENT_DATE ORDER BY event_date;
--   -- expect 10 rows: the 9 seeded here + ClawCon Stockholm (id 63).
-- =============================================================================
