import { createScope, isFault, type Core } from "@core/index"
import { greetFlow } from "@internal/flows/greet"
import { migrationFlow } from "@internal/flows/migration"
import { phoneActivationsFlow } from "@internal/flows/phoneActivations"
import { logExtension } from "@internal/extensions/log"

const flows: Record<string, Core.Flow<any, any, any>> = {
  greet: greetFlow,
  migration: migrationFlow,
  "phone-activations": phoneActivationsFlow,
}

const [flowName, rawInput] = process.argv.slice(2)
const flow = flowName ? flows[flowName] : undefined

if (!flow) {
  console.error(`usage: npm run cli -- <${Object.keys(flows).join("|")}> [json-input]`)
  process.exit(1)
}

const input = rawInput !== undefined ? JSON.parse(rawInput) : undefined
const scope = createScope({ extensions: [logExtension()] })

try {
  const result = await scope.run({ flow, input })
  console.log(result)
} catch (error) {
  if (isFault(flow, error)) {
    console.error(`${flowName} failed:`, error.fault)
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  await scope.dispose()
}
