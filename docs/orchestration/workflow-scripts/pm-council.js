export const meta = {
  name: 'pm-council-clawcamp',
  description: 'PM council: 5 diverse PM modes propose v1.0→v2.0 roadmaps for claw.camp, then a chief-of-staff synthesizes a canonical release plan',
  phases: [
    { title: 'Propose', detail: '5 PM modes each draft a roadmap to v2' },
    { title: 'Cross-critique', detail: 'each PM critiques the merged set' },
    { title: 'Synthesize', detail: 'chief of staff converges to canonical roadmap' },
  ],
}

const CONTEXT = `
claw.camp is a static site (HTML/CSS/vanilla JS, deployed on Vercel from the
opencolin/clawcamp-site GitHub repo, master branch auto-deploys). It is the
global hub for ClawCamp — a network of local AI-builder community chapters in
the OpenClaw ecosystem. Backend is Supabase (project mrnccntqmkxjazznejfc) with
an anon key embedded client-side; most tables are RLS-locked for writes, but
'contacts' and 'events' accept inserts. Auth is Supabase magic-link.

ALREADY BUILT (current state, do not re-propose):
- /events + /events/index — global event calendar (static rows + Supabase merge)
- /events/detail/?id=N — dynamic event detail page (speakers carousel, schedule,
  sponsors, lifecycle banner upcoming/live/ended)
- /events/clawcamp-june-1 — hand-built rich event page
- /chapters — chapter discovery, search, join modal, start-a-chapter application
- /submit-event — 4-tab event submission (Details/Speakers/Schedule/Sponsors),
  Import-from-Luma, draft to submit-for-review workflow
- /dashboard — profile (photo, @username, bio, links), My Chapters, role badge,
  email prefs
- /sponsors — tiers, inquiry form, dynamic logo grid (appends DB sponsors)
- /speakers — static grid + appends approved speaker applications
- /curriculum — tutorial/workshop library (Supabase-backed + static extras)
- Newsletter subscribe strip in footer; "happening today" live badges; nav
  Chapters link; magic-link redirect fix; SRI-pinned CDN scripts.

KNOWN GAPS / OPPORTUNITIES (raw material for the roadmap, not a mandate):
- No VERSION / CHANGELOG / semantic release process
- Chapters are hardcoded (SF + Other); no real chapters table or per-chapter pages
- No speakers/schedule/sponsors DB tables — submission form stuffs them into
  events.notes as text; detail pages read a static js/event-extras.js registry
- No admin review UI for the draft to submit pipeline (events just get inserted)
- No real RBAC: "captain" role is a cosmetic badge, no permissions
- No per-chapter event filtering, no chapter follow feed
- No event RSVP capture on-site (bounces to Luma)
- No search across events; no map view on /events (homepage has a hero map)
- No recap/archive pages with photos/recordings for past events
- Profile photos are preview-only (no upload to storage)
- No tests, no CI, no Lighthouse/perf budget, no a11y audit
- Import-from-Luma is CORS-limited (cannot fetch cross-origin from browser)
`;

const MODES = [
  { key: 'mvp', label: 'MVP / Ship-Fast PM',
    lens: 'Ruthlessly minimal. Smallest shippable increments, fastest path to user value. Cut anything not load-bearing. Prefer static-first, defer infra.' },
  { key: 'growth', label: 'Growth PM',
    lens: 'Network effects, virality, retention, SEO, shareability. What makes chapters multiply and members return? Referral loops, social proof, notifications.' },
  { key: 'platform', label: 'Platform / Infra PM',
    lens: 'Data model correctness, extensibility, proper tables (chapters/speakers/schedule/sponsors), RLS, an admin/review layer, migration path off the static registry. Pay down tech debt that blocks everything else.' },
  { key: 'community', label: 'Community PM',
    lens: 'Chapter captains and organizers are the customer. Per-chapter pages, organizer tooling, member following, event RSVP on-site, recap/archive, engagement.' },
  { key: 'risk', label: 'Risk / Quality PM',
    lens: 'Security (RLS, secrets, XSS), reliability, accessibility, performance budgets, tests, CI, semantic versioning. What breaks at scale or embarrasses us?' },
];

const ROADMAP_SCHEMA = {
  type: 'object',
  required: ['mode', 'releases'],
  properties: {
    mode: { type: 'string' },
    headline: { type: 'string', description: 'one-line thesis for this PM mode' },
    releases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['version', 'name', 'theme', 'features'],
        properties: {
          version: { type: 'string', description: 'e.g. v1.0, v1.1, v2.0' },
          name: { type: 'string' },
          theme: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          exit_criteria: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
        },
      },
    },
  },
};

phase('Propose');
const proposals = await parallel(MODES.map(m => () =>
  agent(
    `You are the ${m.label} on the ClawCamp PM council.\n\nYOUR LENS: ${m.lens}\n\n${CONTEXT}\n\n` +
    `Propose a release roadmap from v1.0 through v2.0 (inclusive) for claw.camp, seen entirely through YOUR lens. ` +
    `Use semantic versions (v1.0, v1.1, ... v2.0). v2.0 should represent a meaningful milestone (the site is "done" in your worldview). ` +
    `Aim for 4-7 releases total. For each release give version, name, theme, a concrete feature list (specific to this codebase — name pages/tables/files), exit criteria, and rationale. ` +
    `Be opinionated and distinct — do not hedge toward consensus, argue YOUR mode's priorities.`,
    { label: `propose:${m.key}`, phase: 'Propose', schema: ROADMAP_SCHEMA }
  ).then(r => ({ ...r, mode: m.key, modeLabel: m.label }))
)).then(rs => rs.filter(Boolean));

