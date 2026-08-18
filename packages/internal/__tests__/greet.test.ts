import { describe, expect, it } from "vitest"
import { createScope } from "@core/index"
import { greetFlow } from "@internal/flows/greet"

describe("greetFlow", () => {
  it("greets the given name", async () => {
    const scope = createScope()
    const result = await scope.run({ flow: greetFlow, input: { name: "Ada" } })
    expect(result).toBe("Hello, Ada!")
    await scope.dispose()
  })
})
