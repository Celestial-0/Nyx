import { TextEncoder } from "node:util";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import nacl from "tweetnacl";
import bs58 from "bs58";
import type { z } from "zod";
import {
  deviceOneTimePrekeys,
  deviceSignedPrekeys,
  roomMembers,
  roomSenderKeyEpochs,
  roomSenderKeyShares,
  rooms,
  userDevices,
  users,
} from "@/platform/db/schema";
import type { db } from "@/platform/db/client";
import {
  e2eeActiveDeviceSchema,
  e2eeDeviceRegistrationSchema,
  e2eePeerDeviceBundleSchema,
  e2eePreKeyInventoryStatusSchema,
  e2eeSenderKeyDistributionSchema,
  e2eeSenderKeyEpochStateSchema,
} from "@/features/e2ee/schema";

import { BadRequest, Forbidden } from "@/shared/error";

const decodeBase58 = (value: string): Uint8Array => bs58.decode(value);


const textEncoder = new TextEncoder();
const senderKeyAlgorithm = "signal-sender-key-v1" as const;
const oneTimePreKeyLowWatermark = 5;

type E2eeDb = typeof db;
type DeviceRegistrationInput = z.infer<typeof e2eeDeviceRegistrationSchema>;
type ActiveDevice = z.infer<typeof e2eeActiveDeviceSchema>;
type PreKeyInventoryStatus = z.infer<typeof e2eePreKeyInventoryStatusSchema>;
type SenderKeyEpochState = z.infer<typeof e2eeSenderKeyEpochStateSchema>;
type PeerDeviceBundle = z.infer<typeof e2eePeerDeviceBundleSchema>;
type SenderKeyDistribution = z.infer<typeof e2eeSenderKeyDistributionSchema>;

const verifyWalletSignature = ({
  walletAddress,
  message,
  signature,
}: {
  walletAddress: string;
  message: string;
  signature: string;
}) => {
  try {
    const publicKey = decodeBase58(walletAddress);
    const signatureBytes = decodeBase58(signature);

    if (publicKey.length !== 32 || signatureBytes.length !== 64) {
      return false;
    }

    const normalizedMessage = message.replace(/\r\n/g, "\n");

    return nacl.sign.detached.verify(
      textEncoder.encode(normalizedMessage),
      signatureBytes,
      publicKey
    );
  } catch {
    return false;
  }
};

const toFingerprint = (publicKey: string) => publicKey.slice(0, 16);

const buildDeviceRegistrationMessage = ({
  walletAddress,
  device,
}: {
  walletAddress: string;
  device: DeviceRegistrationInput;
}) => {
  const lines = [
    "Nyx chat device registration",
    `Wallet: ${walletAddress}`,
    `Device ID: ${device.deviceId}`,
    `Identity Key Type: ${device.identityKey.kty}`,
    `Identity Public Key: ${device.identityKey.publicKey}`,
    `Signed PreKey ID: ${device.signedPreKey.keyId}`,
    `Signed PreKey Type: ${device.signedPreKey.kty}`,
    `Signed PreKey Public Key: ${device.signedPreKey.publicKey}`,
    `Signed PreKey Signature: ${device.signedPreKey.signature}`,
    `Signed PreKey Issued At: ${device.signedPreKey.issuedAt}`,
    `Signed PreKey Expires At: ${device.signedPreKey.expiresAt ?? "null"}`,
    `One-Time PreKey Count: ${device.oneTimePreKeys.length}`,
  ];

  for (const preKey of device.oneTimePreKeys) {
    lines.push(`One-Time PreKey: ${preKey.keyId}:${preKey.kty}:${preKey.publicKey}`);
  }

  return lines.join("\n");
};

const toIso = (value: Date | null) => value?.toISOString() ?? null;

