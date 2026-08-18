export const resourceSymbol: unique symbol = Symbol.for("@package/resource")
export const flowSymbol: unique symbol = Symbol.for("@package/flow")
export const typedSymbol: unique symbol = Symbol.for("@package/typed")

export class FlowFault extends Error {
  override readonly name = "FlowFault"
  readonly fault: unknown
  readonly flow: string

  constructor(fault: unknown, flow: string | undefined) {
    super(`flow "${flow ?? "anonymous"}" failed: ${safeStringify(fault)}`)
    this.fault = fault
    this.flow = flow ?? "anonymous"
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

export type MaybePromise<T> = T | Promise<T>

export namespace Core {
  export interface Scope {
    run<Output, Input>(options: { flow: Flow<Output, Input, any>; input?: Input }): Promise<Output>
    dispose(): Promise<void>
  }

  export interface ScopeOptions {
    extensions?: Extension[]
  }

  export interface Resource<T> {
    readonly [resourceSymbol]: true
    readonly factory: () => MaybePromise<T>
  }

  export interface Typed<T> {
    readonly [typedSymbol]: true
  }

  export interface Flow<Output, Input = void, Fault = never> {
    readonly [flowSymbol]: true
    readonly name?: string
    readonly factory: FlowFactory<Output, Input, Fault, Record<string, Dependency>>
    readonly deps?: Record<string, Dependency>
    /** Phantom marker carrying the flow's declared fault type; never assigned at runtime. */
    readonly faultType?: Fault
  }

  export interface FlowHandle<Output, Input> {
    exec(input?: Input): Promise<Output>
  }

  export type Dependency = Resource<unknown> | Flow<any, any, any>

  export type InferDep<D> = D extends Resource<infer T>
    ? T
    : D extends Flow<infer Output, infer Input, any>
      ? FlowHandle<Output, Input>
      : never

  export type InferDeps<D> = { [K in keyof D]: InferDep<D[K]> }

  export type FlowFactory<Output, Input, Fault, D extends Record<string, Dependency>> =
    keyof D extends never
      ? (ctx: ExecutionContext<Fault> & { readonly input: Input }) => MaybePromise<Output>
      : (ctx: ExecutionContext<Fault> & { readonly input: Input }, deps: InferDeps<D>) => MaybePromise<Output>

  export interface ExecutionContext<Fault = never> {
    readonly input: unknown
    readonly name: string | undefined
    /** Throws a `FlowFault` carrying `fault`, tagged with the executing flow's name. */
    fail(fault: Fault): never
  }

  export interface Extension {
    readonly name: string
    wrapExec?(
      next: () => Promise<unknown>,
      target: Flow<unknown, unknown, unknown>,
      ctx: ExecutionContext
    ): Promise<unknown>
  }
}
