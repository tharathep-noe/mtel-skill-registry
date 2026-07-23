/**
 * registry.js — shared skill collection for the build scripts.
 *
 * Scans skills/<category>/<name>/SKILL.md, parses frontmatter with gray-matter
 * (robust YAML, unlike a hand-rolled regex), validates required fields, and
 * returns a flat list of skills plus any warnings. Both generate-index.js and
 * build-bundle.js consume this so parsing/validation lives in exactly one place.
 */

const fs = require("fs")
const path = require("path")
const matter = require("gray-matter")

const REPO_ROOT = path.join(__dirname, "..", "..")
const SKILLS_ROOT = path.join(REPO_ROOT, "skills")
const CATEGORIES = ["frontend", "backend", "database"]

/**
 * @returns {{ skills: Array<{category,name,path,match,requires,version,body}>, warnings: string[] }}
 */
function collectSkills() {
  const skills = []
  const warnings = []
  const seenNames = new Map() // name -> "category/dir", to catch cross-category clashes

  for (const category of CATEGORIES) {
    const categoryDir = path.join(SKILLS_ROOT, category)
    if (!fs.existsSync(categoryDir)) continue

    for (const entry of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const skillFile = path.join(categoryDir, entry.name, "SKILL.md")
      if (!fs.existsSync(skillFile)) continue

      const where = `skills/${category}/${entry.name}`
      const { data: meta, content } = matter(fs.readFileSync(skillFile, "utf-8"))

      // Validate required frontmatter so a malformed SKILL.md fails loudly
      // instead of silently producing a broken/unresolvable entry.
      if (!meta.name) {
        warnings.push(`${where}: missing required frontmatter field "name" — skipped`)
        continue
      }
      if (!Array.isArray(meta.match) || meta.match.length === 0) {
        warnings.push(`${where}: "match" is empty — skill will never be resolved`)
      }
      if (seenNames.has(meta.name)) {
        warnings.push(
          `${where}: duplicate skill name "${meta.name}" (also ${seenNames.get(meta.name)}) — later one wins`
        )
      }
      seenNames.set(meta.name, where)

      skills.push({
        category,
        name: meta.name,
        path: `skills/${category}/${meta.name}`,
        match: Array.isArray(meta.match) ? meta.match : [],
        requires: Array.isArray(meta.requires) ? meta.requires : [],
        version: meta.version != null ? String(meta.version) : "0.0.0",
        body: content.trim(),
      })
    }
  }

  return { skills, warnings }
}

module.exports = { collectSkills, CATEGORIES, REPO_ROOT, SKILLS_ROOT }
