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
