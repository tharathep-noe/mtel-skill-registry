/**
 * Quick smoke test for resolve_skills resolver.
 * Imports the real resolver logic from resolver/server.js (single source of
 * truth) and asserts keyword → skill resolution, including transitive
 * `requires` dependencies. Run from repo root: node tests/resolver.test.js
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { resolveSkills, getSkills } = await import(
  join(__dirname, "..", "resolver", "server.js")
);

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
];

let passed = 0;
let total = 0;
for (const test of tests) {
  total++;
  const result = resolveSkills(test.keywords);
  const names = result.matched.map((m) => m.name).sort();
  const expected = [...test.expect].sort();
  const ok = JSON.stringify(names) === JSON.stringify(expected);
  console.log(
    ok ? "✓" : "✗",
    `resolveSkills([${test.keywords.map((k) => `"${k}"`).join(", ")}])`,
    ok
      ? `→ [${names.join(", ")}]`
      : `→ [${names.join(", ")}] (expected [${expected.join(", ")}])`,
  );
  if (ok) passed++;
}

// get_skills: returns full raw content for known names, reports unknown ones as
// missing, and accepts a full `skills/<category>/<name>` path as well as a name.
{
  total++;
  const { skills, missing } = getSkills(["nextjs", "skills/frontend/nope"]);
  const ok =
    skills.length === 1 &&
    skills[0].name === "nextjs" &&
    typeof skills[0].raw === "string" &&
    skills[0].raw.startsWith("---") &&
    JSON.stringify(missing) === JSON.stringify(["nope"]);
  console.log(
    ok ? "✓" : "✗",
    `getSkills(["nextjs", "skills/frontend/nope"])`,
    ok
      ? `→ skills=[nextjs] missing=[nope] raw ok`
      : `→ ${JSON.stringify({ skills: skills.map((s) => s.name), missing })}`,
  );
  if (ok) passed++;
}

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
