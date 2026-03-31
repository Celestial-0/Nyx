import { and, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { users } from "@/db/schema/user/users";
import type {
  DbUser,
  UsersDb,
  UsersEventBus,
  UsersEventName,
  UsersEventPayload,
  UsersUpdateMeInput,
} from "@/modules/users/user.types";
import { BadRequest, NotFound } from "@/utils/error";

const toProfile = (user: DbUser) => ({
  id: user.id,
  walletAddress: user.walletAddress,
  username: user.username,
  displayName: user.fullName,
  role: user.role,
  createdAt: (user.createdAt ?? new Date()).toISOString(),
  updatedAt: (user.updatedAt ?? new Date()).toISOString(),
});

const selectProfile = {
  id: users.id,
  walletAddress: users.walletAddress,
  username: users.username,
  fullName: users.fullName,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

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
  getMe: async (dbClient: UsersDb, userId: string) => {
    const result = await dbClient
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

  updateMe: async (
    dbClient: UsersDb,
    userId: string,
    input: UsersUpdateMeInput,
    eventBus?: UsersEventBus
  ) => {
    const username = input.username?.trim();
    const fullName = input.fullName?.trim();

    if (!username && !fullName) {
      throw BadRequest("At least one field is required: username or fullName.");
    }

    const existingResult = await dbClient
      .select(selectProfile)
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    const existing = existingResult[0] ?? null;
    if (!existing) {
      throw NotFound("User not found.");
    }

    if (username) {
      const collision = await dbClient
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

    const updated = await dbClient
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
      await emitEventSafely(eventBus, "auth:profile:completed", {
        userId: user.id,
        walletAddress: user.walletAddress,
        username: nextUsername,
        displayName: nextFullName,
      });
    }

    return toProfile(user);
  },

  getByUsername: async (dbClient: UsersDb, username: string) => {
    const result = await dbClient
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

  getByWallet: async (dbClient: UsersDb, walletAddress: string) => {
    const result = await dbClient
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

  search: async (dbClient: UsersDb, q: string) => {
    const term = q.trim();
    if (!term) {
      return [];
    }

    const result = await dbClient
      .select(selectProfile)
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(ilike(users.username, `%${term}%`), ilike(users.fullName, `%${term}%`))
        )
      )
      .limit(25);

    return result.map(toProfile);
  },
};
