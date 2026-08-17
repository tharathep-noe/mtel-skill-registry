# ภาพรวมโปรเจกต์ `mtel-skill-registry`

## 1. Project Overview

`mtel-skill-registry` คือ **repository กลางสำหรับเก็บ "Skills" มาตรฐานของบริษัท** โดยไฟล์ `SKILL.md` แต่ละไฟล์จะเก็บ convention ของเทคโนโลยีหนึ่งตัว

สิ่งที่ต้องเข้าใจก่อนคือ **repo นี้ไม่ใช่แอปที่ run ได้** แต่ทำหน้าที่เป็น single source of truth ที่โปรเจกต์อื่นดึงไปใช้ เป้าหมายคือ:

> เมื่อเริ่มโปรเจกต์ใหม่และประกาศ tech stack (เช่น `nextjs, tailwind, supabase`)
> ระบบจะ resolve stack นั้นออกมาเป็นชุดไฟล์ `SKILL.md` มาตรฐานที่ตรงกัน แล้ว copy เข้าโปรเจกต์ให้อัตโนมัติ

ผลลัพธ์คือ ทุกทีมในบริษัทเขียนโค้ดตาม convention เดียวกัน โดยไม่ต้อง copy-paste ข้ามโปรเจกต์เอง

---

## 2. How it work

Flow ทั้งหมดถูกขับเคลื่อนด้วย skill ชื่อ `init-project` (ซึ่งตัวมันเองก็อยู่ใน registry นี้):

```
1. Detect intent (Init Trigger)   → User เริ่มโปรเจกต์ใหม่ หรือประกาศ tech stack
2. Extract keywords               → เช่น ["nextjs", "tailwind", "supabase"]
3. Call resolve_skills            → MCP tool คืน metadata ของ skills ที่ match พร้อม dependencies
4. Present a confirmation checklist → Fetch Confirmation (ต้องทำเสมอ — ห้าม fetch เงียบ ๆ)
5. On confirmation → ดึงเนื้อหา skill (raw SKILL.md) แล้วเขียนเข้า .claude/skills/ — ไม่มี git clone
   • วิธีหลัก: MCP tool get_skills({ names }) → คืน raw ของแต่ละ skill
   • ทางเลือก: scripts/fetch-skills.js → ยิง GET /skills/<name>.json ทีละตัว
   (สำหรับ Codex → generate-agents-md.js จะรวมทุกอันเป็น AGENTS.md ไฟล์เดียวแทน)
```

**Logic การ Resolve:**
การ match keyword เป็นแบบ **ตรงตัวและไม่สนตัวพิมพ์เล็กใหญ่ (case-insensitive)** — ไม่มี fuzzy matching หรือ synonym รองรับ จากนั้น dependencies จะถูก resolve แบบ transitive คือ `supabase` ดึง `postgres` มาด้วย และ `nextjs` ดึง `react` มาด้วย

**คำสั่งที่ใช้บ่อย:**

```bash
cd resolver && npm install          # ติดตั้ง dependencies ของ MCP resolver
cd scripts && npm install           # ติดตั้ง build tooling (gray-matter)
cd scripts && npm run build         # regenerate index.json + bundle.json + public/r/ (หลังแก้ skills)
node tests/resolver.test.js         # run smoke test ของ resolver
cd resolver && npm start            # run MCP resolver ผ่าน Streamable HTTP (:3000/mcp)
```

---

## 3. โครงสร้างโปรเจกต์

```
mtel-skill-registry/
├── skills/                     ← เนื้อหาของ registry (ตัวไฟล์ SKILL.md จริง ๆ)
│   ├── frontend/  (react, nextjs, tailwind)
│   ├── backend/   (express, nestjs, prisma)
│   ├── database/  (postgres, supabase)
│   └── init-project/           ← skill ที่ขับเคลื่อน flow ทั้งหมด (category: meta)
│
├── index.json                  ← [generated] source of truth ที่ resolver อ่านตอน match
│                                  (metadata: match, requires, version, path)
├── bundle.json                 ← [generated] catalog รวมทุก skill (metadata + description +
│                                  useWhen/doNotUseWhen + raw SKILL.md เต็ม)
├── public/r/<name>.json        ← [generated] ไฟล์แยกต่อ skill (catalog entry + raw)
│                                  เป็น delivery payload ที่ /skills/<name>.json เสิร์ฟ
│
├── resolver/                   ← MCP server (ESM) — 2 tools: resolve_skills() + get_skills()
│   ├── server.js               ← logic การ match + resolve dependency + ดึง raw content
│   └── http.js                 ← Streamable HTTP entry point (transport เดียวที่มี;
│                                  serve docs/ + /bundle.json + /skills/<name>.json)
│
├── scripts/                    ← build tooling (CommonJS)
│   ├── generate-index.js       ← สร้าง index.json จาก frontmatter
│   ├── build-bundle.js         ← สร้าง bundle.json + public/r/<name>.json
│   ├── lib/registry.js         ← collectSkills(): scan + parse + validate (ใช้ร่วมกัน)
│   ├── fetch-skills.js         ← ยิง GET /skills/<name>.json ทีละตัว → .claude/skills/
│   └── generate-agents-md.js   ← รวม body ของ skills เป็น AGENTS.md (สำหรับ Codex)
│
├── docs/                       ← HTML setup guides (claude / codex / opencode)
└── tests/                      ← smoke tests (ESM, run ตรง ๆ ด้วย node)
```

