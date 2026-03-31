import { Elysia} from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";

import {
  loggerPlugin,
  errorPlugin,
  dbPlugin,
  redisPlugin,
  jwtPlugin,
  eventPlugin,
  authPlugin,
} from "@/plugins";
import { authModule, healthModule, usersModule } from "@/modules";

const nyx = new Elysia()
    .use(dbPlugin)
    .use(redisPlugin)
    .use(jwtPlugin)
    .use(eventPlugin)
    .use(authPlugin);
export type NyxContext = typeof nyx;

export const nyxApp = () => {
  return nyx
    .use(loggerPlugin)
    .use(errorPlugin)
    .use(cors({
      origin: ["http://localhost:3000", "http://localhost:3001", "http://192.168.117.51:3000", "http://192.168.117.51:3001"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }))
    .use(healthModule)
    .use(authModule)
    .use(usersModule)
    .use(
      openapi({
        path: "/docs",
        // provider: "swagger-ui",
        documentation: {
          info: {
            title: "Nyx API",
            version: "0.1.0",
            description: "Anonymous decentralized Chat App",
          },
          tags: [
            { name: "Health", description: "System checks" },
            { name: "Auth", description: "Wallet authentication flow" },
            { name: "Users", description: "User identity and profile endpoints" },
          ],
        },
      })
    )
    .get("/", () => "Welcome to Nyx API", {
      detail: {
        hide: true,
      },
    });
};