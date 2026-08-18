---
paths:
  - "packages/internal/resources/**"
---

# Resource conventions

- Resource factories (`resource({ factory })`) should be side-effect-free until first resolution; the factory only runs once per scope and is cached from then on (see `db.ts`).
- Model state as module-local (closed over by the factory), and expose it only through methods on the returned object, not directly.
