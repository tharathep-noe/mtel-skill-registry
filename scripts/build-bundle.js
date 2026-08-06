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

// Emit metadata + selection guidance + the full `raw` SKILL.md. `body` (the
// frontmatter-stripped variant) stays internal to the build; the bundle carries
// `raw` so a fetched skill keeps its frontmatter and stays a valid skill.
const catalog = skills.map(({ body, ...rest }) => rest)

const bundle = {
  schemaVersion: 3,
  generatedAt: new Date().toISOString(),
  count: catalog.length,
  skills: catalog,
}

for (const w of warnings) console.warn(`⚠  ${w}`)

const outputPath = path.join(REPO_ROOT, "bundle.json")
fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + "\n")
console.log(`Generated bundle.json with ${skills.length} skills`)
