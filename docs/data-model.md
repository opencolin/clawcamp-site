# Data Model

ClawCamp's only datastore is a single Supabase Postgres project, queried
directly from the browser with the public anon key (see [`SECURITY.md`](../SECURITY.md)).
There are two tables today: **`contacts`** (every human who touches the site)
and **`events`** (every event/chapter gathering). This document enumerates them
and records the known structural debt, each item owned and slated for
normalization in a later release.

## `contacts` — the 44-column god-table

Every public form `INSERT`s into one wide `contacts` table. There is no
per-role table; the `form_type` column says which form produced the row, and the
remaining columns are a union of every field any form has ever needed — so most
columns are `NULL` for any given row. This is the central piece of data-model
debt.

### `form_type` overloading (one table, 11+ producers)

`js/supabase.js` wires every public form to the same
`POST /rest/v1/contacts` endpoint via `submitToSupabase()`, tagging each row
with a `form_type` discriminator:

| `form_type` | Source form (element id) | Notable columns it populates |
|-------------|--------------------------|------------------------------|
| `host`      | `#host-form`             | name, email, phone, city, format, proposed_date, venue, about, event_details |
| `sponsor`   | `#sponsor-form`          | name, email, phone, company, tier, event, website, linkedin, bio, offers, message |
| `staff`     | `#crew-form`             | name, email, phone, city, role, linkedin, experience, why |
| `speaker`   | `#speaker-form`          | name, email, phone, company, title, event, format, linkedin, topic, bio, offers |
| `event`     | `#event-form`            | name, email, phone, city, format, proposed_date, venue, event_link, event_details |
| `camper`    | `#camper-form`           | name, email, phone, city, role, experience_level, interests, preferred_event, about |
| `startup`   | `#startup-form`          | name, email, company, website, stage, city, description, pitch, preferred_event, linkedin |
| `showcase`  | `#showcase-form`         | name, email, phone, company, website, stage, event, demo_ready, description, pitch |
| `mentor`    | `#mentor-form`           | name, email, phone, company, title, linkedin, event, expertise, bio, offers |
| `partner`   | `#partner-form`          | name, email, phone, company, website, linkedin, partnership_type, bio, offers, message |
| `tutorial`  | `#tutorial-form`         | name, email, website, title, bio |
| `newsletter`| `js/nav.js` footer signup | email, sub_newsletter, email_opt_in |

> **Debt — multi-`form_type` overloading.** Eleven-plus distinct submission
> types all `INSERT` into one `contacts` table per `js/supabase.js` (and the
> newsletter signup in `js/nav.js`). The result is a sparse, ever-widening
> table where column meaning depends on `form_type`. **Owner:** Data /
> Platform. **Status:** documented debt — to be normalized into per-role tables
> (or a typed submissions table + a contacts identity table) in a later release.
> The `chapter_follow` producer specifically is **Paid down in: v1.4.0** (moved
> to the dedicated `chapter_follows` table — see its section below); the
> remaining producers stay open.

### Column inventory

The columns below are what the live schema exposes (the full set is captured as
the Supabase migration baseline). They group into the buckets shown; the total
is the **44-column** god-table.

**Identity / contact**
- `id` (PK)
- `name`
- `email`
- `phone`
- `city`
- `company`
- `website`
- `linkedin`
- `role`
- `title` — **overloaded**, see the username hack below

**Discriminator**
- `form_type` — which form produced the row (see table above)

**Free-text / application fields** (sparse; meaning varies by `form_type`)
- `about`
- `bio`
- `message`
- `topic`
- `offers`
- `experience`
- `experience_level`
- `expertise`
- `why`
- `description`
- `pitch`
- `interests`

**Event-related (host/event/speaker/sponsor/etc.)**
- `format`
- `proposed_date`
- `venue`
- `event`
- `event_link`
- `event_details`
- `preferred_event`

**Sponsor / startup / showcase / partner**
- `tier`
- `stage`
- `demo_ready`
- `partnership_type`

**Profile / username (dashboard)**
- `username` — see the username hack below

**Email preferences**
- `email_opt_in`
- `sub_newsletter`
- `sub_events`
- `sub_sponsors`

**Verification / auth tokens** (server-only; never returned to anon — see lockdown)
- `verification_token`
- `magic_link_token`
- `email_verified`
- `verified_at`

**Timestamps**
- `created_at`
- `updated_at`

> The exact byte-for-byte column list and types are the source of truth in the
> committed Supabase migration baseline; this inventory documents intent and the
> 44-column count of the live god-table.

### Debt — `title = 'username:'` hack

The dashboard stores a user's chosen public **username inside the `contacts.title`
column** with a literal `username:` prefix, rather than in the dedicated
`username` column or a normalized profile table:

