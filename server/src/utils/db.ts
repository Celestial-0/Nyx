export const withUpdatedAt = <T extends object>(data: T) => ({
  ...data,
  updatedAt: new Date(),
});