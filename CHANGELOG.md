# Changelog

## 2.0.0 — The Self-Running Multi-Chapter Network

The milestone release: ClawCamp is now a real self-serve, self-moderating
multi-chapter platform that a non-engineer can run end to end. Six slices:

- **Self-serve chapter provisioning.** Approving a "Start a Chapter" application
  now auto-creates a live `chapters` row in `status='forming'` and grants the
  applicant the `captain` membership via the `provision-chapter` Edge Function —
  zero manual DB editing (migration 0009).
- **Static data retired.** `js/event-extras.js` and the hardcoded chapter-card
  fallbacks are deleted; the site renders entirely from Supabase tables (with a
  minimal loading/empty state so a page is never blank), and no `events.notes`
  content-stuffing remains.
- **Map + search discovery.** `/events` and `/chapters` reuse `js/clawcamp-map.js`
  to plot chapters/events by lat/lng, closing the "no map, no cross-event search"
  gaps.
- **Engagement + networks.** New-event-from-a-followed-chapter and RSVP-reminder
  notifications (`notify-engagement`, gated by dashboard email prefs), an opt-in
  per-chapter member directory (`profiles.directory_opt_in`, off by default),
  and a private captain health dashboard (follower growth, RSVP conversion,
  attendance) — public momentum framed as "this city is forming", never a
  ranking.
- **The quality wall + CSP.** CI now enforces Lighthouse budgets (Perf ≥ 90,
  A11y ≥ 95, Best-Practices ≥ 95) on the four key pages and axe-core checks on
  the join modal + start-a-chapter form; a Content-Security-Policy header in
  `vercel.json` (authored after the share/calendar/map surfaces exist, so it
  allowlists them); the 198KB homepage event list is split into a Supabase-fed
  lazy render. A checked-in RLS-coverage test asserts every table has explicit
  policies with no anon write leak, plus hot-FK indexes (migration 0009).
- **Observability + privacy + runbook.** A dependency-free, CSP-safe client
  error-reporting hook installed globally in `js/config.js` (Sentry-ready via
  `SENTRY_DSN`/`ERROR_SINK_URL`; fire a test error with `?__test_error=1`); a
  `/privacy` page with a data-retention policy and deletion path; a one-page
  `docs/operator-runbook.md`; an updated `docs/data-model.md` ERD; a documented
  backup+restore drill (RTO/RPO); SRI re-pinning of CDN deps; and a final anon
  re-probe (`scripts/rls-probe.sh`) confirming no PII is reachable.

## 1.5.0 — Recaps + Evergreen SEO

- recap columns on events (recap_url + recap_photos_url jsonb path array +
  recap_headline/recap_body) and per-chapter media-bucket RLS (migration 0008):
  a captain may write recap photos under a `chapter-<id>/` folder in the shared
  'media' bucket; cross-chapter upload is rejected server-side. Recap writes
  reuse the existing events UPDATE gate (no new write policy); recap reads ride
  the existing approved-only anon gate, so unapproved recaps never leak.
- Captain recap composer (RLS-gated) to attach a recording/slides link,
  takeaways, and a photo gallery to a past event.
- Recap section on the event detail page replacing the "this event has ended"
  banner; events without a recap keep the ended banner (graceful fallback).
- Past Events archive tab + a momentum stat ("X events hosted, Y total
  attendees") from an extended chapter_stats view (additive columns
  events_hosted + total_attendees, the latter a real DB RSVP count read without
  exposing the sealed roster).
- Recap JSON-LD (EventCompleted) + sitemap coverage for past events with a
  recap, and a gated recap email to RSVPed attendees.

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
