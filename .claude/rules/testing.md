---
paths:
  - "**/*.test.ts"
---

# Test conventions

- Follow the pattern in `packages/internal/__tests__/*.test.ts`: `createScope()` → `await scope.run({ flow, input })` → assert on the returned value → `await scope.dispose()`.
- Use one scope per `it()` block; don't share a scope across tests since resource caching is per-scope and can leak state between assertions.
- Prefer asserting the flow's return value over reaching into resource internals (e.g. assert `migrationFlow`'s `{ updated, remaining }` result rather than inspecting `db`'s user list directly).
