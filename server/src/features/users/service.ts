import { and, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { users } from "@/platform/db/schema/user/users";
import { authEventTopics } from "@/features/auth/events/topics";
import type {
  DbUser,
  UsersDb,
  UsersEventBus,
  UsersEventName,
  UsersEventPayload,
  UsersUpdateMeInput,
} from "@/features/users/types";
import { BadRequest, NotFound } from "@/shared/error";

const selectProfile = {
  id: users.id,
  walletAddress: users.walletAddress,
  username: users.username,
  fullName: users.fullName,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const toProfile = (user: DbUser) => ({
  id: user.id,
  walletAddress: user.walletAddress,
  username: user.username,
  displayName: user.fullName,
  role: user.role,
  createdAt: (user.createdAt ?? new Date()).toISOString(),
  updatedAt: (user.updatedAt ?? new Date()).toISOString(),
});

const emitEventSafely = async <K extends UsersEventName>(
  eventBus: UsersEventBus | undefined,
  event: K,
  payload: UsersEventPayload<K>
) => {
  if (!eventBus) {
    return;
  }

  try {
    await eventBus.emit(event, payload);
  } catch {
    // Event delivery is intentionally non-blocking for profile updates.
  }
};

export const usersService = {
  getMe: async ({ db, userId }: { db: UsersDb; userId: string }) => {
    const result = await db
      .select(selectProfile)
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const user = result[0] ?? null;

    if (!user) {
      throw NotFound("User not found.");
    }

    return toProfile(user);
  },

  updateMe: async ({
    db,
    userId,
    input,
    eventBus,
  }: {
    db: UsersDb;
    userId: string;
    input: UsersUpdateMeInput;
    eventBus?: UsersEventBus;
  }) => {
    const username = input.username?.trim();
    const fullName = input.fullName?.trim();

    if (!username && !fullName) {
      throw BadRequest("At least one field is required: username or fullName.");
    }

    const existingResult = await db
      .select(selectProfile)
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const existing = existingResult[0] ?? null;

    if (!existing) {
      throw NotFound("User not found.");
    }

    if (username) {
      const collision = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

      if (collision.length > 0) {
        throw BadRequest("Username already taken. Please choose another username.");
      }
    }

    const nextUsername = username ?? existing.username;
    const nextFullName = fullName ?? existing.fullName;

    const updated = await db
      .update(users)
      .set({
        username: nextUsername,
        fullName: nextFullName,
        usernameUpdatedAt: username ? new Date() : existing.updatedAt,
        updatedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning(selectProfile);

    const user = updated[0] ?? null;

    if (!user) {
      throw NotFound("User not found.");
    }

    if (nextUsername && nextFullName) {
      await emitEventSafely(eventBus, authEventTopics.profileCompleted, {
        userId: user.id,
        walletAddress: user.walletAddress,
        username: nextUsername,
        displayName: nextFullName,
      });
    }

    return toProfile(user);
  },

  getByUsername: async ({ db, username }: { db: UsersDb; username: string }) => {
    const result = await db
      .select(selectProfile)
      .from(users)
      .where(and(eq(users.username, username.trim()), isNull(users.deletedAt)))
      .limit(1);

    const user = result[0] ?? null;

    if (!user) {
      throw NotFound("User not found.");
    }

    return toProfile(user);
  },

  getByWallet: async ({ db, walletAddress }: { db: UsersDb; walletAddress: string }) => {
    const result = await db
      .select(selectProfile)
      .from(users)
      .where(and(eq(users.walletAddress, walletAddress.trim()), isNull(users.deletedAt)))
      .limit(1);

    const user = result[0] ?? null;

    if (!user) {
      throw NotFound("User not found.");
    }

    return toProfile(user);
  },

  search: async ({ db, q }: { db: UsersDb; q: string }) => {
    const term = q.trim();

    if (!term) {
      return [];
    }

    const result = await db
      .select(selectProfile)
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(
            ilike(users.username, `%${term}%`),
            ilike(users.fullName, `%${term}%`),
            ilike(users.walletAddress, `%${term}%`)
          )
        )
      )
      .limit(25);

    return result.map(toProfile);
  },
};
