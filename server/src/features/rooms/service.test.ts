import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { creditLogs, roomMembers, rooms, userCredits, users } from "@/platform/db/schema";
import { roomsEventTopics } from "@/features/rooms/events/topics";
import { roomsService } from "@/features/rooms/service";
import { withTestTransaction } from "@/test-utils/integration";

const createEventBus = () => {
  const events: Array<{ event: string; payload: unknown }> = [];

  return {
    events,
    bus: {
      emit: async (event: string, payload: unknown) => {
        events.push({ event, payload });
      },
    },
  };
};

describe("roomsService", () => {
  test("createGroupRoom creates a room and creator membership", async () => {
    await withTestTransaction(async (tx) => {
      const creatorId = randomUUID();
      const activeDeviceId = randomUUID();
      const eventBus = createEventBus();

      await tx.insert(users).values({
        id: creatorId,
        walletAddress: `wallet-room-create-${creatorId}`,
      });

      const result = await roomsService.createGroupRoom({
        db: tx as never,
        userId: creatorId,
        activeDeviceId,
        input: { type: "group" },
        eventBus: eventBus.bus,
      });

      const createdRoom = await tx
        .select({
          id: rooms.id,
          type: rooms.type,
          createdBy: rooms.createdBy,
        })
        .from(rooms)
        .where(eq(rooms.id, result.room.id))
        .limit(1);
      const memberships = await tx
        .select({
          userId: roomMembers.userId,
          role: roomMembers.role,
          leftAt: roomMembers.leftAt,
        })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, result.room.id));
      const creditBalance = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, creatorId))
        .limit(1);
      const creditHistory = await tx
        .select({
          change: creditLogs.change,
          reason: creditLogs.reason,
        })
        .from(creditLogs)
        .where(eq(creditLogs.userId, creatorId))
        .orderBy(asc(creditLogs.createdAt));

      expect(result.room.type).toBe("group");
      expect(result.membership.role).toBe("admin");
      expect(createdRoom[0]).toMatchObject({
        id: result.room.id,
        type: "group",
        createdBy: creatorId,
      });
      expect(memberships).toEqual([
        {
          userId: creatorId,
          role: "admin",
          leftAt: null,
        },
      ]);
      expect(eventBus.events.map((entry) => entry.event)).toEqual([
        roomsEventTopics.roomCreated,
        roomsEventTopics.membershipJoined,
      ]);
      expect(creditBalance[0]?.balance).toBe(100);
      expect(creditHistory).toEqual([
        { change: 150, reason: "initial_grant" },
        { change: -50, reason: "room_creation" },
      ]);
    });
  });

  test("createGroupRoom is rejected when the user has insufficient credits", async () => {
    await withTestTransaction(async (tx) => {
      const creatorId = randomUUID();
      const activeDeviceId = randomUUID();

      await tx.insert(users).values({
        id: creatorId,
        walletAddress: `wallet-room-insufficient-${creatorId}`,
      });
      await tx.insert(userCredits).values({
        userId: creatorId,
        balance: 40,
      });

      try {
        await roomsService.createGroupRoom({
          db: tx as never,
          userId: creatorId,
          activeDeviceId,
          input: { type: "group" },
        });
        throw new Error("Expected room creation to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "INSUFFICIENT_CREDITS",
          details: {
            requiredCredits: 50,
            currentBalance: 40,
          },
        });
      }
    });
  });

  test("joinGroupRoom is idempotent for an active member", async () => {
    await withTestTransaction(async (tx) => {
      const ownerId = randomUUID();
      const memberId = randomUUID();
      const roomId = randomUUID();
      const activeDeviceId = randomUUID();
      const eventBus = createEventBus();

      await tx.insert(users).values([
        { id: ownerId, walletAddress: `wallet-room-owner-${ownerId}` },
        { id: memberId, walletAddress: `wallet-room-member-${memberId}` },
      ]);
      await tx.insert(rooms).values({
        id: roomId,
        type: "group",
        createdBy: ownerId,
      });
      await tx.insert(roomMembers).values({
        roomId,
        userId: memberId,
        role: "member",
      });

      const result = await roomsService.joinGroupRoom({
        db: tx as never,
        roomId,
        userId: memberId,
        activeDeviceId,
        eventBus: eventBus.bus,
      });

      const memberships = await tx
        .select({
          id: roomMembers.id,
          leftAt: roomMembers.leftAt,
        })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, memberId)));

      expect(result.joined).toBe(true);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.leftAt).toBeNull();
      expect(eventBus.events).toHaveLength(0);
    });
  });

  test("leave then rejoin reactivates the same membership row", async () => {
    await withTestTransaction(async (tx) => {
      const ownerId = randomUUID();
      const memberId = randomUUID();
      const roomId = randomUUID();
      const activeDeviceId = randomUUID();
      const eventBus = createEventBus();

      await tx.insert(users).values([
        { id: ownerId, walletAddress: `wallet-leave-owner-${ownerId}` },
        { id: memberId, walletAddress: `wallet-leave-member-${memberId}` },
      ]);
      await tx.insert(rooms).values({
        id: roomId,
        type: "group",
        createdBy: ownerId,
      });
      await tx.insert(roomMembers).values({
        roomId,
        userId: memberId,
        role: "member",
      });

      const beforeLeave = await tx
        .select({
          id: roomMembers.id,
        })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, memberId)))
        .limit(1);

      const leaveResult = await roomsService.leaveGroupRoom({
        db: tx as never,
        roomId,
        userId: memberId,
        activeDeviceId,
        eventBus: eventBus.bus,
      });
      const leftMembership = await tx
        .select({
          id: roomMembers.id,
          leftAt: roomMembers.leftAt,
        })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, memberId)))
        .limit(1);

      const joinResult = await roomsService.joinGroupRoom({
        db: tx as never,
        roomId,
        userId: memberId,
        activeDeviceId,
        eventBus: eventBus.bus,
      });
      const rejoinedMembership = await tx
        .select({
          id: roomMembers.id,
          leftAt: roomMembers.leftAt,
        })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, memberId)))
        .limit(1);

      expect(leaveResult.left).toBe(true);
      expect(leftMembership[0]?.leftAt).not.toBeNull();
      expect(joinResult.membership.role).toBe("member");
      expect(rejoinedMembership[0]).toMatchObject({
        id: beforeLeave[0]?.id,
        leftAt: null,
      });
      expect(eventBus.events.map((entry) => entry.event)).toEqual([
        roomsEventTopics.membershipLeft,
        roomsEventTopics.membershipJoined,
      ]);
    });
  });
});
