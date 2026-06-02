#!/usr/bin/env node
/**
 * build-sitemap.js — zero-dependency sitemap generator for claw.camp.
 *
 * Run at commit time (NOT a runtime build step):
 *
 *     node scripts/build-sitemap.js
 *
 * Emits ./sitemap.xml at the repo root listing:
 *   - the core public pages,
 *   - every hand-built static event page (any subdirectory of events/ that
 *     contains an index.html), excluding the dynamic events/detail template,
 *   - and every APPROVED dynamic event as /events/detail?id=<id>, fetched
 *     live from Supabase via the public anon key (status=eq.approved).
 *
 * The approved-only filter is also enforced server-side by RLS, so requesting
 * status=eq.approved here is defense-in-depth: a freshly submitted (unapproved)
 * event is never advertised. The fetch is best-effort — on any network/HTTP
 * failure we log a warning and still emit the static sitemap, so a flaky
 * network can never crash the commit-time build.
 *
 * RECAP PAGES (v1.5 — "feed recap pages into the sitemap automatically ... for
 * heavy internal linking / SEO authority flow"): a recap page is NOT a new URL —
 * it IS the same /events/detail?id=<id> page once the event is past and carries
 * recap content. So those URLs are already emitted (every approved event is). To
 * give recaps the SEO weight the plan wants, we widen the events select to also
 * read event_date + recap_url + recap_photos_url and RAISE the <priority> on a
 * row that is past-dated AND has a recap (recap_url set OR a non-empty
 * recap_photos_url array) to RECAP_PRIORITY; every other URL keeps the implicit
 * default (no <priority> emitted, which a crawler treats as 0.5). The recap
 * columns may not exist yet (added by a later migration); reading them is still
 * best-effort — if PostgREST rejects the wider select (e.g. unknown column ->
 * non-2xx) we fall back to the static sitemap exactly like any other fetch
 * failure, so the commit-time build never crashes.
 *
 * cleanUrls is enabled in vercel.json, so paths are emitted extensionless
 * (e.g. /events, /events/oakland) with no trailing slash.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://claw.camp';
const REPO_ROOT = path.resolve(__dirname, '..');
const EVENTS_DIR = path.join(REPO_ROOT, 'events');
const OUTPUT = path.join(REPO_ROOT, 'sitemap.xml');

// Public Supabase connection. Defaults match the prod public values used by
// scripts/rls-probe.sh; both are overridable via env. The anon key is PUBLIC
// by design (it ships in the browser bundle).
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://mrnccntqmkxjazznejfc.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI';

// Dynamic templates that should never be advertised in the sitemap.
const EXCLUDED_EVENT_SLUGS = new Set(['detail']);

// SEO weight for a past event that carries a living recap. Above the implicit
// default (0.5) so recap pages get the internal-linking authority the plan asks
// for; every other URL omits <priority> and inherits the crawler default.
const RECAP_PRIORITY = '0.8';

// Core public, crawlable pages (extensionless, cleanUrls on).
const CORE_PATHS = [
  '/',
  '/events',
  '/chapters',
  '/curriculum',
  '/speakers',
  '/sponsors',
];

/**
 * Enumerate the hand-built static event pages: subdirectories of events/
 * that contain an index.html, excluding the dynamic detail template.
 * Returns extensionless paths like "/events/oakland", sorted for stable output.
 */
function discoverEventPaths() {
  let entries;
  try {
    entries = fs.readdirSync(EVENTS_DIR, { withFileTypes: true });
  } catch (err) {
    console.error('Could not read events directory: ' + err.message);
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => !EXCLUDED_EVENT_SLUGS.has(slug))
    .filter((slug) => fs.existsSync(path.join(EVENTS_DIR, slug, 'index.html')))
    .sort()
    .map((slug) => '/events/' + slug);
}

/**
 * True iff `row` is a past-dated event carrying recap content: a recap_url
 * (any non-empty string) OR a non-empty recap_photos_url array. The recap
 * columns are optional (a later migration adds them); an absent column reads as
 * undefined here and simply yields false, so this degrades gracefully.
 * event_date is the same `YYYY-MM-DD` string the detail page compares
 * lexically against "today" (ev.event_date < todayStr), so we mirror that.
 */
function rowHasRecap(row, todayStr) {
  if (!row || typeof row.event_date !== 'string' || row.event_date >= todayStr) {
    return false;
  }
  const hasUrl =
    typeof row.recap_url === 'string' && row.recap_url.trim() !== '';
  const hasPhotos =
    Array.isArray(row.recap_photos_url) && row.recap_photos_url.length > 0;
  return hasUrl || hasPhotos;
}

