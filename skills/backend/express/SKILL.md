---
name: express
category: backend
match: [express, expressjs, "express.js"]
requires: []
version: 1.0.0
description: Company conventions for building HTTP APIs with Express.
useWhen:
  - Building a REST/HTTP API or web server on Node.js with Express
  - Adding routes, middleware, or error handling to an Express app
doNotUseWhen:
  - Using NestJS instead (use the nestjs skill)
  - Building a frontend or a non-HTTP service
---

# Express Skill

Company conventions for Express.js backends.

## Project structure

```
src/
  routes/
    users.routes.ts
    auth.routes.ts
  middleware/
    auth.middleware.ts
    error.middleware.ts
  services/
    users.service.ts
  utils/
    api-response.ts
  app.ts
  server.ts
```

## Patterns

- Router files define routes and wire middleware
- Controllers are thin — validate with `express-validator`, delegate to services
- Error handling via centralized error middleware (not try/catch in every route)
- Use `async-wrap` or a wrapper to catch async errors

## Response format

```ts
// Consistent envelope
{ status: "success" | "error", data?: any, message?: string }
```
