export const success = <T>(data: T, meta?: Record<string, unknown>) => {
  return {
    success: true as const,
    data,
    ...(meta ? { meta } : {}),
  };
};

export const created = <T>(data: T) => {
  return {
    success: true as const,
    data,
  };
};

export const empty = () => {
  return {
    success: true as const,
    data: null,
  };
};