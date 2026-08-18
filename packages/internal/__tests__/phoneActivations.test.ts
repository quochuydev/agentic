import { describe, expect, it } from "vitest"
import { resolvePhoneActivations } from "@internal/flows/phoneActivations"

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
