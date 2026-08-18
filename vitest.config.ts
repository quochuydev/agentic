import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "packages/core"),
      "@internal": path.resolve(__dirname, "packages/internal"),
    },
  },
})
