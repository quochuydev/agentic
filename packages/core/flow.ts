import { flowSymbol, typedSymbol, FlowFault, type Core, type MaybePromise } from "./types"

/**
 * Type marker for flow input without runtime parsing.
 */
export function typed<T>(): Core.Typed<T> {
  return { [typedSymbol]: true }
}

export function flow<
  Output,
  Input,
  const D extends Record<string, Core.Dependency>,
>(config: {
  name?: string
  parse: Core.Typed<Input>
  deps: D
  faults?: undefined
  factory: (ctx: Core.ExecutionContext<never> & { readonly input: Input }, deps: Core.InferDeps<D>) => MaybePromise<Output>
}): Core.Flow<Output, Input, never>

export function flow<
  Output,
  const D extends Record<string, Core.Dependency>,
  Fault = never,
>(config: {
  name?: string
  parse?: undefined
  deps: D
  faults?: Core.Typed<Fault>
  factory: (ctx: Core.ExecutionContext<Fault>, deps: Core.InferDeps<D>) => MaybePromise<Output>
}): Core.Flow<Output, void, Fault>

export function flow(config: any): Core.Flow<any, any, any> {
  return {
    [flowSymbol]: true,
    name: config.name,
    factory: config.factory,
    deps: config.deps,
  }
}

export function isFlow(value: unknown): value is Core.Flow<unknown, unknown, never> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[flowSymbol] === true
  )
}

/**
 * Type guard narrowing an unknown error to the fault type declared by `flow`.
 *
 * Honesty note: the runtime check can only verify `error instanceof FlowFault`
 * and that `error.flow` matches the flow's name. It trusts the flow-name match
 * as a proxy for flow identity — it does not (cannot) verify that `error` was
 * actually thrown by this exact `flow` instance.
 */
export function isFault<F>(
  flow: Core.Flow<any, any, F>,
  error: unknown
): error is FlowFault & { fault: F } {
  return error instanceof FlowFault && error.flow === (flow.name ?? "anonymous")
}
