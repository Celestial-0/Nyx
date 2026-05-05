import { createRoute } from "@hono/zod-openapi";
import { abusePolicies } from "@/abuse/policies";
import { abuseService } from "@/abuse/service";
import { createAbuseProtectionMiddleware } from "@/abuse/middleware";
import { requireAuth } from "@/http/middleware/auth";
import {
  roomCreateBodySchema,
  roomDeleteSuccessResponseSchema,
  roomDetailSuccessResponseSchema,
  roomJoinSuccessResponseSchema,
  roomLeaveSuccessResponseSchema,
  roomMemberParamsSchema,
  roomMemberRoleUpdateBodySchema,
  roomMemberRoleUpdateSuccessResponseSchema,
  roomMembersSuccessResponseSchema,
  roomMuteBodySchema,
  roomMuteSuccessResponseSchema,
  roomParamsSchema,
} from "@/features/rooms/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

const roomsCreateAbuseMiddleware = createAbuseProtectionMiddleware({
  policy: abusePolicies.roomsCreate,
  resolveSubject: (c) => abuseService.createUserSubject(c.get("authUser")!.id),
});

export const createRoomRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Rooms"],
  summary: "Create a group room",
  middleware: [requireAuth, roomsCreateAbuseMiddleware],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: roomCreateBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Created room",
      content: {
        "application/json": {
          schema: roomDetailSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid room request",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: "Rate limited",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    422: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const getRoomRoute = createRoute({
  method: "get",
  path: "/{roomId}",
  tags: ["Rooms"],
  summary: "Get room details",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
  },
  responses: {
    200: {
      description: "Room details",
      content: {
        "application/json": {
          schema: roomDetailSuccessResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Room access denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const getRoomMembersRoute = createRoute({
  method: "get",
  path: "/{roomId}/members",
  tags: ["Rooms"],
  summary: "Get active room members",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
  },
  responses: {
    200: {
      description: "Active room members",
      content: {
        "application/json": {
          schema: roomMembersSuccessResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Room access denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const joinRoomRoute = createRoute({
  method: "post",
  path: "/{roomId}/join",
  tags: ["Rooms"],
  summary: "Join a group room",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
  },
  responses: {
    200: {
      description: "Joined room",
      content: {
        "application/json": {
          schema: roomJoinSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Join rejected",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const leaveRoomRoute = createRoute({
  method: "post",
  path: "/{roomId}/leave",
  tags: ["Rooms"],
  summary: "Leave a group room",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
  },
  responses: {
    200: {
      description: "Left room",
      content: {
        "application/json": {
          schema: roomLeaveSuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Leave rejected",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const muteRoomRoute = createRoute({
  method: "patch",
  path: "/{roomId}/mute",
  tags: ["Rooms"],
  summary: "Mute or unmute a room membership",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: roomMuteBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated mute state",
      content: {
        "application/json": {
          schema: roomMuteSuccessResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Room access denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const updateRoomMemberRoleRoute = createRoute({
  method: "patch",
  path: "/{roomId}/members/{userId}/role",
  tags: ["Rooms"],
  summary: "Promote or demote a room member",
  middleware: requireAuth,
  request: {
    params: roomMemberParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: roomMemberRoleUpdateBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated room member role",
      content: {
        "application/json": {
          schema: roomMemberRoleUpdateSuccessResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Role update denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room or member not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const deleteRoomRoute = createRoute({
  method: "delete",
  path: "/{roomId}",
  tags: ["Rooms"],
  summary: "Delete a group room permanently",
  middleware: requireAuth,
  request: {
    params: roomParamsSchema,
  },
  responses: {
    200: {
      description: "Deleted room",
      content: {
        "application/json": {
          schema: roomDeleteSuccessResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: "Delete denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Room not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});