log(`Collected ${proposals.length} roadmap proposals from PM modes`);

phase('Cross-critique');
const proposalsDigest = proposals.map(p =>
  `### ${p.modeLabel} — "${p.headline || ''}"\n` +
  p.releases.map(r => `- ${r.version} ${r.name}: ${r.theme} [${(r.features||[]).slice(0,5).join('; ')}]`).join('\n')
).join('\n\n');

const CRITIQUE_SCHEMA = {
  type: 'object',
  required: ['mode', 'agreements', 'objections', 'must_keep', 'sequencing_notes'],
  properties: {
    mode: { type: 'string' },
    agreements: { type: 'array', items: { type: 'string' } },
    objections: { type: 'array', items: { type: 'string' }, description: 'where other modes are wrong or risky' },
    must_keep: { type: 'array', items: { type: 'string' }, description: 'non-negotiables from your mode' },
    sequencing_notes: { type: 'string', description: 'what must ship before what, and why' },
  },
};

const critiques = await parallel(MODES.map(m => () =>
  agent(
    `You are the ${m.label} on the ClawCamp PM council. Here are ALL five council members' roadmap proposals:\n\n${proposalsDigest}\n\n` +
    `Critique the full set FROM YOUR LENS (${m.lens}). What do you agree with? Where are other modes wrong or creating risk? ` +
    `What from your mode is NON-NEGOTIABLE for v1.0 through v2.0? What sequencing constraints exist (X must ship before Y)? Be specific and concrete.`,
    { label: `critique:${m.key}`, phase: 'Cross-critique', schema: CRITIQUE_SCHEMA }
  ).then(r => ({ ...r, mode: m.key, modeLabel: m.label }))
)).then(rs => rs.filter(Boolean));

log(`Collected ${critiques.length} cross-critiques`);

phase('Synthesize');
const critiqueDigest = critiques.map(c =>
  `### ${c.modeLabel}\nMUST-KEEP: ${(c.must_keep||[]).join('; ')}\nOBJECTIONS: ${(c.objections||[]).join('; ')}\nSEQUENCING: ${c.sequencing_notes||''}`
).join('\n\n');

const CANONICAL_SCHEMA = {
  type: 'object',
  required: ['summary', 'releases'],
  properties: {
    summary: { type: 'string', description: 'the converged thesis for v1.0 to v2.0' },
    releases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['version', 'slug', 'name', 'theme', 'features', 'exit_criteria', 'files', 'depends_on', 'effort'],
        properties: {
          version: { type: 'string' },
          slug: { type: 'string', description: 'kebab-case, used for branch + doc filename, e.g. data-model' },
          name: { type: 'string' },
          theme: { type: 'string' },
          features: { type: 'array', items: { type: 'string' }, description: 'concrete, codebase-specific tasks naming pages/tables/files' },
          exit_criteria: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' }, description: 'paths likely created or modified' },
          depends_on: { type: 'array', items: { type: 'string' }, description: 'versions that must ship first' },
          effort: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
          council_notes: { type: 'string', description: 'how council tension was resolved for this release' },
        },
      },
    },
  },
};

const canonical = await agent(
  `You are the Chief of Staff to the ClawCamp PM council. Converge the five proposals and five critiques into ONE canonical release roadmap, v1.0 through v2.0.\n\n` +
  `${CONTEXT}\n\nPROPOSALS:\n${proposalsDigest}\n\nCRITIQUES:\n${critiqueDigest}\n\n` +
  `Produce 5-7 sequenced releases. Rules:\n` +
  `- v1.0 MUST establish versioning hygiene (VERSION + CHANGELOG + semver) since none exists.\n` +
  `- Honor the Platform PM's sequencing: real DB tables (chapters/speakers/schedule/sponsors) and an admin/review layer must come before features that depend on them.\n` +
  `- Honor the Risk PM's non-negotiables on security/a11y/perf — fold them in as exit criteria, not a deferred release.\n` +
  `- Each release must be independently shippable to master and deployable.\n` +
  `- v2.0 is the milestone where ClawCamp is a real multi-chapter platform (not hardcoded).\n` +
  `- For each release give: version, slug (kebab-case for branch/doc), name, theme, concrete codebase-specific features, exit criteria, likely files, depends_on, effort (S/M/L/XL), and council_notes explaining how you resolved disagreement.\n` +
  `Order releases by dependency so they can be implemented in sequence.`,
  { label: 'synthesize:chief-of-staff', phase: 'Synthesize', schema: CANONICAL_SCHEMA }
);

return {
  proposals: proposals.map(p => ({ mode: p.mode, modeLabel: p.modeLabel, headline: p.headline, releases: p.releases })),
  critiques,
  canonical,
};
