// Reusable release-builder workflow.
// args = { planDoc: "<absolute path to docs/releases/vX.Y-slug.md>", repo: "<repo root>" }
// Fans out worktree-isolated implementation agents — one per task slice from the
// plan doc — each returning concrete file outputs (new files, string edits, and
// shell commands). A verifier checks the slice against the plan's exit criteria.
// The orchestrator applies the returned outputs onto the release branch/worktree.

export const meta = {
  name: 'release-builder',
  description: 'Build one ClawCamp release from its plan doc: decompose into slices, fan out worktree-isolated producers, verify against exit criteria',
  phases: [
    { title: 'Decompose', detail: 'split the release plan into buildable slices' },
    { title: 'Build', detail: 'one worktree-isolated agent produces each slice' },
    { title: 'Verify', detail: 'check produced output against exit criteria' },
  ],
}

const planDoc = (args && args.planDoc) || '';
const repo = (args && args.repo) || '/Users/colin/Code/clawcamp';

phase('Decompose');
const DECOMP_SCHEMA = {
  type: 'object',
  required: ['slices'],
  properties: {
    slices: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'title', 'instructions', 'files'],
        properties: {
          key: { type: 'string', description: 'kebab-case slice id' },
          title: { type: 'string' },
          instructions: { type: 'string', description: 'precise build instructions for this slice' },
          files: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const decomp = await agent(
  `Read the ClawCamp release plan at ${planDoc} (use: cat "${planDoc}"). Also inspect the repo at ${repo} as needed for accuracy. ` +
  `Decompose this release into 3-6 independent build SLICES that can each be produced by one engineer without colliding on the same files. ` +
  `Group related tasks (e.g. all security/RLS work in one slice, all versioning/config in another, all SEO/meta in another, all cleanup in another). ` +
  `For each slice: a kebab key, a title, precise build instructions naming exact files/paths and the exact changes, and the list of files it owns. ` +
  `Slices MUST be file-disjoint (no two slices edit the same file) so they can run in parallel.`,
  { label: 'decompose', phase: 'Decompose', schema: DECOMP_SCHEMA }
);

log(`Decomposed into ${decomp.slices.length} build slices: ${decomp.slices.map(s => s.key).join(', ')}`);

phase('Build');
const BUILD_SCHEMA = {
  type: 'object',
  required: ['slice', 'newFiles', 'edits', 'commands', 'summary'],
  properties: {
    slice: { type: 'string' },
    summary: { type: 'string' },
    newFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: { type: 'string', description: 'repo-relative path' },
          content: { type: 'string', description: 'FULL file content' },
        },
      },
    },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'oldString', 'newString'],
        properties: {
          path: { type: 'string', description: 'repo-relative path of existing file' },
          oldString: { type: 'string', description: 'exact unique substring to replace' },
          newString: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    commands: {
      type: 'array',
      items: { type: 'string' },
      description: 'shell commands to run from repo root (e.g. mkdir -p, git mv). Must be idempotent and safe.',
    },
  },
};

const built = await parallel(decomp.slices.map(s => () =>
  agent(
    `You are implementing ONE slice of a ClawCamp release. The repo root is ${repo} (read any file you need with cat/Read for exact current content — your string edits must match byte-for-byte). ` +
    `SLICE: ${s.title}\nFILES YOU OWN: ${(s.files||[]).join(', ')}\n\nINSTRUCTIONS:\n${s.instructions}\n\n` +
    `Produce the complete implementation as structured output:\n` +
    `- newFiles: brand-new files with FULL content.\n` +
    `- edits: changes to existing files as exact oldString→newString replacements. oldString MUST be a unique, exact substring of the current file (read it first to get it right). Keep oldString minimal but unambiguous.\n` +
    `- commands: any shell ops (mkdir -p, git mv, chmod +x) needed, idempotent, run from repo root.\n` +
    `Vanilla HTML/CSS/JS only — no build step, no frameworks. Match existing code style. Do NOT touch files outside your slice. Do NOT include secrets beyond the already-public anon key pattern.`,
    { label: `build:${s.key}`, phase: 'Build', schema: BUILD_SCHEMA, isolation: 'worktree' }
  ).then(r => ({ ...r, sliceKey: s.key })).catch(() => null)
)).then(rs => rs.filter(Boolean));

log(`Built ${built.length}/${decomp.slices.length} slices`);

phase('Verify');
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['verdict', 'gaps'],
  properties: {
    verdict: { type: 'string', enum: ['complete', 'partial', 'insufficient'] },
    gaps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

const manifest = built.map(b =>
  `## slice ${b.sliceKey} — ${b.summary}\n` +
  `newFiles: ${(b.newFiles||[]).map(f => f.path).join(', ') || '(none)'}\n` +
  `edits: ${(b.edits||[]).map(e => e.path).join(', ') || '(none)'}\n` +
  `commands: ${(b.commands||[]).join(' && ') || '(none)'}`
).join('\n\n');

const verify = await agent(
  `Read the release plan's exit criteria at ${planDoc} (cat it). Here is what the build slices produced:\n\n${manifest}\n\n` +
  `Judge whether the produced output, once applied, would satisfy the plan's exit criteria. List any gaps (criteria not covered by any slice). Be specific and skeptical.`,
  { label: 'verify', phase: 'Verify', schema: VERIFY_SCHEMA }
);

return { planDoc, slices: decomp.slices.map(s => s.key), built, verify };
