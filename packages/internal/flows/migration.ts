import { flow, typed } from "@core/index"
import { db } from "@internal/resources/db"

/** Sub-flow: updates the db, backfilling `migratedAt` on every user. */
export const migrate = flow({
  name: "migrate",
  deps: { db },
  factory: (_ctx, { db }) => db.migrateUsers(),
})

/** Sub-flow: queries the db to confirm the migration is complete. */
export const verify = flow({
  name: "verify",
  deps: { db },
  factory: (_ctx, { db }) => {
    const remaining = db.countUnmigratedUsers()
    return { ok: remaining === 0, remaining }
  },
})

/** Main flow: runs the migration, then verifies it landed. */
export const migrationFlow = flow({
  name: "migration",
  faults: typed<{ kind: "verification-failed"; remaining: number }>(),
  deps: { migrate: migrate, verify: verify },
  factory: async (ctx, { migrate, verify }) => {
    const updated = await migrate.exec()
    const { ok, remaining } = await verify.exec()
    if (!ok) ctx.fail({ kind: "verification-failed", remaining })
    return { updated, remaining }
  },
})
