import { t } from "elysia";

// Strict encrypted payload contract used by chat message APIs/events.
export const encryptedEnvelopeSchema = t.Object(
  {
    ciphertext: t.String({ minLength: 1 }),
    algorithm: t.Union([
      t.Literal("xchacha20-poly1305"),
      t.Literal("aes-256-gcm"),
    ]),
    nonce: t.String({ minLength: 1 }),
    keyId: t.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const messageTargetSchema = t.Object(
  {
    roomId: t.Optional(t.String({ format: "uuid" })),
    conversationId: t.Optional(t.String({ format: "uuid" })),
  },
  { additionalProperties: false }
);

export const sendMessageBodySchema = t.Object(
  {
    clientMessageId: t.String({ format: "uuid" }),
    idempotencyKey: t.String({ format: "uuid" }),
    target: messageTargetSchema,
    content: encryptedEnvelopeSchema,
  },
  { additionalProperties: false }
);

export const messageAckBodySchema = t.Object(
  {
    messageId: t.String({ format: "uuid" }),
  },
  { additionalProperties: false }
);
