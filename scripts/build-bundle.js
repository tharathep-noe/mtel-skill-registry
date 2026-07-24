#!/usr/bin/env node
/**
 * build-bundle.js
 * Builds bundle.json — a lightweight *selection catalog* of every skill:
 * metadata plus a short `description` and `useWhen` / `doNotUseWhen` guidance,
 * but NOT the full markdown body. The point is for a consumer (often an LLM) to
 * decide *which* skills to pull without spending tokens on every skill's body;
 * the body is fetched on demand afterwards (git clone / fetch-skills.sh).
 *
 * Run from repo root: node scripts/build-bundle.js
 *
 * Output shape:
 *   {
 *     "schemaVersion": 2,
 *     "generatedAt": "<ISO timestamp>",
 *     "count": <n>,
 *     "skills": [
 *       { category, name, path, match, requires, version,
 *         description, useWhen: [...], doNotUseWhen: [...] }, ...
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

// Drop the body — the catalog is for *choosing* skills, not delivering them.
const catalog = skills.map(({ body, ...rest }) => rest)

const bundle = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  count: catalog.length,
  skills: catalog,
}

for (const w of warnings) console.warn(`⚠  ${w}`)

const outputPath = path.join(REPO_ROOT, "bundle.json")
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + "\n")
console.log(`Generated bundle.json with ${skills.length} skills`)
