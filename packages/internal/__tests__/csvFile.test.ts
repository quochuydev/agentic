import { afterEach, describe, expect, it } from "vitest"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { csvFile } from "@internal/resources/csvFile"

let dir: string

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe("csvFile", () => {
  it("reads rows from a csv file", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "csv-file-"))
    const filePath = path.join(dir, "input.csv")
    writeFileSync(filePath, "a,b,c\n1,2,3\n")

    const { read } = await csvFile.factory()
    const rows = await read(filePath)

    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("skips blank lines", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "csv-file-"))
    const filePath = path.join(dir, "input.csv")
    writeFileSync(filePath, "a,b\n\n1,2\n")

    const { read } = await csvFile.factory()
    const rows = await read(filePath)

    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("writes rows to a csv file", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "csv-file-"))
    const filePath = path.join(dir, "output.csv")

    const { write } = await csvFile.factory()
    await write(filePath, [
      ["a", "b"],
      ["1", "2"],
    ])

    expect(readFileSync(filePath, "utf8")).toBe("a,b\n1,2\n")
  })
})
