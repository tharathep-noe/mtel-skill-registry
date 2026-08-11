# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`mtel-skill-registry` is a company-wide registry of `SKILL.md` files (under `skills/`). It is not itself a runtime app — its purpose is to let an `init-project` trigger (running in some *other* project) resolve a tech stack (e.g. "nextjs, tailwind, supabase") to a set of company-standard skill files, then download the matched `SKILL.md` files from the registry server (`GET /bundle.json`) into that project's `.claude/skills/` (or concatenate into `AGENTS.md` for Codex). See `docs/CONTEXT.md` for the vocabulary (Init Trigger, Onboarding Scan, Pulled Skill, Fetch Confirmation) and `docs/PLAN.md` for the full design/rationale.

## Commands

Everything runs through the root `package.json`; `npm install` once at the repo root installs both workspaces (`resolver/`, `scripts/`) plus the shared Prettier dev dependency.

```bash
npm install            # install all workspace deps (resolver + scripts) + Prettier
npm test               # run resolver smoke tests (node tests/resolver.test.js)
npm run build          # regenerate BOTH index.json and bundle.json (build-bundle in scripts/)
npm start              # start the MCP resolver over Streamable HTTP (resolver/http.js)
npm run inspect        # start @modelcontextprotocol/inspector (connect it to the HTTP URL)
npm run format         # format all code with Prettier (config in .prettierrc.json)
npm run format:check   # verify formatting without writing (use in CI / pre-commit)
```

The root is an npm **workspaces** wrapper — it delegates `start`/`inspect`/`build` to the workspace that owns each script. You can still `cd resolver` / `cd scripts` and run the underlying scripts directly.

Two workspace `package.json`s hold the actual deps: `resolver/` (ESM, the MCP server + its deps) and `scripts/` (CommonJS, build tooling — depends on `gray-matter` for frontmatter parsing). `tests/*.js` are ESM (the root is `type: module`; `scripts/` overrides to `commonjs`). Regenerating `index.json`/`bundle.json` is the only build step; there is no compile/bundle step for the resolver itself.

Formatting is Prettier with the config in `.prettierrc.json` (semicolons, double quotes, trailing commas, 80-col). `.prettierignore` excludes generated artifacts (`index.json`, `bundle.json`, `public/`), lockfiles, and prose/content (`*.md`, `skills/`, `docs/`) — run `npm run format` after editing any `.js`.

## Architecture

Two independent pieces share one JSON contract (`index.json`):

1. **The registry content** — `skills/frontend/`, `skills/backend/`, `skills/database/` directories, each holding `<skill-name>/SKILL.md` (plus `skills/init-project/` for the trigger skill itself). Each `SKILL.md` starts with required YAML frontmatter (`name`, `category`, `match` keyword array, `requires`, `version`) plus recommended catalog fields (`description`, `useWhen`, `doNotUseWhen`), followed by the markdown body (company conventions/patterns actually pulled into consuming projects). Both the catalog fields and the full SKILL.md (as `raw`) feed `bundle.json`, which is what the fetch flow downloads and writes into consuming projects.
2. **`index.json`** — generated (never hand-edited) by `scripts/generate-index.js`, which scans the category directories under `skills/` for `SKILL.md` frontmatter and flattens it into `{ category: { name: { match, requires, version, path } } }` (where `path` is `skills/<category>/<name>`). This is the single source of truth the resolver reads; `match` keywords live only in the `SKILL.md` frontmatter. Scanning + gray-matter parsing + validation live in `scripts/lib/registry.js` (`collectSkills()`), shared with the bundle build.
   - **`bundle.json`** — also generated (by `scripts/build-bundle.js`), the self-contained **selection catalog + delivery payload**: per skill, metadata plus `description`/`useWhen`/`doNotUseWhen` selection guidance **and** `raw` (the complete SKILL.md incl. frontmatter) (`{ schemaVersion, generatedAt, count, skills: [{ category, name, path, match, requires, version, description, useWhen, doNotUseWhen, raw }] }`, ordered by category then name). A consumer decides *which* skills to pull from the metadata, then writes each matched skill's `raw` into `.claude/skills/<name>/SKILL.md` — no git clone. The MCP tool does not read it; the HTTP entry point (`http.js`) serves it verbatim at `GET /bundle.json` (read once at boot; gated by `MCP_AUTH_TOKEN` when set). `build-bundle.js` also writes one file per skill to `public/r/<name>.json` (each holding that skill's catalog entry — the same object shape as a `skills[]` element; the `public/r/` dir is cleared and rebuilt each run) — these are what the server serves per-skill at `GET /skills/<name>.json` and what `fetch-skills.js` pulls one at a time. Regenerate everything in the same step as `index.json` (`cd scripts && npm run build`) to avoid drift.
