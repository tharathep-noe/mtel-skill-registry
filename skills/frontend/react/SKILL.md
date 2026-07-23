---
name: react
category: frontend
match: [react, reactjs, "react.js"]
requires: []
version: 1.0.0
---

# React Skill

Company conventions for React.

## Component patterns

- Default to function components with hooks
- Lift state to the smallest common ancestor
- Extract logic into custom hooks when it uses React hooks (`useState`, `useEffect`, etc.)
- Extract pure functions into `lib/` utilities (not hooks)

## Props

```tsx
// Good — explicit interface, destructure in params
interface ButtonProps {
  variant: "primary" | "secondary"
  children: React.ReactNode
}

// Avoid — inline types that are reused elsewhere
```

## State management

- React state + context for UI state
- tRPC react-query for server state
- Avoid Redux/Zustand unless the project already uses them
