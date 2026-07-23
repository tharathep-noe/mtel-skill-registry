#!/usr/bin/env node
/**
 * build-bundle.js
 * Builds bundle.json — a self-contained catalog of every skill including its
 * full markdown body. Unlike index.json (metadata only, for the resolver),
 * the bundle carries content, so a client can present the catalog and let the
 * user pick skills to write into .claude/skills/ without cloning the registry.
 *
 * Run from repo root: node scripts/build-bundle.js
 *
 * Output shape:
 *   {
 *     "schemaVersion": 1,
 *     "generatedAt": "<ISO timestamp>",
 *     "count": <n>,
 *     "skills": [
 *       { category, name, path, match, requires, version, body }, ...
 *     ]
 *   }
 * `skills` is ordered by category (frontend → backend → database) then name,
 * so the catalog is stable across rebuilds and diffs cleanly.
 */

const fs = require("fs")
const path = require("path")
const { collectSkills, CATEGORIES, REPO_ROOT } = require("./lib/registry")

const { skills, warnings } = collectSkills()

const categoryRank = (c) => {
  const i = CATEGORIES.indexOf(c)
  return i === -1 ? CATEGORIES.length : i
}
skills.sort(
  (a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name)
)

const bundle = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  count: skills.length,
  skills,
}

for (const w of warnings) console.warn(`⚠  ${w}`)

const outputPath = path.join(REPO_ROOT, "bundle.json")
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + "\n")
console.log(`Generated bundle.json with ${skills.length} skills`)
