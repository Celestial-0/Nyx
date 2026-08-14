import { z } from 'zod';

import { IsoDateStringSchema } from './common';
import { E2eePeerDeviceBundleSchema, E2eeSenderKeyEpochStateSchema } from './e2ee';

/** Room (conversation container) schemas. Ported from web `features/rooms`. */

export const RoomTypeSchema = z.enum(['direct', 'group']);
export const RoomMemberRoleSchema = z.enum(['admin', 'member']);

export const RoomSummarySchema = z.object({
  id: z.string(),
  type: RoomTypeSchema,
  createdBy: z.string(),
  lastMessageId: z.string().nullable(),
  lastMessageAt: IsoDateStringSchema.nullable(),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
});

export const RoomMembershipSchema = z.object({
  role: RoomMemberRoleSchema,
  joinedAt: IsoDateStringSchema,
  mutedUntil: IsoDateStringSchema.nullable(),
});

export const RoomDetailSchema = z.object({
  room: RoomSummarySchema,
  membership: RoomMembershipSchema,
  senderKeyState: E2eeSenderKeyEpochStateSchema.nullable(),
});

export const RoomMemberSchema = z.object({
  userId: z.string(),
  walletAddress: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  role: RoomMemberRoleSchema,
  joinedAt: IsoDateStringSchema,
  mutedUntil: IsoDateStringSchema.nullable(),
  devices: z.array(E2eePeerDeviceBundleSchema),
});

export const RoomMembersResponseSchema = z.object({
  roomId: z.string(),
  members: z.array(RoomMemberSchema),
});

export const CreateGroupRoomInputSchema = z.object({
  type: z.literal('group'),
});

export const JoinRoomResponseSchema = z.object({
  joined: z.literal(true),
  room: RoomSummarySchema,
  membership: RoomMembershipSchema,
  senderKeyState: E2eeSenderKeyEpochStateSchema.nullable(),
});

export const LeaveRoomResponseSchema = z.object({
  roomId: z.string(),
  left: z.literal(true),
});

export const RoomMuteResponseSchema = z.object({
  roomId: z.string(),
  mutedUntil: IsoDateStringSchema.nullable(),
});

export const RoomMemberRoleUpdateResponseSchema = z.object({
  roomId: z.string(),
  member: RoomMemberSchema,
});

export const RoomDeleteResponseSchema = z.object({
  roomId: z.string(),
  deleted: z.literal(true),
});

export type RoomType = z.infer<typeof RoomTypeSchema>;
export type RoomMemberRole = z.infer<typeof RoomMemberRoleSchema>;
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
export type RoomMembership = z.infer<typeof RoomMembershipSchema>;
export type RoomDetail = z.infer<typeof RoomDetailSchema>;
export type RoomMember = z.infer<typeof RoomMemberSchema>;
export type RoomMembersResponse = z.infer<typeof RoomMembersResponseSchema>;
export type CreateGroupRoomInput = z.infer<typeof CreateGroupRoomInputSchema>;
export type JoinRoomResponse = z.infer<typeof JoinRoomResponseSchema>;
export type LeaveRoomResponse = z.infer<typeof LeaveRoomResponseSchema>;
export type RoomMuteResponse = z.infer<typeof RoomMuteResponseSchema>;
export type RoomMemberRoleUpdateResponse = z.infer<typeof RoomMemberRoleUpdateResponseSchema>;
export type RoomDeleteResponse = z.infer<typeof RoomDeleteResponseSchema>;
