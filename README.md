# agentic

A typed dependency and flow runtime built around resources (cached, scope-level singletons), flows (composable units of execution with typed input/faults), and a scope that manages their lifecycle.

## Scripts

```bash
npm test                                  # run vitest
npm run cli -- <flow-name> [json-input]   # run a flow by name via packages/cli/main.ts
npm run cli -- migration
npm run cli -- greet '{"name":"Ada"}'
```
