import { and, asc, eq, isNull } from "drizzle-orm";
import {
  messageDelivery,
  messageVisibility,
  messages,
  roomMembers,
  roomSenderKeyEpochs,
  roomSenderKeyShares,
  rooms,
  users,
} from "@/platform/db/schema";
import { roomsEventTopics } from "@/features/rooms/events/topics";
import { e2eeService } from "@/features/e2ee/service";
import {
  debitUserBalance,
  GROUP_ROOM_CREATE_CREDITS,
} from "@/features/payments/ledger";
import type {
  DbMembership,
  DbRoom,
  DbRoomMember,
  RoomCreateInput,
  RoomsDb,
  RoomsEventBus,
  RoomsEventName,
  RoomsEventPayload,
} from "@/features/rooms/types";
import { AppError, BadRequest, Forbidden, NotFound } from "@/shared/error";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "rooms.service" });

const roomSelect = {
  id: rooms.id,
  type: rooms.type,
  createdBy: rooms.createdBy,
  lastMessageId: rooms.lastMessageId,
  lastMessageAt: rooms.lastMessageAt,
  createdAt: rooms.createdAt,
  updatedAt: rooms.updatedAt,
};

const membershipSelect = {
  role: roomMembers.role,
  joinedAt: roomMembers.joinedAt,
  mutedUntil: roomMembers.mutedUntil,
};

const roomMemberSelect = {
  userId: users.id,
  walletAddress: users.walletAddress,
  username: users.username,
  fullName: users.fullName,
  role: roomMembers.role,
  joinedAt: roomMembers.joinedAt,
  mutedUntil: roomMembers.mutedUntil,
};

const toIso = (value: Date | null) => value?.toISOString() ?? null;

const toRoomSummary = (room: DbRoom) => ({
  id: room.id,
  type: room.type,
  createdBy: room.createdBy,
  lastMessageId: room.lastMessageId,
  lastMessageAt: toIso(room.lastMessageAt),
  createdAt: (room.createdAt ?? new Date()).toISOString(),
  updatedAt: (room.updatedAt ?? new Date()).toISOString(),
});

const toMembership = (membership: DbMembership) => ({
  role: (membership.role ?? "member") as "admin" | "member",
  joinedAt: (membership.joinedAt ?? new Date()).toISOString(),
  mutedUntil: toIso(membership.mutedUntil),
});

const toRoomMember = (member: DbRoomMember) => ({
  userId: member.userId,
  walletAddress: member.walletAddress,
  username: member.username,
  displayName: member.fullName,
  role: (member.role ?? "member") as "admin" | "member",
  joinedAt: (member.joinedAt ?? new Date()).toISOString(),
  mutedUntil: toIso(member.mutedUntil),
  devices: [],
});

const emitEventSafely = async <K extends RoomsEventName>(
  eventBus: RoomsEventBus | undefined,
  event: K,
  payload: RoomsEventPayload<K>
) => {
  if (!eventBus) {
    return;
  }

  try {
    await eventBus.emit(event, payload);
  } catch (error) {
    log.warn({ event, error }, "Failed to emit rooms event");
  }
};

const assertRoomOwner = async (db: RoomsDb, roomId: string, userId: string) => {
  const room = await getRoomById(db, roomId);

  if (room.createdBy !== userId) {
    throw Forbidden("Only the group creator can perform this action.");
  }

  return room;
};

const getRoomById = async (db: RoomsDb, roomId: string) => {
  const result = await db
    .select(roomSelect)
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  const room = result[0] ?? null;

  if (!room) {
    throw NotFound("Room not found.");
  }

  return room as DbRoom;
};

const getActiveMembership = async (db: RoomsDb, roomId: string, userId: string) => {
  const result = await db
    .select(membershipSelect)
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), isNull(roomMembers.leftAt)))
    .limit(1);

  return (result[0] ?? null) as DbMembership | null;
};

const getMembershipRow = async (db: RoomsDb, roomId: string, userId: string) => {
  const result = await db
    .select({
      id: roomMembers.id,
      role: roomMembers.role,
      joinedAt: roomMembers.joinedAt,
      leftAt: roomMembers.leftAt,
      mutedUntil: roomMembers.mutedUntil,
    })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);

  return result[0] ?? null;
};

const getRoomDetailForMember = async (db: RoomsDb, roomId: string, userId: string) => {
  const room = await getRoomById(db, roomId);
  const membership = await getActiveMembership(db, roomId, userId);

  if (!membership) {
    throw Forbidden("You are not an active member of this room.");
  }

  return {
    room: toRoomSummary(room),
    membership: toMembership(membership),
  };
};

