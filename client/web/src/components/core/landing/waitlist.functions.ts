import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getDb } from "@/lib/db"

const JoinWaitlistSchema = z.object({
  email: z.email("Please enter a valid email address"),
})

// Ensure the waitlist table exists (runs once on first call)
let tableCreated = false
async function ensureTable() {
  if (tableCreated) return
  const db = getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  tableCreated = true
}

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator(JoinWaitlistSchema)
  .handler(async ({ data }) => {
    await ensureTable()
    const db = getDb()

    try {
      await db.execute({
        sql: "INSERT INTO waitlist (email) VALUES (?)",
        args: [data.email],
      })
    } catch (err: unknown) {
      // SQLite UNIQUE constraint violation
      if (
        err instanceof Error &&
        err.message.includes("UNIQUE constraint failed")
      ) {
        throw new Error("This email is already on the waitlist")
      }
      throw err
    }

    const result = await db.execute("SELECT COUNT(*) as count FROM waitlist")
    const count = result.rows[0]?.count ?? 0
    console.log(`[Waitlist] ✓ ${data.email} (total: ${count})`)

    return { success: true, email: data.email }
  })
