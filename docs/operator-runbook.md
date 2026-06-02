# Operator Runbook

A one-page, do-this-then-that guide for running ClawCamp end to end. No code
required. URLs assume production (`https://claw.camp`); paths are repo-relative.

Sign in first at **`/get-involved`** (magic link to your email). Captain/admin
controls only appear once your account holds the right role (see
[`docs/data-model.md`](data-model.md) → `memberships`).

---

## A. The core loop (event → approval → chapter → RSVPs → recap)

### 1. Submit an event

- Public path: **`/submit-event`** (or the "Submit an event" form on
  **`/events`**). Fill in name, date, city, venue, description, and (optionally)
  speakers / schedule / sponsors.
- This POSTs through the `submit-event` Edge Function and creates an event with
  **`status = 'submitted'`**. It is **not** publicly listed until approved.

### 2. Approve the event

- **Captains:** open the captain's console at **`/dashboard`** → your chapter →
  pending events → **Approve**. You can only approve events in your own chapter.
- **Admins:** open **`/admin`** to approve/reject any chapter's events.
- Approving issues a `PATCH` that sets **`status = 'approved'`**; the event now
  appears on `/events`, the chapter page, and the map. Reject leaves it hidden.

### 3. Add a chapter (self-serve provisioning)

- Applicant submits the **"Start a Chapter"** form on **`/chapters`**.
- On approval (admin in the console), the `provision-chapter` Edge Function
  **auto-creates the `chapters` row in `status = 'forming'` and grants the
  applicant the `captain` membership** — no manual SQL.
- **Manual step (only if the console surfaces it):** if the applicant applied
  with a different email than their signed-in account, the console shows a
  "link captain" prompt — confirm the correct account so the captain membership
  attaches to the right user. Otherwise there is nothing else to do.
- A forming chapter shows a "this city is forming" state until it has events
  (never a competitive ranking).

### 4. Read RSVPs

- **`/dashboard`** → your chapter → an event → **Roster**. Shows attendee names
  and emails and headcount-vs-capacity (captains see only their own chapter's
  roster; the public never can).
- **Export CSV** with the button on the roster for offline check-in.

### 5. Compose & send a recap

- **`/dashboard`** → a past event → **Recap composer**. Add a recording/slides
  link, takeaways, and photos (uploaded to the shared `media` bucket under your
  `chapter-<id>/` folder).
- Saving publishes the recap on the event detail page. Use **Send recap** to
  trigger the `send-recap` Edge Function, which emails RSVPed attendees.

---

## B. Operational drills

### 6. Engagement notifications (`notify-engagement`)

- Sends "new event from a chapter you follow" and RSVP reminders, gated by each
  user's dashboard email prefs (`sub_events` / `sub_newsletter`).
- **Manual run:** invoke the `notify-engagement` Edge Function from the Supabase
  dashboard (Functions → Invoke), or via the scheduled cron that calls it.
- **Cron:** confirm the schedule exists in the Supabase project (Database →
  Cron / Scheduled Functions). If deliverability dips, pause the cron rather
  than editing recipients.

### 7. Client error reports + firing a test error

- Errors surface from the global hook in **`js/config.js`** (installed on every
  key page). Reports carry only error metadata + page path + browser — no PII.
- **Where they go:** wherever `SENTRY_DSN` or `ERROR_SINK_URL` in `js/config.js`
  points. If both are empty, errors log to the browser console only.
- **Fire a test error:** load any page with **`?__test_error=1`**
  (e.g. `https://claw.camp/?__test_error=1`). One synthetic error fires and
  should appear in your sink. Confirms the exit criterion "Sentry captures a
  test client error."
- **CSP note:** if you wire a new endpoint, add it to `connect-src` in
  `vercel.json` or the report POST is blocked.

### 8. Backup + restore drill (RTO / RPO)

- **What:** Supabase runs automated daily backups + point-in-time recovery
  (PITR) on the Postgres DB.
- **RPO (max data loss): ≤ 24 hours** via daily backup; minutes with PITR if
  enabled on the plan.
- **RTO (max downtime to restore): ≤ 2 hours.**
- **Drill (quarterly):** in the Supabase dashboard → Database → Backups,
  restore the latest backup into a **scratch project**, then confirm row counts
  for `events`, `chapters`, `rsvps`, `chapter_follows`, and `profiles` match
  production. Record the date and elapsed time. Never restore over production
  without a current backup in hand.

### 9. Re-pin CDN dependencies (SRI)

- The site loads `@supabase/supabase-js` and Leaflet from a CDN at **pinned**
  versions with Subresource Integrity (`integrity="sha384-..."`) hashes.
- **When a version bumps** (or Dependabot opens a PR): update the pinned version
  **and** regenerate the matching SRI hash, then redeploy. A version change
  without an updated hash will (correctly) cause the browser to refuse the
  script.

### 10. Final anon re-probe (no PII reachable)

- Run **`scripts/rls-probe.sh`** against production. It uses only the public
  anon key and asserts that anon **cannot** read `contacts` / `rsvps` rosters /
  `memberships`, **cannot** write any locked table, and that no PII leaks
  anywhere. CI runs this on every push (`.github/workflows/ci.yml`).
- **Expected:** all assertions PASS. A failure means an RLS gap — treat as an
  incident and follow [`SECURITY.md`](../SECURITY.md).

---

## Quick reference

| Action | Where | Mechanism |
|--------|-------|-----------|
| Submit event | `/submit-event`, `/events` | `submit-event` fn → `status='submitted'` |
| Approve event | `/dashboard` (captain), `/admin` (admin) | `PATCH status='approved'` |
| Add chapter | `/chapters` "Start a Chapter" | `provision-chapter` fn → forming chapter + captain |
| Read RSVPs | `/dashboard` → roster | captain-only RLS read + CSV export |
| Send recap | `/dashboard` → recap composer | `send-recap` fn |
| Notifications | Supabase Functions / cron | `notify-engagement` fn |
| Test error | any page `?__test_error=1` | global hook in `js/config.js` |
| RLS probe | `scripts/rls-probe.sh` | anon-key assertions |
