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
