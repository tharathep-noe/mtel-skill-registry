# skill-registry — Initial Plan

## User Story

As a Developer / Team Member, I want the AI to automatically download relevant project-specific skills when initializing a new project, so that the AI understands the codebase standards and generates code consistent with the project's architecture, conventions, and coding guidelines from the start.

## Acceptance Criteria (AC)

- [ ] **Trigger on Initialization**: ระบบ/AI สามารถตรวจจับการ Initial Project ใหม่ได้โดยอัตโนมัติ
- [ ] **Skill Resolution & Fetching**: AI ดึงและดาวน์โหลด project-specific skills ที่ตรงกับโปรเจกต์นั้นๆ ได้ถูกต้อง

## เป้าหมาย

ทำ **central SKILL.md registry** ที่บริษัทดูแล — เมื่อ engineer เริ่ม project ใหม่ AI ต้องรู้เองว่านี่คือจังหวะ init (AC1) แล้วตัดสินว่า skill ไหน compatible กับ project นี้ผ่าน MCP resolver พร้อมดึง `SKILL.md` ที่ match จาก registry กลางมาวางเป็น project-scoped skill ใน `.claude/skills/` ให้ถูกต้อง (AC2)

แนวทางยังเป็น hybrid เดิม: **MCP ทำหน้าที่แค่ตัดสินว่า skill ไหน compatible** ส่วน **เนื้อหา skill เป็นไฟล์ markdown ที่ pull ผ่าน git**

---

## AC1 — Trigger on Initialization

### กลไกการ trigger

การ trigger **ไม่ผูกกับคำสั่งตายตัว** (เช่นต้องพิมพ์ "init project using X Y Z" เป๊ะ ๆ) แต่ใช้กลไก skill-matching ปกติของ Claude: `init-project` skill มี description ที่ครอบคลุมประโยคธรรมชาติที่บ่งบอกว่ากำลังเริ่ม project ใหม่ เช่น "create a new project", "scaffold a new app", "set up a new repo", "init project using...", "start a new nextjs project" ฯลฯ — Claude จับ intent จาก description นี้แล้ว trigger เองโดยไม่ต้องมีคำสั่งเฉพาะ

สัญญาณเสริม (ไม่ใช่ trigger หลัก แต่ใช้ยืนยัน) คือสถานะ directory ปัจจุบัน: ถ้าเป็นโฟลเดอร์ว่างหรือยังไม่มี `package.json` / `.git` ก็สอดคล้องกับ "กำลัง init project ใหม่" — ใช้เป็น signal เสริมเวลา description อย่างเดียวกำกวม (เช่น user พูดถึง "project" กว้าง ๆ โดยไม่ชัดว่ากำลังสร้างใหม่หรือแก้ของเดิม)

### Test corpus: definition of done for AC1

Since description-matching is non-deterministic, AC1 passes only when trigger accuracy meets a defined threshold against a labelled test corpus. The corpus must be built **before** tuning the description.

**Corpus structure** (file: `tests/trigger-corpus.json`):

```json
{
  "should_fire": [
    "create a new Next.js project with Tailwind and Supabase",
    "scaffold a new app",
    "set up a new repo for a NestJS API",
    "init project using express and prisma",
    "start a new nextjs project"
  ],
  "should_not_fire": [
    "how do I add authentication to my existing project",
    "what's the project structure looking like",
    "fix the bug in the user service",
    "add a new API route to the current app",
    "can you review my project setup"
  ]
}
```

**Acceptance threshold**: `precision >= 0.9` (of triggers that fire, at least 90% are correct) and `recall >= 0.8` (of init attempts, at least 80% are caught). The tooling to measure this (how to record triggers, how to run the corpus) must be defined in M2.

### สิ่งที่ต้องทำ

1. เขียน `skills/init-project/SKILL.md` โดยเน้นคุณภาพของ description/trigger phrase เป็นพิเศษ
2. สร้าง test corpus (should-fire / should-not-fire) ก่อน tuning description
3. วัด trigger accuracy ผ่าน corpus ตาม threshold ที่กำหนด
4. เพิ่ม directory-state check เป็น guard เสริมก่อนเริ่ม fetch จริง