const getDeviceRow = async (dbClient: E2eeDb, deviceId: string) => {
  const rows = await dbClient
    .select({
      deviceId: userDevices.id,
      userId: userDevices.userId,
      fingerprint: userDevices.fingerprint,
      identityKey: userDevices.identityKey,
      status: userDevices.status,
      registeredAt: userDevices.registeredAt,
      lastSeenAt: userDevices.lastSeenAt,
      revokedAt: userDevices.revokedAt,
      signedPreKeyId: deviceSignedPrekeys.keyId,
      signedPreKeyPublicKey: deviceSignedPrekeys.publicKey,
      signedPreKeySignature: deviceSignedPrekeys.signature,
      signedPreKeyIssuedAt: deviceSignedPrekeys.issuedAt,
      signedPreKeyExpiresAt: deviceSignedPrekeys.expiresAt,
    })
    .from(userDevices)
    .innerJoin(deviceSignedPrekeys, eq(deviceSignedPrekeys.deviceId, userDevices.id))
    .where(eq(userDevices.id, deviceId))
    .limit(1);

  return rows[0] ?? null;
};

const toActiveDevice = (
  row: Awaited<ReturnType<typeof getDeviceRow>> extends infer T
    ? T extends null
      ? never
      : NonNullable<T>
    : never
): ActiveDevice => ({
  deviceId: row.deviceId,
  fingerprint: row.fingerprint,
  identityKey: row.identityKey as ActiveDevice["identityKey"],
  signedPreKey: {
    keyId: row.signedPreKeyId,
    kty: "x25519",
    publicKey: row.signedPreKeyPublicKey,
    signature: row.signedPreKeySignature,
    issuedAt: row.signedPreKeyIssuedAt.toISOString(),
    expiresAt: toIso(row.signedPreKeyExpiresAt),
  },
  status: row.status,
  registeredAt: row.registeredAt?.toISOString() ?? new Date().toISOString(),
  lastSeenAt: toIso(row.lastSeenAt),
  revokedAt: toIso(row.revokedAt),
});

const getPreKeyInventoryStatus = async ({
  db,
  deviceId,
}: {
  db: E2eeDb;
  deviceId: string;
}): Promise<PreKeyInventoryStatus> => {
  const signedPreKey = await db
    .select({ deviceId: deviceSignedPrekeys.deviceId })
    .from(deviceSignedPrekeys)
    .where(eq(deviceSignedPrekeys.deviceId, deviceId))
    .limit(1);

  const oneTimePreKeys = await db
    .select({ id: deviceOneTimePrekeys.id })
    .from(deviceOneTimePrekeys)
    .where(and(eq(deviceOneTimePrekeys.deviceId, deviceId), isNull(deviceOneTimePrekeys.consumedAt)));

  const remaining = oneTimePreKeys.length;

  return {
    signedPreKeyRegistered: Boolean(signedPreKey[0]),
    oneTimePreKeysRemaining: remaining,
    oneTimePreKeysLowWatermark: remaining < oneTimePreKeyLowWatermark,
  };
};

const touchDevice = async ({
  db,
  deviceId,
}: {
  db: E2eeDb;
  deviceId: string;
}) => {
  await db
    .update(userDevices)
    .set({
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userDevices.id, deviceId));
};

const getActiveRoomMemberDeviceRows = async ({
  db,
  roomId,
}: {
  db: E2eeDb;
  roomId: string;
}) =>
  db
    .select({
      userId: users.id,
      deviceId: userDevices.id,
      fingerprint: userDevices.fingerprint,
      identityKey: userDevices.identityKey,
      registeredAt: userDevices.registeredAt,
      signedPreKeyId: deviceSignedPrekeys.keyId,
      signedPreKeyPublicKey: deviceSignedPrekeys.publicKey,
      signedPreKeySignature: deviceSignedPrekeys.signature,
      signedPreKeyIssuedAt: deviceSignedPrekeys.issuedAt,
      signedPreKeyExpiresAt: deviceSignedPrekeys.expiresAt,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .innerJoin(userDevices, eq(userDevices.userId, users.id))
    .innerJoin(deviceSignedPrekeys, eq(deviceSignedPrekeys.deviceId, userDevices.id))
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        isNull(roomMembers.leftAt),
        isNull(users.deletedAt),
        eq(userDevices.status, "active")
      )
    )
    .orderBy(asc(userDevices.registeredAt), asc(userDevices.id));

