import { createRoute } from "@hono/zod-openapi";
import { requireAuth } from "@/http/middleware/auth";
import { errorResponseSchema } from "@/http/openapi/schemas";
import {
  contactDeleteSuccessResponseSchema,
  contactEntrySuccessResponseSchema,
  contactParamsSchema,
  contactsListSuccessResponseSchema,
  createContactBodySchema,
  updateContactBodySchema,
} from "@/features/contacts/schema";

export const listContactsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Contacts"],
  summary: "List saved contacts",
  middleware: requireAuth,
  responses: {
    200: {
      description: "Saved contacts",
      content: {
        "application/json": {
          schema: contactsListSuccessResponseSchema,
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

export const createContactRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Contacts"],
  summary: "Save a private contact alias",
  middleware: requireAuth,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createContactBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Saved contact",
      content: {
        "application/json": {
          schema: contactEntrySuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid contact request",
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
  },
});

export const updateContactRoute = createRoute({
  method: "patch",
  path: "/{contactUserId}",
  tags: ["Contacts"],
  summary: "Update a private contact alias",
  middleware: requireAuth,
  request: {
    params: contactParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: updateContactBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated contact",
      content: {
        "application/json": {
          schema: contactEntrySuccessResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid contact request",
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
      description: "Contact not found",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

export const deleteContactRoute = createRoute({
  method: "delete",
  path: "/{contactUserId}",
  tags: ["Contacts"],
  summary: "Remove a saved contact",
  middleware: requireAuth,
  request: {
    params: contactParamsSchema,
  },
  responses: {
    200: {
      description: "Removed contact",
      content: {
        "application/json": {
          schema: contactDeleteSuccessResponseSchema,
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
