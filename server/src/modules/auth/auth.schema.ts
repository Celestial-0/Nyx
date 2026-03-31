import { t } from "elysia";

/**
 * Solana base58 address validator.
 * Base58 alphabet excludes: 0, O, I, l to reduce visual confusion
 */
export const solanaAddressSchema = t.String({
  minLength: 32,
  maxLength: 44,
  pattern: "^[1-9A-HJ-NP-Za-km-z]{32,44}$",
  description: "Solana pubkey address",
});

export type SolanaAddress = string;

export const authNonceRequestBodySchema = t.Object(
  {
    walletAddress: solanaAddressSchema,
  },
  {
    additionalProperties: false,
  }
);

export const authNonceDataSchema = t.Object({
  walletAddress: t.String(),
  nonce: t.String(),
  message: t.String(),
  issuedAt: t.String(),
  expiresAt: t.String(),
});

export const authNonceSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authNonceDataSchema,
});

export const authVerifyRequestBodySchema = t.Object(
  {
    walletAddress: solanaAddressSchema,
    nonce: t.String({ minLength: 8, maxLength: 128 }),
    message: t.String({ minLength: 10, maxLength: 1024 }),
    signature: t.String({ minLength: 32, maxLength: 256 }),
  },
  {
    additionalProperties: false,
  }
);

export const authVerifyDataSchema = t.Object({
  verified: t.Boolean(),
  firstSignIn: t.Boolean(),
  profile: t.Object({
    walletAddress: t.String(),
    username: t.Union([t.String(), t.Null()]),
    displayName: t.Union([t.String(), t.Null()]),
    profileComplete: t.Boolean(),
  }),
  accessToken: t.String(),
  refreshToken: t.String(),
  tokenType: t.Literal("Bearer"),
  expiresIn: t.Number({ minimum: 1 }),
});

export const authVerifySuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authVerifyDataSchema,
});

export const authRefreshRequestBodySchema = t.Object(
  {
    refreshToken: t.String({ minLength: 16 }),
  },
  {
    additionalProperties: false,
  }
);

export const authRefreshDataSchema = t.Object({
  accessToken: t.String(),
  tokenType: t.Literal("Bearer"),
  expiresIn: t.Number({ minimum: 1 }),
});

export const authRefreshSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authRefreshDataSchema,
});

export const authProfileCompleteRequestBodySchema = t.Object(
  {
    username: t.String({ minLength: 3, maxLength: 30 }),
    fullName: t.String({ minLength: 2, maxLength: 60 }),
  },
  {
    additionalProperties: false,
  }
);

export const authProfileCompleteDataSchema = t.Object({
  profile: t.Object({
    walletAddress: t.String(),
    username: t.String(),
    displayName: t.String(),
    profileComplete: t.Literal(true),
  }),
});

export const authProfileCompleteSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authProfileCompleteDataSchema,
});

export const authSessionUserSchema = t.Object({
  id: t.String({ format: "uuid" }),
  walletAddress: t.String(),
  role: t.Union([t.String(), t.Null()]),
});

export const authSessionDataSchema = t.Object({
  authenticated: t.Boolean(),
  user: t.Union([authSessionUserSchema, t.Null()]),
});

export const authSessionSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authSessionDataSchema,
});

export const authSignoutDataSchema = t.Object({
  signedOut: t.Literal(true),
});

export const authSignoutSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  data: authSignoutDataSchema,
});
