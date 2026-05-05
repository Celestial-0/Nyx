import { afterEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { TextEncoder } from "node:util";
import nacl from "tweetnacl";
import { asc, eq } from "drizzle-orm";
import { creditLogs, userCredits, users } from "@/platform/db/schema";
import { authService } from "@/features/auth/service";
import { e2eeService } from "@/features/e2ee/service";
import { jwtService } from "@/security/jwt";
import { withTestTransaction } from "@/test-utils/integration";
import { redis } from "@/platform/redis/client";
import bs58 from "bs58";

const encodeBase58 = (value: Uint8Array): string => bs58.encode(value);


const textEncoder = new TextEncoder();

const cleanupAuthRedisState = async () => {
  const keys = await redis.keys("auth:*");

  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

const createJwt = () =>
  ({
    sign: mock(async () => "signed-token"),
  }) as never;

const createSignedAuthPayload = async () => {
  const keyPair = nacl.sign.keyPair();
  const walletAddress = encodeBase58(keyPair.publicKey);
  const nonceData = await authService.generateNonce({
    redis,
    input: { walletAddress },
  });
  const signature = encodeBase58(
    nacl.sign.detached(textEncoder.encode(nonceData.message), keyPair.secretKey)
  );

  return {
    walletAddress,
    keyPair,
    nonceData,
    signature,
  };
};

const createDeviceRegistration = ({
  walletAddress,
  walletSecretKey,
}: {
  walletAddress: string;
  walletSecretKey: Uint8Array;
}) => {
  const identityKeyPair = nacl.box.keyPair();
  const signedPreKeyPair = nacl.box.keyPair();
  const device = {
    deviceId: randomUUID(),
    identityKey: {
      kty: "x25519" as const,
      publicKey: encodeBase58(identityKeyPair.publicKey),
    },
    signedPreKey: {
      keyId: randomUUID(),
      kty: "x25519" as const,
      publicKey: encodeBase58(signedPreKeyPair.publicKey),
      signature: encodeBase58(nacl.randomBytes(64)),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    oneTimePreKeys: Array.from({ length: 8 }, () => {
      const preKey = nacl.box.keyPair();
      return {
        keyId: randomUUID(),
        kty: "x25519" as const,
        publicKey: encodeBase58(preKey.publicKey),
      };
    }),
    proof: {
      message: "",
      signature: "",
    },
  };

  const message = e2eeService.buildDeviceRegistrationMessage({
    walletAddress,
    device,
  });

  device.proof = {
    message,
    signature: encodeBase58(nacl.sign.detached(textEncoder.encode(message), walletSecretKey)),
  };

  return device;
};

afterEach(async () => {
  mock.restore();
  await cleanupAuthRedisState();
});

describe("authService", () => {
  test("verifySignature creates a new user and grants default credits", async () => {
    await withTestTransaction(async (tx) => {
      const signed = await createSignedAuthPayload();

      const result = await authService.verifySignature({
        redis,
        db: tx as never,
        jwt: createJwt(),
        input: {
          walletAddress: signed.walletAddress,
          nonce: signed.nonceData.nonce,
          message: signed.nonceData.message,
          signature: signed.signature,
          device: createDeviceRegistration({
            walletAddress: signed.walletAddress,
            walletSecretKey: signed.keyPair.secretKey,
          }),
        },
      });

      const createdUsers = await tx
        .select({
          id: users.id,
          walletAddress: users.walletAddress,
        })
        .from(users)
        .where(eq(users.walletAddress, signed.walletAddress))
        .limit(1);
      const balances = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, createdUsers[0]!.id))
        .limit(1);
      const creditEntries = await tx
        .select({
          change: creditLogs.change,
          reason: creditLogs.reason,
        })
        .from(creditLogs)
        .where(eq(creditLogs.userId, createdUsers[0]!.id))
        .orderBy(asc(creditLogs.createdAt));

      expect(result.firstSignIn).toBe(true);
      expect(createdUsers[0]?.walletAddress).toBe(signed.walletAddress);
      expect(balances[0]?.balance).toBe(150);
      expect(creditEntries).toEqual([{ change: 150, reason: "initial_grant" }]);
    });
  });

  test("verifySignature backfills credits for an existing user without a balance row", async () => {
    await withTestTransaction(async (tx) => {
      const signed = await createSignedAuthPayload();

      const existingUsers = await tx
        .insert(users)
        .values({
          walletAddress: signed.walletAddress,
        })
        .returning({
          id: users.id,
        });

      const result = await authService.verifySignature({
        redis,
        db: tx as never,
        jwt: createJwt(),
        input: {
          walletAddress: signed.walletAddress,
          nonce: signed.nonceData.nonce,
          message: signed.nonceData.message,
          signature: signed.signature,
          device: createDeviceRegistration({
            walletAddress: signed.walletAddress,
            walletSecretKey: signed.keyPair.secretKey,
          }),
        },
      });

      const balances = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, existingUsers[0]!.id))
        .limit(1);

      expect(result.firstSignIn).toBe(false);
      expect(balances[0]?.balance).toBe(150);
    });
  });

  test("old access tokens without hardened claims are rejected after phase 14", async () => {
    await withTestTransaction(async (tx) => {
      const signed = await createSignedAuthPayload();
      const issued = await authService.verifySignature({
        redis,
        db: tx as never,
        jwt: jwtService,
        input: {
          walletAddress: signed.walletAddress,
          nonce: signed.nonceData.nonce,
          message: signed.nonceData.message,
          signature: signed.signature,
          device: createDeviceRegistration({
            walletAddress: signed.walletAddress,
            walletSecretKey: signed.keyPair.secretKey,
          }),
        },
      });

      const legacyToken = await jwtService.sign({
        sub: "legacy-user",
        wal: signed.walletAddress,
        role: null,
        jti: randomUUID(),
        type: "access",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      expect(
        await authService.resolveSessionFromToken({
          jwt: jwtService,
          redis,
          db: tx as never,
          token: legacyToken,
        })
      ).toBeNull();
      expect(issued.accessToken).toBeString();
    });
  });

  test("refresh rotates tokens and invalidates the previous refresh token", async () => {
    await withTestTransaction(async (tx) => {
      const signed = await createSignedAuthPayload();
      const session = await authService.verifySignature({
        redis,
        db: tx as never,
        jwt: jwtService,
        input: {
          walletAddress: signed.walletAddress,
          nonce: signed.nonceData.nonce,
          message: signed.nonceData.message,
          signature: signed.signature,
          device: createDeviceRegistration({
            walletAddress: signed.walletAddress,
            walletSecretKey: signed.keyPair.secretKey,
          }),
        },
      });

      const refreshed = await authService.refreshAccessToken({
        redis,
        db: tx as never,
        jwt: jwtService,
        input: {
          refreshToken: session.refreshToken!,
        },
      });

      expect(refreshed.accessToken).toBeString();
      expect(refreshed.refreshToken).toBeString();
      expect(refreshed.refreshToken).not.toBe(session.refreshToken);
      expect(
        await authService.resolveSessionFromToken({
          jwt: jwtService,
          redis,
          db: tx as never,
          token: refreshed.accessToken,
        })
      ).toMatchObject({
        walletAddress: signed.walletAddress,
      });

      try {
        await authService.refreshAccessToken({
          redis,
          db: tx as never,
          jwt: jwtService,
          input: {
            refreshToken: session.refreshToken!,
          },
        });
        throw new Error("Expected refresh token reuse to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "UNAUTHORIZED",
          message: "Refresh token reuse detected. Please sign in again.",
        });
      }

      expect(
        await authService.resolveSessionFromToken({
          jwt: jwtService,
          redis,
          db: tx as never,
          token: session.accessToken!,
        })
      ).toBeNull();
      expect(
        await authService.resolveSessionFromToken({
          jwt: jwtService,
          redis,
          db: tx as never,
          token: refreshed.accessToken,
        })
      ).toBeNull();
    });
  });

  test("deleted or banned users cannot keep using previously issued access tokens", async () => {
    await withTestTransaction(async (tx) => {
      const signed = await createSignedAuthPayload();
      const session = await authService.verifySignature({
        redis,
        db: tx as never,
        jwt: jwtService,
        input: {
          walletAddress: signed.walletAddress,
          nonce: signed.nonceData.nonce,
          message: signed.nonceData.message,
          signature: signed.signature,
          device: createDeviceRegistration({
            walletAddress: signed.walletAddress,
            walletSecretKey: signed.keyPair.secretKey,
          }),
        },
      });

      const userRows = await tx
        .select({
          id: users.id,
        })
        .from(users)
        .where(eq(users.walletAddress, signed.walletAddress))
        .limit(1);

      await tx
        .update(users)
        .set({
          isBanned: true,
        })
        .where(eq(users.id, userRows[0]!.id));

      expect(
        await authService.resolveSessionFromToken({
          jwt: jwtService,
          redis,
          db: tx as never,
          token: session.accessToken!,
        })
      ).toBeNull();
    });
  });

  test("issuing a second nonce invalidates the previous wallet nonce", async () => {
    const keyPair = nacl.sign.keyPair();
    const walletAddress = encodeBase58(keyPair.publicKey);
    const firstNonce = await authService.generateNonce({
      redis,
      input: { walletAddress },
    });
    const secondNonce = await authService.generateNonce({
      redis,
      input: { walletAddress },
    });

    expect(firstNonce.nonce).not.toBe(secondNonce.nonce);
    expect(await redis.get(`auth:nonce:payload:${firstNonce.nonce}`)).toBeNull();
    expect(await redis.get(`auth:nonce:wallet:${walletAddress}`)).toBe(secondNonce.nonce);
  });
});
