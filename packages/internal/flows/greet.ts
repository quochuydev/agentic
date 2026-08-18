import { resource, flow, typed } from "@core/index"

export const greeter = resource({
  factory: () => ({
    greet: (name: string) => `Hello, ${name}!`,
  }),
})

export const greetFlow = flow({
  name: "greet",
  parse: typed<{ name: string }>(),
  deps: { greeter },
  factory: (ctx, { greeter }) => greeter.greet(ctx.input.name),
})