---

## AC2 — Skill Resolution & Fetching

### Storage: Private git repo จัดเป็น category

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
│   └── init-project/SKILL.md   # AC1 trigger skill
├── index.json         # generated from SKILL.md frontmatter
└── README.md
```

### index.json schema

Single source of truth for match keywords lives in each `SKILL.md` frontmatter. `index.json` is **generated**, not hand-maintained, to prevent drift.

**SKILL.md frontmatter example:**

```yaml
---
name: nextjs
category: frontend
match: [nextjs, next.js, next]
requires: []
version: 1.0.0
---
```

**Generated `index.json`:**

```json
{
  "frontend": {
    "nextjs":   { "match": ["nextjs", "next.js", "next"], "requires": ["react"], "version": "1.0.0", "path": "skills/frontend/nextjs" },
    "tailwind": { "match": ["tailwind", "tailwindcss"], "requires": [], "version": "1.0.0", "path": "skills/frontend/tailwind" }
  },
  "backend": {
    "nestjs":  { "match": ["nestjs", "nest.js"], "requires": [], "version": "1.0.0", "path": "skills/backend/nestjs" },
    "prisma":  { "match": ["prisma"], "requires": [], "version": "1.0.0", "path": "skills/backend/prisma" }
  },
  "database": {
    "supabase": { "match": ["supabase"], "requires": ["postgres"], "version": "1.0.0", "path": "skills/database/supabase" },
    "postgres": { "match": ["postgres", "postgresql"], "requires": [], "version": "1.0.0", "path": "skills/database/postgres" }
  }
}
```

### Keyword extraction (by init-project agent)

Keyword extraction happens **before** calling `resolve_skills`. The `init-project` agent scans the conversation and project context for stack mentions and produces a flat keyword array. Rules:

1. Extract explicit tech names from user's prompt (e.g. "nextjs tailwind supabase" → `["nextjs", "tailwind", "supabase"]`)
2. Extract from any `stack`/`template` params if user provides them
3. Fallback to known defaults if none detected (configurable per team)

This is the **critical link** between AC1 and AC2 — poor extraction means good matching doesn't matter.

### MCP resolver: ตัวเดียว หน้าที่เดียว

| Tool | Input | Output |
|---|---|---|
| `resolve_skills` | `{ keywords: string[] }` | `{ matched: [{ category, name, path, version }] }` |

โหลด `index.json` จาก registry repo, flatten ทุก category ลงมาเป็น list เดียว, จับคู่ `keywords` ที่ดึงมาจากคำอธิบายของ user (เช่น "nextjs tailwind supabase") กับ `match` array คืน path ที่ compatible กลับมา deploy เป็น Streamable HTTP ตัวเดียวกลาง ให้ทั้ง Claude และ Codex ต่อ URL เดียวกัน

Resolver ไม่ต้องรู้เนื้อหาไฟล์ SKILL.md เลย รู้แค่ path ก็พอ

Matching strategy: exact match on keywords against `match` arrays. Fuzzy/synonym matching is a future enhancement — open question below.

### Fetching: MCP resolve → download from server

การส่งมอบเนื้อหา skill ทำผ่าน **registry server ตัวเดียวกับ resolver** ไม่มี git clone เลย — client ต่อ URL เดียว ได้ทั้ง `resolve_skills` (เลือก) และ `GET /skills/<name>.json` (เนื้อหาทีละ skill)

1. `init-project` ถูก trigger (AC1) → ดึง keyword ของ stack จากบทสนทนา/context ปัจจุบัน
2. เรียก MCP tool `resolve_skills(keywords)` → ได้ list ของ skill (name/path) ที่ compatible กลับมา
3. Agent ดึงทีละตัวจาก `GET <registry>/skills/<name>.json` (แต่ละอันมี `raw` = SKILL.md เต็ม) แล้วเขียนลง `.claude/skills/<name>/SKILL.md` — ทำผ่าน `scripts/fetch-skills.js` (`GET /bundle.json` ยังมีไว้ browse ทั้ง catalog)
4. Claude เห็น skill ที่ pull เข้ามาเป็น directory-scoped skill ของ project นี้ทันที และทำตาม scaffold instruction ต่อ

```bash
node <registry>/scripts/fetch-skills.js https://skills.mtel.internal nextjs tailwind supabase
# → GET /skills/nextjs.json, /skills/tailwind.json, /skills/supabase.json
# → .claude/skills/{nextjs,tailwind,supabase}/SKILL.md
```

**Auth & credential provisioning**: ใช้ credential ช่องทางเดียวกับ MCP server — ถ้าตั้ง `MCP_AUTH_TOKEN` ทั้ง `/mcp`, `/bundle.json` และ `/skills/*` จะถูก gate ด้วย bearer token เดียวกัน client ส่ง `Authorization: Bearer <token>` (ผ่าน env `MCP_AUTH_TOKEN`) ไม่ต้องมี git token / deploy-key แยก และไม่ต้องให้ registry อยู่บน GitHub

**Idempotency**: If `.claude/skills/<name>/` already exists, skip that skill (do not overwrite). If the user re-inits with different keywords, merge new skills alongside existing ones — never delete existing skills without explicit user confirmation.

### ความเข้ากันได้กับ Codex

Codex ไม่มี concept "SKILL.md" แต่คุยกับ MCP resolver ตัวเดียวกันได้ (`resolve_skills` เหมือนกัน) หลัง resolve + pull ไฟล์มาแล้ว ให้ concat เนื้อหาของแต่ละ SKILL.md เขียนรวมเป็น `AGENTS.md` ที่ root project แทนการวางเป็น `.claude/skills/` — ต้นทางเดียวกันทั้งหมด ต่างกันแค่ปลายทางไฟล์

**Concat rules for AGENTS.md**:
- Skills appended in category order (frontend → backend → database), then alphabetically within category
- Each skill section separated by a heading `## <name>` with a source comment
- Re-init: regenerate entire AGENTS.md from scratch (no append/merge) — guaranteed idempotent

---

## Milestones

0. **M0 — Schema lock (new)**: Define `index.json` schema including `requires`, `version`, and the `SKILL.md` frontmatter as single source of truth for match keywords. Write the generate-index script. Decide version pinning strategy (pin to semver range or always latest).

1. **M1 — Registry skeleton**: สร้าง repo `mtel-skill-registry` จัด category (frontend/backend/database) ใส่ skill ตัวอย่างหมวดละ 1-2 ตัว + `index.json`

2. **M2 — Trigger design with test corpus (AC1)**: เขียน test corpus (should-fire / should-not-fire) ก่อน tuning description สร้าง `skills/init-project/SKILL.md` ที่ผ่าน threshold precision >= 0.9, recall >= 0.8 + directory-state guard

3. **M3 — Keyword extraction + MCP resolver (AC2)**: กลไก extraction keywords จาก context (core deliverable), MCP server tool เดียว `resolve_skills`, เริ่ม stdio ทดสอบผ่าน inspector แล้วย้ายเป็น Streamable HTTP

4. **M4 — Fetch flow (AC2)**: ต่อ resolver → git pull + copy เข้า `.claude/skills/` ฝั่ง Claude รวม auth provisioning และ idempotency handling

5. **M5 — Codex parity**: flow เดียวกันฝั่ง Codex, generate `AGENTS.md` ตาม concat rules

6. **M6 — End-to-end test**: ทดสอบทั้ง AC1 (ผ่าน test corpus + threshold) และ AC2 (skill resolution ตรงกับ stack + fetch success) ทั้งสอง agent

7. **M7 — Governance**: README วิธีเพิ่ม skill ใหม่/หมวดใหม่, PR review process, guidelines สำหรับ frontmatter metadata

## Open questions

- AC2: resolver จับคู่ keyword แบบ exact match พอไหม หรือต้องรองรับ fuzzy/synonym enhancement
- deploy MCP resolver ไว้ที่ไหน และจะมี version upgrade strategy อย่างไรเมื่อ schema ของ index.json เปลี่ยน