- `dashboard/index.html` line ~775 — availability check:
  `GET /rest/v1/contacts?title=eq.username:<value>&select=id&limit=1`
- `dashboard/index.html` line ~808 — write on save:
  `body.title = 'username:' + username;`

This collides `title` (a person's job title, populated by the speaker/mentor
forms) with usernames, and relies on string-prefix matching for uniqueness
instead of a unique constraint. **Owner:** Dashboard / Identity. **Status:**
documented debt — to move usernames to a first-class, unique-constrained column
(or profiles table). **Paid down in:** **v1.3.0** (unique-username).

## `events`

The `events` table backs the public events listing
(`/rest/v1/events?select=*&order=event_date.asc` in `index.html` and
`events/index.html`), the detail page (`events/detail/index.html`), and the
event submission form (`submit-event/index.html`). Notable columns observed in
client code: `id`, `name`, `event_date`, `city`, `event_type`, `description`,
`location`, `venue_name`, `time_range`, `link`, `image_url`, `is_external`,
`is_featured`, `source`, and `notes`.

### Debt — `events.notes` text-stuffing

The `notes` column is a single free-text field that
`submit-event/index.html` (around lines 816–822) packs multiple structured
facts into, newline-joined:

```
STATUS: submitted for review        (or "STATUS: draft")
<reviewer notes>
Speakers: <comma-joined speaker names>
Schedule blocks: <count>
Sponsors: <comma-joined sponsor names>
```

Downstream code then re-parses this blob: `sponsors/index.html` (around line
672) reconstructs the sponsor list by reading `Sponsors: ...` back out of
`events.notes`. So review status, reviewer notes, speakers, schedule size, and
sponsors — all of which deserve their own columns or related tables — live as
substrings in one text field that must be string-parsed to use.

> **Debt — `events.notes` text-stuffing.** Structured event metadata (status,
> speakers, schedule, sponsors) is serialized into and parsed out of a single
> free-text `notes` column. **Owner:** Events / Platform. **Status:**
> documented debt — to be split into typed columns and/or related tables
> (e.g. `event_speakers`, `event_sponsors`, a `status` enum). **Paid down in:**
> **v1.2.0** (structured event content).

### `events.capacity` (v1.4.0)

`events` gains a nullable `capacity integer` column
(`supabase/migrations/0007_follows_and_capacity.sql`). `NULL` means **no cap /
unlimited** (every pre-existing row is unaffected — the column is added
`IF NOT EXISTS` and left nullable). The captain console roster reads it to show
headcount-vs-capacity, and waitlist logic keys on it: once the count of active
RSVPs reaches `capacity`, further RSVPs take the `'waitlist'` status the `rsvps`
table already supports (see the `rsvps` notes / migration 0004).

## `memberships` — first-class roles (v1.4.0)

Until v1.4.0 there was **no role table**. Who counted as an admin was a
hardcoded JavaScript allowlist in `admin/index.html` (`ADMIN_EMAILS`, a single
entry `['collin@dabl.club']`), and a non-admin who bypassed that client check
was stopped only by the absence of any approve/reject write path — there was no
captain role at all. `memberships`
(`supabase/migrations/0006_memberships_rbac.sql`) makes **roles real data,
enforced server-side**.

Each row grants exactly **one role to one auth user within one chapter**:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint GENERATED BY DEFAULT AS IDENTITY` (PK) | matches the repo PK convention |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `profile_id` | `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | the auth user (same FK style as `rsvps.profile_id` / `profiles.id`) |
| `chapter_id` | `bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE` | the chapter |
| `role` | `text NOT NULL DEFAULT 'member'` | **free-text + `CHECK (role IN ('member','captain','admin'))`**, NOT a Postgres enum (the 0002/0003/0004 convention) |

A `UNIQUE (profile_id, chapter_id)` constraint means a user holds **at most one
membership row per chapter**. Indexes exist on `chapter_id` and `profile_id`.

### Server-side role enforcement (replaces the hardcoded allowlist)

Two `SECURITY DEFINER` helpers — created with a pinned
`search_path = public, pg_temp`, the same hardening as `rsvp_count` (0004) — are
the **only** place authorization is decided. RLS policies call them; the client
never decides access (a client role check is cosmetic and trivially forged):

- **`public.is_chapter_role(p_chapter_id bigint, p_role text) -> boolean`** —
  true iff the caller (`auth.uid()`) holds a membership with exactly `p_role` on
  `p_chapter_id`. Authorizes a **captain**'s writes scoped to their own chapter.
- **`public.is_claw_admin() -> boolean`** — true iff the caller holds **any**
  membership row with `role='admin'` (a **global**, chapter-independent grant).
  This is the **direct replacement for the `ADMIN_EMAILS` allowlist** — the
  allowlist comment in `admin/index.html` literally said "Keep this in sync with
  the allowlist in the events RLS policy"; that linkage is now this function
  instead of a copied email list.

