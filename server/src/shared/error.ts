export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_CREDITS"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

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
    Error.captureStackTrace?.(this, this.constructor);
  }
}

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

export const Conflict = (message = "Conflict", details?: unknown) =>
  new AppError({
    message,
    statusCode: 409,
    code: "CONFLICT",
    details,
  });

export const RateLimited = ({
  message = "Rate limit exceeded.",
  retryAfterMs,
  scope,
}: {
  message?: string;
  retryAfterMs?: number | null;
  scope: string;
}) =>
  new AppError({
    message,
    statusCode: 429,
    code: "RATE_LIMITED",
    details: {
      retryAfterMs: retryAfterMs ?? null,
      scope,
    },
  });

export const NotFound = (message = "Resource not found") =>
  new AppError({
    message,
    statusCode: 404,
    code: "NOT_FOUND",
  });

export const ValidationError = (details?: unknown) =>
  new AppError({
    message: "Validation failed",
    statusCode: 422,
    code: "VALIDATION_ERROR",
    details,
  });

export const InsufficientCredits = ({
  requiredCredits,
  currentBalance,
  message = "Insufficient credits.",
}: {
  requiredCredits: number;
  currentBalance: number;
  message?: string;
}) =>
  new AppError({
    message,
    statusCode: 409,
    code: "INSUFFICIENT_CREDITS",
    details: {
      requiredCredits,
      currentBalance,
    },
  });

export type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;
