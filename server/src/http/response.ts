export const success = <T>(data: T, meta?: Record<string, unknown>) => ({
  success: true as const,
  data,
  ...(meta ? { meta } : {}),
});
