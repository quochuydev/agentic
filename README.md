# agentic

A typed dependency and flow runtime built around resources (cached, scope-level singletons), flows (composable units of execution with typed input/faults), and a scope that manages their lifecycle.

## Layout

- `packages/core/` — library source (`resource`, `flow`, `scope`, `types`), re-exported from `packages/core/index.ts`.
- `packages/internal/resources/` — shared resources (e.g. `db`, a mock in-memory database).
- `packages/internal/flows/` — flows built on the library (`greet`, `migration`: `migrate` + `verify` sub-flows).
- `packages/internal/extensions/` — scope extensions (e.g. `log`, prints one line each time the CLI runs).
- `packages/internal/__tests__/` — tests for the flows.
- `packages/cli/` — `main.ts`, a single entry point that runs a flow by name through a scope.

## Usage

```ts
import { createScope, isFault } from "@core/index"
import { migrationFlow } from "@internal/flows/migration"

const scope = createScope()
const result = await scope.run({ flow: migrationFlow })
await scope.dispose()
```

## Scripts

```bash
npm test                                  # run vitest
npm run cli -- <flow-name> [json-input]   # run a flow by name via packages/cli/main.ts
npm run cli -- migration
npm run cli -- greet '{"name":"Ada"}'
```
