import { Elysia } from "elysia";
import type { NyxSharedContext } from "@/types/global";
import {
  usersLookupQuerySchema,
  usersLookupSuccessResponseSchema,
  usersMeSuccessResponseSchema,
  usersSearchQuerySchema,
  usersSearchSuccessResponseSchema,
  usersUpdateMeRequestBodySchema,
  usersUpdateMeSuccessResponseSchema,
} from "@/modules/users/users.schema";
import { usersService } from "@/modules/users/users.service";
import type { UsersEventBus } from "@/modules/users/user.types";
import { BadRequest, Unauthorized } from "@/utils/error";
import { success } from "@/utils/response";

const usersMeMeta = {
  detail: {
    tags: ["Users"],
    summary: "Get current user profile",
    operationId: "getUsersMe",
  },
  auth: true,
  response: {
    200: usersMeSuccessResponseSchema,
  },
};

const usersPatchMeMeta = {
  detail: {
    tags: ["Users"],
    summary: "Update current user profile",
    operationId: "patchUsersMe",
  },
  auth: true,
  body: usersUpdateMeRequestBodySchema,
  response: {
    200: usersUpdateMeSuccessResponseSchema,
  },
};

const usersSearchMeta = {
  detail: {
    tags: ["Users"],
    summary: "Search users by username or display name",
    operationId: "searchUsers",
  },
  query: usersSearchQuerySchema,
  response: {
    200: usersSearchSuccessResponseSchema,
  },
};

export const usersHandler = new Elysia<
  "",
  NyxSharedContext["singleton"],
  NyxSharedContext["definitions"],
  NyxSharedContext["metadata"]
>({
  name: "users.handler",
})
  .get(
    "/users/me",
    async (ctx) => {
      const authUser = ctx.authUser;
      if (!authUser) {
        throw Unauthorized("Authentication required.");
      }

      const data = await usersService.getMe(ctx.db, authUser.id);
      return success(data);
    },
    usersMeMeta
  )
  .patch(
    "/users/me",
    async (ctx) => {
      const authUser = ctx.authUser;
      if (!authUser) {
        throw Unauthorized("Authentication required.");
      }

      const data = await usersService.updateMe(
        ctx.db,
        authUser.id,
        ctx.body,
        ctx.eventBus as UsersEventBus
      );
      return success(data);
    },
    usersPatchMeMeta
  )
  .get(
    "/users/lookup",
    async ({ query, db }) => {
      if (query.by === "username") {
        const data = await usersService.getByUsername(db, query.value);
        return success(data);
      }

      if (query.by === "wallet") {
        const data = await usersService.getByWallet(db, query.value);
        return success(data);
      }

      // Query schema already restricts value; this is an additional safety net.
      throw BadRequest("'by' must be 'username' or 'wallet'.");
    },
    {
      detail: {
        tags: ["Users"],
        summary: "Lookup user by username or wallet",
        operationId: "getUsersLookup",
      },
      query: usersLookupQuerySchema,
      response: {
        200: usersLookupSuccessResponseSchema,
      },
    }
  )
  .get(
    "/users/search",
    async ({ query, db }) => {
      const data = await usersService.search(db, query.q);
      return success(data);
    },
    usersSearchMeta
  );
