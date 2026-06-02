# ClawCamp Release Orchestration — Master Handoff

> **Purpose:** This document lets any agent (or human) pick up the multi-release
> build for claw.camp exactly where the last agent left off. Read this top to
> bottom before doing anything.

## What is happening here

claw.camp is being built out from its current state (chapters, events, profiles,
submission flow) toward a **v2.0** milestone. The work is decomposed into a
sequence of releases (v1.0 → v2.0). Each release is:

1. **Decided** by a *PM Council* — a panel of project-manager agents with
   distinct "modes" (MVP, Growth, Platform, Community, Risk) who independently
   propose a roadmap, then a synthesizer converges them into a canonical plan.
2. **Documented** as a standalone plan file in `docs/releases/vX.Y-*.md`.
3. **Implemented** by a fan-out Workflow whose agents run in **isolated git
   worktrees** (so parallel releases never collide on the same files).

## Orchestration model

```
                ┌─────────────────────┐
                │   PM COUNCIL (wf)    │  diverse PM modes propose roadmaps
                │  MVP·Growth·Platform │  → synthesizer converges
                │  Community·Risk      │
                └──────────┬──────────┘
                           │ canonical roadmap (v1.0 … v2.0)
                           ▼
        docs/releases/vX.Y-<slug>.md  (one plan per release)
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │  RELEASE WORKFLOWS (one per release)           │
        │  each agent runs in its own worktree           │
        │  isolation: 'worktree'  → no file collisions   │
        └──────────────────────────────────────────────┘
```

## Conventions

- **Branch per release:** `release/vX.Y-<slug>` cut from `master`.
- **Worktree per implementation agent:** the Workflow `agent(..., {isolation:'worktree'})`
  option gives each agent a throwaway worktree; only changed worktrees persist.
- **Plan files are the source of truth.** If a workflow is interrupted, the next
  agent reads `docs/releases/STATUS.md` for the live state and the relevant
  `vX.Y-*.md` for the scope, then resumes.
- **Tick cadence:** the orchestrating agent self-paces with ~30s ticks
  (runtime floor is 60s, so effective cadence is 60s) via ScheduleWakeup, using
  ticks as a heartbeat/fallback while background workflows run.

## Files in this handoff

| File | Role |
|------|------|
| `docs/orchestration/README.md` | This master doc |
| `docs/orchestration/pm-council.md` | Council output: modes, votes, rationale |
| `docs/orchestration/workflow-scripts/` | Saved workflow scripts (council + per-release) |
| `docs/releases/ROADMAP.md` | Canonical v1.0→v2.0 roadmap (council-decided) |
| `docs/releases/STATUS.md` | Live status board — WHAT TO READ FIRST on resume |
| `docs/releases/vX.Y-<slug>.md` | Per-release scope, exit criteria, file list |

## How to resume (for the next agent)

1. Read `docs/releases/STATUS.md` — it lists each release's state
   (`planned` / `in-progress` / `shipped`) and the active worktree/branch.
2. `git worktree list` — see which worktrees exist and on what branch.
3. For any `in-progress` release: open its `docs/releases/vX.Y-*.md`, check the
   "Tasks" checklist, continue the unchecked items.
4. Re-launch its release workflow with `Workflow({scriptPath, resumeFromRunId})`
   if a runId is recorded in STATUS.md, else from the saved script in
   `docs/orchestration/workflow-scripts/`.

## Current state at orchestration start

- Base commit: `e0d1d50` on `master`
- No VERSION / CHANGELOG yet (v1.0 will introduce them)
- Live site: https://claw.camp (Vercel auto-deploys `master`)
- Supabase project: `mrnccntqmkxjazznejfc` (anon key in page sources; RLS-locked
  for writes to most tables; `contacts` + `events` accept inserts)


## ⚠️ Orchestration learnings (avoid these traps)

1. **`args` does NOT reliably propagate through `Workflow({scriptPath, args})`.**
   The v1.1.0 build launched via the shared `release-builder.js` with
   `args.planDoc` came back empty, so the decomposer re-audited the already-shipped
   v1.0.0 files instead of building chapters. **Fix:** hardcode `const planDoc`
   and `const repo` as literals at the top of the script per release. Use
   `release-builder-TEMPLATE.js` and edit the two consts. (Run wf_5f6f040c-45d
   was the misfire; wf_a30d2f0f-171 is the corrected v1.1.0 build.)
2. **Point `repo` at the release WORKTREE, not the main checkout.** The builder's
   producer agents write to the `repo` path directly (in addition to returning
   structured output), so targeting the worktree keeps work on the right branch
   instead of leaking onto `master`.
3. **Sync the release worktree to `master` before building** so it has all prior
   shipped releases as its foundation (`cd <worktree> && git merge master`).
4. **DB migrations are git-only.** The anon key cannot run DDL; every migration
   under `supabase/migrations/` needs an admin to apply it server-side. The
   matching `scripts/*-probe.sh` is the red→green gate proving it landed.

5. **Don't return large file content via StructuredOutput — it overflows and the
   agent fails to call the tool.** The v1.2.0 build (wf_92207da7-d12) died with
   "subagent completed without calling StructuredOutput" when a slice tried to
   return a full-file HTML rewrite as `newFiles[].content`. **Fix (now the
   canonical template):** build agents WRITE FILES DIRECTLY into the worktree
   via Write/Edit using ABSOLUTE paths under the worktree root, and return only
   a small manifest `{slice, summary, filesWritten[], followups[]}`. The
   orchestrator then just `git add -A && commit` in the worktree — no apply step,
   no content in the response. See `release-builder-TEMPLATE.js`. (Drop per-agent
   `isolation:'worktree'` for this pattern so writes land in the real release
   worktree; slices are file-disjoint by the decomposer so they don't collide.)
