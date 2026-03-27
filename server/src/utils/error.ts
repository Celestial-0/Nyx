export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  public statusCode: number;
  public code: ErrorCode;
  public details?: unknown;

  constructor({
    message,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details,
  }: {
    message: string;
    statusCode?: number;
    code?: ErrorCode;
    details?: unknown;
  }) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace (important)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Helper functions for common errors
 */

export const BadRequest = (message = "Bad request", details?: unknown) =>
  new AppError({
    message,
    statusCode: 400,
    code: "BAD_REQUEST",
    details,
  });

export const Unauthorized = (message = "Unauthorized") =>
  new AppError({
    message,
    statusCode: 401,
    code: "UNAUTHORIZED",
  });

export const Forbidden = (message = "Forbidden") =>
  new AppError({
    message,
    statusCode: 403,
    code: "FORBIDDEN",
  });

export const NotFound = (message = "Resource not found") =>
  new AppError({
    message,
    statusCode: 404,
    code: "NOT_FOUND",
  });

export const Conflict = (message = "Conflict", details?: unknown) =>
  new AppError({
    message,
    statusCode: 409,
    code: "CONFLICT",
    details,
  });

export const ValidationError = (details?: unknown) =>
  new AppError({
    message: "Validation failed",
    statusCode: 422,
    code: "VALIDATION_ERROR",
    details,
  });