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
