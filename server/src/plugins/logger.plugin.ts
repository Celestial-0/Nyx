// src/plugins/logger.ts
import { Elysia } from "elysia";
import { logger } from "@/utils/logger";

export const loggerPlugin = new Elysia({ name: "logger" })
  .onRequest(({ request }) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  })
  .onAfterHandle(({ request, set }) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        status: set.status,
      },
      "Request completed"
    );
  })
  .onError(({ error, request }) => {
    logger.error(
      {
        err: error,
        method: request.method,
        url: request.url,
      },
      "Request error"
    );
  });