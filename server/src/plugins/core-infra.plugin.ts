import { Elysia } from "elysia";
import { dbPlugin } from "@/plugins/db.plugin";
import { redisPlugin } from "@/plugins/redis.plugin";
import { jwtPlugin } from "@/plugins/jwt.plugin";
import { eventPlugin } from "@/plugins/event.plugin";

export const coreInfraPlugin = new Elysia({ name: "core.infra" })
  .use(dbPlugin)
  .use(redisPlugin)
  .use(jwtPlugin)
  .use(eventPlugin);
