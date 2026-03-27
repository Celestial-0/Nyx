import { createClient } from "@libsql/client"

let db: ReturnType<typeof createClient> | null = null

export function getDb() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return db
}
