import { OpenAPIHono } from "@hono/zod-openapi";
import {
  createRoomRoute,
  deleteRoomRoute,
  getRoomMembersRoute,
  getRoomRoute,
  joinRoomRoute,
  leaveRoomRoute,
  muteRoomRoute,
  updateRoomMemberRoleRoute,
} from "@/features/rooms/openapi";
import { roomsService } from "@/features/rooms/service";
import type { AppBindings } from "@/types/global";
import { success } from "@/http/response";

export const roomRoutes = new OpenAPIHono<AppBindings>().basePath("/rooms");

roomRoutes.openapi(createRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const data = await roomsService.createGroupRoom({
    db: c.get("db"),
    userId: authUser!.id,
    activeDeviceId: authUser!.activeDeviceId,
    input: c.req.valid("json"),
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(getRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.getRoom({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
    activeDeviceId: authUser!.activeDeviceId,
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(getRoomMembersRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.getMembers({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(joinRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.joinGroupRoom({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
    activeDeviceId: authUser!.activeDeviceId,
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(leaveRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.leaveGroupRoom({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
    activeDeviceId: authUser!.activeDeviceId,
    eventBus: c.get("eventBus"),
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(muteRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.updateMuteState({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
    mutedUntil: c.req.valid("json").mutedUntil,
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(updateRoomMemberRoleRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId, userId } = c.req.valid("param");
  const data = await roomsService.updateMemberRole({
    db: c.get("db"),
    roomId,
    actorUserId: authUser!.id,
    targetUserId: userId,
    role: c.req.valid("json").role,
  });

  return c.json(success(data), 200);
});

roomRoutes.openapi(deleteRoomRoute, async (c) => {
  const authUser = c.get("authUser");
  const { roomId } = c.req.valid("param");
  const data = await roomsService.deleteGroupRoom({
    db: c.get("db"),
    roomId,
    userId: authUser!.id,
  });

  return c.json(success(data), 200);
});
