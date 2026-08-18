import { resourceSymbol, type Core, type MaybePromise } from "./types"

/**
 * Creates a scope-level singleton dependency: resolved once per scope and cached.
 */
export function resource<T>(config: { factory: () => MaybePromise<T> }): Core.Resource<T> {
  return {
    [resourceSymbol]: true,
    factory: config.factory,
  }
}

export function isResource(value: unknown): value is Core.Resource<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[resourceSymbol] === true
  )
}
