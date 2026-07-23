---
name: supabase
category: database
match: [supabase]
requires: [postgres]
version: 1.0.0
---

# Supabase Skill

Company conventions for Supabase.

## Client setup

```ts
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js"
import { Database } from "./database.types"

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

## Auth

- Use Supabase Auth for authentication
- RLS (Row Level Security) on all tables
- Always define policies per operation (SELECT/INSERT/UPDATE/DELETE)

## Database

- Use the Supabase SQL editor or migrations via `supabase migration`
- Generate TypeScript types from schema: `supabase gen types typescript --linked > lib/database.types.ts`

## Storage

- Public bucket for user-uploaded content with RLS policies
- Use `supabase.storage.from().upload()` with path convention `{userId}/{filename}`
