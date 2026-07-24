# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`mtel-skill-registry` is a company-wide registry of `SKILL.md` files (under `skills/`). It is not itself a runtime app — its purpose is to let an `init-project` trigger (running in some *other* project) resolve a tech stack (e.g. "nextjs, tailwind, supabase") to a set of company-standard skill files, then git-clone this repo and copy the matched `SKILL.md` files into that project's `.claude/skills/` (or concatenate into `AGENTS.md` for Codex). See `CONTEXT.md` for the vocabulary (Init Trigger, Onboarding Scan, Pulled Skill, Fetch Confirmation) and `PLAN.md` for the full design/rationale.

## Commands

```bash
cd resolver && npm install          # install MCP resolver deps
cd scripts && npm install           # install build-tooling deps (gray-matter)
node tests/resolver.test.js         # run resolver smoke tests (from repo root)
node scripts/generate-index.js      # regenerate index.json (metadata only) from frontmatter
node scripts/build-bundle.js        # regenerate bundle.json (metadata + skill bodies)
cd scripts && npm run build         # regenerate BOTH index.json and bundle.json
cd resolver && npm start            # start the MCP resolver over stdio (node index.js)
cd resolver && npm run start:http   # start the MCP resolver over Streamable HTTP (node http.js)
cd resolver && npm run inspect      # start resolver under @modelcontextprotocol/inspector
```

(npm scripts run with cwd = the directory holding that `package.json` — `resolver/` or `scripts/` — so their paths are relative to that directory, not the repo root.)

There are two independent `package.json`s and no single top-level test runner: `resolver/` (ESM, the MCP server + its deps) and `scripts/` (CommonJS, build tooling — depends on `gray-matter` for frontmatter parsing). `tests/*.js` are ESM run directly with `node`. Regenerating `index.json`/`bundle.json` is the only build step; there is no compile/bundle step for the resolver itself.

## Architecture

Two independent pieces share one JSON contract (`index.json`):

1. **The registry content** — `skills/frontend/`, `skills/backend/`, `skills/database/` directories, each holding `<skill-name>/SKILL.md` (plus `skills/init-project/` for the trigger skill itself). Each `SKILL.md` starts with required YAML frontmatter (`name`, `category`, `match` keyword array, `requires`, `version`) plus recommended catalog fields (`description`, `useWhen`, `doNotUseWhen`), followed by the markdown body (company conventions/patterns actually pulled into consuming projects). The catalog fields feed `bundle.json`; the body does not.
2. **`index.json`** — generated (never hand-edited) by `scripts/generate-index.js`, which scans the category directories under `skills/` for `SKILL.md` frontmatter and flattens it into `{ category: { name: { match, requires, version, path } } }` (where `path` is `skills/<category>/<name>`). This is the single source of truth the resolver reads; `match` keywords live only in the `SKILL.md` frontmatter. Scanning + gray-matter parsing + validation live in `scripts/lib/registry.js` (`collectSkills()`), shared with the bundle build.
   - **`bundle.json`** — also generated (by `scripts/build-bundle.js`), a lightweight **selection catalog**: metadata plus a short `description` and `useWhen`/`doNotUseWhen` guidance per skill, but **no markdown body** (`{ schemaVersion, generatedAt, count, skills: [{ category, name, path, match, requires, version, description, useWhen, doNotUseWhen }] }`, ordered by category then name). The point is to let a consumer (often an LLM) decide *which* skills to pull without spending tokens on every skill's full body; the body is fetched on demand afterwards (fetch flow / `git clone`). The MCP tool does not read it; the HTTP entry point (`http.js`) serves it verbatim at `GET /bundle.json` (read once at boot; gated by `MCP_AUTH_TOKEN` when set). Regenerate it in the same step as `index.json` (`cd scripts && npm run build`) to avoid drift.
3. **`resolver/`** — an MCP server (`@modelcontextprotocol/sdk`) exposing one tool, `resolve_skills({ keywords: string[] })`. It loads `index.json`, does an exact, case-insensitive match of each keyword against each skill's `match` array — no fuzzy/synonym matching (an open question in `PLAN.md`) — then follows each matched skill's `requires` to pull in transitive dependencies (e.g. `supabase` → `postgres`, `nextjs` → `react`). Returns `{ matched: [{ category, name, path, version }] }`. The tool definition + matching logic live in `resolver/server.js` (`createServer()`, `resolveSkills()`), shared by two transport entry points: `resolver/index.js` (stdio — each client spawns it locally) and `resolver/http.js` (Streamable HTTP — one central server on `PORT`/`/mcp`, stateless so a fresh server+transport is built per request; optional `MCP_AUTH_TOKEN` bearer gate; also serves the HTML setup guides in `docs/` and the skill catalog at `GET /bundle.json`). This is the M3 deliverable from `PLAN.md`.
4. **`scripts/fetch-skills.sh`** — takes a registry URL and a list of matched skill paths (`skills/<category>/<name>`), shallow + sparse-clones only those paths to a tmpdir, copies each matched directory into `.claude/skills/<name>/`, and skips any skill that already exists locally (never overwrites — see Idempotency below). The tmpdir is always cleaned up via an `EXIT` trap.
5. **`scripts/generate-agents-md.js`** — for Codex consumers (no `SKILL.md` concept): takes a list of already-fetched `.claude/skills/<dir>` paths, strips frontmatter from each, and concatenates the bodies into a single `AGENTS.md` at the consuming project's root, ordered by category (frontend → backend → database → meta) then alphabetically. Always regenerates from scratch — never appends.

The consuming-project workflow (driven by `skills/init-project/SKILL.md`, which itself lives in this registry) is: detect intent → extract keywords → call `resolve_skills` → show the user a confirmation checklist (**Fetch Confirmation** — always required, no silent fetch) → on confirm, run `fetch-skills.sh` and, for Codex, `generate-agents-md.js`.

**Idempotency contract**: once a skill is pulled into a consuming project's `.claude/skills/<name>/`, it is frozen/project-owned and never auto-resynced, even if the registry copy changes upstream (see "Pulled Skill" in `CONTEXT.md`). Updating requires deleting the local copy and re-running the fetch flow. `AGENTS.md`, in contrast, is always regenerated wholesale, not merged.

## Adding or editing a skill

1. Create `skills/<category>/<name>/SKILL.md` (category is one of `frontend`, `backend`, `database`, or `meta` for registry-internal skills like `init-project`) with the required frontmatter block (see README.md "Frontmatter reference").
2. Write the body content to be factual/current company practice, not aspirational.
3. Run `cd scripts && npm run build` to regenerate both `index.json` and `bundle.json` — do not hand-edit either (first run needs `npm install` in `scripts/` for `gray-matter`).
4. Run `node tests/resolver.test.js` to confirm keyword matching still resolves as expected (add a case to the `tests` array in that file if you're adding new match keywords worth covering).

Keep `match` keywords lowercase, include common aliases (e.g. `nextjs`, `next.js`, `next`), and keep the list focused since matching is exact, not fuzzy.