These helpers `RETURN boolean` only and run as their definer, so an RLS policy
can ask "does this caller hold role X?" without granting the caller any read of
other users' membership rows.

The policies they unlock (all added in 0006):

- **`events_update_admin_or_captain`** on `events` — the **first `UPDATE`
  policy** events has ever had. Migration 0003 enabled RLS on `events` with only
  `SELECT` policies and **no `UPDATE` policy**, so with RLS on, all updates were
  blocked at the policy layer. This single policy now authorizes **both** the
  v1.2 `/admin` approve/reject `PATCH` (via `is_claw_admin()`) **and** the new
  captain console's approve/reject/edit of events whose `events.chapter_id`
  matches a chapter the caller captains (via
  `is_chapter_role(chapter_id,'captain')`). A `PATCH` of another chapter's event
  is rejected by RLS; a hostile **anon** `PATCH` is denied outright (the policy
  is `TO authenticated`, both helpers are false for anon).
- **`chapters_update_captain`** on `chapters` — a captain may edit **only their
  own** chapter row; a global admin, any. (0002 granted anon `SELECT`-only on
  chapters; anon write stays denied.)
- **`rsvps_select_captain`** on `rsvps` — a captain may read the roster
  (emails/names) for events **in their own chapter only** (or an admin, any),
  powering the console roster + CSV. Anon still has **no** `rsvps` `SELECT`, so
  the roster stays PII-sealed to the public client.

### No-self-promote (the headline exit criterion)

`authenticated` gets **`SELECT`-only** on `memberships` (read your own rows via
`memberships_select_own`, for the dashboard "my roles" surface) and **no
`INSERT`/`UPDATE`/`DELETE` grant and no write policy at all**. Roles are written
**only** by an admin in the hosted SQL console (or, later, a service-role
gateway). A member therefore **cannot grant themselves captain**, and anon
cannot read or write the table. `scripts/rls-probe.sh` asserts this from a
hostile anon client: assertion **(j)** (a self-grant `POST` is denied),
assertion **(k)** (roles are not world-readable), and assertion **(m)** (the new
events `UPDATE` gate does not leak write access to anon).

> **Debt — cosmetic client-side roles / hardcoded admin allowlist.** Admin
> authorization lived in a JS `ADMIN_EMAILS` list, and there was no captain role
> — a "role" was a cosmetic client concept with no server-enforced backing.
> **Owner:** Platform / Identity. **Status:** **Paid down in:** **v1.4.0** —
> roles are now first-class `memberships` rows enforced server-side by RLS +
> `SECURITY DEFINER` helpers (`is_chapter_role` / `is_claw_admin`); the
> `ADMIN_EMAILS` allowlist is replaced by `is_claw_admin()`.

## `chapter_follows` — real chapter follows (v1.4.0)

