---
name: init-project
description: "
  Fetches company-standard SKILL.md files matched to a new project's tech stack.
  Use when the user is starting a BRAND-NEW project and names a stack — e.g.
  'init project using next.js supabase and tailwind', 'create a new Next.js
  app', 'scaffold a new NestJS API', 'set up a new repo with express and
  prisma', 'bootstrap a react app'. Do NOT use when the user references an
  existing project ('this project', 'our repo', 'the current app', 'add X to my
  existing ...').
category: meta
match: [init, scaffold, create project, new project, set up, bootstrap]
requires: []
version: 1.0.0
---

# init-project

This skill is the AC1 trigger — it auto-fires when the user signals intent to start a brand-new project. It resolves matching registry skills, presents them for confirmation, then fetches them into the local project.

## Scope (what this skill does and does NOT do)

Your **only** deliverable is fetching company `SKILL.md` files into `.claude/skills/<name>/` (or `AGENTS.md` for Codex). This is **not** a request to build or scaffold the application:

- Do **NOT** run `create-next-app`, `create-vite`, `nest new`, or any project generator.
- Do **NOT** write app source, install dependencies, or create config files.
- Only do the above if the user separately and explicitly asks for it as its own step.

`resolve_skills` is the **start of the fetch flow**, not a lookup to confirm a stack is "recommended". Run every workflow step below in order — do not stop after `resolve_skills`.

## Trigger phrases (description-matching)

Fire when the user says any of these or similar variants:

- "create a new ... project"
- "scaffold a new app"
- "set up a new repo"
- "init project using ..."
- "start a new ... project"
- "bootstrap a ... app"

**Hard disqualified** (do NOT fire): any phrase referencing "this project", "our repo", "the app", "existing", "current" — these anchor to an existing project.

**Ambiguous guard**: if the conversation lacks both a clear creation verb and an existing-project reference, check the directory state:

- Empty directory OR no `package.json` / `.git` → soft signal that this may be a new project. Show the resolved skill list but note the ambiguity.
- Has `package.json` or `.git` → do not fire.

## Workflow

### Step 1: Keyword extraction

Scan the user's message and conversation context for technology stack names:

- Extract explicit tech names from the prompt (e.g., "nextjs tailwind supabase")
- Extract from any `stack` / `template` parameters
- Fallback: if nothing detected, ask the user what stack they want

Output: a flat list of keyword strings.

### Step 2: Resolve skills

Call the MCP tool `resolve_skills({ keywords })` to get matching registry entries. The tool returns `{ matched: [{ category, name, path, version }] }`.

The resolver is served over MCP (Streamable HTTP) at **`http://localhost:3000/mcp`** for local development (this is the default the registry server binds to via `cd resolver && npm start`). Point your MCP client at that URL. In production, swap the host for the deployed registry URL.

### Step 3: Fetch Confirmation

Show the resolved skills to the user as a checklist:

```
I detected you're starting a new project with: Next.js, Tailwind, Supabase
The following skills will be loaded into this project:
  - nextjs (frontend)
  - tailwind (frontend)
  - supabase (database)
Proceed? [y/N]
```

Wait for explicit user confirmation before cloning or copying anything. This is the universal safety net for resolver mismatches.

If no skills matched, inform the user and offer to create new ones.

### Step 4: Fetch skills (pull content into the project)

On confirmation, pull the matched skills' full content and write each to
`.claude/skills/<name>/SKILL.md` — no git clone. There are two equivalent ways;
prefer the MCP tool since you're already connected to the resolver.

**Option A — MCP tool `get_skills` (preferred).** Call `get_skills({ names })`
with the matched skill **names** (the `name` field `resolve_skills` returned):

```
get_skills({ names: ["nextjs", "tailwind", "supabase"] })
→ { skills: [{ category, name, path, version, raw }], missing: [] }
```

Write each returned skill's `raw` (the complete SKILL.md incl. frontmatter) to
`.claude/skills/<name>/SKILL.md`. A skill whose `.claude/skills/<name>/` already
exists is left untouched (never overwrite). Anything in `missing` isn't in the
registry — surface it to the user rather than silently skipping.

**This step is mandatory** — you are not done until `get_skills` (or the fetch
script) has run and the files are written. Do not treat a successful
`resolve_skills` call as the end of the flow.

**Option B — fetch script (no MCP client / shell-only).** Run the fetch script
with the registry base URL and the matched skill names:

```bash
node <registry>/scripts/fetch-skills.js http://localhost:3000 nextjs tailwind supabase
```

For each name it fetches `GET http://localhost:3000/skills/<name>.json` (which
carries that skill's full `raw` SKILL.md) and writes it to
`.claude/skills/<name>/SKILL.md`.

- **Registry base URL**: for local development this is **`http://localhost:3000`**
  — the same host as the MCP server (`http://localhost:3000/mcp`) without the
  `/mcp` path. Override with the `MTEL_SKILL_REGISTRY_URL` env var to point at a
  deployed registry; if unset, default to `http://localhost:3000`. If the server
  gates `/skills/*`, set `MCP_AUTH_TOKEN` so the script sends the bearer token.
- A skill whose `.claude/skills/<name>/` already exists is skipped (no overwrite).

### Step 5: Codex detection

If the project is running under Codex (or `AGENTS.md` exists at root), concatenate fetched skills into `AGENTS.md` instead:

- Sort by category order (frontend → backend → database), then alphabetically within category
- Each section headed with `## <name>`
- Add a source comment: `<!-- sourced from mtel-skill-registry -->`
- Regenerate the entire `AGENTS.md` (idempotent, no append/merge)

## Idempotency

Re-running init on the same project:

- `.claude/skills/<name>/` already exists → skip that skill (never overwrite)
- `AGENTS.md` already exists → regenerate from scratch (not append)
- New keywords bring new skills alongside existing ones — never delete existing skills without explicit confirmation
