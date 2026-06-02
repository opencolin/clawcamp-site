#!/usr/bin/env node
/**
 * build-sitemap.js — zero-dependency sitemap generator for claw.camp.
 *
 * Run at commit time (NOT a runtime build step):
 *
 *     node scripts/build-sitemap.js
 *
 * Emits ./sitemap.xml at the repo root listing the core public pages plus
 * every hand-built static event page (any subdirectory of events/ that
 * contains an index.html), excluding the dynamic events/detail template.
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

function main() {
  const paths = CORE_PATHS.concat(discoverEventPaths());
  const xml = buildSitemap(paths);
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(
    'Wrote ' + path.relative(REPO_ROOT, OUTPUT) + ' with ' + paths.length + ' URLs:'
  );
  paths.forEach((p) => console.log('  ' + p));
}

main();
