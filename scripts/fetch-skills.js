#!/usr/bin/env node
/**
 * fetch-skills.js
 * Downloads matched skills from the registry SERVER and writes them into
 * .claude/skills/. Replaces the old git-clone flow: instead of cloning the repo,
 * it fetches the self-contained bundle (`GET <registry>/bundle.json`) — which
 * carries each skill's full `raw` SKILL.md — and writes only the requested ones.
 *
 * Run from the consuming project's root:
 *   node <registry-path>/scripts/fetch-skills.js <registry-base-url> <skill-path...>
 *
 * Example:
 *   node scripts/fetch-skills.js https://skills.mtel.internal \
 *     skills/frontend/nextjs skills/frontend/tailwind skills/database/supabase
 *
 * Skill paths are the `path` field the resolver returns (skills/<category>/<name>).
 *
 * Environment variables:
 *   MCP_AUTH_TOKEN — if the server gates /bundle.json, sent as `Authorization: Bearer <token>`
 *
 * Idempotency: a skill whose .claude/skills/<name>/ already exists is skipped
 * (never overwritten) — pulled skills are project-owned once fetched.
 */

const fs = require("fs")
const path = require("path")

async function main() {
  const [registryUrl, ...skillPaths] = process.argv.slice(2)

  if (!registryUrl || skillPaths.length === 0) {
    console.error(
      "Usage: node fetch-skills.js <registry-base-url> <skill-path-1> [skill-path-2 ...]"
    )
    process.exit(1)
  }

  const bundleUrl = `${registryUrl.replace(/\/+$/, "")}/bundle.json`
  const headers = {}
  if (process.env.MCP_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MCP_AUTH_TOKEN}`
  }

  console.log(`Fetching bundle from ${bundleUrl} ...`)
  const res = await fetch(bundleUrl, { headers })
  if (!res.ok) {
    console.error(`  ✗ ${res.status} ${res.statusText} — could not fetch bundle.json`)
    process.exit(1)
  }
  const bundle = await res.json()

  // Index skills by their registry path for O(1) lookup of each requested one.
  const byPath = new Map(bundle.skills.map((s) => [s.path, s]))

  const targetDir = ".claude/skills"
  fs.mkdirSync(targetDir, { recursive: true })

  for (const skillPath of skillPaths) {
    const skill = byPath.get(skillPath)
    if (!skill) {
      console.log(`  ⚠  ${skillPath} — not in bundle, skipping`)
      continue
    }

    const dest = path.join(targetDir, skill.name)
    if (fs.existsSync(dest)) {
      console.log(`  - ${skill.name} (already exists, skipping)`)
      continue
    }

    fs.mkdirSync(dest, { recursive: true })
    fs.writeFileSync(path.join(dest, "SKILL.md"), `${skill.raw}\n`)
    console.log(`  ✓ ${skill.name} → ${dest}/SKILL.md`)
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
