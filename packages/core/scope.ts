import { FlowFault, type Core } from "./types"
import { isResource } from "./resource"

class ScopeImpl implements Core.Scope {
  private readonly extensions: Core.Extension[]
  private readonly resourceCache = new Map<Core.Resource<unknown>, Promise<unknown>>()
  private disposed = false

  constructor(options?: Core.ScopeOptions) {
    this.extensions = (options?.extensions ?? []).filter((ext) => typeof ext.wrapExec === "function")
  }

  async run<Output, Input>(options: { flow: Core.Flow<Output, Input, any>; input?: Input }): Promise<Output> {
    if (this.disposed) throw new Error("scope is disposed")
    return this.execFlow(options.flow, options.input) as Promise<Output>
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.resourceCache.clear()
  }

  private resolveResource<T>(resource: Core.Resource<T>): Promise<T> {
    let cached = this.resourceCache.get(resource)
    if (!cached) {
      cached = Promise.resolve(resource.factory())
      this.resourceCache.set(resource, cached)
    }
    return cached as Promise<T>
  }

  private async resolveDeps(deps: Record<string, Core.Dependency> | undefined): Promise<Record<string, unknown>> {
    if (!deps) return {}
    const resolved: Record<string, unknown> = {}
    for (const key in deps) {
      const dep = deps[key]!
      resolved[key] = isResource(dep)
        ? await this.resolveResource(dep)
        : ({ exec: (input?: unknown) => this.execFlow(dep, input) } satisfies Core.FlowHandle<unknown, unknown>)
    }
    return resolved
  }

  private async execFlow(flow: Core.Flow<any, any, any>, input: unknown): Promise<unknown> {
    const deps = await this.resolveDeps(flow.deps)
    const ctx: Core.ExecutionContext = {
      input,
      name: flow.name,
      fail: (fault: unknown) => {
        throw new FlowFault(fault, flow.name)
      },
    }
    const run = () => Promise.resolve((flow.factory as (ctx: unknown, deps: unknown) => unknown)(ctx, deps))
    return this.applyExtensions(flow, ctx, run)()
  }

  private applyExtensions(
    flow: Core.Flow<any, any, any>,
    ctx: Core.ExecutionContext,
    run: () => Promise<unknown>
  ): () => Promise<unknown> {
    let next = run
    for (let i = this.extensions.length - 1; i >= 0; i--) {
      const ext = this.extensions[i]!
      const currentNext = next
      next = () => ext.wrapExec!(currentNext, flow, ctx)
    }
    return next
  }
}

/**
 * Creates a DI container that resolves resources, executes flows, and runs extensions.
 *
 * @example
 * ```typescript
 * const scope = createScope({ extensions: [logging] })
 * const result = await scope.run({ flow: myFlow, input })
 * await scope.dispose()
 * ```
 */
export function createScope(options?: Core.ScopeOptions): Core.Scope {
  return new ScopeImpl(options)
}
