import { Elysia } from "elysia";
import { db, closeDB } from "@/db/client";

export const dbPlugin = new Elysia({ name: "db" })
  .decorate("db", db)
  .onStop(async () => {
    await closeDB();
  });