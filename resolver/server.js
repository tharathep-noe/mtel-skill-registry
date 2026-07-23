/**
 * Shared resolve_skills MCP server construction.
 *
 * Tool: resolve_skills
 * Input: { keywords: string[] }
 * Output: { matched: [{ category, name, path, version }] }
 *
 * Loads index.json from the registry repo (or local for development),
 * matches keywords exactly against each skill's match array, then follows each
 * matched skill's `requires` to pull in transitive dependencies (e.g. supabase
 * → postgres, nextjs → react). Transport-agnostic: `createServer()` returns a
 * wired-up MCP Server that a stdio (index.js) or Streamable HTTP (http.js)
 * entry point connects a transport to.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_DIR = join(__dirname, "..")

// index.json is baked at build/deploy time and never changes while the process
// runs, so parse it once. Tests that mutate the file between runs use a fresh
// process, so caching is safe there too.
let cachedIndex = null

export function loadIndex() {
  if (cachedIndex) return cachedIndex
  const indexPath = join(REGISTRY_DIR, "index.json")
  if (!existsSync(indexPath)) {
    throw new Error("index.json not found")
  }
  cachedIndex = JSON.parse(readFileSync(indexPath, "utf-8"))
  return cachedIndex
}

export function resolveSkills(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { matched: [] }
  }

  const index = loadIndex()

  // Flatten the category-nested index into a name → entry lookup so we can
  // follow `requires` (which reference skills by name) across categories.
  const byName = new Map()
  for (const [category, skills] of Object.entries(index)) {
    for (const [name, skill] of Object.entries(skills)) {
      byName.set(name, { category, name, skill })
    }
  }

  const lowerKeywords = new Set(
    keywords
      .filter((k) => typeof k === "string")
      .map((k) => k.toLowerCase())
  )

  // Follow `requires` depth-first, guarding against cycles and dangling refs.
  const resolved = new Set()
  const visit = (name) => {
    if (resolved.has(name)) return
    const node = byName.get(name)
    if (!node) return // dangling `requires` — skill not in registry, skip
    resolved.add(name)
    for (const req of node.skill.requires || []) visit(req)
  }

  for (const { name, skill } of byName.values()) {
    const matchList = (skill.match || []).map((m) => m.toLowerCase())
    if (matchList.some((m) => lowerKeywords.has(m))) visit(name)
  }

  const matched = [...resolved].map((name) => {
    const { category, skill } = byName.get(name)
    return { category, name, path: skill.path, version: skill.version }
  })

  return { matched }
}

/**
 * Build a fresh MCP Server wired with the resolve_skills tool.
 * Stateless — safe to construct one per Streamable HTTP request.
 */
export function createServer() {
  const { version: SERVER_VERSION } = JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8")
  )

  const server = new Server(
    {
      name: "mtel-skill-resolver",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

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
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "resolve_skills") {
      throw new Error(`Unknown tool: ${request.params.name}`)
    }

    const { keywords } = request.params.arguments || {}
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(resolveSkills(keywords)),
        },
      ],
    }
  })

  return server
}
