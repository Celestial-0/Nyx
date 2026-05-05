import { OpenAPIHono } from "@hono/zod-openapi";
import {
  getMeRoute,
  lookupRoute,
  searchRoute,
  updateMeRoute,
} from "@/features/users/openapi";
import { usersService } from "@/features/users/service";
import type { AppBindings } from "@/types/global";
import { BadRequest } from "@/shared/error";
import { success } from "@/http/response";

export const userRoutes = new OpenAPIHono<AppBindings>().basePath("/users");

userRoutes.openapi(getMeRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await usersService.getMe({
    db: c.get("db"),
    userId: authUser!.id,
  });
  return c.json(success(data), 200);
});

userRoutes.openapi(updateMeRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await usersService.updateMe({
    db: c.get("db"),
    userId: authUser!.id,
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

userRoutes.openapi(lookupRoute, async (c) => {
  const query = c.req.valid("query");

  if (query.by === "username") {
    const data = await usersService.getByUsername({
      db: c.get("db"),
      username: query.value,
    });
    return c.json(success(data), 200);
  }

  if (query.by === "wallet") {
    const data = await usersService.getByWallet({
      db: c.get("db"),
      walletAddress: query.value,
    });
    return c.json(success(data), 200);
  }

  throw BadRequest("'by' must be 'username' or 'wallet'.");
});

userRoutes.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const data = await usersService.search({
    db: c.get("db"),
    q,
  });
  return c.json(success(data), 200);
});
