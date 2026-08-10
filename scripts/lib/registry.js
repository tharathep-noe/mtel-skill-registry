/**
 * registry.js — shared skill collection for the build scripts.
 *
 * Scans skills/<category>/<name>/SKILL.md, parses frontmatter with gray-matter
 * (robust YAML, unlike a hand-rolled regex), validates required fields, and
 * returns a flat list of skills plus any warnings. Both generate-index.js and
 * build-bundle.js consume this so parsing/validation lives in exactly one place.
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const REPO_ROOT = path.join(__dirname, "..", "..");
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
const CATEGORIES = ["frontend", "backend", "database"];

// Normalize a frontmatter field that should be a list of strings: accept an
// array as-is, wrap a lone string, treat anything else as empty.
function toStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * @returns {{ skills: Array<{category,name,path,match,requires,version,description,useWhen,doNotUseWhen,raw}>, warnings: string[] }}
 */
function collectSkills() {
  const skills = [];
  const warnings = [];
  const seenNames = new Map(); // name -> "category/dir", to catch cross-category clashes

  for (const category of CATEGORIES) {
    const categoryDir = path.join(SKILLS_ROOT, category);
    if (!fs.existsSync(categoryDir)) continue;

    for (const entry of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(categoryDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      const where = `skills/${category}/${entry.name}`;
      const raw = fs.readFileSync(skillFile, "utf-8");
      const { data: meta } = matter(raw);

      // Validate required frontmatter so a malformed SKILL.md fails loudly
      // instead of silently producing a broken/unresolvable entry.
      if (!meta.name) {
        warnings.push(
          `${where}: missing required frontmatter field "name" — skipped`,
        );
        continue;
      }
      if (!Array.isArray(meta.match) || meta.match.length === 0) {
        warnings.push(
          `${where}: "match" is empty — skill will never be resolved`,
        );
      }
      if (seenNames.has(meta.name)) {
        warnings.push(
          `${where}: duplicate skill name "${meta.name}" (also ${seenNames.get(meta.name)}) — later one wins`,
        );
      }
      seenNames.set(meta.name, where);

      // `description` powers the lightweight catalog (bundle.json); warn if it
      // is missing so authors add one rather than shipping a body-less entry
      // that a consumer can't reason about without fetching the full skill.
      if (!meta.description) {
        warnings.push(
          `${where}: missing "description" — catalog entry will have no summary`,
        );
      }

      skills.push({
        category,
        name: meta.name,
        path: `skills/${category}/${meta.name}`,
        match: Array.isArray(meta.match) ? meta.match : [],
        requires: Array.isArray(meta.requires) ? meta.requires : [],
        version: meta.version != null ? String(meta.version) : "0.0.0",
        description: meta.description ? String(meta.description) : "",
        useWhen: toStringArray(meta.useWhen),
        doNotUseWhen: toStringArray(meta.doNotUseWhen),
        raw: raw.trim(), // full SKILL.md incl. frontmatter (delivery payload)
      });
    }
  }

  return { skills, warnings };
}

module.exports = { collectSkills, CATEGORIES, REPO_ROOT, SKILLS_ROOT };
