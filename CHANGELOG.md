# Changelog

## 1.4.0 — Real Roles + the Captain's Console

- memberships table + SECURITY DEFINER role helpers (server-side RBAC, no
  self-promote); events/chapters UPDATE policies for admins + chapter captains;
  chapter_follows table + submit-follow Edge Function (join modal writes a real
  follow); dashboard My Chapters + role badge + follow feed; Captain's Console
  (RLS-gated) with chapter editing + RSVP roster + CSV export.

## 1.3.0 — On-Site RSVP, Real Profiles, and Storage

- rsvps table (migration 0004) + a submit-rsvp service-role Edge Function with a
  honeypot field; raw anon inserts are rejected — the Edge Function is the only
  writer.
- Inline on-site RSVP form on the event detail page with a live attendee count
  (a rsvp_count SECURITY DEFINER RPC, so the roster table stays unreadable),
  Add-to-Calendar, and a post-RSVP invite link that carries UTM/ref attribution.
  Luma is retained as the secondary RSVP action.
- profiles table (migration 0005) keyed to auth.users, with a citext UNIQUE
  username column replacing the old contacts.title username hack. The table is
  kept intentionally PII-free.
- One `media` Storage bucket with per-user-folder RLS (an object's path prefix
  must equal auth.uid()) plus size/mime validation, wired into the dashboard
  photo upload.
- UTM/ref capture on contact-form inserts (js/supabase.js): utm_source,
  utm_medium, utm_campaign, and ref are stamped onto every new contact row.
  Migration 0005 adds these four columns to the `contacts` table.
- rls-probe extended (scripts/rls-probe.sh): anon cannot raw-insert rsvps,
  cannot read the rsvps roster, cannot write another user's media storage
  folder, and profiles exposes no private fields.

## 1.2.0 — Decompose the Event + the Moderation Gate

- events.status moderation enum + event_speakers/event_schedule/event_sponsors
  tables (migration 0003); submit-event posts to a service-role Edge Function;
  detail page reads child tables DB-first with EVENT_EXTRAS fallback; /admin
  review page; public lists filtered to approved; per-event OG/JSON-LD;
  stored-XSS Playwright regression test.

## 1.1.0 — Chapters Become Data + first CI gate

- chapters table (migration 0002) + events.chapter_id FK; chapters page renders
  from the DB with a static fallback; per-chapter pages at /chapters/?slug=X.
- Events directory chapter filter.
- First CI gate (.github/workflows/ci.yml) running the RLS probe + smoke check.
- Renamed: "Other Events" → "Online Events", "ClawCamp SF, CA" → "ClawCamp San Francisco".

All notable changes to ClawCamp are recorded here.

Convention: we hand-bump the `VERSION` file on every release and add a matching
entry below. There is no `semantic-release` or other automated tooling — versions
are chosen and written by a human (or release agent) at ship time.

## 1.0.0

First versioned release. Hardens the Supabase integration, consolidates config,
and lays the groundwork for SEO and automated smoke testing.

- Security: lock down Supabase tables with Row Level Security (RLS) so the public
  anon key can no longer read or mutate data it should not.
- Security: fix a token-leak in the form/auth flow.
- Dashboard writes are now bound to the authenticated user (auth-scoped inserts/updates).
- Versioning: introduce a hand-bumped `VERSION` file (`1.0.0`) and this changelog.
- Config consolidation: add `js/config.js` as the single source of truth for
  `SUPABASE_URL` / `SUPABASE_ANON_KEY` (the anon key is public by design). All
  pages and `js/auth.js` now read from `window.CLAWCAMP_CONFIG` instead of
  duplicating the URL/key inline.
- SEO foundation: canonical/meta groundwork across public content pages.
- Cleanup: remove duplicated inline Supabase constants from content pages.
- Tooling: add `scripts/smoke.sh` — a curl+grep smoke test asserting HTTP 200 and
  a known string on `/`, `/events`, `/chapters`, and an event detail page.

### History before 1.0.0

Pre-1.0.0 work was tracked only in git. Selected highlights (newest first):

- Add reusable release-builder workflow + canonical roadmap and release plan docs.
- Add dynamic event detail pages, dynamic sponsors + speakers, past-event lifecycle state.
- Add chapters, event submission, rich event pages, newsletter, live badges, profiles.
- Fix magic-link login redirecting to homepage instead of dashboard.
- Add and curate dozens of events synced with the Luma calendar.
- Add Nebius / OpenClaw workshop tutorials and presentations.
- Initial ClawCamp marketing site, map, and Supabase-backed CRM forms.
