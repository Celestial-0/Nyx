import { Elysia } from "elysia";
import { authHandler } from "@/modules/auth/auth.handler";

export const authModule = new Elysia({
    name: "auth.module",
}).use(authHandler);