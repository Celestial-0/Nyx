import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";

// plugins
import { loggerPlugin, errorPlugin, responsePlugin, dbPlugin, redisPlugin, jwtPlugin, eventPlugin } from "@/plugins";


// modules
import { healthModule } from "@/modules";


export const nyxApp = () => {
  const app = new Elysia();

  app
    // OpenAPI 
    .use(
      openapi({
        documentation: {
          info: {
            title: "Nyx API",
            version: "0.1.0",
            description: "Anonymous decentralized API",
          },
        },
      })
    )

    // Logging 
    .use(loggerPlugin)

    // Error handling 
    .use(errorPlugin)

    // Response formatter 
    .use(responsePlugin)

    // Core infra 
    .use(dbPlugin)
    .use(redisPlugin)
    .use(jwtPlugin)
    .use(eventPlugin)
    
    
    // Modules
    .use(healthModule)
    
    // Routes
    .get("/", () => "Welcome to Nyx API");

  return app;
};