# Release Status Board — READ THIS FIRST ON RESUME

> Live state of the v1.0→v2.0 orchestration. Update this file whenever a release
> changes state. Any agent resuming the work starts here.

_Last updated: orchestration kickoff (base commit `e0d1d50`, branch `master`)._

## Orchestration phase

| Stage | State | Detail |
|-------|-------|--------|
| PM Council | 🟡 running | Workflow `wf_3977ba4a-338` (background). Decides v1.0→v2.0 roadmap. Script: `docs/orchestration/workflow-scripts/pm-council.js` |
| Roadmap doc | ⏳ pending council | Will be written to `docs/releases/ROADMAP.md` |
| Per-release plans | ⏳ pending roadmap | `docs/releases/vX.Y-<slug>.md` |
| Release workflows | ⏳ pending plans | One worktree-isolated Workflow per release |

## Releases (filled once the council reports)

| Version | Slug | State | Branch | Worktree | Workflow runId |
|---------|------|-------|--------|----------|----------------|
| _(awaiting council)_ | | | | | |

State legend: `planned` · `in-progress` · `in-review` · `shipped` · `blocked`

## Active worktrees

Run `git worktree list`. At kickoff: only the main checkout
`/Users/colin/Code/clawcamp` on `master`.

## How to resume

1. If PM Council still running: `/workflows` to watch, or wait for the
   completion notification. Its result contains `canonical.releases[]`.
2. Once council is done: ROADMAP.md + per-release plan files are written; the
   table above is populated. Pick the first `planned` release whose `depends_on`
   are all `shipped` and launch its release workflow.
3. Release workflows isolate each implementation agent in its own git worktree
   (`isolation: 'worktree'`). Branch naming: `release/vX.Y-<slug>`.

## Tick log (orchestrator heartbeat)

- t0 — council launched, docs scaffolded, STATUS board created, tick scheduled.
