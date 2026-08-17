#!/usr/bin/env node
/**
 * generate-index.js
 * Scans all SKILL.md files for frontmatter and generates index.json — the
 * lightweight matching contract the resolver reads (no skill bodies).
 * Run from repo root: node scripts/generate-index.js
 *
 * For a self-contained catalog that also carries the skill bodies (so clients
 * can consume content without cloning), see build-bundle.js.
 */

const fs = require("fs");
const path = require("path");
const { collectSkills, REPO_ROOT } = require("./lib/registry");

const { skills, warnings } = collectSkills();

const index = {};
for (const skill of skills) {
  if (!index[skill.category]) index[skill.category] = {};
  index[skill.category][skill.name] = {
    match: skill.match,
    requires: skill.requires,
    version: skill.version,
    path: skill.path,
  };
}

for (const w of warnings) console.warn(`⚠  ${w}`);

const outputPath = path.join(REPO_ROOT, "index.json");
fs.writeFileSync(outputPath, JSON.stringify(index, null, 2) + "\n");
console.log(`Generated index.json with ${skills.length} skills`);
