#!/usr/bin/env node
/* tools/check-meta.mjs — the version and licence a repo states must agree with
 * the files that hold them.
 *
 *   VERSION           vs the newest heading in CHANGELOG.md
 *   package.json      vs VERSION
 *   LICENSE           vs the licence named in README.md
 *
 * Every one of these is a claim a reader trusts and nothing else checks. Absent
 * files are skipped, so the same tool runs in any repo.
 *
 *   node tools/check-meta.mjs [dir]
 *   node tools/check-meta.mjs [dir] --warn   # report only, always exit 0
 *
 * --warn exists for a repo with a known drift: it can adopt the measurement
 * before it can adopt the rule, and the badge stays honest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const warn = args.includes('--warn');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : null);

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  }
  return 0;
}

const problems = [];
const warnings = [];
const checked = [];

// ---- version ---------------------------------------------------------------
const version = read('VERSION');
const changelog = read('CHANGELOG.md');

if (version) {
  const v = version.trim();
  checked.push(`VERSION ${v}`);
  if (changelog) {
    const headings = [...changelog.matchAll(/^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+)/gm)].map((m) => m[1]);
    if (headings.length) {
      checked.push(`CHANGELOG newest ${headings[0]}`);
      const cmp = compareVersions(v, headings[0]);
      if (cmp < 0) {
        // the changelog claims a release the version file does not know about
        problems.push(`VERSION is ${v} but CHANGELOG.md already documents ${headings[0]}`);
      } else if (cmp > 0) {
        // a version bumped ahead of its changelog entry is work in progress
        warnings.push(`VERSION is ${v}, ahead of the newest CHANGELOG heading ${headings[0]}`);
      }
    }
  }
  const pkg = read('package.json');
  if (pkg) {
    try {
      const p = JSON.parse(pkg);
      if (p.version) {
        checked.push(`package.json ${p.version}`);
        if (p.version !== v) problems.push(`VERSION is ${v} but package.json says ${p.version}`);
      }
    } catch (e) { problems.push('package.json is not valid JSON'); }
  }
} else if (changelog) {
  // a repo that never adopted a VERSION file is not in conflict with itself
  const headings = [...changelog.matchAll(/^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+)/gm)].map((m) => m[1]);
  if (headings.length) warnings.push(`no VERSION file, but CHANGELOG.md has ${headings.length} version headings`);
}

// ---- licence ---------------------------------------------------------------
const license = read('LICENSE') || read('LICENSE.md');
const readme = read('README.md');

if (license && readme) {
  const first = license.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ');
  const named = [
    ['MIT', /MIT License/i],
    ['Apache-2.0', /Apache License/i],
    ['GPL-3.0', /GNU GENERAL PUBLIC LICENSE/i],
    ['PolyForm Noncommercial', /PolyForm Noncommercial/i],
    ['CC BY 4.0', /Creative Commons Attribution/i],
  ].find(([, re]) => re.test(first));

  if (named) {
    checked.push(`LICENSE ${named[0]}`);

    // A shields.io badge spells the licence into a URL: "PolyForm%20Noncommercial
    // %201.0.0-2e7d32". Normalise both sides to a family before comparing, or
    // every badge reads as a mismatch with the licence it is describing.
    const family = (text) => {
      const t = decodeURIComponent(text).replace(/[_-]/g, ' ').toLowerCase();
      if (/polyform/.test(t)) return 'PolyForm Noncommercial';
      if (/\bmit\b/.test(t)) return 'MIT';
      if (/apache/.test(t)) return 'Apache-2.0';
      if (/gpl/.test(t)) return 'GPL-3.0';
      if (/creative commons|cc by/.test(t)) return 'CC BY 4.0';
      return null;
    };

    const claims = new Set();
    for (const m of readme.matchAll(/licen[cs]e[^\n]{0,120}/gi)) {
      const f = family(m[0]);
      if (f) claims.add(f);
    }
    for (const claim of claims) {
      if (claim !== named[0]) problems.push(`LICENSE is ${named[0]} but the README mentions ${claim}`);
    }
  }
}

console.log(`${path.basename(ROOT)}: ${checked.join(' · ') || 'nothing to check'}`);
for (const w of warnings) console.log('  warn: ' + w);
if (problems.length) {
  console.log((warn ? 'WARN:' : 'FAIL:'));
  for (const p of problems) console.log('  ' + p);
  process.exit(warn ? 0 : 1);
}
console.log('version and licence agree with the files that hold them');
