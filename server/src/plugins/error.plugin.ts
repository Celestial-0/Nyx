import { Elysia } from "elysia";
import { logger } from "@/utils/logger";
import { AppError } from "@/utils/error";

export const errorPlugin = new Elysia().onError(
  ({ error, code, set, request }) => {
    let status = 500;
    let response = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
      details: undefined as unknown,
    };

    // Handle custom AppError
    if (error instanceof AppError) {
      status = error.statusCode;

      response = {
        success: false,
        error: error.code,
        message: error.message,
        details: error.details,
      };
    }

    // Handle Elysia built-in errors
    else if (code === "NOT_FOUND") {
      status = 404;
      response = {
        success: false,
        error: "NOT_FOUND",
        message: "Route not found",
        details: null,
      };
    }

    else if (code === "VALIDATION") {
      status = 422;
      response = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        details: error,
      };
    }

    // Log EVERYTHING (important)
    // Access error properties safely because `error` can be several different types
    const anyError = error as any;
    const errorLog = {
      name: typeof anyError?.name === "string" ? anyError.name : undefined,
      message: typeof anyError?.message === "string" ? anyError.message : undefined,
      stack: typeof anyError?.stack === "string" ? anyError.stack : undefined,
    };

    logger.error(
      {
        method: request.method,
        url: request.url,
        status,
        code,
        error: errorLog,
      },
      "Request error"
    );

    set.status = status;
    return response;
  }
);
