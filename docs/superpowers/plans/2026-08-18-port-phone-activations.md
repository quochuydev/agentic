# Port Phone Activations (.hidden/main.go) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the phone-activation-history resolver in `.hidden/main.go` into `packages/internal/` as a flow, runnable via `npm run cli -- phone-activations '{"inputPath":...}'`, producing identical output to the Go binary.

**Architecture:** A new `csvFile` resource does streaming CSV read/write over `node:fs`/`node:readline` (no dependency added). A pure function `resolvePhoneActivations` reproduces the Go program's chain-walking algorithm with no I/O, so it's unit-testable directly. A new `phoneActivationsFlow` wires the two together: read rows via `csvFile`, validate/parse, call the pure function, write rows via `csvFile`. The flow is registered in the CLI's `flows` map like `greetFlow` and `migrationFlow`.

**Tech Stack:** TypeScript, Vitest, Node built-ins only (`node:fs`, `node:readline`, `node:path`, `node:os`, `node:url`).

**Spec:** No separate spec file — this is a bounded port with the design agreed in conversation (see Design Summary below). This plan carries the full design in place of a spec doc.

**Design Summary (source of truth for the algorithm):**
- Input CSV columns: `PHONE_NUMBER, ACTIVATION_DATE, DEACTIVATION_DATE`. First line is always a header and is skipped unconditionally (mirrors Go's `didReadHeader` flag).
- A data row with fewer than 3 fields throws (mirrors Go's `"Wrong format at line %v"` check).
- Build `phone -> Map<deactivateDate, activateDate>` from all rows for that phone (a still-active row has `deactivateDate === ""`).
- Per phone, pick a starting `activateDate`: the value at key `""` if the phone has a still-active period, otherwise the value at the lexicographically-largest deactivate-date key.
- Walk backward: while `periods.get(activateDate)` is truthy, replace `activateDate` with that value. This merges back-to-back reactivation periods (where one period's activation date equals a prior period's deactivation date) into the earliest activation date in the chain.
- Output columns: `PHONE_NUMBER, REAL_ACTIVATION_DATE`, one row per phone, sorted by phone number ascending (string sort).

## Global Constraints

- Flows compose only through `deps` + `.exec()`; never import another flow's factory directly (`.claude/rules/flows.md`).
- Any CLI-runnable flow must be added to the `flows` map in `packages/cli/main.ts` (`.claude/rules/flows.md`).
- Resource factories are side-effect-free until first resolution; state is module-local, exposed only via returned methods (`.claude/rules/resources.md`).
- Tests follow `createScope()` → `await scope.run({ flow, input })` → assert → `await scope.dispose()`, one scope per `it()` (`.claude/rules/testing.md`).
- No new runtime dependencies — `package.json` has none today; implement CSV parsing/writing with Node built-ins only.
- Path aliases: `@core/*` → `packages/core`, `@internal/*` → `packages/internal`.

---

### Task 1: `csvFile` resource (streaming CSV read/write)

**Files:**
- Create: `packages/internal/resources/csvFile.ts`
- Test: `packages/internal/__tests__/csvFile.test.ts`

**Interfaces:**
- Produces: `csvFile: Core.Resource<{ read(path: string): Promise<string[][]>; write(path: string, rows: string[][]): Promise<void> }>` — consumed by Task 3's `phoneActivationsFlow`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/internal/__tests__/csvFile.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/internal/__tests__/csvFile.test.ts`
Expected: FAIL — `Cannot find module '@internal/resources/csvFile'` (or similar resolution error), since the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/internal/resources/csvFile.ts
import { createReadStream, createWriteStream } from "node:fs"
import { createInterface } from "node:readline"
import { resource } from "@core/index"

export const csvFile = resource({
  factory: () => ({
    read: async (path: string): Promise<string[][]> => {
      const rows: string[][] = []
      const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
      for await (const line of rl) {
        if (line.length === 0) continue
        rows.push(line.split(","))
      }
      return rows
    },
    write: (path: string, rows: string[][]): Promise<void> =>
      new Promise((resolve, reject) => {
        const stream = createWriteStream(path)
        stream.on("error", reject)
        stream.on("finish", resolve)
        for (const row of rows) {
          stream.write(row.join(",") + "\n")
        }
        stream.end()
      }),
  }),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/internal/__tests__/csvFile.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/internal/resources/csvFile.ts packages/internal/__tests__/csvFile.test.ts
git commit -m "feat: add streaming csvFile resource"
```

---

### Task 2: `resolvePhoneActivations` pure algorithm

**Files:**
- Create: `packages/internal/flows/phoneActivations.ts` (types + pure function only in this task; the flow itself is added in Task 3)
- Test: `packages/internal/__tests__/phoneActivations.test.ts` (pure-function tests only in this task; flow tests are added in Task 3)

**Interfaces:**
- Produces: `PhoneRow { phone: string; activate: string; deactivate: string }`, `PhoneActivation { phone: string; realActivationDate: string }`, and `resolvePhoneActivations(rows: PhoneRow[]): PhoneActivation[]` — consumed by Task 3's `phoneActivationsFlow`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/internal/__tests__/phoneActivations.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/internal/__tests__/phoneActivations.test.ts`
Expected: FAIL — `Cannot find module '@internal/flows/phoneActivations'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/internal/flows/phoneActivations.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/internal/__tests__/phoneActivations.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/internal/flows/phoneActivations.ts packages/internal/__tests__/phoneActivations.test.ts
git commit -m "feat: add resolvePhoneActivations algorithm"
```

---

### Task 3: `phoneActivationsFlow`

**Files:**
- Modify: `packages/internal/flows/phoneActivations.ts` (add the flow, using Task 2's `resolvePhoneActivations`/types and Task 1's `csvFile`)
- Create: `packages/internal/__tests__/fixtures/phone-activations.csv`
- Modify: `packages/internal/__tests__/phoneActivations.test.ts` (add flow-level tests)

**Interfaces:**
- Consumes: `csvFile` from Task 1 (`read(path): Promise<string[][]>`, `write(path, rows): Promise<void>`); `resolvePhoneActivations`, `PhoneRow`, `PhoneActivation` from Task 2.
- Produces: `phoneActivationsFlow: Core.Flow<{ count: number; outputPath: string }, { inputPath: string; outputPath?: string }, never>` — consumed by Task 4's CLI wiring.

- [ ] **Step 1: Create the fixture file**

```csv
PHONE_NUMBER,ACTIVATION_DATE,DEACTIVATION_DATE
1111,2020-01-01,2020-02-01
1111,2020-02-01,2020-03-01
1111,2020-03-01,
2222,2019-01-01,2019-06-01
2222,2021-01-01,2021-06-01
3333,2022-05-05,
```

Save as `packages/internal/__tests__/fixtures/phone-activations.csv`. This exercises all three cases from Task 2's unit tests, now through the full CSV round trip. Expected output (verified in Step 2's test): `1111 -> 2020-01-01`, `2222 -> 2021-01-01`, `3333 -> 2022-05-05`.

- [ ] **Step 2: Write the failing test**

Replace the top of `packages/internal/__tests__/phoneActivations.test.ts` (the single `import { describe, expect, it } from "vitest"` line and the `import { resolvePhoneActivations } from "@internal/flows/phoneActivations"` line from Task 2) with:

```typescript
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
```

Leave the existing `describe("resolvePhoneActivations", ...)` block from Task 2 unchanged below that, and append this new block after it:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/internal/__tests__/phoneActivations.test.ts`
Expected: FAIL — `phoneActivationsFlow` is not exported from `@internal/flows/phoneActivations`.

- [ ] **Step 4: Write minimal implementation**

Add this import block to the top of `packages/internal/flows/phoneActivations.ts`, above the `PhoneRow` interface:

```typescript
import { flow, typed } from "@core/index"
import { csvFile } from "@internal/resources/csvFile"
```

Then append to the end of the same file:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/internal/__tests__/phoneActivations.test.ts`
Expected: PASS (7 tests total: 4 from Task 2 + 3 new)

- [ ] **Step 6: Commit**

```bash
git add packages/internal/flows/phoneActivations.ts packages/internal/__tests__/phoneActivations.test.ts packages/internal/__tests__/fixtures/phone-activations.csv
git commit -m "feat: add phoneActivationsFlow"
```

---

### Task 4: Wire into CLI and verify against the real 68MB fixture

**Files:**
- Modify: `packages/cli/main.ts:1-6` (imports and `flows` map)

**Interfaces:**
- Consumes: `phoneActivationsFlow` from Task 3.

- [ ] **Step 1: Register the flow in the CLI**

In `packages/cli/main.ts`, add the import next to the existing flow imports:

```typescript
import { phoneActivationsFlow } from "@internal/flows/phoneActivations"
```

And add it to the `flows` map:

```typescript
const flows: Record<string, Core.Flow<any, any, any>> = {
  greet: greetFlow,
  migration: migrationFlow,
  "phone-activations": phoneActivationsFlow,
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `csvFile` and `phoneActivations` suites.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/main.ts
git commit -m "feat: register phone-activations flow in the cli"
```

- [ ] **Step 5: Manually verify against the real 68MB / 2.48M-row fixture**

This step is a manual sanity check, not an automated test — `assets/test_big_file.csv` is too large to run on every `npm test`. Write the output outside the repo (e.g. under `$TMPDIR`), not into `assets/`, since `assets/test_big_file.out.csv` was already removed from the repo and shouldn't be silently recreated as a tracked file.

Run:
```bash
npm run cli -- phone-activations "{\"inputPath\":\"assets/test_big_file.csv\",\"outputPath\":\"${TMPDIR:-/tmp}/test_big_file.out.csv\"}"
```

Confirm:
- The command completes without an out-of-memory error or crash.
- The logged output (`[cli] flow=phone-activations ... output={"count":...,...}`) shows a `count` that's a plausible number of distinct phone numbers (fewer than the 2.48M input rows, since many phones repeat).
- `head "${TMPDIR:-/tmp}/test_big_file.out.csv"` shows a `PHONE_NUMBER,REAL_ACTIVATION_DATE` header followed by sorted phone numbers with plausible dates.

No commit for this step — it's verification only, and the generated file stays outside the repo.
