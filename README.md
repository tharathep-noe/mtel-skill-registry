# mtel-skill-registry

Central SKILL.md registry for company-standard project skills. When engineers start new projects, the AI auto-detects the tech stack and fetches matching skills that encode company conventions — no manual setup required.

## How it works

```
User: "create a new Next.js project with Tailwind and Supabase"
  │
  ▼
[init-project skill fires — AC1 trigger]
  │
  ├─ 1. Extract keywords: [nextjs, tailwind, supabase]
  │
  ├─ 2. resolve_skills({ keywords }) → matched entries
  │     └─ MCP server reads index.json, exact-matches keywords,
  │        then pulls in transitive `requires` (e.g. supabase → postgres)
  │
  ├─ 3. Show resolved skills to user → Fetch Confirmation
  │
  └─ 4. On confirm: git clone → copy matched skills → clean up
        ├─ Claude: .claude/skills/<name>/SKILL.md
        └─ Codex:  concat into AGENTS.md at root
```

Two triggers:
- **Init Trigger**: detects brand-new project intent from conversation (no existing-project references)
- **Onboarding Scan**: detects established projects missing `.claude/skills/` for their detected stack

## Two generated artifacts

The build produces two JSON files from the same `SKILL.md` sources — never hand-edit either:

| File | Contents | Consumed by |
|---|---|---|
| `index.json` | Metadata only (`match`, `requires`, `version`, `path`) | The MCP resolver, for keyword matching |
| `bundle.json` | Metadata **+ each skill's full markdown body** | Clients, as a self-contained catalog |

`bundle.json` exists so a client can fetch **one file**, show the full skill catalog, and let the user pick which skills to write into `.claude/skills/` — no `git clone` of the registry required. Shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-23T00:00:00.000Z",
  "count": 8,
  "skills": [
    {
      "category": "frontend",
      "name": "nextjs",
      "path": "skills/frontend/nextjs",
      "match": ["nextjs", "next.js", "next"],
      "requires": ["react"],
      "version": "1.0.0",
      "body": "# Next.js Skill\n\nCompany conventions for Next.js projects.\n…"
    }
  ]
}
```

`skills` is ordered by category (frontend → backend → database) then name, so the file diffs cleanly across rebuilds.

## Repository structure

```
mtel-skill-registry/
├── skills/
│   ├── frontend/
│   │   ├── nextjs/SKILL.md
│   │   ├── tailwind/SKILL.md
│   │   └── react/SKILL.md
│   ├── backend/
│   │   ├── nestjs/SKILL.md
│   │   ├── express/SKILL.md
│   │   └── prisma/SKILL.md
│   ├── database/
│   │   ├── supabase/SKILL.md
│   │   └── postgres/SKILL.md
│   └── init-project/SKILL.md    # AC1 trigger skill
├── index.json                   # Generated: metadata only, read by the resolver (do not edit)
├── bundle.json                  # Generated: metadata + full skill bodies, for clients (do not edit)
├── docs/                        # HTML setup guides served by the HTTP resolver
│   ├── _style.html              # Shared stylesheet (injected into each page)
│   ├── claude-setup.html
│   ├── codex-setup.html
│   └── opencode-setup.html
├── scripts/
│   ├── package.json             # Build-tooling deps (gray-matter)
│   ├── lib/registry.js          # Shared scan + frontmatter parse + validation
│   ├── generate-index.js        # Regenerates index.json (metadata) from frontmatter
│   ├── build-bundle.js          # Regenerates bundle.json (metadata + bodies)
│   ├── fetch-skills.sh          # Clones registry + copies matched skills
│   └── generate-agents-md.js    # Concat skills into AGENTS.md (Codex)
├── tests/
│   ├── trigger-corpus.json      # Should-fire / should-not-fire prompts
│   └── resolver.test.js         # Resolver unit tests
└── resolver/
    ├── server.js                # Shared resolve_skills tool + matching logic
    ├── index.js                 # stdio entry point
    ├── http.js                  # Streamable HTTP entry point (serves docs/)
    └── package.json
