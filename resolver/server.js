/**
 * Shared MCP server construction.
 *
 * Tools:
 *   resolve_skills({ keywords: string[] })
 *     → { matched: [{ category, name, path, version }] }
 *     Which registry skills match the given tech keywords (metadata only).
 *   get_skills({ names: string[] })
 *     → { skills: [{ category, name, path, version, raw }], missing: string[] }
 *     Pulls the full SKILL.md content for the named skills so a client can write
 *     them into .claude/skills/ over MCP — no separate HTTP fetch required.
 *
 * resolve_skills loads index.json (metadata) and follows each matched skill's
 * `requires` to pull in transitive dependencies (e.g. supabase → postgres,
 * nextjs → react). get_skills reads the per-skill build files (public/r/) that
 * carry each skill's `raw` body. Transport-agnostic: `createServer()` returns a
 * wired-up MCP Server that the Streamable HTTP entry point (http.js) connects a
 * transport to.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = join(__dirname, "..");
const SKILLS_BUILD_DIR = join(REGISTRY_DIR, "public", "r");

// index.json is baked at build/deploy time and never changes while the process
// runs, so parse it once. Tests that mutate the file between runs use a fresh
// process, so caching is safe there too.
let cachedIndex = null;

export function loadIndex() {
  if (cachedIndex) return cachedIndex;
  const indexPath = join(REGISTRY_DIR, "index.json");
  if (!existsSync(indexPath)) {
    throw new Error("index.json not found");
  }
  cachedIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
  return cachedIndex;
}

export function resolveSkills(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { matched: [] };
  }

  const index = loadIndex();

  // Flatten the category-nested index into a name → entry lookup so we can
  // follow `requires` (which reference skills by name) across categories.
  const byName = new Map();
  for (const [category, skills] of Object.entries(index)) {
    for (const [name, skill] of Object.entries(skills)) {
      byName.set(name, { category, name, skill });
    }
  }

  const lowerKeywords = new Set(
    keywords.filter((k) => typeof k === "string").map((k) => k.toLowerCase()),
  );

  // Follow `requires` depth-first, guarding against cycles and dangling refs.
  const resolved = new Set();
  const visit = (name) => {
    if (resolved.has(name)) return;
    const node = byName.get(name);
    if (!node) return; // dangling `requires` — skill not in registry, skip
    resolved.add(name);
    for (const req of node.skill.requires || []) visit(req);
  };

  for (const { name, skill } of byName.values()) {
    const matchList = (skill.match || []).map((m) => m.toLowerCase());
    if (matchList.some((m) => lowerKeywords.has(m))) visit(name);
  }

  const matched = [...resolved].map((name) => {
    const { category, skill } = byName.get(name);
    return { category, name, path: skill.path, version: skill.version };
  });

  return { matched };
}

// Per-skill build files (public/r/<name>.json) carry the full `raw` SKILL.md.
// Read + index by name once; like index.json they're baked at build time and
// don't change while the process runs, so caching is safe.
let cachedSkillContent = null;

export function loadSkillContent() {
  if (cachedSkillContent) return cachedSkillContent;
  const byName = new Map();
  if (existsSync(SKILLS_BUILD_DIR)) {
    for (const file of readdirSync(SKILLS_BUILD_DIR)) {
      if (!file.endsWith(".json")) continue;
      const skill = JSON.parse(
        readFileSync(join(SKILLS_BUILD_DIR, file), "utf-8"),
      );
      byName.set(skill.name, skill);
    }
  }
  cachedSkillContent = byName;
  return cachedSkillContent;
}

// Pull full skill content for the given names. Returns each found skill's
// metadata plus its `raw` SKILL.md, and lists any names not in the registry so
// the caller can surface them rather than silently dropping them.
export function getSkills(names) {
  if (!Array.isArray(names) || names.length === 0) {
    return { skills: [], missing: [] };
  }

  const byName = loadSkillContent();
  const skills = [];
  const missing = [];

  for (const raw of names) {
    if (typeof raw !== "string") continue;
    // Accept a bare name or the resolver's `path` (skills/<category>/<name>).
    const name = raw.split("/").filter(Boolean).pop();
    const skill = byName.get(name);
    if (!skill) {
      missing.push(name);
      continue;
    }
    skills.push({
      category: skill.category,
      name: skill.name,
      path: skill.path,
      version: skill.version,
      raw: skill.raw,
    });
  }

  return { skills, missing };
}

/**
 * Build a fresh MCP Server wired with the resolve_skills tool.
 * Stateless — safe to construct one per Streamable HTTP request.
 */
