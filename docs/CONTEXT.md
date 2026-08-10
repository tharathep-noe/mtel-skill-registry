# Skill Registry

A system that automatically supplies a project with company-standard `SKILL.md` files, matched to that project's tech stack, without the developer having to know the registry exists.

## Language

**Init Trigger**:
The AC1 mechanism that detects a developer is starting a **brand-new** project from conversational phrasing alone (no project files exist yet to inspect). Reads the message in 3 tiers: (1) an explicit existing-project reference ("this project," "our repo") is a hard disqualifier — never fires; (2) a clear creation verb with no existing-project reference — resolves immediately; (3) neither signal present — ambiguous — falls back to directory state (empty / no `.git` / no `package.json`) as a soft prior. All tiers that resolve to "fire" show the resolved skill list and wait for user confirmation before cloning/copying (see Fetch Confirmation) — there is no silent-fetch path.
_Avoid_: "the trigger," "AC1" alone (ambiguous with Onboarding Scan)

**Onboarding Scan**:
A second, independent trigger for **established** projects: fires based on project state (has `.git`/`package.json` but `.claude/skills/` is missing or incomplete relative to the detected stack), regardless of what the user's message says that turn. Shows the resolved skill list and waits for user confirmation before scanning/pulling (see Fetch Confirmation).
_Avoid_: "the fallback," "existing-project trigger"

**Pulled Skill**:
A `SKILL.md` that has already been copied into `.claude/skills/<name>/` (or concatenated into `AGENTS.md` for Codex). Once pulled, it is frozen — considered project-owned, not re-synced automatically even if the registry's copy changes upstream. Updating one is a manual act: delete the local copy, then re-trigger Onboarding Scan/Init Trigger so `resolve_skills` and the normal fetch flow run again. No dedicated "resync" tool exists — this deliberately reuses the existing fetch path instead of adding a second MCP tool.
_Avoid_: "installed skill," "synced skill" (implies auto-updating, which it isn't)

**Fetch Confirmation**:
The universal checkpoint before any skill fetch/write: regardless of which trigger fired or which tier resolved it, the resolved skill list is always shown to the user for confirmation first. This is deliberately the safety net for resolver mismatches — since `resolve_skills` uses exact-match (see PLAN.md), a human catches misses here rather than the resolver being made "smarter."
_Avoid_: "confirmation step" alone (say which trigger it's guarding)

**Existing-project reference**:
A phrase like "this project," "our repo," or "the app" that anchors the user's intent to a project that already exists. Acts as a hard disqualifier for the Init Trigger — it outranks any creation verb ("scaffold," "set up") present in the same message.

**Keyword extraction**:
The step that produces the `keywords` array passed to `resolve_skills`. Source is trigger-specific: for the Init Trigger, keywords come from the conversation (no files exist yet to inspect); for the Onboarding Scan, keywords come from reading actual project files (`package.json` dependencies, `requirements.txt`, config files like `next.config.js`/`tailwind.config.js`).
_Avoid_: conflating this with the resolver's matching logic (exact/fuzzy) — extraction produces the input, matching consumes it (still open, see PLAN.md open questions).
