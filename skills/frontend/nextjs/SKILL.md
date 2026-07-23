---
name: nextjs
category: frontend
match: [nextjs, "next.js", next]
requires: [react]
version: 1.0.0
---

# Next.js Skill

Company conventions for Next.js projects.

## Project structure

```
app/
  (marketing)/
    page.tsx          # Public landing routes
  (dashboard)/
    layout.tsx        # Authenticated layout
    page.tsx          # Dashboard home
  api/                # Route handlers (App Router)
    trpc/
      [trpc]/
        route.ts
lib/                  # Shared utilities
  db.ts
  auth.ts
components/           # Shared UI components
  ui/                 # Primitive components (button, input, etc.)
providers/            # React context providers
```

## Routing

- Use App Router exclusively (no `pages/`)
- Route groups `(group)` for layout segmentation, not for URL structure
- Server Components by default; add `'use client'` only when needed

## Data fetching

- Prefer server-side data fetching in Server Components
- Use `fetch()` with Next.js caching: `cache: 'force-cache'` for static, `cache: 'no-store'` for dynamic
- Use tRPC for authenticated client-server interactions

## Styling

- Tailwind CSS for all styling
- Use `cn()` utility from `clsx` + `tailwind-merge` for conditional classes
