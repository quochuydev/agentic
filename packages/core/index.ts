export type { Core } from "./types"
export { resourceSymbol, flowSymbol, typedSymbol, FlowFault } from "./types"
export { resource, isResource } from "./resource"
export { flow, isFlow, typed, isFault } from "./flow"
export { createScope } from "./scope"

declare const __PACKAGE_VERSION__: string

/** Current package version. */
export const VERSION: string = typeof __PACKAGE_VERSION__ === "string" ? __PACKAGE_VERSION__ : "0.0.0-source"
