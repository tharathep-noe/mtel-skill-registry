---
name: nestjs
category: backend
match: [nestjs, "nest.js", nest]
requires: []
version: 1.0.0
---

# NestJS Skill

Company conventions for NestJS backends.

## Module structure

```
src/
  modules/
    users/
      users.module.ts
      users.service.ts
      users.controller.ts
      dto/
      entities/
  common/
    guards/
    interceptors/
    pipes/
    filters/
  config/
    env.ts
    database.config.ts
```

## Patterns

- Feature modules with controllers, services, and DTOs
- Use `@Injectable()` services for business logic
- Keep controllers thin — validation in DTOs, logic in services
- Use `class-validator` + `class-transformer` for DTO validation

## Database

- Prisma as the ORM
- NestJS-prisma module for DI
- Repository pattern via Prisma service wrapper in each module

## Testing

- Unit tests with `jest` + in-memory mocks
- E2E tests with `supertest` + test database