const createPeerBundle = (
  row: Awaited<ReturnType<typeof getActiveRoomMemberDeviceRows>>[number],
  oneTimePreKey: PeerDeviceBundle["oneTimePreKey"]
): PeerDeviceBundle => ({
  userId: row.userId,
  deviceId: row.deviceId,
  fingerprint: row.fingerprint,
  identityKey: row.identityKey as PeerDeviceBundle["identityKey"],
  signedPreKey: {
    keyId: row.signedPreKeyId,
    kty: "x25519",
    publicKey: row.signedPreKeyPublicKey,
    signature: row.signedPreKeySignature,
    issuedAt: row.signedPreKeyIssuedAt.toISOString(),
    expiresAt: toIso(row.signedPreKeyExpiresAt),
  },
  oneTimePreKey,
  registeredAt: row.registeredAt?.toISOString() ?? new Date().toISOString(),
});

const getLatestSenderKeyEpochRow = async ({
  db,
  roomId,
}: {
  db: E2eeDb;
  roomId: string;
}) => {
  const rows = await db
    .select({
      id: roomSenderKeyEpochs.id,
      roomId: roomSenderKeyEpochs.roomId,
      algorithm: roomSenderKeyEpochs.algorithm,
      status: roomSenderKeyEpochs.status,
      createdByUserId: roomSenderKeyEpochs.createdByUserId,
      createdByDeviceId: roomSenderKeyEpochs.createdByDeviceId,
      createdAt: roomSenderKeyEpochs.createdAt,
      activatedAt: roomSenderKeyEpochs.activatedAt,
    })
    .from(roomSenderKeyEpochs)
    .where(eq(roomSenderKeyEpochs.roomId, roomId))
    .orderBy(desc(roomSenderKeyEpochs.createdAt), desc(roomSenderKeyEpochs.id))
    .limit(1);

  return rows[0] ?? null;
};

