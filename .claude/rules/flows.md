---
paths:
  - "packages/internal/flows/**"
---

# Flow conventions

- Declare flows with `flow({ name, deps, parse: typed<Input>() | faults: typed<Fault>(), factory })`. Always set `name` — it's used for fault matching and CLI dispatch.
- Compose sub-flows only through `deps` + `.exec()` (see `migration.ts`'s `migrationFlow` calling `migrate.exec()` / `verify.exec()`), never by importing and calling another flow's `factory` directly — that bypasses the scope's dependency resolution and extension wrapping.
- Any flow meant to be runnable from the CLI must be added to the `flows` map in `packages/cli/main.ts`.
