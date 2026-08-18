import { describe, expect, it } from "vitest"
import { createScope } from "@core/index"
import { migrationFlow } from "@internal/flows/migration"

describe("migrationFlow", () => {
  it("migrates users and verifies the result", async () => {
    const scope = createScope()
    const result = await scope.run({ flow: migrationFlow })
    expect(result).toEqual({ updated: 3, remaining: 0 })
    await scope.dispose()
  })

  it("is a no-op verified migration when run again", async () => {
    const scope = createScope()
    await scope.run({ flow: migrationFlow })
    const result = await scope.run({ flow: migrationFlow })
    expect(result).toEqual({ updated: 0, remaining: 0 })
    await scope.dispose()
  })
})
