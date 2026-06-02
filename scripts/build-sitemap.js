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
 * Fetch APPROVED dynamic events from Supabase and return their detail-page
 * paths, e.g. "/events/detail?id=173". Uses the public anon key and the
 * approved-only RLS-gated table; the explicit status=eq.approved filter is
 * defense-in-depth so a non-approved row can never be advertised even if RLS
 * were ever loosened. Best-effort: on any failure (no fetch, network error,
 * non-2xx, malformed body) we log a warning and return [] so the commit-time
 * build still emits the static sitemap rather than crashing.
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
    '/rest/v1/events?select=id,name,status&status=eq.approved';

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

  // Never advertise a non-approved row, even if the API ever returned one.
  return rows
    .filter((row) => row && row.status === 'approved' && row.id != null)
    .map((row) => row.id)
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map((id) => '/events/detail?id=' + encodeURIComponent(id));
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSitemap(paths) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map((p) => {
      const loc = xmlEscape(BASE_URL + (p === '/' ? '' : p));
      return (
        '  <url>\n' +
        '    <loc>' + loc + '</loc>\n' +
        '    <lastmod>' + lastmod + '</lastmod>\n' +
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
  const dynamicPaths = await fetchApprovedEventPaths();
  const paths = CORE_PATHS.concat(discoverEventPaths(), dynamicPaths);
  const xml = buildSitemap(paths);
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(
    'Wrote ' + path.relative(REPO_ROOT, OUTPUT) + ' with ' + paths.length + ' URLs:'
  );
  paths.forEach((p) => console.log('  ' + p));
}

main().catch((err) => {
  // A failure here should never silently corrupt the commit; surface it.
  console.error('build-sitemap failed: ' + err.message);
  process.exitCode = 1;
});
