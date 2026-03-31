import { t } from "elysia";

const walletAddressPattern = "^[1-9A-HJ-NP-Za-km-z]{32,44}$";

export const usersProfileSchema = t.Object({
  id: t.String({ format: "uuid" }),
  walletAddress: t.String(),
  username: t.Union([t.String(), t.Null()]),
  displayName: t.Union([t.String(), t.Null()]),
  role: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const usersMeSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: usersProfileSchema,
});

export const usersUpdateMeRequestBodySchema = t.Object(
  {
    username: t.Optional(t.String({ minLength: 3, maxLength: 30 })),
    fullName: t.Optional(t.String({ minLength: 2, maxLength: 60 })),
  },
  {
    additionalProperties: false,
  }
);

export const usersUpdateMeSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: usersProfileSchema,
});

export const usersByUsernameParamsSchema = t.Object({
  username: t.String({ minLength: 3, maxLength: 30 }),
});

export const usersByWalletParamsSchema = t.Object({
  wallet: t.String({ minLength: 32, maxLength: 44, pattern: walletAddressPattern }),
});

export const usersSearchQuerySchema = t.Object({
  q: t.String({ minLength: 2, maxLength: 50 }),
});

export const usersLookupQuerySchema = t.Object({
  by: t.Union([t.Literal("username"), t.Literal("wallet")]),
  value: t.String({ minLength: 1, maxLength: 100 }),
});

export const usersLookupSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: usersProfileSchema,
});

export const usersSearchSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(usersProfileSchema),
});
