# Release Status Board — READ THIS FIRST ON RESUME

> Live state of the v1.0→v2.0 orchestration. Update this file whenever a release
> changes state. Any agent resuming the work starts here.

_Last updated: **GOAL MET — 7/7 releases shipped, VERSION 2.0.0.** See docs/orchestration/COMPLETE.md._

## Orchestration phase

| Stage | State | Detail |
|-------|-------|--------|
| PM Council | ✅ done | Workflow `wf_3977ba4a-338`. 11 agents. Output → `ROADMAP.md` + `docs/orchestration/pm-council.md` |
| Roadmap doc | ✅ done | `docs/releases/ROADMAP.md` — 7 releases, strict dependency chain |
| Per-release plans | ✅ done | `docs/releases/vX.Y-<slug>.md` (7 files) |
| Worktrees + branches | ✅ staged | 7 worktrees under `../clawcamp-worktrees/`, branches `release/*` pushed |
| Release workflows | 🟡 in progress | v1.0.0 build launching; rest `planned` (gated on deps) |

## ⚠️ Security note (drives v1.0.0)

The council reproduced a **live data exposure**: anon role can `SELECT` the
`contacts` table (including `verification_token`/`magic_link_token`) and can
`PATCH` any contact by email. **v1.0.0 (`lockdown-and-versioning`) fixes this
first** — RLS lockdown + token-leak header fix + auth-bound profile writes.
Until v1.0.0 ships, treat `contacts` as compromised.

## Releases

| Version | Slug | State | Branch | Worktree | Workflow runId |
|---------|------|-------|--------|----------|----------------|
| 1.0.0 | lockdown-and-versioning | ✅ shipped (8809d72) | `release/1.0.0-lockdown-and-versioning` | `../clawcamp-worktrees/lockdown-and-versioning` | `wf_daa7adcd-bde` |
| 1.1.0 | chapters-are-real | ✅ shipped (766c70a) | `release/1.1.0-chapters-are-real` | `../clawcamp-worktrees/chapters-are-real` | `wf_a30d2f0f-171` |
| 1.2.0 | structured-content-and-moderation | ✅ shipped (854f8ae) | `release/1.2.0-structured-content-and-moderation` | `../clawcamp-worktrees/structured-content-and-moderation` | `wf_62e3c1c6-bbf` |
| 1.3.0 | rsvp-and-identity | ✅ shipped (b10abed) | `release/1.3.0-rsvp-and-identity` | `../clawcamp-worktrees/rsvp-and-identity` | `wf_5aff7bd6-cc1` |
| 1.4.0 | rbac-and-captains-console | ✅ shipped (0568b73) | `release/1.4.0-rbac-and-captains-console` | `../clawcamp-worktrees/rbac-and-captains-console` | `wf_434e562b-968` |
| 1.5.0 | recaps-and-living-archive | ✅ shipped (369420c) | `release/1.5.0-recaps-and-living-archive` | `../clawcamp-worktrees/recaps-and-living-archive` | `wf_39dcc88e-73d` |
| 2.0.0 | self-running-platform | ✅ shipped (d6b951f) | `release/2.0.0-self-running-platform` | `../clawcamp-worktrees/self-running-platform` | `wf_4706ec00-849` |

State legend: `planned` · `building` · `in-review` · `shipped` · `blocked`

Dependency chain is strict: each release depends on the prior. Only the
lowest unshipped release is ever `building`; the rest stay `planned`.

## Active worktrees

```
git worktree list
```
8 entries: main `master` + 7 `release/*` worktrees under `../clawcamp-worktrees/`.

## How to resume

1. Find the lowest release that is not `shipped`. If it's `building`, check its
   workflow runId (below) via `/workflows`; if the workflow finished, apply its
   output in the release worktree, commit to the branch, open/merge PR, bump
   `VERSION` + `CHANGELOG.md`, mark `shipped`, advance to the next.
2. To (re)build a release: use the reusable builder script
   `docs/orchestration/workflow-scripts/release-builder.js` — pass the release's
   plan-doc path as `args`. It fans out worktree-isolated agents per task slice.
3. Branch naming `release/vX.Y-<slug>`; worktree `../clawcamp-worktrees/<slug>`.

## Workflow runs

| Workflow | runId | script |
|----------|-------|--------|
| PM Council | `wf_3977ba4a-338` | `docs/orchestration/workflow-scripts/pm-council.js` |
| v1.0.0 build | `wf_daa7adcd-bde` | `docs/orchestration/workflow-scripts/release-builder.js` |

## Tick log (orchestrator heartbeat, ~60s)

