import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "mod",
]);

export const userDeviceStatusEnum = pgEnum("user_device_status", [
  "active",
  "revoked",
]);
