# Changelog

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