export function createServer() {
  const { version: SERVER_VERSION } = JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8"),
  );

  const server = new Server(
    {
      name: "mtel-skill-resolver",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "This server resolves company-standard SKILL.md files for a BRAND-NEW project " +
        "and delivers their content to be written into the project's .claude/skills/ directory.\n\n" +
        "SCOPE — your ONLY deliverable is fetching company SKILL.md files into " +
        ".claude/skills/<name>/. This is NOT a request to build or scaffold the application: " +
        "do NOT run create-next-app, create-vite, `nest new`, or any project generator, and " +
        "do NOT write app source, install dependencies, or create config files — unless the " +
        "user separately and explicitly asks for that as its own step. resolve_skills is the " +
        "START of the fetch flow, not a lookup to confirm a stack is 'recommended'.\n\n" +
        "Auto-fire this workflow when the user signals starting a new project AND names a " +
        "tech stack — e.g. 'init project with nextjs supabase tailwind', 'scaffold a new " +
        "NestJS API', 'bootstrap a react app'. Do NOT fire when the user references an " +
        "existing project ('this project', 'our repo', 'the current app', 'add X to my " +
        "existing ...').\n\n" +
        "Workflow — run ALL steps in order; do NOT stop after resolve_skills:\n" +
        "1. Extract tech-stack keywords from the user's message (e.g. ['nextjs', 'tailwind', 'supabase']).\n" +
        "2. Call resolve_skills({ keywords }) to get the matched skills.\n" +
        "3. Show the matched skills to the user as a checklist and wait for explicit " +
        "confirmation — never fetch silently (Fetch Confirmation is mandatory).\n" +
        "4. On confirm, call get_skills({ names }) with the matched skill names and write " +
        "each returned skill's `raw` to .claude/skills/<name>/SKILL.md. Skills already " +
        "present locally are left untouched (never overwrite). Surface anything in `missing`. " +
        "You are NOT done until get_skills has run and the files are written.\n" +
        "5. If the project runs under Codex (or AGENTS.md exists at root), concatenate the " +
        "fetched skill bodies (frontmatter stripped) into AGENTS.md instead, regenerated " +
        "wholesale.",
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "resolve_skills",
        description:
          "Resolve which skills from the company registry match the given technology keywords. " +
          "Pass an array of tech stack names (e.g. ['nextjs', 'tailwind', 'supabase']) and get " +
          "back matched skill entries with their category, name, path, and version.",
        inputSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description:
                "Technology keywords to match against the registry (e.g. ['nextjs', 'prisma'])",
            },
          },
          required: ["keywords"],
        },
      },
      {
        name: "get_skills",
        description:
          "Fetch the full SKILL.md content for one or more skills so they can be " +
          "written into the project. Pass the skill names returned by resolve_skills " +
          "(e.g. ['nextjs', 'tailwind', 'supabase']; a full path like " +
          "'skills/frontend/nextjs' is also accepted). Returns each skill's metadata " +
          "and its complete `raw` SKILL.md (frontmatter + body), which the client " +
          "writes to .claude/skills/<name>/SKILL.md. Unknown names come back in `missing`.",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description:
                "Skill names (or paths) to fetch content for (e.g. ['nextjs', 'prisma'])",
            },
          },
          required: ["names"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args = {} } = request.params;

    if (toolName === "resolve_skills") {
      return {
        content: [
          { type: "text", text: JSON.stringify(resolveSkills(args.keywords)) },
        ],
      };
    }

    if (toolName === "get_skills") {
      return {
        content: [
          { type: "text", text: JSON.stringify(getSkills(args.names)) },
        ],
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  return server;
}
