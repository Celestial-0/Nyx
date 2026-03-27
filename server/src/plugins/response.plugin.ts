import { Elysia } from "elysia";

export const responsePlugin = new Elysia().onAfterHandle((ctx) => {
  const response = ctx.responseValue;

  // Skip already formatted
  if (
    typeof response === "object" &&
    response !== null &&
    "success" in response
  ) {
    return response;
  }

  // Skip native responses (file, stream, etc.)
  if (
    response instanceof Response ||
    response instanceof ReadableStream
  ) {
    return response;
  }

  return {
    success: true,
    data: response ?? null,
  };
});