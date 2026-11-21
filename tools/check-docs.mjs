#!/usr/bin/env node
/* tools/check-docs.mjs — every exported symbol carries a JSDoc block.
 *
 * The rule is narrow on purpose: a doc comment directly above the export, or
 * above the line that starts it. Class methods are not required (the class
 * block explains the object; the methods are named in the docs), but every
 * module-level export is.
 *
 *   node tools/check-docs.mjs                    # report and exit 1 on a gap
 *   node tools/check-docs.mjs --list             # also print what is missing
 *   node tools/check-docs.mjs --src js --warn    # another repo, report only
 *
 * `--src` points at the source directory (default play/src). `--warn` exits 0
 * whatever it finds, so a repo can adopt the measurement before it can adopt
 * the rule.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcArg = process.argv.indexOf('--src');
const SRC = path.resolve(ROOT, srcArg > -1 ? process.argv[srcArg + 1] : path.join('play', 'src'));
const list = process.argv.includes('--list');
const warn = process.argv.includes('--warn');

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();

let total = 0;
let documented = 0;
const missing = [];

for (const file of files) {
  const lines = fs.readFileSync(path.join(SRC, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z0-9_]+)/);
    if (!m) return;
    total++;
    // walk back over blank lines and attributes to find a comment block
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j--;
    const closes = j >= 0 && lines[j].trim().endsWith('*/');
    let opens = false;
    if (closes) {
      for (let k = j; k >= 0 && j - k < 40; k--) {
        if (lines[k].trim().startsWith('/**')) {
          opens = true;
          break;
        }
        if (lines[k].trim().startsWith('/*') && !lines[k].trim().startsWith('/**')) break;
      }
    }
    if (opens) documented++;
    else missing.push(`${file}: ${m[1]}`);
  });
}

if (total === 0) {
  // a green result on zero exports is a lie: either --src is wrong or the repo
  // is not an ES-module codebase, and the rule does not apply
  console.log('no ES module exports found in ' + path.relative(ROOT, SRC));
  process.exit(warn ? 0 : 1);
}

const pct = Math.round((documented / total) * 100);
console.log(`documented exports: ${documented}/${total} (${pct}%)`);
if (missing.length) {
  if (list) for (const m of missing) console.log('  missing ' + m);
  console.log((warn ? 'WARN: ' : 'FAIL: ') + missing.length + ' export(s) without a JSDoc block');
  process.exit(warn ? 0 : 1);
}
console.log('all exports documented');
