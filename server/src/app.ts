import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { success } from "@/utils/response";

// plugins
import { loggerPlugin, errorPlugin, coreInfraPlugin } from "@/plugins";


// modules
import { healthModule } from "@/modules";


export const nyxApp = () => {
  const app = new Elysia();

  app
    // OpenAPI 
    .use(
      openapi({
        path: "/docs",
        documentation: {
          info: {
            title: "Nyx API",
            version: "0.1.0",
            description: "Anonymous decentralized Chat App",
          },
          tags: [
            {
              name: "System",
              description: "General API metadata and base endpoints",
            },
            {
              name: "Health",
              description: "System health and dependency checks",
            },
          ],
        },
      })
    )

    // Logging 
    .use(loggerPlugin)

    // Error handling 
    .use(errorPlugin)

    // Core infra
    .use(coreInfraPlugin)
      
    // Modules
    .use(healthModule)
    
    // Routes
    .get("/", () => success("Welcome to Nyx API"), {
      detail: {
        tags: ["System"],
        summary: "API welcome route",
        description: "Returns a simple welcome message for the Nyx API.",
      },
      response: {
        200: t.Object({
          success: t.Literal(true),
          data: t.String(),
        }),
      },
    });

  return app;
};