- t0 — council launched, docs scaffolded, STATUS created, tick scheduled.
- t1 — council in Propose phase (5/11); rescheduled.
- t2 — council DONE. Wrote ROADMAP + 7 plan docs + council record. Created 7
  worktrees/branches, pushed all. Launching v1.0.0 build workflow.
- t3 — v1.0.0 build workflow `wf_daa7adcd-bde` launched (worktree-isolated producers). Rescheduled tick.
- t4 — v1.0.0 build DONE (4 worktree-isolated slices). Applied 11 new files +
  38 edits to release worktree, fixed verifier gap (dashboard config.js include),
  committed 8809d72, merged to master + pushed (DEPLOYED). ⚠️ RLS migration
  0001 still needs server-side apply (see v1.0.0 plan doc). Launching v1.1.0.
- t5 — v1.1.0 build wf_5f6f040c-45d launched, repo arg pointed at the v1.1.0 worktree (lands on the right branch directly). Rescheduled tick.
- t5b — User rename: 'Other Events' → 'Online Events' on /chapters (master, deployed). NOTE for v1.1.0 apply: when chapters becomes data-driven, seed the catch-all row as 'Online Events' (slug online-events), not 'Other Events'.
- t5c — User rename: ClawCamp SF, CA → ClawCamp San Francisco (master, deployed). NOTE for v1.1.0 chapters seed: name the SF row "ClawCamp San Francisco" (slug sf / san-francisco).
- t6 — v1.1.0 build wf_5f6f040c-45d MISFIRED (args.planDoc empty via scriptPath → re-audited v1.0.0). Root-caused, documented in README. Reset worktree, relaunched as wf_a30d2f0f-171 with hardcoded planDoc/repo. Saved release-builder-TEMPLATE.js.
- t7 — v1.1.0 build wf_a30d2f0f-171 DONE+correct. Composed 4 slices, added static chapters fallback (no empty-state regression), resolved chapters merge conflict (took data-driven), restored og-default.png, bumped VERSION 1.1.0 + CHANGELOG, merged to master 766c70a (deployed). Launching v1.2.0.
- t8 — v1.2.0 build wf_92207da7-d12 launched (hardcoded paths, worktree repo). Verifying v1.1.0 chapters live.
- t9 — v1.2.0 build wf_92207da7-d12 FAILED (StructuredOutput overflow on full-file rewrite). Switched to direct-write+manifest pattern (agents Write to worktree, return paths only); relaunched wf_62e3c1c6-bbf. Promoted as canonical TEMPLATE.
- t10 — v1.2.0 build wf_62e3c1c6-bbf DONE (direct-write pattern worked cleanly; no main leakage, no merge conflict). Committed 854f8ae, merged to master, VERSION 1.2.0. Launching v1.3.0.
- t11 — v1.2.0 shipped (76aec98). v1.3.0 build wf_5aff7bd6-cc1 launched (direct-write template). Reschedule.
- t12 — v1.3.0 build wf_5aff7bd6-cc1 DONE (5 slices; agent self-bumped VERSION 1.3.0). Clean merge b10abed. 4/7 shipped. Launching v1.4.0.
- t13 — 4/7 shipped. v1.4.0 build wf_434e562b-968 launched (direct-write template). Reschedule.
- t14 — v1.4.0 build wf_434e562b-968 DONE (4 slices; captains console as modular js/captains-console.{js,css}). Bumped VERSION 1.4.0, merged 0568b73. 5/7 shipped. Launching v1.5.0.
- t15 — 5/7 shipped (v1.4.0 41f546e). v1.5.0 build wf_39dcc88e-73d launched. v2.0.0 is last.
- t16 — v1.5.0 build wf_39dcc88e-73d DONE (5 slices + send-recap function). Merged 369420c, VERSION 1.5.0. 6/7 shipped. Launching FINAL v2.0.0.
- t17 — 6/7 shipped (v1.5.0 369420c). FINAL v2.0.0 build wf_4706ec00-849 launched. On completion: ship + write COMPLETE.md + stop ticking.
- t18 — FINAL v2.0.0 build wf_4706ec00-849 DONE. Kept static event list + chapters fallback (events table RLS-locked, only 2 upcoming — avoided live regression). Shipped d6b951f, VERSION 2.0.0. Wrote COMPLETE.md with server-side apply checklist. 7/7 SHIPPED — orchestration complete, ticking stopped.
- t19 — HOTFIX: Vercel deploys were FAILING since the v2.0.0 merge (package-lock.json + invalid vercel.json //csp key) → site frozen, /events showed only 2 DB events. Fixed with .vercelignore (static-only) + cleaned vercel.json (b3327dc). Also made events/index.html renderEvents additive (was wiping static rows). Deploy now SUCCESS; /events shows 16 upcoming. Goal MET.
