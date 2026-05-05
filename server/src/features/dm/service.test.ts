import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { roomMembers, rooms, userCredits, users } from "@/platform/db/schema";
import { dmEventTopics } from "@/features/dm/events/topics";
import { buildDirectKey, dmService } from "@/features/dm/service";
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

describe("dmService", () => {
  test("buildDirectKey is stable regardless of user order", () => {
    const a = randomUUID();
    const b = randomUUID();

    expect(buildDirectKey(a, b)).toBe(buildDirectKey(b, a));
  });

  test("startConversation resolves an existing direct room by username", async () => {
    await withTestTransaction(async (tx) => {
      const currentUserId = randomUUID();
      const targetUserId = randomUUID();
      const roomId = randomUUID();
      const directKey = buildDirectKey(currentUserId, targetUserId);
      const eventBus = createEventBus();
      const username = `alice-existing-${targetUserId.slice(0, 8)}`;

      await tx.insert(users).values([
        {
          id: currentUserId,
          walletAddress: `wallet-dm-current-${currentUserId}`,
          username: `dm-current-${currentUserId.slice(0, 8)}`,
        },
        {
          id: targetUserId,
          walletAddress: `wallet-dm-target-${targetUserId}`,
          username,
        },
      ]);
      await tx.insert(rooms).values({
        id: roomId,
        type: "direct",
        directKey,
        createdBy: currentUserId,
      });
      await tx.insert(roomMembers).values([
        {
          roomId,
          userId: currentUserId,
          role: "member",
        },
        {
          roomId,
          userId: targetUserId,
          role: "member",
        },
      ]);

      const result = await dmService.startConversation({
        db: tx as never,
        currentUserId,
        input: { username },
        eventBus: eventBus.bus,
      });

      expect(result.created).toBe(false);
      expect(result.conversation.id).toBe(roomId);
      expect(eventBus.events.map((entry) => entry.event)).toEqual([
        dmEventTopics.conversationResolved,
      ]);
    });
  });

  test("startConversation creates a direct room by wallet address", async () => {
    await withTestTransaction(async (tx) => {
      const currentUserId = randomUUID();
      const targetUserId = randomUUID();
      const eventBus = createEventBus();

      await tx.insert(users).values([
        {
          id: currentUserId,
          walletAddress: `wallet-create-current-${currentUserId}`,
          username: `create-current-${currentUserId.slice(0, 8)}`,
        },
        {
          id: targetUserId,
          walletAddress: `wallet-create-target-${targetUserId}`,
          username: `create-target-${targetUserId.slice(0, 8)}`,
        },
      ]);

      const result = await dmService.startConversation({
        db: tx as never,
        currentUserId,
        input: { walletAddress: `wallet-create-target-${targetUserId}` },
        eventBus: eventBus.bus,
      });

      const createdRooms = await tx
        .select({
          id: rooms.id,
          type: rooms.type,
          directKey: rooms.directKey,
        })
        .from(rooms)
        .where(eq(rooms.id, result.conversation.id))
        .limit(1);
      const memberships = await tx
        .select({
          userId: roomMembers.userId,
        })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, result.conversation.id), isNull(roomMembers.leftAt)));

      expect(result.created).toBe(true);
      expect(createdRooms[0]).toMatchObject({
        id: result.conversation.id,
        type: "direct",
        directKey: buildDirectKey(currentUserId, targetUserId),
      });
      expect(memberships.map((membership) => membership.userId).sort()).toEqual(
        [currentUserId, targetUserId].sort()
      );
      expect(eventBus.events.map((entry) => entry.event)).toEqual([
        dmEventTopics.conversationCreated,
        dmEventTopics.conversationResolved,
      ]);
    });
  });

  test("startConversation does not charge credits", async () => {
    await withTestTransaction(async (tx) => {
      const currentUserId = randomUUID();
      const targetUserId = randomUUID();

      await tx.insert(users).values([
        {
          id: currentUserId,
          walletAddress: `wallet-free-current-${currentUserId}`,
          username: `free-current-${currentUserId.slice(0, 8)}`,
        },
        {
          id: targetUserId,
          walletAddress: `wallet-free-target-${targetUserId}`,
          username: `free-target-${targetUserId.slice(0, 8)}`,
        },
      ]);
      await tx.insert(userCredits).values({
        userId: currentUserId,
        balance: 10,
      });

      await dmService.startConversation({
        db: tx as never,
        currentUserId,
        input: { walletAddress: `wallet-free-target-${targetUserId}` },
      });

      const balances = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, currentUserId))
        .limit(1);

      expect(balances[0]?.balance).toBe(10);
    });
  });

  test("startConversation rejects self-DM", async () => {
    await withTestTransaction(async (tx) => {
      const currentUserId = randomUUID();
      const username = `self-user-${currentUserId.slice(0, 8)}`;

      await tx.insert(users).values({
        id: currentUserId,
        walletAddress: `wallet-self-dm-${currentUserId}`,
        username,
      });

      try {
        await dmService.startConversation({
          db: tx as never,
          currentUserId,
          input: { username },
        });
        throw new Error("Expected self-DM to be rejected.");
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 400,
          code: "BAD_REQUEST",
        });
      }
    });
  });

  test("startConversation fails loudly when a direct room has invalid membership count", async () => {
    await withTestTransaction(async (tx) => {
      const currentUserId = randomUUID();
      const targetUserId = randomUUID();
      const roomId = randomUUID();
      const directKey = buildDirectKey(currentUserId, targetUserId);
      const username = `invalid-target-${targetUserId.slice(0, 8)}`;

      await tx.insert(users).values([
        {
          id: currentUserId,
          walletAddress: `wallet-invalid-current-${currentUserId}`,
          username: `invalid-current-${currentUserId.slice(0, 8)}`,
        },
        {
          id: targetUserId,
          walletAddress: `wallet-invalid-target-${targetUserId}`,
          username,
        },
      ]);
      await tx.insert(rooms).values({
        id: roomId,
        type: "direct",
        directKey,
        createdBy: currentUserId,
      });
      await tx.insert(roomMembers).values({
        roomId,
        userId: currentUserId,
        role: "member",
      });

      try {
        await dmService.startConversation({
          db: tx as never,
          currentUserId,
          input: { username },
        });
        throw new Error("Expected invalid direct room membership to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          statusCode: 500,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    });
  });
});
