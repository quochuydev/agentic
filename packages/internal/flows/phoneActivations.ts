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
