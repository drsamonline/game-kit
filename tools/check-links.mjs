#!/usr/bin/env node
/* tools/check-links.mjs — every local href and src in the HTML actually exists.
 *
 * The smoke test checks images at runtime; this checks every reference
 * statically, including the ones a browser only asks for when you click them.
 *
 *   node tools/check-links.mjs            # the pages in this repo
 *   node tools/check-links.mjs <dir>      # any static site
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// A page is a whole document. Fragments that get concatenated at build time
// (eon-commando's src/*.html) resolve their paths against the built output, not
// against where they sit, so checking them here produces false positives.
const allHtml = walk(ROOT);
const pages = allHtml.filter((p) => /<!DOCTYPE|<html/i.test(fs.readFileSync(p, 'utf8')));
const skipped = allHtml.length - pages.length;

// where the site is actually served from, when the repo says so
let siteRoot = ROOT;
const pagesCfg = path.join(ROOT, 'PAGES.json');
if (fs.existsSync(pagesCfg)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(pagesCfg, 'utf8'));
    const dir = cfg.source && cfg.source.path ? cfg.source.path.replace(/^\//, '') : '';
    if (dir) siteRoot = path.join(ROOT, dir);
  } catch (e) { /* a broken PAGES.json is check-pages.mjs's problem */ }
}
const bad = [];
let checked = 0;

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const refs = [
    ...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);

  for (const ref of refs) {
    // anything with a scheme is not a local file: http, data, mailto, upi, tel…
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref) || ref.startsWith('#') || ref.startsWith('//')) continue;
    const clean = ref.split('?')[0].split('#')[0];
    if (!clean) continue;
    checked++;
    // a root-absolute path may be served from the domain root or from a project
    // sub-path (/Hellgate/...), so try both before calling it broken
    // a root-absolute path can be served from the domain root, from a project
    // sub-path (/repo/...), or from a Pages directory such as docs/ — try the
    // combinations before calling it broken
    let candidates;
    if (clean.startsWith('/')) {
      const bases = [ROOT, siteRoot];
      const docs = path.join(ROOT, 'docs');
      if (fs.existsSync(docs)) bases.push(docs);
      candidates = [];
      for (const base of bases) {
        for (let drop = 0; drop <= 2; drop++) {
          candidates.push(path.join(base, clean.split('/').slice(1 + drop).join('/')));
        }
      }
    } else {
      candidates = [path.join(path.dirname(page), clean)];
    }
    const ok = candidates.some((t) =>
      (fs.existsSync(t) && fs.statSync(t).isFile()) ||
      (fs.existsSync(t) && fs.statSync(t).isDirectory() && fs.existsSync(path.join(t, 'index.html')))
    );
    if (!ok) bad.push(`${path.relative(ROOT, page)} → ${ref}`);
  }
}

console.log(`${pages.length} page(s)${skipped ? ` (${skipped} fragment(s) skipped)` : ''}, ${checked} local reference(s)`);
if (bad.length) {
  console.log('FAIL: broken references');
  for (const b of bad) console.log('  ' + b);
  process.exit(1);
}
console.log('every local reference resolves');
