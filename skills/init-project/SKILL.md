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

### Step 4: Fetch skills (download from the registry server)

On confirmation, download the matched skills from the registry **server** — no
git clone. Run the fetch script with the registry base URL and the matched skill
paths (the `path` field the resolver returned):

```bash
node <registry>/scripts/fetch-skills.js <registry-url> \
  skills/frontend/nextjs skills/frontend/tailwind skills/database/supabase
```

It fetches the self-contained bundle (`GET <registry-url>/bundle.json`) and
writes each matched skill's full SKILL.md into `.claude/skills/<name>/`.

- The registry URL comes from config/env (e.g. `MTEL_SKILL_REGISTRY_URL`). If the
  server gates the bundle, set `MCP_AUTH_TOKEN` so the script sends the bearer token.
- If the fetch script isn't available locally, fetch `<registry-url>/bundle.json`
  directly and write each matched skill's `raw` field to
  `.claude/skills/<name>/SKILL.md` yourself — same result.
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
