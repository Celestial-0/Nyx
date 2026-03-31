import { nyxApp } from "@/app";
import { env } from "@/config/env";

const app = nyxApp().listen(env.PORT);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

// trigger graceful shutdown
const shutdown = async () => {
  await app.stop(); 
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);