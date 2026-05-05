import { pgEnum } from "drizzle-orm/pg-core";

export const roomTypeEnum = pgEnum("room_type", [
  "direct",
  "group",
]);

export const roomMemberRoleEnum = pgEnum("room_member_role", [
  "admin",
  "member",
]);

export const senderKeyEpochStatusEnum = pgEnum("sender_key_epoch_status", [
  "pending",
  "active",
  "superseded",
]);
