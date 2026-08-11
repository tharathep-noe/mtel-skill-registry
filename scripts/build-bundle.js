#!/usr/bin/env node
/**
 * build-bundle.js
 * Builds bundle.json — the self-contained skill bundle: every skill's metadata
 * plus its selection guidance (`description`, `useWhen`, `doNotUseWhen`) AND its
 * full `raw` SKILL.md (frontmatter + body). This is both the selection catalog
 * *and* the delivery payload: a consumer resolves which skills it wants, fetches
 * this one file from the server (`GET /bundle.json`), and writes each `raw`
 * straight into `.claude/skills/<name>/SKILL.md` — no git clone of the registry
 * required. `raw` is the complete file so the pulled skill keeps its frontmatter
 * (which is what makes it discoverable as a Claude Code skill).
 *
 * Run from repo root: node scripts/build-bundle.js
 *
 * Output shape:
 *   {
 *     "schemaVersion": 3,
 *     "generatedAt": "<ISO timestamp>",
 *     "count": <n>,
 *     "skills": [
 *       { category, name, path, match, requires, version,
 *         description, useWhen: [...], doNotUseWhen: [...], raw }, ...
 *     ]
 *   }
 * `skills` is ordered by category (frontend → backend → database) then name,
 * so the bundle is stable across rebuilds and diffs cleanly.
 *
 * Alongside bundle.json this also writes one file per skill to
 * public/r/<name>.json — each holding that skill's catalog entry (the same shape
 * the HTTP server serves at GET /skills/<name>.json). The public/r/ directory is
 * cleared and rebuilt each run so it never carries stale/renamed skills.
 */

const fs = require("fs");
const path = require("path");
const { collectSkills, CATEGORIES, REPO_ROOT } = require("./lib/registry");

const { skills, warnings } = collectSkills();

const categoryRank = (c) => {
  const i = CATEGORIES.indexOf(c);
  return i === -1 ? CATEGORIES.length : i;
};
skills.sort(
  (a, b) =>
    categoryRank(a.category) - categoryRank(b.category) ||
    a.name.localeCompare(b.name),
);

// Emit metadata + selection guidance + the full `raw` SKILL.md. The bundle
// carries `raw` so a fetched skill keeps its frontmatter and stays a valid skill.
const catalog = skills;

const bundle = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  count: catalog.length,
  skills: catalog,
};

for (const w of warnings) console.warn(`⚠  ${w}`);

const outputPath = path.join(REPO_ROOT, "bundle.json");
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + "\n");
console.log(`Generated bundle.json with ${skills.length} skills`);

// Per-skill files: public/r/<name>.json, each the skill's catalog entry. Rebuild
// the directory from scratch so renamed/removed skills don't leave stale files.
const perSkillDir = path.join(REPO_ROOT, "public/r");
fs.rmSync(perSkillDir, { recursive: true, force: true });
fs.mkdirSync(perSkillDir, { recursive: true });
for (const skill of catalog) {
  fs.writeFileSync(
    path.join(perSkillDir, `${skill.name}.json`),
    JSON.stringify(skill, null, 2) + "\n",
  );
}
console.log(`Generated public/r/ with ${catalog.length} per-skill files`);
