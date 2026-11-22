#!/usr/bin/env node
/* tools/check-assets.mjs — every binary asset in this repository must be declared,
 * with where it came from and what licence it is under.
 *
 * A sprite is the one thing in a repository that arrives without a diff anyone reads.
 * It is also the one thing whose licence can quietly poison a project: a CC-BY-SA tile
 * carries its share-alike into every game that recolours it, and a GPL sprite in a
 * PolyForm-Noncommercial kit is a claim nobody wants to defend later.
 *
 * The rule is deliberately narrow:
 *   - every file with an asset extension has an entry in ASSETS.json;
 *   - every entry names a `source` (a URL, or "own") and a `licence`;
 *   - the licence is on the allow list below, or the build fails;
 *   - an entry with no file behind it fails too, so the manifest cannot rot.
 *
 *   node tools/check-assets.mjs            # report, exit 1 on any gap
 *   node tools/check-assets.mjs --warn     # report, always exit 0
 *   node tools/check-assets.mjs --root ..  # another repository
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > -1
  ? path.resolve(process.cwd(), process.argv[rootArg + 1])
  : path.resolve(HERE, "..");
const warn = process.argv.includes("--warn");

/* What counts as an asset: the bytes nobody can read in a diff. */
const EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ico", ".svg",
  ".ogg", ".wav", ".mp3", ".m4a", ".flac",
  ".ttf", ".otf", ".woff", ".woff2",
  ".glb", ".gltf", ".atlas", ".aseprite", ".tmx", ".ldtk"
]);

/* The allow list. Copyleft art (CC-BY-SA, GPL) and "unknown" are deliberately absent:
   a kit that ships under PolyForm Noncommercial cannot absorb them by accident, so the
   failure is the feature. Add a licence here only with a decision written down. */
const ALLOWED = new Set([
  "cc0-1.0", "cc0", "cc-by-4.0", "cc-by-3.0", "oga-by-3.0", "oga-by-4.0",
  "mit", "apache-2.0", "ofl-1.1", "own"
]);

const SKIP = new Set([".git", "node_modules", ".github", "dist", "build"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name).toLowerCase())) out.push(path.relative(ROOT, full).split(path.sep).join("/"));
  }
  return out;
}

const manifestPath = path.join(ROOT, "ASSETS.json");
let manifest = { assets: [] };
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    console.error(`FAIL: ASSETS.json is not valid JSON — ${e.message}`);
    process.exit(1);
  }
}

const declared = new Map();
for (const a of manifest.assets || []) {
  if (!a || !a.path) continue;
  declared.set(String(a.path).replace(/^\.?\//, ""), a);
}

const found = walk(ROOT).sort();
const problems = [];
const rows = [];

for (const file of found) {
  const entry = declared.get(file);
  if (!entry) {
    problems.push(`undeclared asset: ${file}`);
    rows.push([file, "—", "—", "MISSING"]);
    continue;
  }
  const licence = String(entry.licence || "").toLowerCase();
  const source = entry.source ? String(entry.source) : "";
  if (!source) problems.push(`no source: ${file}`);
  if (!licence) problems.push(`no licence: ${file}`);
  else if (!ALLOWED.has(licence)) problems.push(`licence not allowed here: ${file} (${entry.licence})`);
  rows.push([file, source || "—", entry.licence || "—", ALLOWED.has(licence) && source ? "ok" : "FAIL"]);
}

for (const file of declared.keys()) {
  if (!found.includes(file)) problems.push(`declared but not on disk: ${file}`);
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`${found.length} asset file(s), ${declared.size} declared`);
for (const [file, source, licence, state] of rows) {
  console.log(`  ${pad(state, 7)} ${pad(file, 42)} ${pad(licence, 14)} ${source}`);
}

if (problems.length) {
  console.log("");
  for (const p of problems) console.log(`FAIL  ${p}`);
  if (!warn) process.exit(1);
  console.log("\n(--warn: exiting 0 anyway)");
} else {
  console.log("\nOK: every asset is declared, with a source and an allowed licence");
}
