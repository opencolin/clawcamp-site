# ClawCamp v1.0 → v2.0 — Orchestration Complete

**Status: 7/7 releases shipped to `master`. VERSION = 2.0.0.**

This documents the full multi-release build, decided by a PM council and executed
by fan-out workflows in isolated git worktrees, with ~60s self-paced ticks. Any
agent or human can use the checklist at the bottom to finish the server-side work.

## Releases shipped

| Version | Name | Commit | Build workflow |
|---------|------|--------|----------------|
| 1.0.0 | Stop the Bleed + Version Zero | `8809d72` | wf_daa7adcd-bde |
| 1.1.0 | Chapters Become Data + first CI gate | `766c70a` | wf_a30d2f0f-171 |
| 1.2.0 | Decompose the Event + Moderation Gate | `854f8ae` | wf_62e3c1c6-bbf |
| 1.3.0 | On-Site RSVP, Real Profiles, Storage | `b10abed` | wf_5aff7bd6-cc1 |
| 1.4.0 | Real Roles + the Captain's Console | `0568b73` | wf_434e562b-968 |
| 1.5.0 | Recaps + Evergreen SEO | `369420c` | wf_39dcc88e-73d |
| 2.0.0 | The Self-Running Multi-Chapter Network | `d6b951f` | wf_4706ec00-849 |

Council that decided the roadmap: `wf_3977ba4a-338` (5 PM modes → cross-critique
→ chief-of-staff synthesis). Deliberation: `docs/orchestration/pm-council.md`.

## How it was built

- **PM Council** (5 modes: MVP, Growth, Platform, Community, Risk) proposed
  roadmaps, cross-critiqued, and a chief-of-staff synthesized the canonical
  7-release dependency chain (`docs/releases/ROADMAP.md`).
- **One git worktree + branch per release** under `../clawcamp-worktrees/`,
  `release/vX.Y-<slug>`. Each synced onto `master` before building so it had all
  prior releases as its foundation.
- **One fan-out Workflow per release**: a decomposer split the plan into
  file-disjoint slices; parallel agents built each slice; a verifier checked the
  result against the plan's exit criteria. Each release then: commit → push →
  merge to master → bump VERSION + CHANGELOG → ship (Vercel auto-deploys).
- **Self-paced ~60s ticks** (30s requested; runtime floor is 60s) via
  ScheduleWakeup drove the chain; background-workflow completion notifications
  advanced it whenever they arrived first.

## Orchestration learnings (encoded so they don't recur)

1. `args` does NOT propagate through `Workflow({scriptPath, args})` — hardcode
   `planDoc`/`repo` as literals in an inline script.
2. Builder agents write to the `repo` path directly — point it at the release
   WORKTREE, not the main checkout, and clean any leaked main-checkout edits
   before merging.
3. Returning large file content via StructuredOutput overflows and fails the
   agent. **Canonical pattern (`release-builder-TEMPLATE.js`):** agents WRITE
   files directly into the worktree and return only a small manifest
   `{slice, summary, filesWritten[], followups[]}`; the orchestrator just
   `git add -A && commit`. No apply step, no large payloads.
4. **Don't retire a fallback before its data is migrated.** v2.0.0 planned to
   delete the static event list, but the `events` table is RLS-locked and holds
   only 2 upcoming rows, so the static list + chapters fallback were KEPT to
   avoid regressing the live site. Full retirement is gated on the backfill below.

## ⚠️ Server-side apply checklist (REQUIRED to fully activate v1.0–v2.0)

The anon key cannot run DDL, deploy functions, or create buckets, so all DB/
infra changes are committed to git but inert until an admin applies them. Do
these in order in the Supabase project (`mrnccntqmkxjazznejfc`) + Vercel:

1. **Apply migrations 0001 → 0009 in order** (Supabase SQL editor or
   service-role): baseline+RLS lockdown, chapters, event content+status,
   rsvps, profiles+storage, memberships/RBAC, follows+capacity, recaps,
   indexes. Each is idempotent and documented in-file.
2. **Create/confirm the `media` Storage bucket** (5 MB, image-only) — 0005
   defines its per-user RLS; 0008 adds per-chapter-folder captain policies.
3. **Deploy the 6 Edge Functions** with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   secrets: `submit-event`, `submit-rsvp`, `submit-follow`, `provision-chapter`,
   `send-recap`, `notify-engagement`.
4. **Seed/confirm the admin membership** (0006 backfills `collin@dabl.club` as
   role=admin) and grant any other admins a `memberships` row with role='admin';
   then remove the interim `ADMIN_EMAILS` allowlist from `admin/index.html`
   (`is_claw_admin()` is now the source of truth).
5. **Backfill the `events` table** from the curated static list so the DB is the
   complete source of truth (needs service-role — anon INSERT is now RLS-denied).
   The static list lives in `events/index.html`; once backfilled + 0003 applied
   (status=approved), the static event rows and chapters `FALLBACK_CHAPTERS` can
   be deleted and `/events` + `/chapters` go fully data-driven (the v2.0 search +
   map + provisioning UI wire that were deferred can then also land).
6. **Run `scripts/rls-probe.sh`** against production — it should flip from red to
   green once 0001+0003+0006+0007 are applied (proves anon can't read `contacts`,
   can't PATCH by email, can't read the rsvp roster, can't self-grant a role).
7. **(Optional) Vercel deploy protection** + wire the `js/config.js` error hook
   to a real Sentry DSN.

## Deferred (gated on step 5 backfill)

- `/events` and `/chapters` full static-data retirement + the v2.0 cross-entity
  search box and map on those two pages, and the Start-a-Chapter form posting to
  `provision-chapter` (the function ships; the UI wire was reverted to avoid the
  regression). Re-apply from the `release/2.0.0-self-running-platform` branch
  history after the events backfill.

## Resume / re-run

- Live status board: `docs/releases/STATUS.md`.
- Per-release scope + checklists: `docs/releases/vX.Y-<slug>.md`.
- Reusable builder: `docs/orchestration/workflow-scripts/release-builder-TEMPLATE.js`
  (edit the two path consts, launch inline).


## ⚠️ POST-SHIP HOTFIX (deploy was failing)

After v2.0.0 merged, **Vercel deploys silently started failing** (last good:
`ea6f401`), so the site froze on an old build and `/events` showed only the 2
DB events (the additive-render fix + everything since v1.2 weren't live).

Two causes, both fixed in `b3327dc`:
1. v2.0.0 added a root `package-lock.json`; combined with the v1.2 `package.json`
   it made Vercel auto-detect a Node project and run a failing install/build.
   **Fix:** `.vercelignore` excludes package.json, package-lock.json,
   playwright.config.js, tests/, supabase/, .github/, docs/ → pure static deploy.
2. `vercel.json` had a non-standard `"//csp"` comment key under `$schema`, which
   can fail config validation. **Fix:** removed `$schema` + the `//csp` key; kept
   cleanUrls, redirects, and the CSP/security headers.

LESSON (#6): a static site's deploy is only "shipped" if it actually deploys —
verify the live deploy state, not just the git merge. Adding build-tooling files
(package.json/lockfile) to a zero-config static repo silently flips Vercel into
build mode. Keep tooling out of the deploy via `.vercelignore`.
