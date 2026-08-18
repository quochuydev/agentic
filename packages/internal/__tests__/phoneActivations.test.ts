import { afterEach, describe, expect, it } from "vitest"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createScope } from "@core/index"
import { phoneActivationsFlow, resolvePhoneActivations } from "@internal/flows/phoneActivations"

const fixturePath = fileURLToPath(new URL("./fixtures/phone-activations.csv", import.meta.url))

let dir: string

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe("resolvePhoneActivations", () => {
  it("merges a back-to-back reactivation chain into the earliest activation date", () => {
    const result = resolvePhoneActivations([
      { phone: "1111", activate: "2020-01-01", deactivate: "2020-02-01" },
      { phone: "1111", activate: "2020-02-01", deactivate: "2020-03-01" },
      { phone: "1111", activate: "2020-03-01", deactivate: "" },
    ])
    expect(result).toEqual([{ phone: "1111", realActivationDate: "2020-01-01" }])
  })

  it("picks the most recent period when periods have a gap", () => {
    const result = resolvePhoneActivations([
      { phone: "2222", activate: "2019-01-01", deactivate: "2019-06-01" },
      { phone: "2222", activate: "2021-01-01", deactivate: "2021-06-01" },
    ])
    expect(result).toEqual([{ phone: "2222", realActivationDate: "2021-01-01" }])
  })

  it("resolves a single still-active period", () => {
    const result = resolvePhoneActivations([
      { phone: "3333", activate: "2022-05-05", deactivate: "" },
    ])
    expect(result).toEqual([{ phone: "3333", realActivationDate: "2022-05-05" }])
  })

  it("sorts results by phone number ascending", () => {
    const result = resolvePhoneActivations([
      { phone: "3333", activate: "2022-05-05", deactivate: "" },
      { phone: "1111", activate: "2020-01-01", deactivate: "" },
    ])
    expect(result.map((r) => r.phone)).toEqual(["1111", "3333"])
  })
})

describe("phoneActivationsFlow", () => {
  it("reads the input csv and writes real activation dates", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "phone-activations-"))
    const outputPath = path.join(dir, "output.csv")

    const scope = createScope()
    const result = await scope.run({
      flow: phoneActivationsFlow,
      input: { inputPath: fixturePath, outputPath },
    })
    await scope.dispose()

    expect(result).toEqual({ count: 3, outputPath })
    expect(readFileSync(outputPath, "utf8")).toBe(
      "PHONE_NUMBER,REAL_ACTIVATION_DATE\n1111,2020-01-01\n2222,2021-01-01\n3333,2022-05-05\n"
    )
  })

  it("defaults outputPath to output.csv when not given", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "phone-activations-"))
    const cwdBefore = process.cwd()
    process.chdir(dir)

    const scope = createScope()
    const result = await scope.run({ flow: phoneActivationsFlow, input: { inputPath: fixturePath } })
    await scope.dispose()

    process.chdir(cwdBefore)
    expect(result).toEqual({ count: 3, outputPath: "output.csv" })
    expect(readFileSync(path.join(dir, "output.csv"), "utf8")).toContain("1111,2020-01-01")
  })

  it("throws when a data row has fewer than 3 fields", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "phone-activations-"))
    const badInput = path.join(dir, "bad.csv")
    const outputPath = path.join(dir, "output.csv")
    writeFileSync(badInput, "PHONE_NUMBER,ACTIVATION_DATE,DEACTIVATION_DATE\n1111,2020-01-01\n")

    const scope = createScope()
    await expect(
      scope.run({ flow: phoneActivationsFlow, input: { inputPath: badInput, outputPath } })
    ).rejects.toThrow("Wrong format at line")
    await scope.dispose()
  })
})
