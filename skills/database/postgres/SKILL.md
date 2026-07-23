---
name: postgres
category: database
match: [postgres, postgresql]
requires: []
version: 1.0.0
---

# PostgreSQL Skill

Company conventions for PostgreSQL databases.

## Connections

- Connection pooling via PgBouncer in production
- Connection string from environment: `DATABASE_URL`
- SSL required for production connections

## Naming

- Tables: snake_case, plural (`users`, `blog_posts`)
- Columns: snake_case (`created_at`, `user_id`)
- Primary keys: `id BIGSERIAL PRIMARY KEY` or UUID
- Foreign keys: `{referenced_table}_id`

## Migrations

- Use Prisma Migrate or direct SQL via `supabase migration`
- One migration per schema change, never squash
- Always add `down` migration if writing raw SQL

## Performance

- Add indexes for columns used in WHERE, JOIN, ORDER BY
- Use `EXPLAIN ANALYZE` to verify query plans
- Avoid N+1 by using JOINs or batch loading
