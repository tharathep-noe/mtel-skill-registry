---
name: tailwind
category: frontend
match: [tailwind, tailwindcss]
requires: []
version: 1.0.0
---

# Tailwind CSS Skill

Company conventions for Tailwind CSS.

## Class ordering

Use Prettier plugin `prettier-plugin-tailwindcss` — let the formatter handle order.

## Design tokens

All design tokens come from `tailwind.config.ts` — no arbitrary values (`h-[32px]`) unless the design system doesn't cover the case.

## Utility patterns

```tsx
// Good — use cn() for conditional classes
<div className={cn("flex items-center gap-2", isActive && "bg-blue-100")} />

// Avoid — long inline conditionals
<div className={`flex items-center gap-2 ${isActive ? "bg-blue-100" : ""}`} />
```

## Component patterns

- Extract repeated class groups into React components (don't repeat markup+classes)
- Use `@apply` only in component libraries, never in page code
