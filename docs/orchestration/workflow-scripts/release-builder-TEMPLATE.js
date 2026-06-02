export const meta = {
  name: 'release-builder-v1.1.0',
  description: 'Build ClawCamp v1.1.0 (chapters-are-real) from its plan doc: decompose, fan out worktree-isolated producers, verify',
  phases: [
    { title: 'Decompose', detail: 'split the release plan into buildable slices' },
    { title: 'Build', detail: 'one worktree-isolated agent produces each slice' },
    { title: 'Verify', detail: 'check produced output against exit criteria' },
  ],
}

// Hardcoded (args does not propagate reliably through scriptPath launches).
const planDoc = '/Users/colin/Code/clawcamp/docs/releases/1.1.0-chapters-are-real.md';
const repo = '/Users/colin/Code/clawcamp-worktrees/chapters-are-real';

phase('Decompose');
const DECOMP_SCHEMA = {
  type: 'object', required: ['slices'],
  properties: { slices: { type: 'array', items: {
    type: 'object', required: ['key','title','instructions','files'],
    properties: {
      key: { type: 'string' }, title: { type: 'string' },
      instructions: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
    } } } },
};
const decomp = await agent(
  `Read the ClawCamp release plan at ${planDoc} (run: cat "${planDoc}"). This is release v1.1.0 "chapters-are-real". Also inspect the repo at ${repo} (it already contains shipped v1.0.0 — chapters/index.html is currently hardcoded with two cards: "ClawCamp San Francisco" and "Online Events"). ` +
  `Decompose THIS v1.1.0 plan (NOT v1.0.0 — v1.0.0 is already shipped) into 3-5 file-disjoint build slices. The work is: a chapters data table + seed, a real chapter_id FK on events, rewriting chapters/index.html to render from data, per-chapter pages at /chapters/?slug=X, a chapter filter on /events, and a .github/workflows/ci.yml gate running scripts/rls-probe.sh + smoke.sh. ` +
  `For each slice: kebab key, title, precise instructions naming exact files/paths, and the files it owns. Slices MUST be file-disjoint.`,
  { label: 'decompose', phase: 'Decompose', schema: DECOMP_SCHEMA }
);
log(`v1.1.0 decomposed into ${decomp.slices.length} slices: ${decomp.slices.map(s=>s.key).join(', ')}`);

phase('Build');
const BUILD_SCHEMA = {
  type: 'object', required: ['slice','newFiles','edits','commands','summary'],
  properties: {
    slice: { type: 'string' }, summary: { type: 'string' },
    newFiles: { type: 'array', items: { type: 'object', required: ['path','content'],
      properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    edits: { type: 'array', items: { type: 'object', required: ['path','oldString','newString'],
      properties: { path: { type: 'string' }, oldString: { type: 'string' }, newString: { type: 'string' }, note: { type: 'string' } } } },
    commands: { type: 'array', items: { type: 'string' } },
  },
};
const built = await parallel(decomp.slices.map(s => () =>
  agent(
    `You are implementing ONE slice of ClawCamp release v1.1.0 (chapters-are-real). Repo root: ${repo} (read exact current file content with cat before writing string edits — they must match byte-for-byte). ` +
    `SLICE: ${s.title}\nFILES YOU OWN: ${(s.files||[]).join(', ')}\n\nINSTRUCTIONS:\n${s.instructions}\n\n` +
    `IMPORTANT CONTEXT: v1.0.0 is already shipped (RLS migration, js/config.js, VERSION, etc. all exist). Do NOT redo v1.0.0 work. Build ONLY this v1.1.0 slice. ` +
    `When seeding chapters data, the two existing chapters are "ClawCamp San Francisco" (slug: san-francisco, city: San Francisco) and "Online Events" (slug: online-events, virtual). ` +
    `Supabase is RLS-locked; any new table needs a migration file under supabase/migrations/ (admin applies it — anon cannot run DDL), plus client code that reads via the anon key. Mirror scripts/rls-probe.sh for any new insert-only table. ` +
    `Produce: newFiles (full content), edits (exact unique oldString→newString on existing files), commands (idempotent shell: mkdir -p, chmod +x). Vanilla HTML/CSS/JS, no build step. Match existing style. Do NOT touch files outside your slice.`,
    { label: `build:${s.key}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }
  ).then(r => ({ ...r, sliceKey: s.key })).catch(() => null)
)).then(rs => rs.filter(Boolean));
log(`Built ${built.length}/${decomp.slices.length} v1.1.0 slices`);

phase('Verify');
const VERIFY_SCHEMA = {
  type: 'object', required: ['verdict','gaps'],
  properties: { verdict: { type: 'string', enum: ['complete','partial','insufficient'] },
    gaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
};
const manifest = built.map(b =>
  `## ${b.sliceKey} — ${b.summary}\nnew: ${(b.newFiles||[]).map(f=>f.path).join(', ')||'(none)'}\nedits: ${(b.edits||[]).map(e=>e.path).join(', ')||'(none)'}\ncmds: ${(b.commands||[]).join(' && ')||'(none)'}`
).join('\n\n');
const verify = await agent(
  `Read the v1.1.0 exit criteria at ${planDoc} (cat it). Produced output:\n\n${manifest}\n\nWould this, once applied, satisfy the exit criteria? List specific gaps. Be skeptical — confirm this is chapters-are-real work, not v1.0.0 re-audit.`,
  { label: 'verify', phase: 'Verify', schema: VERIFY_SCHEMA }
);
return { release: '1.1.0', planDoc, repo, slices: decomp.slices.map(s=>s.key), built, verify };
