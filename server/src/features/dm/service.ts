import { and, eq, ilike, isNull } from "drizzle-orm";
import { roomMembers, rooms, users } from "@/platform/db/schema";
import { dmEventTopics } from "@/features/dm/events/topics";
import { e2eeService } from "@/features/e2ee/service";
import type {
  DmDb,
  DmEventBus,
  DmEventName,
  DmEventPayload,
  DmStartInput,
} from "@/features/dm/types";
import { AppError, BadRequest, NotFound } from "@/shared/error";
import { logger } from "@/shared/logger";

const log = logger.child({ module: "dm.service" });

const roomSelect = {
  id: rooms.id,
  type: rooms.type,
  createdBy: rooms.createdBy,
  lastMessageId: rooms.lastMessageId,
  lastMessageAt: rooms.lastMessageAt,
  createdAt: rooms.createdAt,
  updatedAt: rooms.updatedAt,
};

const toRoomSummary = (room: {
  id: string;
  type: "direct" | "group";
  createdBy: string;
  lastMessageId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}) => ({
  id: room.id,
  type: room.type,
  createdBy: room.createdBy,
  lastMessageId: room.lastMessageId,
  lastMessageAt: room.lastMessageAt?.toISOString() ?? null,
  createdAt: (room.createdAt ?? new Date()).toISOString(),
  updatedAt: (room.updatedAt ?? new Date()).toISOString(),
});

const emitEventSafely = async <K extends DmEventName>(
  eventBus: DmEventBus | undefined,
  event: K,
  payload: DmEventPayload<K>
) => {
  if (!eventBus) {
    return;
  }

  try {
    await eventBus.emit(event, payload);
  } catch (error) {
    log.warn({ event, error }, "Failed to emit dm event");
  }
};

export const buildDirectKey = (userAId: string, userBId: string) =>
  [userAId, userBId].sort((a, b) => a.localeCompare(b)).join(":");

const findTargetUser = async (db: DmDb, input: DmStartInput) => {
  if (input.username) {
    const result = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(and(ilike(users.username, input.username.trim()), isNull(users.deletedAt)))
      .limit(1);

    return result[0] ?? null;
  }

  if (input.walletAddress) {
    const result = await db
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
      })
      .from(users)
      .where(and(eq(users.walletAddress, input.walletAddress.trim()), isNull(users.deletedAt)))
      .limit(1);

    return result[0] ?? null;
  }

  return null;
};

const assertDirectRoomInvariant = async (
  db: DmDb,
  roomId: string,
  expectedUserIds: string[]
) => {
  const members = await db
    .select({
      userId: roomMembers.userId,
    })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.leftAt)));

  const actualIds = members.map((member) => member.userId).sort((a, b) => a.localeCompare(b));
  const expectedIds = [...expectedUserIds].sort((a, b) => a.localeCompare(b));

  if (actualIds.length !== 2 || actualIds[0] !== expectedIds[0] || actualIds[1] !== expectedIds[1]) {
    throw new AppError({
      message: "Direct room membership invariant violated.",
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

const getDirectRoomByKey = async (db: DmDb, directKey: string) => {
  const result = await db
    .select(roomSelect)
    .from(rooms)
    .where(and(eq(rooms.type, "direct"), eq(rooms.directKey, directKey)))
    .limit(1);

  return result[0] ?? null;
};

export const dmService = {
  startConversation: async ({
    db,
    currentUserId,
    input,
    eventBus,
  }: {
    db: DmDb;
    currentUserId: string;
    input: DmStartInput;
    eventBus?: DmEventBus;
  }) => {
    const targetUser = await findTargetUser(db, input);

    if (!targetUser) {
      throw NotFound("Target user not found.");
    }

    if (targetUser.id === currentUserId) {
      throw BadRequest("You cannot start a direct conversation with yourself.");
    }

    const directKey = buildDirectKey(currentUserId, targetUser.id);
    const existingRoom = await getDirectRoomByKey(db, directKey);
    const now = new Date().toISOString();

    if (existingRoom) {
      await assertDirectRoomInvariant(db, existingRoom.id, [currentUserId, targetUser.id]);

      await emitEventSafely(eventBus, dmEventTopics.conversationResolved, {
        roomId: existingRoom.id,
        userAId: currentUserId,
        userBId: targetUser.id,
        created: false,
        timestamp: now,
      });

      const peerDeviceBundles = await e2eeService.getPeerDeviceBundlesForDm({
        db,
        targetUserId: targetUser.id,
        currentUserId,
        conversationId: existingRoom.id,
      });

      return {
        conversation: toRoomSummary(existingRoom),
        created: false,
        peerUserId: targetUser.id,
        peerDeviceBundles,
      };
    }

    try {
      const createdRooms = await db
        .insert(rooms)
        .values({
          type: "direct",
          directKey,
          createdBy: currentUserId,
          updatedAt: new Date(now),
        })
        .returning(roomSelect);

      const room = createdRooms[0];

      if (!room) {
        throw new AppError({
          message: "Failed to create direct conversation.",
        });
      }

      await db.insert(roomMembers).values([
        {
          roomId: room.id,
          userId: currentUserId,
          role: "member",
          joinedAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          roomId: room.id,
          userId: targetUser.id,
          role: "member",
          joinedAt: new Date(now),
          updatedAt: new Date(now),
        },
      ]);

      await assertDirectRoomInvariant(db, room.id, [currentUserId, targetUser.id]);

      await emitEventSafely(eventBus, dmEventTopics.conversationCreated, {
        roomId: room.id,
        userAId: currentUserId,
        userBId: targetUser.id,
        timestamp: now,
      });

      await emitEventSafely(eventBus, dmEventTopics.conversationResolved, {
        roomId: room.id,
        userAId: currentUserId,
        userBId: targetUser.id,
        created: true,
        timestamp: now,
      });

      const peerDeviceBundles = await e2eeService.getPeerDeviceBundlesForDm({
        db,
        targetUserId: targetUser.id,
        currentUserId,
        conversationId: room.id,
      });

      return {
        conversation: toRoomSummary(room),
        created: true,
        peerUserId: targetUser.id,
        peerDeviceBundles,
      };
    } catch (error) {
      const dbError = error as { code?: string; message?: string };

      if (
        dbError.code === "23505" ||
        /rooms_direct_key_unique|duplicate key/i.test(dbError.message ?? "")
      ) {
        const room = await getDirectRoomByKey(db, directKey);

        if (!room) {
          throw error;
        }

        await assertDirectRoomInvariant(db, room.id, [currentUserId, targetUser.id]);

        await emitEventSafely(eventBus, dmEventTopics.conversationResolved, {
          roomId: room.id,
          userAId: currentUserId,
          userBId: targetUser.id,
          created: false,
          timestamp: now,
        });

        const peerDeviceBundles = await e2eeService.getPeerDeviceBundlesForDm({
          db,
          targetUserId: targetUser.id,
          currentUserId,
          conversationId: room.id,
        });

        return {
          conversation: toRoomSummary(room),
          created: false,
          peerUserId: targetUser.id,
          peerDeviceBundles,
        };
      }

      throw error;
    }
  },
};