### แนวคิดหลัก: สอง Component แชร์ "Contract" เดียวกันผ่าน `index.json`

1. **เนื้อหา Registry** — ไฟล์ `SKILL.md` (frontmatter + body ที่เก็บ convention จริง)
2. **`index.json`** — ตัวกลางที่ถูก generate จาก frontmatter นั้น; resolver อ่าน *เฉพาะ* ไฟล์นี้เท่านั้น

> ⚠️ **ห้ามแก้ `index.json` หรือ `bundle.json` ด้วยมือเด็ดขาด** — ทั้งคู่เป็น generated artifact
> หลังเพิ่มหรือแก้ skill ใด ๆ ให้ run `cd scripts && npm run build` เพื่อ regenerate

### ทำไมต้องมี `index.json`, `bundle.json` และ `public/r/`

- **`index.json`** — lean ที่สุด สร้างมาเพื่อขั้นตอน "match + resolve dependency" ของ resolver โดยเฉพาะ (มีแค่ metadata)
- **`bundle.json`** — catalog รวมที่เพิ่ม `description` + `useWhen`/`doNotUseWhen` ให้ consumer (ปกติคือ LLM) ตัดสินใจได้ว่า **จะเลือก skill ไหน** และแนบ `raw` (SKILL.md เต็ม) ไว้เป็น payload ด้วย
- **`public/r/<name>.json`** — แยกไฟล์ต่อ skill (เนื้อหาเดียวกับ 1 entry ใน `bundle.json`) เพื่อให้ดึง **ทีละตัว** ได้โดยไม่ต้องโหลด catalog ทั้งก้อน — เป็นสิ่งที่ route `GET /skills/<name>.json` และ tool `get_skills` เสิร์ฟ

Flow ปกติคือ: อ่าน metadata เพื่อ "เลือก" ก่อน (ประหยัด token) แล้วค่อยดึง `raw` เฉพาะ skill ที่เลือกตอน fetch time

---

## 4. ตัวอย่าง Use Case

**Use Case A — เริ่มโปรเจกต์ Next.js ใหม่**

```
Dev: "Start a project with nextjs + tailwind + supabase"
→ resolve_skills(["nextjs", "tailwind", "supabase"])
→ คืน: nextjs, react (dep ของ nextjs), tailwind, supabase, postgres (dep ของ supabase)
→ Confirm checklist → get_skills(["nextjs","react","tailwind","supabase","postgres"])
→ เขียน raw ของแต่ละอัน → .claude/skills/ มีครบ 5 อัน พร้อม convention ของบริษัท
```

**Use Case B — โปรเจกต์ Codex (ไม่มีคอนเซปต์ SKILL.md)**

```
→ หลัง fetch → generate-agents-md.js รวม body ของทุก skill (ตัด frontmatter ออก)
→ ได้ AGENTS.md ไฟล์เดียวที่ root ของโปรเจกต์ (เรียงตาม category)
```

**Use Case C — เพิ่ม skill ใหม่เข้า registry**

```
1. สร้าง skills/<category>/<name>/SKILL.md พร้อม frontmatter ที่จำเป็น
2. เขียน body เป็น convention จริงของบริษัท (ไม่ใช่แบบอุดมคติ)
3. cd scripts && npm run build   ← regenerate index.json + bundle.json + public/r/
4. node tests/resolver.test.js   ← verify ว่า keyword ยัง resolve ถูกต้อง
```

---

## 5. กฎสำคัญที่ต้องรู้ (Idempotency)

เมื่อ skill ถูกดึงเข้าโปรเจกต์ปลายทางแล้ว (`.claude/skills/<name>/`) มันจะถูก **"freeze" เป็นส่วนหนึ่งของโปรเจกต์นั้น** และจะไม่ auto-sync กับ registry อีก แม้ upstream จะถูก update ก็ตาม ถ้าจะ update ต้องลบ copy เดิมในโปรเจกต์ทิ้ง แล้ว run fetch flow ใหม่

Behavior สำคัญที่ต้องจำ:

- `fetch-skills.js` (และการเขียนผ่าน `get_skills`) **จะไม่ overwrite** ไฟล์ที่มีอยู่แล้ว (ข้ามให้อัตโนมัติ)
- ข้อยกเว้นเดียวคือ `AGENTS.md` ที่จะถูก regenerate ใหม่ทั้งหมดเสมอ (ไม่มีการ merge)