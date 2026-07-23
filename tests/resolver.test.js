/**
 * Quick smoke test for resolve_skills resolver.
 * Imports the real resolver logic from resolver/server.js (single source of
 * truth) and asserts keyword → skill resolution, including transitive
 * `requires` dependencies. Run from repo root: node tests/resolver.test.js
 */

import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const { resolveSkills } = await import(
  join(__dirname, "..", "resolver", "server.js")
)

const tests = [
  // nextjs → react, supabase → postgres are pulled in transitively.
  {
    keywords: ["nextjs", "tailwind", "supabase"],
    expect: ["nextjs", "postgres", "react", "supabase", "tailwind"],
  },
  { keywords: ["nestjs", "prisma"], expect: ["nestjs", "prisma"] },
  { keywords: ["next.js", "react.js"], expect: ["nextjs", "react"] },
  { keywords: ["postgresql"], expect: ["postgres"] },
  // transitive: asking for supabase alone still pulls in postgres.
  { keywords: ["supabase"], expect: ["postgres", "supabase"] },
  { keywords: ["kubernetes"], expect: [] },
  { keywords: [], expect: [] },
]

let passed = 0
for (const test of tests) {
  const result = resolveSkills(test.keywords)
  const names = result.matched.map((m) => m.name).sort()
  const expected = [...test.expect].sort()
  const ok = JSON.stringify(names) === JSON.stringify(expected)
  console.log(
    ok ? "✓" : "✗",
    `resolveSkills([${test.keywords.map((k) => `"${k}"`).join(", ")}])`,
    ok ? `→ [${names.join(", ")}]` : `→ [${names.join(", ")}] (expected [${expected.join(", ")}])`
  )
  if (ok) passed++
}

console.log(`\n${passed}/${tests.length} tests passed`)
process.exit(passed === tests.length ? 0 : 1)
