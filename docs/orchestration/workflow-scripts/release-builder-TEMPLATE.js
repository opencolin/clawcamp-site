export const meta = {
  name: 'release-builder-v1.2.0-direct',
  description: 'Build ClawCamp v1.2.0 (structured-content-and-moderation): agents write files directly to the worktree, return manifest only (avoids large-structured-output failures)',
  phases: [
    { title: 'Decompose', detail: 'split plan into file-disjoint slices' },
    { title: 'Build', detail: 'each agent writes its slice files directly into the worktree' },
    { title: 'Verify', detail: 'check the worktree diff against exit criteria' },
  ],
}
const repo = '/Users/colin/Code/clawcamp-worktrees/structured-content-and-moderation';
const planDoc = '/Users/colin/Code/clawcamp/docs/releases/1.2.0-structured-content-and-moderation.md';

phase('Decompose');
const DECOMP_SCHEMA = { type:'object', required:['slices'], properties:{ slices:{ type:'array', items:{
  type:'object', required:['key','title','instructions','files'],
  properties:{ key:{type:'string'}, title:{type:'string'}, instructions:{type:'string'}, files:{type:'array',items:{type:'string'}} } } } } };
const decomp = await agent(
  `Read the ClawCamp release plan at ${planDoc} (run: cat "${planDoc}"). Release v1.2.0 "structured-content-and-moderation". Repo: ${repo} (shipped v1.0.0 lockdown + v1.1.0 chapters; migrations 0001+0002 exist; submit-event/index.html stuffs speakers/schedule/sponsors into events.notes; events/detail/index.html reads window.EVENT_EXTRAS from js/event-extras.js). ` +
  `Decompose into 3-5 FILE-DISJOINT slices. Scope: events.status enum migration + event_speakers/event_schedule/event_sponsors tables (migration 0003); rewrite submit-event saveEvent to insert child rows; rewrite events/detail to read those tables first then fall back to EVENT_EXTRAS; backfill id-173; thin /admin review page (auth + admin allowlist) to approve submitted events; public /events + detail filter to status=approved; per-event OG/JSON-LD; Playwright stored-XSS test. ` +
  `Each slice: kebab key, title, precise instructions naming exact paths, files owned. Slices MUST be file-disjoint. Do NOT redo v1.0.0/v1.1.0.`,
  { label:'decompose', phase:'Decompose', schema: DECOMP_SCHEMA });
log(`v1.2.0 slices: ${decomp.slices.map(s=>s.key).join(', ')}`);

phase('Build');
// Manifest-only schema — NO file content in the response (avoids overflow).
const MANIFEST_SCHEMA = { type:'object', required:['slice','filesWritten','summary'], properties:{
  slice:{type:'string'}, summary:{type:'string', description:'what was built'},
  filesWritten:{type:'array', items:{type:'string'}, description:'repo-relative paths created or modified'},
  followups:{type:'array', items:{type:'string'}, description:'anything left for the orchestrator (e.g. migration must be applied server-side)'} } };
const built = await parallel(decomp.slices.map(s => () =>
  agent(
    `Implement ONE slice of ClawCamp v1.2.0 by WRITING FILES DIRECTLY into the worktree. The worktree repo root is ${repo}. Use the Write/Edit tools with ABSOLUTE paths under ${repo}/ for every file you create or change (e.g. ${repo}/supabase/migrations/0003_*.sql). Read existing files first with Read to match style. ` +
    `SLICE: ${s.title}\nFILES YOU OWN: ${(s.files||[]).join(', ')}\n\nINSTRUCTIONS:\n${s.instructions}\n\n` +
    `CONTEXT: v1.0.0 + v1.1.0 shipped. New tables need a migration under ${repo}/supabase/migrations/ (admin applies server-side; anon cannot run DDL) + client read paths via the anon key + an rls-probe mirroring scripts/rls-probe.sh. ALWAYS keep a graceful fallback so pages don't regress before migrations apply (detail page reads new tables, falls back to js/event-extras.js; lists fall back if status column absent). Render ALL user-supplied content as inert text via textContent/createElement — NEVER innerHTML with user data (stored-XSS). Decode HTML entities. Vanilla HTML/CSS/JS, no build step. Match existing style. Touch ONLY your slice's files. ` +
    `Do NOT paste file contents back to me. After writing, return ONLY: slice, a one-paragraph summary, filesWritten (the repo-relative paths you created/modified), and followups. Keep the response small.`,
    { label:`build:${s.key}`, phase:'Build', schema: MANIFEST_SCHEMA }
  ).then(r=>({...r,sliceKey:s.key})).catch(e=>({sliceKey:s.key, error:String(e), filesWritten:[], summary:'FAILED'}))
)).then(rs=>rs.filter(Boolean));
log(`Build slices done: ${built.map(b=>b.sliceKey+(b.error?'(ERR)':'')).join(', ')}`);

phase('Verify');
const VERIFY_SCHEMA = { type:'object', required:['verdict','gaps'], properties:{ verdict:{type:'string',enum:['complete','partial','insufficient']}, gaps:{type:'array',items:{type:'string'}}, notes:{type:'string'} } };
const verify = await agent(
  `Read v1.2.0 exit criteria at ${planDoc} (cat it). Inspect the actual worktree diff: run \`cd ${repo} && git status --short && git diff --stat\` and read key changed files. Judge whether the work on disk satisfies the exit criteria. List specific gaps. Confirm: structured-content+moderation work is present (migration 0003 with event_speakers/schedule/sponsors + events.status; submit-event inserts child rows; detail reads tables w/ EVENT_EXTRAS fallback; /admin review page; status=approved filter; XSS-safe rendering).`,
  { label:'verify', phase:'Verify', schema: VERIFY_SCHEMA });
return { release:'1.2.0', repo, slices: decomp.slices.map(s=>s.key), built, verify };
