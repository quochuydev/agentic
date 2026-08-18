import { flow, typed } from "@core/index"
import { csvFile } from "@internal/resources/csvFile"

export interface PhoneRow {
  phone: string
  activate: string
  deactivate: string
}

export interface PhoneActivation {
  phone: string
  realActivationDate: string
}

/** Resolves each phone's earliest activation date, merging back-to-back reactivation chains. */
export function resolvePhoneActivations(rows: PhoneRow[]): PhoneActivation[] {
  const phoneMap = new Map<string, Map<string, string>>()
  for (const { phone, activate, deactivate } of rows) {
    if (!phoneMap.has(phone)) phoneMap.set(phone, new Map())
    phoneMap.get(phone)!.set(deactivate, activate)
  }

  const phones = [...phoneMap.keys()].sort()
  const results: PhoneActivation[] = []

  for (const phone of phones) {
    const periods = phoneMap.get(phone)!

    let activateDate: string
    if (periods.has("")) {
      activateDate = periods.get("")!
    } else {
      const deactivateDates = [...periods.keys()].sort()
      const latestDeactivate = deactivateDates[deactivateDates.length - 1]!
      activateDate = periods.get(latestDeactivate)!
    }

    while (true) {
      const next = periods.get(activateDate)
      if (!next) break
      activateDate = next
    }

    results.push({ phone, realActivationDate: activateDate })
  }

  return results
}

export const phoneActivationsFlow = flow({
  name: "phone-activations",
  parse: typed<{ inputPath: string; outputPath?: string }>(),
  deps: { csvFile },
  factory: async (ctx, { csvFile }) => {
    const { inputPath, outputPath = "output.csv" } = ctx.input

    const rawRows = await csvFile.read(inputPath)
    const dataRows = rawRows.slice(1) // first line is always a header

    const rows: PhoneRow[] = dataRows.map((record) => {
      if (record.length < 3) {
        throw new Error(`Wrong format at line ${JSON.stringify(record)}`)
      }
      return { phone: record[0]!, activate: record[1]!, deactivate: record[2]! }
    })

    const activations = resolvePhoneActivations(rows)

    await csvFile.write(outputPath, [
      ["PHONE_NUMBER", "REAL_ACTIVATION_DATE"],
      ...activations.map((a) => [a.phone, a.realActivationDate]),
    ])

    return { count: activations.length, outputPath }
  },
})
