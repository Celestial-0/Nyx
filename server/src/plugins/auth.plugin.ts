import { Elysia } from "elysia";
import { authService } from "@/modules/auth/auth.service";
import type {
  AuthenticatedUser,
  AuthMacroOption,
  ResolveAuthContext,
  ResolveAuthUserFn,
} from "@/modules/auth/auth.types";
import { Unauthorized } from "@/utils/error";

const extractBearerToken = (authorization?: string): string | null => {
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;

  return bearer && bearer.length > 0 ? bearer : null;
};

export const authPlugin = new Elysia({ name: "auth.plugin" })
  .decorate("authUser", null as AuthenticatedUser | null)
  .decorate("resolveAuthUser", async ({ headers, jwt, redis, db }: ResolveAuthContext) => {
    const token = extractBearerToken(headers.authorization);

    if (!token) {
      return null;
    }

    return authService.resolveSessionFromToken({
      jwt,
      redis,
      db,
      token,
    });
  })
  .decorate(
    "requireAuthUser",
    async (ctx: ResolveAuthContext & { resolveAuthUser: ResolveAuthUserFn }) => {
    const user = await ctx.resolveAuthUser(ctx);

    if (!user) {
      throw Unauthorized("Authentication required.");
    }

    return user;
    }
  )
  .macro({
    auth: (option: AuthMacroOption = true) => {
      const optional = typeof option === "object" && Boolean(option.optional);

      return {
        beforeHandle: async (ctx: object) => {
          const authCtx = ctx as {
            resolveAuthUser: ResolveAuthUserFn;
            authUser: AuthenticatedUser | null;
          } & Partial<ResolveAuthContext>;

          const authUser = await authCtx.resolveAuthUser(authCtx as ResolveAuthContext);

          if (!authUser && !optional) {
            throw Unauthorized("Authentication required.");
          }

          authCtx.authUser = authUser;
        },
      };
    },
  });