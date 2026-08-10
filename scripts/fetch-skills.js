#!/usr/bin/env node
/**
 * fetch-skills.js
 * Downloads matched skills from the registry SERVER and writes them into
 * .claude/skills/. Instead of cloning the repo (or pulling the whole catalog),
 * it fetches one skill at a time — `GET <registry>/skills/<name>.json`, served
 * from the registry's public/r/ folder — each carrying the skill's full `raw`
 * SKILL.md, and writes only the requested ones.
 *
 * Run from the consuming project's root:
 *   node <registry-path>/scripts/fetch-skills.js <registry-base-url> <skill...>
 *
 * Example:
 *   node scripts/fetch-skills.js https://skills.mtel.internal \
 *     skills/frontend/nextjs skills/frontend/tailwind skills/database/supabase
 *
 * Each <skill> may be either the resolver's `path` (skills/<category>/<name>) or
 * a bare skill name — only the trailing name segment is used to build the URL.
 *
 * Environment variables:
 *   MCP_AUTH_TOKEN — if the server gates /skills/*, sent as `Authorization: Bearer <token>`
 *
 * Idempotency: a skill whose .claude/skills/<name>/ already exists is skipped
 * (never overwritten) — pulled skills are project-owned once fetched.
 */

const fs = require("fs");
const path = require("path");

async function main() {
  const [registryUrl, ...skillRefs] = process.argv.slice(2);

  if (!registryUrl || skillRefs.length === 0) {
    console.error(
      "Usage: node fetch-skills.js <registry-base-url> <skill-1> [skill-2 ...]",
    );
    process.exit(1);
  }

  const baseUrl = registryUrl.replace(/\/+$/, "");
  const headers = {};
  if (process.env.MCP_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MCP_AUTH_TOKEN}`;
  }

  const targetDir = ".claude/skills";
  fs.mkdirSync(targetDir, { recursive: true });

  for (const ref of skillRefs) {
    // Accept either a full path (skills/<category>/<name>) or a bare name.
    const name = ref.split("/").filter(Boolean).pop();

    const dest = path.join(targetDir, name);
    if (fs.existsSync(dest)) {
      console.log(`  - ${name} (already exists, skipping)`);
      continue;
    }

    const skillUrl = `${baseUrl}/skills/${name}.json`;
    const res = await fetch(skillUrl, { headers });
    if (res.status === 404) {
      console.log(`  ⚠  ${name} — not in registry, skipping`);
      continue;
    }
    if (!res.ok) {
      console.error(
        `  ✗ ${name} — ${res.status} ${res.statusText} (${skillUrl})`,
      );
      continue;
    }
    const skill = await res.json();

    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "SKILL.md"), `${skill.raw}\n`);
    console.log(`  ✓ ${name} → ${dest}/SKILL.md`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
