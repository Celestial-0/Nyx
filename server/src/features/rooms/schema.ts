import { z } from "@hono/zod-openapi";
import {
  e2eePeerDeviceBundleSchema,
  e2eeSenderKeyEpochStateSchema,
} from "@/features/e2ee/schema";

export const roomTypeSchema = z.enum(["direct", "group"]);
export const roomMemberRoleSchema = z.enum(["admin", "member"]);

export const roomParamsSchema = z
  .object({
    roomId: z.string().uuid(),
  })
  .strict();

export const roomMemberParamsSchema = z
  .object({
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
  })
  .strict();

export const roomCreateBodySchema = z
  .object({
    type: z.literal("group"),
  })
  .strict();

export const roomMuteBodySchema = z
  .object({
    mutedUntil: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const roomMemberRoleUpdateBodySchema = z
  .object({
    role: roomMemberRoleSchema,
  })
  .strict();

export const roomSummarySchema = z
  .object({
    id: z.string().uuid(),
    type: roomTypeSchema,
    createdBy: z.string().uuid(),
    lastMessageId: z.string().uuid().nullable(),
    lastMessageAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("RoomSummary");

export const roomMembershipSchema = z
  .object({
    role: roomMemberRoleSchema,
    joinedAt: z.string(),
    mutedUntil: z.string().nullable(),
  })
  .openapi("RoomMembership");

export const roomDetailDataSchema = z
  .object({
    room: roomSummarySchema,
    membership: roomMembershipSchema,
    senderKeyState: e2eeSenderKeyEpochStateSchema.nullable(),
  })
  .openapi("RoomDetailData");

export const roomDetailSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: roomDetailDataSchema,
  })
  .openapi("RoomDetailSuccessResponse");

export const roomMemberSchema = z
  .object({
    userId: z.string().uuid(),
    walletAddress: z.string(),
    username: z.string().nullable(),
    displayName: z.string().nullable(),
    role: roomMemberRoleSchema,
    joinedAt: z.string(),
    mutedUntil: z.string().nullable(),
    devices: z.array(e2eePeerDeviceBundleSchema),
  })
  .openapi("RoomMember");

export const roomMembersSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      roomId: z.string().uuid(),
      members: z.array(roomMemberSchema),
    }),
  })
  .openapi("RoomMembersSuccessResponse");

export const roomJoinSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      joined: z.literal(true),
      room: roomSummarySchema,
      membership: roomMembershipSchema,
      senderKeyState: e2eeSenderKeyEpochStateSchema.nullable(),
    }),
  })
  .openapi("RoomJoinSuccessResponse");

export const roomLeaveSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      roomId: z.string().uuid(),
      left: z.literal(true),
    }),
  })
  .openapi("RoomLeaveSuccessResponse");

export const roomMuteSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      roomId: z.string().uuid(),
      mutedUntil: z.string().nullable(),
    }),
  })
  .openapi("RoomMuteSuccessResponse");

export const roomMemberRoleUpdateSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      roomId: z.string().uuid(),
      member: roomMemberSchema,
    }),
  })
  .openapi("RoomMemberRoleUpdateSuccessResponse");

export const roomDeleteSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      roomId: z.string().uuid(),
      deleted: z.literal(true),
    }),
  })
  .openapi("RoomDeleteSuccessResponse");