```

## Adding a new skill

1. Create a new directory under the appropriate category (e.g., `skills/database/redis/`)
2. Create `SKILL.md` with required frontmatter:

```yaml
---
name: redis
category: database
match: [redis]
requires: []
version: 1.0.0
---
```

3. Write the skill body in markdown — company conventions, architecture patterns, code examples
4. Regenerate `index.json` and `bundle.json` (first time: `cd scripts && npm install`):

```bash
cd scripts && npm run build     # runs generate-index.js + build-bundle.js
```

5. Open a PR with your new skill directory and the updated `index.json` + `bundle.json`

### Frontmatter reference

| Field | Required | Description |
|---|---|---|
| `name` | yes | Unique skill identifier (used as directory name in `.claude/skills/`) |
| `category` | yes | One of: `frontend`, `backend`, `database`, `meta` |
| `match` | yes | Array of keyword strings the resolver uses for matching |
| `requires` | no | Array of skill names this skill depends on (e.g., supabase requires postgres) |
| `version` | yes | Semver version for the skill content |

### Match keyword guidelines

- Use lowercase
- Include common aliases (e.g., `nextjs`, `next.js`, `next`)
- Keep the list focused — quality over quantity
- Run `node tests/resolver.test.js` to verify matching works as expected

## PR review process

1. Reviewer verifies frontmatter is complete and valid
2. Reviewer runs `cd scripts && npm run build` to confirm `index.json` and `bundle.json` regenerate cleanly (and match what's committed)
3. Reviewer checks:
   - Skill content is factual, not aspirational
   - Conventions match actual company practice
   - No sensitive/secret information in the markdown
4. Merge after approval

## Development

### Install dependencies

```bash
cd resolver && npm install     # MCP resolver (runtime)
cd scripts  && npm install     # build tooling: gray-matter (generate-index / build-bundle)
```

### Run tests

```bash
node tests/resolver.test.js
```

### Start MCP resolver (stdio)

For local, per-machine use — each client (Claude Code, Codex) spawns this process itself:

```bash
cd resolver && node index.js        # or: npm start
```

Point a client at it via MCP config (each machine must have this repo cloned):

```json
{
  "mcpServers": {
    "mtel-skill-resolver": {
      "command": "node",
      "args": ["/absolute/path/to/mtel-skill-registry/resolver/index.js"]
    }
  }
}
```

### Start MCP resolver (Streamable HTTP)

For a single central server that many projects connect to over the network — no local clone required on the client side:

```bash
cd resolver && npm run start:http                       # listens on :3000/mcp
PORT=8080 MCP_AUTH_TOKEN=<secret> npm run start:http     # custom port + bearer auth
```

Environment:

| Var | Description |
|---|---|
| `PORT` | Port to listen on (default `3000`) |
| `MCP_AUTH_TOKEN` | If set, requests to `/mcp` **and** `/bundle.json` must send `Authorization: Bearer <token>`. The landing page, setup docs, and `/health` stay open. |

The server is **stateless** (a fresh MCP server + transport per request), so it scales horizontally behind a load balancer.

Routes:

| Route | Purpose |
|---|---|
| `POST /mcp` | MCP Streamable HTTP endpoint (`resolve_skills`) |
| `GET /bundle.json` | Static skill catalog (metadata + full bodies) — fetch once, no clone needed. 404s until `bundle.json` is built. |
| `GET /health` | Liveness probe |
| `GET /` + `/claude-setup`, `/codex-setup`, `/opencode-setup` | Landing page + per-client setup guides |

Clients connect to the `/mcp` endpoint:

```json
{
  "mcpServers": {
    "mtel-skill-resolver": {
      "url": "https://mcp-registry.internal.company.com/mcp"
    }
  }
}
```

### Testing the HTTP resolver with Postman

Import `resolver/postman/mtel-skill-resolver.postman_collection.json` — it ships a Health check, `tools/list`, and `tools/call resolve_skills` request. Start the server (`cd resolver && PORT=3939 npm run start:http`) and set the `baseUrl` collection variable to match.

Two things to know when hand-crafting `/mcp` requests:

- **Headers are strict.** You must send `Accept: application/json, text/event-stream` (plus `Content-Type: application/json`). Omitting `text/event-stream` returns `406 Not Acceptable`.
- **Responses are SSE.** The reply is `text/event-stream`; the JSON-RPC payload is on the `data:` line, and the resolver's `{ matched: [...] }` is itself JSON-stringified inside `result.content[0].text`. The collection's test scripts unwrap both layers and print the matched skills to the Postman Console (**View → Show Postman Console**).

If the server was started with `MCP_AUTH_TOKEN`, put the value in the `authToken` variable and enable the pre-added `Authorization: Bearer {{authToken}}` header.

## License

Internal — company use only.