const ensureSenderKeyEpoch = async ({
  db,
  roomId,
  createdByUserId,
  createdByDeviceId,
  forceRotate = false,
}: {
  db: E2eeDb;
  roomId: string;
  createdByUserId: string;
  createdByDeviceId: string | null;
  forceRotate?: boolean;
}) => {
  const current = await getLatestSenderKeyEpochRow({ db, roomId });

  if (current && !forceRotate) {
    return current;
  }

  if (current) {
    await db
      .update(roomSenderKeyEpochs)
      .set({
        status: "superseded",
        supersededAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(roomSenderKeyEpochs.id, current.id));
  }

  const created = await db
    .insert(roomSenderKeyEpochs)
    .values({
      roomId,
      algorithm: senderKeyAlgorithm,
      status: "pending",
      createdByUserId,
      createdByDeviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: roomSenderKeyEpochs.id,
      roomId: roomSenderKeyEpochs.roomId,
      algorithm: roomSenderKeyEpochs.algorithm,
      status: roomSenderKeyEpochs.status,
      createdByUserId: roomSenderKeyEpochs.createdByUserId,
      createdByDeviceId: roomSenderKeyEpochs.createdByDeviceId,
      createdAt: roomSenderKeyEpochs.createdAt,
      activatedAt: roomSenderKeyEpochs.activatedAt,
    });

  return created[0]!;
};

export const e2eeService = {
  buildDeviceRegistrationMessage,

  registerDevice: async ({
    db,
    userId,
    walletAddress,
    device,
  }: {
    db: E2eeDb;
    userId: string;
    walletAddress: string;
    device: DeviceRegistrationInput;
  }) => {
    const expectedMessage = buildDeviceRegistrationMessage({ walletAddress, device }).replace(/\r\n/g, "\n");
    const normalizedProofMessage = (device.proof.message || "").replace(/\r\n/g, "\n");

    if (normalizedProofMessage !== expectedMessage) {
      throw BadRequest("Device registration message does not match the submitted device bundle.");
    }

    if (
      !verifyWalletSignature({
        walletAddress,
        message: expectedMessage,
        signature: device.proof.signature,
      })
    ) {
      throw BadRequest("Invalid wallet signature for device registration.");
    }

    const existingDevice = await db
      .select({
        id: userDevices.id,
        userId: userDevices.userId,
        status: userDevices.status,
      })
      .from(userDevices)
      .where(eq(userDevices.id, device.deviceId))
      .limit(1);

    if (existingDevice[0] && existingDevice[0].userId !== userId) {
      throw Forbidden("This device identifier is already bound to another account.");
    }

    if (existingDevice[0]?.status === "revoked" && existingDevice[0].userId !== userId) {
      throw BadRequest("This device has been revoked. Register a new device instead.");
    }

    await db.transaction(async (tx) => {
      if (existingDevice[0]) {
        await tx
          .update(userDevices)
          .set({
            identityKey: device.identityKey,
            registrationMessage: device.proof.message,
            registrationSignature: device.proof.signature,
            fingerprint: toFingerprint(device.identityKey.publicKey),
            status: "active",
            revokedAt: null,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userDevices.id, device.deviceId));
      } else {
        await tx.insert(userDevices).values({
          id: device.deviceId,
          userId,
          identityKey: device.identityKey,
          registrationMessage: device.proof.message,
          registrationSignature: device.proof.signature,
          fingerprint: toFingerprint(device.identityKey.publicKey),
          status: "active",
          registeredAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const existingSignedPreKey = await tx
        .select({ deviceId: deviceSignedPrekeys.deviceId })
        .from(deviceSignedPrekeys)
        .where(eq(deviceSignedPrekeys.deviceId, device.deviceId))
        .limit(1);

      if (existingSignedPreKey[0]) {
        await tx
          .update(deviceSignedPrekeys)
          .set({
            keyId: device.signedPreKey.keyId,
            publicKey: device.signedPreKey.publicKey,
            signature: device.signedPreKey.signature,
            issuedAt: new Date(device.signedPreKey.issuedAt),
            expiresAt: device.signedPreKey.expiresAt ? new Date(device.signedPreKey.expiresAt) : null,
            updatedAt: new Date(),
          })
          .where(eq(deviceSignedPrekeys.deviceId, device.deviceId));
      } else {
        await tx.insert(deviceSignedPrekeys).values({
          deviceId: device.deviceId,
          keyId: device.signedPreKey.keyId,
          publicKey: device.signedPreKey.publicKey,
          signature: device.signedPreKey.signature,
          issuedAt: new Date(device.signedPreKey.issuedAt),
          expiresAt: device.signedPreKey.expiresAt ? new Date(device.signedPreKey.expiresAt) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (device.oneTimePreKeys.length > 0) {
        const existingOneTimePreKeys = await tx
          .select({
            keyId: deviceOneTimePrekeys.keyId,
          })
          .from(deviceOneTimePrekeys)
          .where(eq(deviceOneTimePrekeys.deviceId, device.deviceId));

        const existingKeyIds = new Set(
          existingOneTimePreKeys.map((preKey) => preKey.keyId)
        );
        const nextOneTimePreKeys = device.oneTimePreKeys.filter(
          (preKey) => !existingKeyIds.has(preKey.keyId)
        );

        if (nextOneTimePreKeys.length === 0) {
          return;
        }

        await tx.insert(deviceOneTimePrekeys).values(
          nextOneTimePreKeys.map((preKey) => ({
            deviceId: device.deviceId,
            keyId: preKey.keyId,
            publicKey: preKey.publicKey,
            createdAt: new Date(),
          }))
        );
      }
    });

    const activeDevice = await e2eeService.getActiveDeviceForSession({
      db,
      userId,
      deviceId: device.deviceId,
    });

    if (!activeDevice) {
      throw BadRequest("Failed to activate device registration.");
    }

    return activeDevice;
  },

  getActiveDeviceForSession: async ({
    db,
    userId,
    deviceId,
  }: {
    db: E2eeDb;
    userId: string;
    deviceId: string;
  }) => {
    const row = await getDeviceRow(db, deviceId);

    if (!row || row.userId !== userId || row.status !== "active") {
      return null;
    }

    await touchDevice({ db, deviceId });

    return {
      activeDevice: toActiveDevice(row),
      prekeyStatus: await getPreKeyInventoryStatus({ db, deviceId }),
    };
  },

  revokeDevice: async ({
    db,
    userId,
    deviceId,
  }: {
    db: E2eeDb;
    userId: string;
    deviceId: string;
  }) => {
    const existing = await db
      .select({
        id: userDevices.id,
        userId: userDevices.userId,
        status: userDevices.status,
      })
      .from(userDevices)
      .where(eq(userDevices.id, deviceId))
      .limit(1);

    if (!existing[0] || existing[0].userId !== userId || existing[0].status === "revoked") {
      return false;
    }

    const now = new Date();

    await db
      .update(userDevices)
      .set({
        status: "revoked",
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(userDevices.id, deviceId));

    const groupRooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(
        and(
          eq(roomMembers.userId, userId),
          isNull(roomMembers.leftAt),
          eq(rooms.type, "group")
        )
      );

    for (const room of groupRooms) {
      await ensureSenderKeyEpoch({
        db,
        roomId: room.roomId,
        createdByUserId: userId,
        createdByDeviceId: null,
        forceRotate: true,
      });
    }

    return true;
  },

  getPeerDeviceBundlesForDm: async ({
    db,
    targetUserId,
    currentUserId,
    conversationId,
  }: {
    db: E2eeDb;
    targetUserId: string;
    currentUserId: string;
    conversationId: string;
  }) => {
    const rows = await getActiveRoomMemberDeviceRows({
      db,
      roomId: conversationId,
    });

    const peerRows = rows.filter((row) => row.userId === targetUserId);
    const bundles: PeerDeviceBundle[] = [];

    for (const row of peerRows) {
      const preKeyRows = await db
        .select({
          id: deviceOneTimePrekeys.id,
          keyId: deviceOneTimePrekeys.keyId,
          publicKey: deviceOneTimePrekeys.publicKey,
        })
        .from(deviceOneTimePrekeys)
        .where(
          and(eq(deviceOneTimePrekeys.deviceId, row.deviceId), isNull(deviceOneTimePrekeys.consumedAt))
        )
        .orderBy(asc(deviceOneTimePrekeys.createdAt), asc(deviceOneTimePrekeys.id))
        .limit(1);

      const oneTimePreKey = preKeyRows[0]
        ? {
            keyId: preKeyRows[0].keyId,
            kty: "x25519" as const,
            publicKey: preKeyRows[0].publicKey,
          }
        : null;

      if (preKeyRows[0]) {
        await db
          .update(deviceOneTimePrekeys)
          .set({
            consumedAt: new Date(),
            consumedByUserId: currentUserId,
            consumedForConversationId: conversationId,
          })
          .where(eq(deviceOneTimePrekeys.id, preKeyRows[0].id));
      }

      bundles.push(createPeerBundle(row, oneTimePreKey));
    }

    return bundles;
  },

  getRoomMemberDevices: async ({
    db,
    roomId,
  }: {
    db: E2eeDb;
    roomId: string;
  }) => {
    const rows = await getActiveRoomMemberDeviceRows({ db, roomId });
    return rows.map((row) => createPeerBundle(row, null));
  },

  getRoomSenderKeyState: async ({
    db,
    roomId,
    userId,
    activeDeviceId,
  }: {
    db: E2eeDb;
    roomId: string;
    userId: string;
    activeDeviceId: string;
  }): Promise<SenderKeyEpochState> => {
    const epoch = await ensureSenderKeyEpoch({
      db,
      roomId,
      createdByUserId: userId,
      createdByDeviceId: activeDeviceId,
    });

    const shareRows = await db
      .select({
        encryptedShare: roomSenderKeyShares.encryptedShare,
      })
      .from(roomSenderKeyShares)
      .where(
        and(
          eq(roomSenderKeyShares.epochId, epoch.id),
          eq(roomSenderKeyShares.deviceId, activeDeviceId)
        )
      )
      .limit(1);

    return {
      epochId: epoch.id,
      roomId: epoch.roomId,
      algorithm: senderKeyAlgorithm,
      status: epoch.status,
      createdByUserId: epoch.createdByUserId,
      createdByDeviceId: epoch.createdByDeviceId,
      createdAt: epoch.createdAt?.toISOString() ?? new Date().toISOString(),
      activatedAt: toIso(epoch.activatedAt),
      distributionRequired: !shareRows[0] || epoch.status !== "active",
      activeDeviceShare: (shareRows[0]?.encryptedShare as SenderKeyEpochState["activeDeviceShare"]) ?? null,
    };
  },

  rotateRoomSenderKeyEpoch: async ({
    db,
    roomId,
    userId,
    activeDeviceId,
  }: {
    db: E2eeDb;
    roomId: string;
    userId: string;
    activeDeviceId: string | null;
  }) =>
    ensureSenderKeyEpoch({
      db,
      roomId,
      createdByUserId: userId,
      createdByDeviceId: activeDeviceId,
      forceRotate: true,
    }),

  storeGroupSenderKeyDistribution: async ({
    db,
    roomId,
    senderDeviceId,
    distribution,
  }: {
    db: E2eeDb;
    roomId: string;
    senderDeviceId: string;
    distribution: SenderKeyDistribution;
  }) => {
    const epochRows = await db
      .select({
        id: roomSenderKeyEpochs.id,
        roomId: roomSenderKeyEpochs.roomId,
        status: roomSenderKeyEpochs.status,
      })
      .from(roomSenderKeyEpochs)
      .where(and(eq(roomSenderKeyEpochs.id, distribution.epochId), eq(roomSenderKeyEpochs.roomId, roomId)))
      .limit(1);

    const epoch = epochRows[0];

    if (!epoch) {
      throw BadRequest("Sender-key epoch does not belong to this room.");
    }

    const activeDevices = await getActiveRoomMemberDeviceRows({ db, roomId });
    const allowedTargets = new Set(
      activeDevices
        .map((device) => device.deviceId)
        .filter((deviceId) => deviceId !== senderDeviceId)
    );

    for (const share of distribution.shares) {
      if (!allowedTargets.has(share.deviceId)) {
        throw Forbidden("Sender-key distribution targets only active member devices.");
      }
    }

    await db.transaction(async (tx) => {
      for (const share of distribution.shares) {
        const existingShare = await tx
          .select({ id: roomSenderKeyShares.id })
          .from(roomSenderKeyShares)
          .where(
            and(
              eq(roomSenderKeyShares.epochId, distribution.epochId),
              eq(roomSenderKeyShares.deviceId, share.deviceId)
            )
          )
          .limit(1);

        if (existingShare[0]) {
          await tx
            .update(roomSenderKeyShares)
            .set({
              userId: share.userId,
              createdByDeviceId: senderDeviceId,
              encryptedShare: share.encryptedShare,
              updatedAt: new Date(),
            })
            .where(eq(roomSenderKeyShares.id, existingShare[0].id));
        } else {
          await tx.insert(roomSenderKeyShares).values({
            epochId: distribution.epochId,
            roomId,
            userId: share.userId,
            deviceId: share.deviceId,
            createdByDeviceId: senderDeviceId,
            encryptedShare: share.encryptedShare,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      await tx
        .update(roomSenderKeyEpochs)
        .set({
          status: "active",
          activatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(roomSenderKeyEpochs.id, distribution.epochId));
    });
  },
};
