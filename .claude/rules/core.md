---
paths:
  - "packages/core/**"
---

# Core runtime conventions

- New primitives are tagged with a `unique symbol` (see `resourceSymbol`, `flowSymbol`, `typedSymbol` in `types.ts`), not a string discriminant or `instanceof` check. Type guards (`isResource`, `isFlow`) read that symbol.
- All public types live under the `Core` namespace in `types.ts`. Add new shared types there rather than exporting loose top-level interfaces.
- `flow()` is intentionally two overloads: one with `parse` (typed input, no `faults`), one with `faults` (typed fault channel, no `parse`). Don't collapse these into a single signature — a flow can't declare both today.
- `typed<T>()` is a compile-time-only phantom marker (`{ [typedSymbol]: true }`). It does not parse or validate anything at runtime — don't add runtime logic to it or assume `ctx.input` has been validated.
- `FlowFault` is matched by flow **name** in `isFault()`, not by instance identity. Anonymous flows all share the name `"anonymous"` and will match each other's faults — keep this in mind if adding fault-matching logic.
- `ScopeImpl.resourceCache` keys resources by object identity, not name. Resource sharing across a scope depends on reusing the same exported `resource()` instance.
