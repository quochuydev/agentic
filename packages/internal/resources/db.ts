import { resource } from "@core/index"

export interface User {
  id: string
  name: string
  email: string
  migratedAt?: string
}

const users: User[] = [
  { id: "1", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "2", name: "Alan Turing", email: "alan@example.com" },
  { id: "3", name: "Grace Hopper", email: "grace@example.com" },
]

export const db = resource({
  factory: () => ({
    findUserById: (id: string): User | undefined => users.find((user) => user.id === id),
    listUsers: (): User[] => [...users],
    createUser: (input: Omit<User, "id">): User => {
      const user: User = { id: String(users.length + 1), ...input }
      users.push(user)
      return user
    },
    /** Update: backfills `migratedAt` on every user that doesn't have it yet. */
    migrateUsers: (): number => {
      const now = new Date().toISOString()
      let updated = 0
      for (const user of users) {
        if (!user.migratedAt) {
          user.migratedAt = now
          updated++
        }
      }
      return updated
    },
    /** Query: counts how many users still lack `migratedAt`. */
    countUnmigratedUsers: (): number => users.filter((user) => !user.migratedAt).length,
  }),
})
