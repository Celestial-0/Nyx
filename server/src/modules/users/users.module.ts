import { Elysia } from "elysia";
import { usersHandler } from "@/modules/users/users.handler";

export const usersModule = new Elysia({
  name: "users.module",
}).use(usersHandler);
