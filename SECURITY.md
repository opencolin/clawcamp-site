# Security Policy

ClawCamp is a static site (vanilla HTML/CSS/JS, no build step) deployed on
Vercel. The only backend is Supabase, reached directly from the browser. This
document explains the threat model we operate under and how to report a problem.

## The anon key is public by design

The Supabase **anonymous (anon) key** is embedded in client JavaScript on
purpose. It ships in `js/supabase.js`, `js/auth.js`, `js/nav.js`, and inline in
several pages (`events/index.html`, `events/detail/index.html`,
`sponsors/index.html`, `submit-event/index.html`, `dashboard/index.html`). It is
a JWT with `"role": "anon"` and is meant to be world-readable — anyone can view
source and copy it. This is not a leak.

Because the key is public, **every Row Level Security (RLS) policy assumes the
client is hostile.** We never treat "the request came from our own JS" as a
trust signal. A request carrying the anon key can come from our forms, from
`curl`, or from a scraper — the database policy is the only thing that decides
what that request may read or write. The `service_role` key (which bypasses RLS)
is never present in this repository or in any client bundle; it lives only in
Supabase-side environment configuration for Edge Functions.

Treat the database, not the front end, as the security boundary. Client-side
checks in the HTML/JS are UX conveniences and provide **no** security guarantee.

## v1.0.0 lockdown

Release 1.0.0 ("Stop the Bleed") closed a live PII/token-exposure and
account-takeover vector. Summary of the policy that the anon role now operates
under:

- **`contacts` — SELECT and UPDATE revoked for anon.** The anon role can no
  longer read or modify rows in the `contacts` god-table. Authenticated users
  may read only their own row, matched on the JWT email claim.
- **`contacts` — INSERT kept for anon.** Public submission forms must keep
  working, so anon retains INSERT-only access. This is the reusable pattern for
  every future public-write table: insert-only, never readable, guarded by an
  `rls-probe` test that proves anon cannot SELECT or PATCH.
- **Tokens never cross the wire.** Form inserts now use the
  `Prefer: return=minimal` header instead of `return=representation`, so
  `verification_token` / `magic_link_token` are never echoed back in the insert
  response. The verification email reads the token **server-side** in the
  `send-verification` Edge Function; it is never exposed to the browser.
- **Dashboard writes are JWT-bound.** The profile and email-preference updates
  in `dashboard/index.html` were rewritten from "PATCH `contacts` filtered by
  `email=eq.<address>`" (which let any visitor overwrite anyone's name, bio,
  username, and prefs) to authenticated, session-bound updates keyed on the
  caller's own `auth.uid()` / JWT email. A visitor can no longer edit another
  person's row.

The live schema is captured in git as a Supabase migration baseline so policy
changes are always recorded against a known starting point. See
[`docs/data-model.md`](docs/data-model.md) for the table inventory and the
documented data-model debt.

> Note: the form/dashboard code paths described above are owned and changed by
> other release slices. This document records the security contract those
> changes must satisfy.

## Reporting a vulnerability (responsible disclosure)

If you find a security issue — an RLS gap, a way to read another person's
`contacts` row, a token leak, an account-takeover path, or anything else —
please disclose it responsibly:

- **Email:** hello@claw.camp
- Include steps to reproduce, the affected URL or endpoint, and the impact.
- Please do **not** open a public GitHub issue for security reports, and do not
  run automated scanners against production beyond what is needed to demonstrate
  the issue.
- We will acknowledge your report and work with you on a fix and timeline.

Thank you for helping keep ClawCamp's community data safe.
