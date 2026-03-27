import { pgEnum } from "drizzle-orm/pg-core";

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "system",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
]);