3. **`resolver/`** — an MCP server (`@modelcontextprotocol/sdk`) exposing two tools. `resolve_skills({ keywords: string[] })` loads `index.json`, does an exact, case-insensitive match of each keyword against each skill's `match` array — no fuzzy/synonym matching (an open question in `docs/PLAN.md`) — then follows each matched skill's `requires` to pull in transitive dependencies (e.g. `supabase` → `postgres`, `nextjs` → `react`), returning `{ matched: [{ category, name, path, version }] }` (metadata only). `get_skills({ names: string[] })` then pulls the full content for chosen skills — reading the per-skill build files (`public/r/<name>.json`) and returning `{ skills: [{ category, name, path, version, raw }], missing: [...] }`, where `raw` is the complete SKILL.md a client writes into `.claude/skills/<name>/SKILL.md` (names or `skills/<category>/<name>` paths both accepted; unknown names come back in `missing`). The tool definitions + logic live in `resolver/server.js` (`createServer()`, `resolveSkills()`, `getSkills()`), driven by a single transport entry point `resolver/http.js` (Streamable HTTP — one central server on `PORT`/`/mcp`, stateless so a fresh server+transport is built per request; optional `MCP_AUTH_TOKEN` bearer gate; also serves the HTML setup guides in `docs/`, the whole skill catalog at `GET /bundle.json` (read from `bundle.json` at boot), and one skill at a time at `GET /skills/<name>.json` (served from the per-skill `public/r/<name>.json` files, indexed from the `public/r/` directory at boot)). `createServer()` also sets the MCP `instructions` field — a condensed copy of `init-project`'s trigger + fetch workflow that the SDK sends to the client during the `initialize` handshake, so any client that connects learns when/how to run the flow **without** `init-project/SKILL.md` needing to be pre-installed in the consuming project (this solves the trigger chicken-and-egg; `instructions` is a hint clients may ignore, and `SKILL.md` remains the authoritative long-form copy — keep the two in sync when editing the workflow). This is the M3 deliverable from `docs/PLAN.md`.
4. **`scripts/fetch-skills.js`** — takes a registry **base URL** and a list of matched skill **names**, fetches `GET <url>/skills/<name>.json` for each (sending `Authorization: Bearer $MCP_AUTH_TOKEN` when that env var is set), and writes each skill's `raw` into `.claude/skills/<name>/SKILL.md`, skipping any skill that already exists locally (never overwrites — see Idempotency below). No git clone; a Node ≥18 global `fetch` is the only requirement.
5. **`scripts/generate-agents-md.js`** — for Codex consumers (no `SKILL.md` concept): takes a list of already-fetched `.claude/skills/<dir>` paths, strips frontmatter from each, and concatenates the bodies into a single `AGENTS.md` at the consuming project's root, ordered by category (frontend → backend → database → meta) then alphabetically. Always regenerates from scratch — never appends.

The consuming-project workflow (driven by `skills/init-project/SKILL.md`, which itself lives in this registry) is: detect intent → extract keywords → call `resolve_skills` → show the user a confirmation checklist (**Fetch Confirmation** — always required, no silent fetch) → on confirm, run `fetch-skills.js` and, for Codex, `generate-agents-md.js`.

**Idempotency contract**: once a skill is pulled into a consuming project's `.claude/skills/<name>/`, it is frozen/project-owned and never auto-resynced, even if the registry copy changes upstream (see "Pulled Skill" in `docs/CONTEXT.md`). Updating requires deleting the local copy and re-running the fetch flow. `AGENTS.md`, in contrast, is always regenerated wholesale, not merged.

## Adding or editing a skill

1. Create `skills/<category>/<name>/SKILL.md` (category is one of `frontend`, `backend`, `database`, or `meta` for registry-internal skills like `init-project`) with the required frontmatter block (see README.md "Frontmatter reference").
2. Write the body content to be factual/current company practice, not aspirational.
3. Run `npm run build` from the repo root to regenerate both `index.json` and `bundle.json` — do not hand-edit either (first run needs `npm install` at the root for `gray-matter`).
4. Run `npm test` to confirm keyword matching still resolves as expected (add a case to the `tests` array in `tests/resolver.test.js` if you're adding new match keywords worth covering).
5. Run `npm run format` if you touched any `.js`.

Keep `match` keywords lowercase, include common aliases (e.g. `nextjs`, `next.js`, `next`), and keep the list focused since matching is exact, not fuzzy.