/**
 * Fetch APPROVED dynamic events from Supabase and return their detail-page
 * sitemap entries — objects of the shape { path, priority? } where path looks
 * like "/events/detail?id=173". Uses the public anon key and the approved-only
 * RLS-gated table; the explicit status=eq.approved filter is defense-in-depth
 * so a non-approved row can never be advertised even if RLS were ever loosened.
 *
 * Recap weighting: the select is widened to event_date + recap_url +
 * recap_photos_url so a past-dated row WITH a recap is emitted at
 * RECAP_PRIORITY (heavier SEO authority for the living-recap pages); every
 * other approved event is still emitted, just with no explicit priority. The
 * recap columns may not exist yet — if PostgREST rejects the wider select it
 * surfaces as a non-2xx and falls through the best-effort path below.
 *
 * Best-effort: on any failure (no fetch, network error, non-2xx, malformed
 * body) we log a warning and return [] so the commit-time build still emits the
 * static sitemap rather than crashing.
 */
async function fetchApprovedEventPaths() {
  if (typeof fetch !== 'function') {
    console.warn(
      'WARN: global fetch unavailable (needs Node 18+); skipping dynamic events.'
    );
    return [];
  }

  const url =
    SUPABASE_URL +
    '/rest/v1/events?select=id,name,status,event_date,recap_url,recap_photos_url&status=eq.approved';

  let rows;
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      },
    });
    if (!resp.ok) {
      console.warn(
        'WARN: Supabase returned HTTP ' +
          resp.status +
          ' fetching approved events; emitting static sitemap only.'
      );
      return [];
    }
    rows = await resp.json();
  } catch (err) {
    console.warn(
      'WARN: could not fetch approved events (' +
        err.message +
        '); emitting static sitemap only.'
    );
    return [];
  }

  if (!Array.isArray(rows)) {
    console.warn(
      'WARN: unexpected response shape for approved events; emitting static sitemap only.'
    );
    return [];
  }

  // event_date strings are compared lexically against today (same YYYY-MM-DD
  // shape the detail page uses) to decide which approved rows are recap pages.
  const todayStr = new Date().toISOString().slice(0, 10);

  // Never advertise a non-approved row, even if the API ever returned one.
  return rows
    .filter((row) => row && row.status === 'approved' && row.id != null)
    .sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    )
    .map((row) => {
      const entry = { path: '/events/detail?id=' + encodeURIComponent(row.id) };
      if (rowHasRecap(row, todayStr)) entry.priority = RECAP_PRIORITY;
      return entry;
    });
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build the sitemap XML from an array of entries. An entry is either a bare
 * path string ("/events") or an object { path, priority? }; a priority, when
 * present, emits an optional <priority> element (recap pages use this for extra
 * SEO weight). All other URLs omit <priority> and inherit the crawler default.
 */
function buildSitemap(entries) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = entries
    .map((entry) => {
      const p = typeof entry === 'string' ? entry : entry.path;
      const priority = typeof entry === 'string' ? undefined : entry.priority;
      const loc = xmlEscape(BASE_URL + (p === '/' ? '' : p));
      return (
        '  <url>\n' +
        '    <loc>' + loc + '</loc>\n' +
        '    <lastmod>' + lastmod + '</lastmod>\n' +
        (priority
          ? '    <priority>' + xmlEscape(String(priority)) + '</priority>\n'
          : '') +
        '  </url>'
      );
    })
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    '\n</urlset>\n'
  );
}

async function main() {
  const dynamicEntries = await fetchApprovedEventPaths();
  // CORE_PATHS + static event pages are bare strings; dynamic events are
  // { path, priority? } entries so recap pages can carry a higher priority.
  const entries = CORE_PATHS.concat(discoverEventPaths(), dynamicEntries);
  const xml = buildSitemap(entries);
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  const recapCount = dynamicEntries.filter((e) => e && e.priority).length;
  console.log(
    'Wrote ' + path.relative(REPO_ROOT, OUTPUT) + ' with ' + entries.length +
      ' URLs (' + recapCount + ' recap page(s) at priority ' + RECAP_PRIORITY + '):'
  );
  entries.forEach((e) => {
    const p = typeof e === 'string' ? e : e.path;
    const tag = typeof e === 'string' || !e.priority ? '' : '  [priority ' + e.priority + ']';
    console.log('  ' + p + tag);
  });
}

main().catch((err) => {
  // A failure here should never silently corrupt the commit; surface it.
  console.error('build-sitemap failed: ' + err.message);
  process.exitCode = 1;
});