export const roomsService = {
  createGroupRoom: async ({
    db,
    userId,
    input,
    eventBus,
    activeDeviceId,
  }: {
    db: RoomsDb;
    userId: string;
    input: RoomCreateInput;
    eventBus?: RoomsEventBus;
    activeDeviceId: string;
  }) => {
    if (input.type !== "group") {
      throw BadRequest("Only group rooms can be created in this phase.");
    }

    const now = new Date();
    const { room, membership } = await db.transaction(async (tx) => {
      await debitUserBalance({
        db: tx as never,
        userId,
        credits: GROUP_ROOM_CREATE_CREDITS,
        reason: "room_creation",
      });

      const createdRooms = await tx
        .insert(rooms)
        .values({
          type: "group",
          directKey: null,
          createdBy: userId,
          updatedAt: now,
        })
        .returning(roomSelect);

      const createdRoom = createdRooms[0] as DbRoom | undefined;

      if (!createdRoom) {
        throw new AppError({
          message: "Failed to create room.",
        });
      }

      const memberships = await tx
        .insert(roomMembers)
        .values({
          roomId: createdRoom.id,
          userId,
          role: "admin",
          joinedAt: now,
          updatedAt: now,
        })
        .returning(membershipSelect);

      const createdMembership = memberships[0] as DbMembership | undefined;

      if (!createdMembership) {
        throw new AppError({
          message: "Failed to create room membership.",
        });
      }

      return {
        room: createdRoom,
        membership: createdMembership,
      };
    });

    const timestamp = now.toISOString();

    await emitEventSafely(eventBus, roomsEventTopics.roomCreated, {
      roomId: room.id,
      type: room.type,
      createdBy: userId,
      timestamp,
    });

    await emitEventSafely(eventBus, roomsEventTopics.membershipJoined, {
      roomId: room.id,
      userId,
      role: "admin",
      timestamp,
    });

    return {
      room: toRoomSummary(room),
      membership: toMembership(membership),
      senderKeyState: await e2eeService.getRoomSenderKeyState({
        db,
        roomId: room.id,
        userId,
        activeDeviceId,
      }),
    };
  },

  getRoom: async ({
    db,
    roomId,
    userId,
    activeDeviceId,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
    activeDeviceId: string;
  }) => {
    const detail = await getRoomDetailForMember(db, roomId, userId);
    return {
      ...detail,
      senderKeyState:
        detail.room.type === "group"
          ? await e2eeService.getRoomSenderKeyState({
              db,
              roomId,
              userId,
              activeDeviceId,
            })
          : null,
    };
  },

  getMembers: async ({
    db,
    roomId,
    userId,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
  }) => {
    await getRoomDetailForMember(db, roomId, userId);
    const deviceBundles = await e2eeService.getRoomMemberDevices({
      db,
      roomId,
    });
    const devicesByUserId = new Map<string, typeof deviceBundles>();

    for (const device of deviceBundles) {
      const list = devicesByUserId.get(device.userId) ?? [];
      list.push(device);
      devicesByUserId.set(device.userId, list);
    }

    const members = await db
      .select(roomMemberSelect)
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.leftAt), isNull(users.deletedAt)))
      .orderBy(asc(roomMembers.joinedAt));

    return {
      roomId,
      members: members.map((member) => ({
        ...toRoomMember(member as DbRoomMember),
        devices: devicesByUserId.get((member as DbRoomMember).userId) ?? [],
      })),
    };
  },

  joinGroupRoom: async ({
    db,
    roomId,
    userId,
    eventBus,
    activeDeviceId,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
    eventBus?: RoomsEventBus;
    activeDeviceId: string;
  }) => {
    const room = await getRoomById(db, roomId);

    if (room.type !== "group") {
      throw BadRequest("Only group rooms support joining in this phase.");
    }

    const membershipRow = await getMembershipRow(db, roomId, userId);
    const now = new Date();
    let shouldEmitJoined = false;

    if (!membershipRow) {
      await db.insert(roomMembers).values({
        roomId,
        userId,
        role: "member",
        joinedAt: now,
        updatedAt: now,
      });
      shouldEmitJoined = true;
    } else if (membershipRow.leftAt) {
      await db
        .update(roomMembers)
        .set({
          leftAt: null,
          joinedAt: now,
          updatedAt: now,
        })
        .where(eq(roomMembers.id, membershipRow.id));
      shouldEmitJoined = true;
    }

    const detail = await getRoomDetailForMember(db, roomId, userId);

    if (shouldEmitJoined) {
      await emitEventSafely(eventBus, roomsEventTopics.membershipJoined, {
        roomId,
        userId,
        role: detail.membership.role,
        timestamp: now.toISOString(),
      });
    }

    const senderKeyState =
      detail.room.type === "group"
        ? await e2eeService.rotateRoomSenderKeyEpoch({
            db,
            roomId,
            userId,
            activeDeviceId,
          }).then(() =>
            e2eeService.getRoomSenderKeyState({
              db,
              roomId,
              userId,
              activeDeviceId,
            })
          )
        : null;

    return {
      joined: true as const,
      room: detail.room,
      membership: detail.membership,
      senderKeyState,
    };
  },

  leaveGroupRoom: async ({
    db,
    roomId,
    userId,
    eventBus,
    activeDeviceId,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
    eventBus?: RoomsEventBus;
    activeDeviceId: string;
  }) => {
    const room = await getRoomById(db, roomId);

    if (room.type !== "group") {
      throw BadRequest("Only group rooms support leaving in this phase.");
    }

    const membershipRow = await getMembershipRow(db, roomId, userId);

    if (!membershipRow || membershipRow.leftAt) {
      return {
        roomId,
        left: true as const,
      };
    }

    const now = new Date();

    await db
      .update(roomMembers)
      .set({
        leftAt: now,
        updatedAt: now,
      })
      .where(eq(roomMembers.id, membershipRow.id));

    await emitEventSafely(eventBus, roomsEventTopics.membershipLeft, {
      roomId,
      userId,
      timestamp: now.toISOString(),
    });

    await e2eeService.rotateRoomSenderKeyEpoch({
      db,
      roomId,
      userId,
      activeDeviceId,
    });

    return {
      roomId,
      left: true as const,
    };
  },

  updateMuteState: async ({
    db,
    roomId,
    userId,
    mutedUntil,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
    mutedUntil: string | null;
  }) => {
    const membershipRow = await getMembershipRow(db, roomId, userId);

    if (!membershipRow || membershipRow.leftAt) {
      throw Forbidden("You are not an active member of this room.");
    }

    const nextMutedUntil = mutedUntil ? new Date(mutedUntil) : null;

    await db
      .update(roomMembers)
      .set({
        mutedUntil: nextMutedUntil,
        updatedAt: new Date(),
      })
      .where(eq(roomMembers.id, membershipRow.id));

    return {
      roomId,
      mutedUntil: toIso(nextMutedUntil),
    };
  },

  updateMemberRole: async ({
    db,
    roomId,
    actorUserId,
    targetUserId,
    role,
  }: {
    db: RoomsDb;
    roomId: string;
    actorUserId: string;
    targetUserId: string;
    role: "admin" | "member";
  }) => {
    const room = await assertRoomOwner(db, roomId, actorUserId);

    if (room.type !== "group") {
      throw BadRequest("Only group rooms support admin role updates.");
    }

    if (targetUserId === room.createdBy && role !== "admin") {
      throw BadRequest("The group creator must remain an admin.");
    }

    const targetMembership = await getMembershipRow(db, roomId, targetUserId);

    if (!targetMembership || targetMembership.leftAt) {
      throw NotFound("Room member not found.");
    }

    await db
      .update(roomMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(roomMembers.id, targetMembership.id));

    const members = await roomsService.getMembers({
      db,
      roomId,
      userId: actorUserId,
    });

    const member = members.members.find((item) => item.userId === targetUserId) ?? null;

    if (!member) {
      throw NotFound("Room member not found.");
    }

    return {
      roomId,
      member,
    };
  },

  deleteGroupRoom: async ({
    db,
    roomId,
    userId,
  }: {
    db: RoomsDb;
    roomId: string;
    userId: string;
  }) => {
    const room = await assertRoomOwner(db, roomId, userId);

    if (room.type !== "group") {
      throw BadRequest("Only group rooms can be deleted permanently.");
    }

    await db.transaction(async (tx) => {
      const roomMessageRows = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.roomId, roomId));

      const roomMessageIds = roomMessageRows.map((item) => item.id);

      for (const messageId of roomMessageIds) {
        await tx.delete(messageDelivery).where(eq(messageDelivery.messageId, messageId));
        await tx.delete(messageVisibility).where(eq(messageVisibility.messageId, messageId));
      }

      await tx.delete(messages).where(eq(messages.roomId, roomId));
      await tx.delete(roomSenderKeyShares).where(eq(roomSenderKeyShares.roomId, roomId));
      await tx.delete(roomSenderKeyEpochs).where(eq(roomSenderKeyEpochs.roomId, roomId));
      await tx.delete(roomMembers).where(eq(roomMembers.roomId, roomId));
      await tx.delete(rooms).where(eq(rooms.id, roomId));
    });

    return {
      roomId,
      deleted: true as const,
    };
  },
};
