#!/usr/bin/env node
/* tools/check-claims.js — a README number is a claim; this fails the build when
 * one drifts from the suite that produces it.
 *
 * Reads the first "N passed" in README.md, runs test-node.js, compares. Exit 1 on
 * a mismatch, so CI goes red rather than the documentation going quietly stale.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const claim = readme.match(/(\d+)\s+passed/);

if (!claim) {
  console.error("FAIL: README states no 'N passed' count, so nothing can be checked");
  process.exit(1);
}

let out = "";
try {
  out = execFileSync(process.execPath, [path.join(root, "test-node.js")], { encoding: "utf8" });
} catch (e) {
  out = (e.stdout || "") + (e.stderr || "");
}

const got = out.match(/(\d+)\s+passed,\s*(\d+)\s+failed/);
if (!got) {
  console.error("FAIL: the suite printed no 'N passed, M failed' line");
  console.error(out.split("\n").slice(-5).join("\n"));
  process.exit(1);
}

const stated = Number(claim[1]);
const actual = Number(got[1]);
const failed = Number(got[2]);

console.log(`README claims ${stated} passed; the suite ran ${actual} passed, ${failed} failed`);

if (failed > 0) { console.error("FAIL: the suite has failures"); process.exit(1); }
if (stated !== actual) {
  console.error(`FAIL: the README says ${stated}, the suite ran ${actual} — update one of them`);
  process.exit(1);
}
console.log("OK: the README's number matches the suite");
