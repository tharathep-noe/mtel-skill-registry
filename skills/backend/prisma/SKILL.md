---
name: prisma
category: backend
match: [prisma]
requires: []
version: 1.0.0
description: Company conventions for data access with the Prisma ORM.
useWhen:
  - Defining a database schema or running migrations with Prisma
  - Writing type-safe database queries via Prisma Client
doNotUseWhen:
  - Not using Prisma for data access
  - Writing raw SQL without an ORM
---

# Prisma Skill

Company conventions for Prisma ORM.

## Schema conventions

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}
```

## Naming

- Models: PascalCase, singular
- Fields: camelCase
- Relations: same name as the related model (camelCase)
- Join tables: use implicit many-to-many unless custom fields needed

## Migration

- Run `npx prisma migrate dev` during development
- Generate migration names: `npx prisma migrate dev --name add_user_profile`
- Never edit generated migration files manually

## Client

```ts
// Use a singleton in lib/db.ts
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
export default prisma
```
