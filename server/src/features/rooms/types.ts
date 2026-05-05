import type { z } from "zod";
import type { db } from "@/platform/db/client";
import type { EventBusLike } from "@/platform/events/types";
import type { roomsEventSchemas } from "@/features/rooms/events/schema";
import type { roomCreateBodySchema } from "@/features/rooms/schema";
import type {
  roomMemberRoleUpdateBodySchema,
  roomMuteBodySchema,
} from "@/features/rooms/schema";

export type RoomsDb = typeof db;

export type RoomsEventName = keyof typeof roomsEventSchemas;
export type RoomsEventPayload<K extends RoomsEventName = RoomsEventName> = z.infer<
  (typeof roomsEventSchemas)[K]
>;

export type RoomsEventBus = EventBusLike<typeof roomsEventSchemas>;

export type RoomCreateInput = z.infer<typeof roomCreateBodySchema>;
export type RoomMuteInput = z.infer<typeof roomMuteBodySchema>;
export type RoomMemberRoleUpdateInput = z.infer<typeof roomMemberRoleUpdateBodySchema>;

export type DbRoom = {
  id: string;
  type: "direct" | "group";
  createdBy: string;
  lastMessageId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type DbMembership = {
  role: "admin" | "member" | null;
  joinedAt: Date | null;
  mutedUntil: Date | null;
};

export type DbRoomMember = {
  userId: string;
  walletAddress: string;
  username: string | null;
  fullName: string | null;
  role: "admin" | "member" | null;
  joinedAt: Date | null;
  mutedUntil: Date | null;
};
