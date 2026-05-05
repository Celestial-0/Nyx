import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "@/http/middleware/auth";
import {
  chatConversationListSuccessResponseSchema,
  chatMessageMutationSuccessResponseSchema,
  chatMessageParamsSchema,
  chatConversationParamsSchema,
  chatHistoryQuerySchema,
  chatHistorySuccessResponseSchema,
} from "@/features/chat/schema";
import { errorResponseSchema } from "@/http/openapi/schemas";

export const getConversationMessagesRoute = createRoute({
  method: "get",
  path: "/conversations/{conversationId}/messages",
  tags: ["Chat"],
  summary: "Get encrypted conversation history",
  middleware: requireAuth,
  request: {
    params: chatConversationParamsSchema,
    query: chatHistoryQuerySchema,
  },
  responses: {
    200: {
      description: "Conversation history",
      content: {
        "application/json": {
          schema: chatHistorySuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid history request",
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
    403: {
      description: "Conversation access denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Conversation not found",
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

export const getConversationListRoute = createRoute({
  method: "get",
  path: "/conversations",
  tags: ["Chat"],
  summary: "Get encrypted conversation inbox",
  middleware: requireAuth,
  responses: {
    200: {
      description: "Conversation inbox",
      content: {
        "application/json": {
          schema: chatConversationListSuccessResponseSchema,
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
  },
});

export const hideMessageRoute = createRoute({
  method: "post",
  path: "/messages/{messageId}/hide",
  tags: ["Chat"],
  summary: "Hide a message for the current user",
  middleware: requireAuth,
  request: {
    params: chatMessageParamsSchema,
  },
  responses: {
    200: {
      description: "Message hidden",
      content: {
        "application/json": {
          schema: chatMessageMutationSuccessResponseSchema,
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
      description: "Conversation access denied",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Message not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const deleteMessageRoute = createRoute({
  method: "post",
  path: "/messages/{messageId}/delete",
  tags: ["Chat"],
  summary: "Delete a sent message for everyone",
  middleware: requireAuth,
  request: {
    params: chatMessageParamsSchema,
  },
  responses: {
    200: {
      description: "Message deleted",
      content: {
        "application/json": {
          schema: chatMessageMutationSuccessResponseSchema,
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
      description: "Delete not allowed",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: "Message not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});