Following a chapter used to be a `contacts` row tagged
`form_type='chapter_follow'` (written by the Join-Chapter modal in
`chapters/index.html`), and the original follower-count read hit
`contacts?form_type=eq.chapter_follow` — a path that returns nothing now that
v1.0.0 revoked anon `SELECT` on `contacts`. `chapter_follows`
(`supabase/migrations/0007_follows_and_capacity.sql`) gives follows a dedicated,
queryable home:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint GENERATED BY DEFAULT AS IDENTITY` (PK) | repo PK convention |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `chapter_id` | `bigint NOT NULL REFERENCES chapters(id) ON DELETE CASCADE` | |
| `email` | `text NOT NULL` | **email-first** — a follow works **without login** |
| `name` | `text` | optional display name |
| `profile_id` | `uuid REFERENCES auth.users(id) ON DELETE SET NULL` | **optional** account linkage (nullable), same posture as `rsvps.profile_id` |

A **partial unique index** `uq_chapter_follows_active` on
`(chapter_id, lower(email))` enforces one follow per email per chapter
(case-insensitive), modeled on `uq_rsvps_event_email_active`. Indexes exist on
`chapter_id` and `profile_id`.

Security mirrors `rsvps`: emails are PII, so anon gets **no write** (the **only**
writer is the submit-follow Edge Function holding the service-role key — never a
raw anon `INSERT`) and **no read**. `authenticated` may `SELECT`/`DELETE` only
their **own** follows (by `profile_id` linkage **or** matching JWT email),
powering the dashboard "My Chapters" list and the unfollow control.
`scripts/rls-probe.sh` assertion **(l)** asserts a raw anon `POST` to
`chapter_follows` is denied.

> **Debt — `chapter_follow` stuffed into the `contacts` god-table.** Chapter
> follows were just another sparse `form_type` in the 44-column `contacts` table,
> with no uniqueness guarantee and a follower read that died with the v1.0.0
> contacts lockdown. **Owner:** Chapters / Platform. **Status:** **Paid down
> in:** **v1.4.0** — follows move to the dedicated, email-first `chapter_follows`
> table with a real per-chapter uniqueness constraint and an Edge-Function-only
> write path. (The broader multi-`form_type` overloading of `contacts` remains
> open for the other producers — see that debt item above.)

## v2.0 additions — self-serve provisioning, opt-in directory, hot-FK indexes (June 2026)

Release 2.0.0 ("self-running-platform") turns ClawCamp into a real self-serve
multi-chapter network. The DB-side additions land in
`supabase/migrations/0009_indexes_and_provisioning.sql` (applied by an admin;
anon cannot run DDL). Nothing below changes the anon RLS posture — the
[`SECURITY.md`](../SECURITY.md) contract still holds, and `scripts/rls-probe.sh`
re-asserts it (no PII reachable anywhere).

### `chapters.status = 'forming'` — self-serve provisioning path

Until v2.0 a new chapter required hand-editing the `chapters` table and manually
inserting a `memberships` captain row. v2.0 makes provisioning self-serve:

- The existing **"Start a Chapter"** application (`chapters/index.html`
  `submitChapterApp`, `form_type='chapter_application'`) is, on approval, turned
  into a **live chapter** by the **`provision-chapter` Edge Function** (a
  service-role function alongside the existing `supabase/functions/*` — anon
  never writes `chapters`/`memberships` directly).
- The function **creates a `chapters` row with `status = 'forming'`** and
  **grants the applicant the `captain` membership** (`role='captain'` scoped to
  the new chapter), in one trusted server-side step.
- `chapters.status` is **text + a `CHECK` constraint** (the 0002/0004
  convention — *not* a Postgres enum), with values such as
  `'forming'` → `'active'`. A `'forming'` chapter renders the public
  "this city is forming" state and graduates to `'active'` once it has approved
  events. Pre-existing chapters are unaffected (the column is added
  `IF NOT EXISTS` and backfilled to `'active'`).
- This is the **direct replacement** for the manual DB-editing step the
  operator runbook used to require — see [`operator-runbook.md`](operator-runbook.md) §3.

### Opt-in member directory column (engagement slice)

The opt-in per-chapter member directory (profiles shown on a chapter page as
photo/`@username`/bio, *only* with consent) relies on a **boolean opt-in column
on `profiles`** — `directory_opt_in boolean NOT NULL DEFAULT false`. Default
**false** means a profile is **never** listed without the user explicitly opting
in from the dashboard; clearing it removes them from the directory. The
directory read is gated so only opted-in, non-PII profile fields
(`username`, `bio`, photo) are exposed — emails are never part of the directory
payload. This keeps the [`/privacy`](../privacy/index.html) "directory is
opt-in" promise enforceable in data, not just UI.

### `0009` hot-FK indexes (query budget)

Migration 0009 adds B-tree indexes on the **hot foreign keys** that the
DB-first read paths (now that static fallbacks are retired) traverse on every
list/detail/map render. These back the v2.0 query budget:

| Index on | Backs |
|----------|-------|
| `events(chapter_id)` | events filtered/grouped by chapter (lists, chapter pages, map) |
| `event_speakers(event_id)` | speaker block on the detail page |
| `event_schedule(event_id)` | schedule block on the detail page (note: the table is named `event_schedule`, per migration 0003 — not "schedule_blocks") |
| `event_sponsors(event_id)` | sponsor block on the detail page + `sponsors/index.html` |
| `rsvps(event_id)` | roster reads + the `rsvp_count` RPC |
| `chapter_follows(chapter_id)` | follower counts + the follow feed |

All are created `IF NOT EXISTS` and are additive (no lock-heavy table rewrite).
The `memberships(chapter_id)` / `memberships(profile_id)` and
`chapter_follows(chapter_id)` / `chapter_follows(profile_id)` indexes already
shipped in 0006/0007 (see those sections); 0009 fills the remaining gaps above.

### Checked-in generated types + ERD

`supabase gen types typescript` should be **regenerated and checked in** after
0009 applies, at the intended path **`supabase/database.types.ts`**, so the
schema-of-record travels with the repo and a follow-up can drop the file
verbatim. (This document remains the human-readable ERD; the generated file is
the machine-readable companion.) A checked-in RLS-coverage test
(`tests/rls-coverage.spec.js`) asserts every table — `events`, `chapters`,
`event_speakers`, `event_schedule`, `event_sponsors`, `profiles`,
`memberships`, `rsvps`, `chapter_follows`, `contacts` — has explicit
SELECT/INSERT/UPDATE/DELETE policies with no anon write leak.
