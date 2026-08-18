import type { Core } from "@core/index"

export function logExtension(): Core.Extension {
  let logged = false

  return {
    name: "log",
    wrapExec: async (next, _target, ctx) => {
      const isOutermost = !logged
      logged = true

      const start = Date.now()
      const output = await next()

      if (isOutermost) {
        const name = ctx.name ?? "anonymous"
        const durationMs = Date.now() - start
        console.log(
          `[cli] flow=${name} input=${JSON.stringify(ctx.input)} output=${JSON.stringify(output)} durationMs=${durationMs}`
        )
      }

      return output
    },
  }
}
