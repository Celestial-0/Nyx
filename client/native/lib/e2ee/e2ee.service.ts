import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { randomUUID } from '@/lib/crypto';
import type {
  ChatCiphertextEnvelope,
  ChatDirectMessageEnvelope,
  ChatGroupMessageEnvelope,
  ChatMessageKind,
  E2eeDeviceRegistration,
  E2eePeerDeviceBundle,
  E2eeSenderKeyEpochState,
  RoomMember,
} from '@/types';

import {
  clearStoredLocalDevice,
  readStoredLocalDevice,
  readStoredSenderKey,
  writeStoredLocalDevice,
  writeStoredSenderKey,
} from './e2ee.storage';
import type {
  DecryptedMessageContent,
  E2eeGroupEncryptInput,
  E2eeSenderKeyDistributionResult,
  E2eeTextPayload,
  StoredLocalDevice,
  StoredSenderKey,
} from './e2ee.types';

/**
 * End-to-end encryption service. Ported from the web client's
 * `features/e2ee/e2ee.service.ts`. Algorithms are unchanged:
 *  - direct messages: random symmetric key (secretbox), wrapped per-recipient
 *    via X25519 scalarMult + SHA-512-derived wrap key XOR.
 *  - group messages: sender key (secretbox) distributed per-device the same way.
 *
 * RN adaptations vs web: storage comes from the local async-cache module,
 * `crypto.randomUUID()` → `randomUUID()`, and `signMessage` is async (MWA).
 */

const ONE_TIME_PREKEY_COUNT = 12;

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function encodeBytes(value: Uint8Array) {
  return bs58.encode(value);
}

function decodeBytes(value: string) {
  return bs58.decode(value);
}

function concatBytes(...values: Uint8Array[]) {
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }

  return output;
}

function toPublicKey(value: Uint8Array) {
  return {
    kty: 'x25519' as const,
    publicKey: encodeBytes(value),
  };
}

function hashKeyMaterial(...values: Uint8Array[]) {
  return nacl.hash(concatBytes(...values)).slice(0, 32);
}

function xorBytes(left: Uint8Array, right: Uint8Array) {
  const length = Math.min(left.length, right.length);
  const output = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    output[index] = left[index]! ^ right[index]!;
  }

  return output;
}

function buildWrapKey(input: { sharedSecret: Uint8Array; context: string }) {
  return hashKeyMaterial(input.sharedSecret, encodeUtf8(input.context));
}

function createUnsignedDeviceRegistration() {
  const identityKeyPair = nacl.box.keyPair();
  const signedPreKeyPair = nacl.box.keyPair();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    registration: {
      deviceId: randomUUID(),
      identityKey: toPublicKey(identityKeyPair.publicKey),
      signedPreKey: {
        keyId: randomUUID(),
        kty: 'x25519' as const,
        publicKey: encodeBytes(signedPreKeyPair.publicKey),
        signature: encodeBytes(nacl.randomBytes(64)),
        issuedAt,
        expiresAt,
      },
      oneTimePreKeys: Array.from({ length: ONE_TIME_PREKEY_COUNT }, () => {
        const oneTimePreKey = nacl.box.keyPair();

        return {
          keyId: randomUUID(),
          kty: 'x25519' as const,
          publicKey: encodeBytes(oneTimePreKey.publicKey),
        };
      }),
    } satisfies Omit<E2eeDeviceRegistration, 'proof'>,
    secrets: {
      identitySecretKey: encodeBytes(identityKeyPair.secretKey),
      signedPreKeySecretKey: encodeBytes(signedPreKeyPair.secretKey),
    },
  };
}

export function buildDeviceRegistrationMessage(input: {
  walletAddress: string;
  device: Omit<E2eeDeviceRegistration, 'proof'>;
}) {
  const { walletAddress, device } = input;
  const lines = [
    'Nyx chat device registration',
    `Wallet: ${walletAddress}`,
    `Device ID: ${device.deviceId}`,
    `Identity Key Type: ${device.identityKey.kty}`,
    `Identity Public Key: ${device.identityKey.publicKey}`,
    `Signed PreKey ID: ${device.signedPreKey.keyId}`,
    `Signed PreKey Type: ${device.signedPreKey.kty}`,
    `Signed PreKey Public Key: ${device.signedPreKey.publicKey}`,
    `Signed PreKey Signature: ${device.signedPreKey.signature}`,
    `Signed PreKey Issued At: ${device.signedPreKey.issuedAt}`,
    `Signed PreKey Expires At: ${device.signedPreKey.expiresAt ?? 'null'}`,
    `One-Time PreKey Count: ${device.oneTimePreKeys.length}`,
  ];

  for (const preKey of device.oneTimePreKeys) {
    lines.push(`One-Time PreKey: ${preKey.keyId}:${preKey.kty}:${preKey.publicKey}`);
  }

  return lines.join('\n');
}

export async function getOrCreateLocalDevice(input: {
  walletAddress: string;
  signMessage: SignMessageFn;
}) {
  const existing = readStoredLocalDevice(input.walletAddress);

  if (existing) {
    return existing;
  }

  const unsignedDevice = createUnsignedDeviceRegistration();
  const message = buildDeviceRegistrationMessage({
    walletAddress: input.walletAddress,
    device: unsignedDevice.registration,
  });
  const signature = await input.signMessage(encodeUtf8(message));

  const localDevice: StoredLocalDevice = {
    registration: {
      ...unsignedDevice.registration,
      proof: {
        message,
        signature: encodeBytes(signature),
      },
    },
    secrets: unsignedDevice.secrets,
    senderKeysByEpochId: {},
  };

  writeStoredLocalDevice(input.walletAddress, localDevice);
  return localDevice;
}

export function getStoredLocalAuthDevice(walletAddress: string) {
  return readStoredLocalDevice(walletAddress);
}

export function getStoredAuthDeviceRegistration(walletAddress: string) {
  return readStoredLocalDevice(walletAddress)?.registration ?? null;
}

export function clearLocalDevice(walletAddress: string) {
  clearStoredLocalDevice(walletAddress);
}

function getLocalIdentitySecretKey(localDevice: StoredLocalDevice) {
  return decodeBytes(localDevice.secrets.identitySecretKey);
}

function getPeerPublicKey(publicKey: string) {
  return decodeBytes(publicKey);
}

function encodeTextPayload(text: string) {
  const payload: E2eeTextPayload = { text };
  return encodeUtf8(JSON.stringify(payload));
}

function decodeTextPayload(value: Uint8Array) {
  const parsed = JSON.parse(decodeUtf8(value)) as Partial<E2eeTextPayload>;

  if (typeof parsed.text !== 'string') {
    throw new Error('Invalid encrypted text payload');
  }

  return parsed.text;
}

function encryptWithSymmetricKey(input: { key: Uint8Array; plaintext: Uint8Array }) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(input.plaintext, nonce, input.key);

  return {
    nonce: encodeBytes(nonce),
    ciphertext: encodeBytes(ciphertext),
  };
}

function decryptWithSymmetricKey(input: {
  ciphertext: string;
  nonce: string;
  key: Uint8Array;
}) {
  const plaintext = nacl.secretbox.open(
    decodeBytes(input.ciphertext),
    decodeBytes(input.nonce),
    input.key
  );

  if (!plaintext) {
    throw new Error('Failed to decrypt encrypted payload');
  }

  return plaintext;
}

function wrapDirectMessageKey(input: {
  messageKey: Uint8Array;
  senderSecretKey: Uint8Array;
  recipientBundle: E2eePeerDeviceBundle;
}) {
  const sharedSecret = nacl.scalarMult(
    input.senderSecretKey,
    getPeerPublicKey(input.recipientBundle.identityKey.publicKey)
  );
  const wrapKey = buildWrapKey({
    sharedSecret,
    context: [
      'nyx-dm-key',
      input.recipientBundle.deviceId,
      input.recipientBundle.signedPreKey.keyId,
      input.recipientBundle.oneTimePreKey?.keyId ?? 'none',
    ].join(':'),
  });

  return encodeBytes(xorBytes(input.messageKey, wrapKey));
}

function unwrapDirectMessageKey(input: {
  encryptedMessageKey: string;
  localDevice: StoredLocalDevice;
  peerPublicKey: string;
  recipientDeviceId: string;
  preKeyId: string;
  oneTimePreKeyId: string | null;
}) {
  const sharedSecret = nacl.scalarMult(
    getLocalIdentitySecretKey(input.localDevice),
    getPeerPublicKey(input.peerPublicKey)
  );
  const wrapKey = buildWrapKey({
    sharedSecret,
    context: [
      'nyx-dm-key',
      input.recipientDeviceId,
      input.preKeyId,
      input.oneTimePreKeyId ?? 'none',
    ].join(':'),
  });

  return xorBytes(decodeBytes(input.encryptedMessageKey), wrapKey);
}

function wrapSenderKey(input: {
  senderKey: Uint8Array;
  senderDevice: StoredLocalDevice;
  recipientDevice: E2eePeerDeviceBundle;
}) {
  const nonce = nacl.randomBytes(24);
  const sharedSecret = nacl.scalarMult(
    getLocalIdentitySecretKey(input.senderDevice),
    getPeerPublicKey(input.recipientDevice.identityKey.publicKey)
  );
  const wrapKey = buildWrapKey({
    sharedSecret,
    context: `nyx-group-key:${encodeBytes(nonce)}`,
  });

  return {
    algorithm: 'signal-sender-key-v1' as const,
    ciphertext: encodeBytes(xorBytes(input.senderKey, wrapKey)),
    nonce: encodeBytes(nonce),
    wrappedAt: new Date().toISOString(),
  };
}

function unwrapSenderKey(input: {
  encryptedShare: { ciphertext: string; nonce: string };
  localDevice: StoredLocalDevice;
  senderPublicKey: string;
}) {
  const sharedSecret = nacl.scalarMult(
    getLocalIdentitySecretKey(input.localDevice),
    getPeerPublicKey(input.senderPublicKey)
  );
  const wrapKey = buildWrapKey({
    sharedSecret,
    context: `nyx-group-key:${input.encryptedShare.nonce}`,
  });

  return xorBytes(decodeBytes(input.encryptedShare.ciphertext), wrapKey);
}

function createPlaceholder(kind: ChatMessageKind, label: string): DecryptedMessageContent {
  return { kind, text: label, isPlaceholder: true };
}

export function buildDirectTextEnvelope(input: {
  text: string;
  sentAt: string;
  senderDevice: StoredLocalDevice;
  recipients: E2eePeerDeviceBundle[];
}): ChatDirectMessageEnvelope {
  const messageKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const payload = encryptWithSymmetricKey({
    key: messageKey,
    plaintext: encodeTextPayload(input.text),
  });
  const senderSecretKey = getLocalIdentitySecretKey(input.senderDevice);

  return {
    version: '1',
    algorithm: 'signal-prekey-message-v1',
    conversationType: 'direct',
    senderDeviceId: input.senderDevice.registration.deviceId,
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    sentAt: input.sentAt,
    recipients: input.recipients.map((recipient) => ({
      deviceId: recipient.deviceId,
      preKeyId: recipient.signedPreKey.keyId,
      oneTimePreKeyId: recipient.oneTimePreKey?.keyId ?? null,
      encryptedMessageKey: wrapDirectMessageKey({
        messageKey,
        senderSecretKey,
        recipientBundle: recipient,
      }),
    })),
  };
}

export function createSenderKeyDistribution(input: {
  roomId: string;
  epochId: string;
  senderDevice: StoredLocalDevice;
  members: RoomMember[];
  senderKey?: Uint8Array;
}) {
  const senderKey = input.senderKey ?? nacl.randomBytes(nacl.secretbox.keyLength);
  const shares = input.members.flatMap((member) =>
    member.devices
      .filter((device) => device.deviceId !== input.senderDevice.registration.deviceId)
      .map((device) => ({
        userId: member.userId,
        deviceId: device.deviceId,
        encryptedShare: wrapSenderKey({
          senderKey,
          senderDevice: input.senderDevice,
          recipientDevice: device,
        }),
      }))
  );

  return {
    epochId: input.epochId,
    algorithm: 'signal-sender-key-v1' as const,
    shares,
    senderKey,
  } satisfies E2eeSenderKeyDistributionResult;
}

export function getStoredSenderKeyValue(walletAddress: string, epochId: string) {
  const stored = readStoredSenderKey(walletAddress, epochId);
  return stored ? decodeBytes(stored.key) : null;
}

export function persistSenderKey(input: {
  walletAddress: string;
  roomId: string;
  epochId: string;
  key: Uint8Array;
}) {
  writeStoredSenderKey({
    walletAddress: input.walletAddress,
    epochId: input.epochId,
    senderKey: toStoredSenderKey({
      roomId: input.roomId,
      epochId: input.epochId,
      key: input.key,
    }),
  });
}

export function buildGroupTextEnvelope(input: E2eeGroupEncryptInput): ChatGroupMessageEnvelope {
  const payload = encryptWithSymmetricKey({
    key: input.senderKey,
    plaintext: encodeTextPayload(input.text),
  });

  return {
    version: '1',
    algorithm: 'signal-sender-key-message-v1',
    conversationType: 'group',
    senderDeviceId: input.senderDevice.registration.deviceId,
    ciphertext: payload.ciphertext,
    nonce: payload.nonce,
    sentAt: input.sentAt,
    senderKeyEpochId: input.epochId,
    distribution: input.distribution
      ? {
          epochId: input.distribution.epochId,
          algorithm: 'signal-sender-key-v1',
          shares: input.distribution.shares,
        }
      : null,
  };
}

function findPeerDeviceInMembers(members: RoomMember[], deviceId: string) {
  for (const member of members) {
    const device = member.devices.find((item) => item.deviceId === deviceId);

    if (device) {
      return device;
    }
  }

  return null;
}

function toStoredSenderKey(input: {
  roomId: string;
  epochId: string;
  key: Uint8Array;
}): StoredSenderKey {
  return {
    epochId: input.epochId,
    roomId: input.roomId,
    key: encodeBytes(input.key),
    createdAt: new Date().toISOString(),
  };
}

function decryptDirectText(input: {
  envelope: ChatDirectMessageEnvelope;
  localDevice: StoredLocalDevice;
  currentUserId: string;
  peerDeviceBundles: E2eePeerDeviceBundle[];
}): string {
  if (input.envelope.senderDeviceId === input.localDevice.registration.deviceId) {
    const recipient = input.envelope.recipients[0];

    if (!recipient) {
      throw new Error('Direct envelope is missing recipients');
    }

    const peerDevice = input.peerDeviceBundles.find(
      (device) => device.deviceId === recipient.deviceId
    );

    if (!peerDevice) {
      throw new Error('Recipient device bundle is unavailable');
    }

    const messageKey = unwrapDirectMessageKey({
      encryptedMessageKey: recipient.encryptedMessageKey,
      localDevice: input.localDevice,
      peerPublicKey: peerDevice.identityKey.publicKey,
      recipientDeviceId: recipient.deviceId,
      preKeyId: recipient.preKeyId,
      oneTimePreKeyId: recipient.oneTimePreKeyId,
    });

    return decodeTextPayload(
      decryptWithSymmetricKey({
        ciphertext: input.envelope.ciphertext,
        nonce: input.envelope.nonce,
        key: messageKey,
      })
    );
  }

  const recipient = input.envelope.recipients.find(
    (item) => item.deviceId === input.localDevice.registration.deviceId
  );

  if (!recipient) {
    throw new Error('This device cannot decrypt the direct message');
  }

  const senderDevice = input.peerDeviceBundles.find(
    (device) => device.deviceId === input.envelope.senderDeviceId
  );

  if (!senderDevice) {
    throw new Error('Sender device bundle is unavailable');
  }

  const messageKey = unwrapDirectMessageKey({
    encryptedMessageKey: recipient.encryptedMessageKey,
    localDevice: input.localDevice,
    peerPublicKey: senderDevice.identityKey.publicKey,
    recipientDeviceId: recipient.deviceId,
    preKeyId: recipient.preKeyId,
    oneTimePreKeyId: recipient.oneTimePreKeyId,
  });

  return decodeTextPayload(
    decryptWithSymmetricKey({
      ciphertext: input.envelope.ciphertext,
      nonce: input.envelope.nonce,
      key: messageKey,
    })
  );
}

function resolveLocalSenderKey(input: {
  walletAddress: string;
  roomId: string;
  epochId: string;
  localDevice: StoredLocalDevice;
  members: RoomMember[];
  senderDeviceId: string;
  distribution?: ChatGroupMessageEnvelope['distribution'] | null;
  senderKeyState: E2eeSenderKeyEpochState | null;
}) {
  const peerDevice = findPeerDeviceInMembers(input.members, input.senderDeviceId);

  const matchingShare =
    input.distribution?.shares.find(
      (share) => share.deviceId === input.localDevice.registration.deviceId
    ) ?? null;

  if (matchingShare && peerDevice) {
    const senderKey = unwrapSenderKey({
      encryptedShare: matchingShare.encryptedShare,
      localDevice: input.localDevice,
      senderPublicKey: peerDevice.identityKey.publicKey,
    });

    writeStoredSenderKey({
      walletAddress: input.walletAddress,
      epochId: input.epochId,
      senderKey: toStoredSenderKey({
        roomId: input.roomId,
        epochId: input.epochId,
        key: senderKey,
      }),
    });

    return senderKey;
  }

  const cached = readStoredSenderKey(input.walletAddress, input.epochId);

  if (cached) {
    return decodeBytes(cached.key);
  }

  if (!peerDevice) {
    return null;
  }

  if (
    input.senderKeyState?.epochId === input.epochId &&
    input.senderKeyState.activeDeviceShare &&
    input.senderKeyState.createdByDeviceId
  ) {
    const creatorDevice = findPeerDeviceInMembers(
      input.members,
      input.senderKeyState.createdByDeviceId
    );

    if (!creatorDevice) {
      return null;
    }

    const senderKey = unwrapSenderKey({
      encryptedShare: input.senderKeyState.activeDeviceShare,
      localDevice: input.localDevice,
      senderPublicKey: creatorDevice.identityKey.publicKey,
    });

    writeStoredSenderKey({
      walletAddress: input.walletAddress,
      epochId: input.epochId,
      senderKey: toStoredSenderKey({
        roomId: input.roomId,
        epochId: input.epochId,
        key: senderKey,
      }),
    });

    return senderKey;
  }

  return null;
}

export function ensureResolvedGroupSenderKey(input: {
  walletAddress: string;
  roomId: string;
  epochId: string;
  localDevice: StoredLocalDevice;
  members: RoomMember[];
  senderDeviceId: string;
  distribution?: ChatGroupMessageEnvelope['distribution'] | null;
  senderKeyState: E2eeSenderKeyEpochState | null;
}) {
  return resolveLocalSenderKey(input);
}

function decryptGroupText(input: {
  envelope: ChatGroupMessageEnvelope;
  kind: ChatMessageKind;
  localDevice: StoredLocalDevice;
  walletAddress: string;
  members: RoomMember[];
  senderId: string;
  senderKeyState: E2eeSenderKeyEpochState | null;
}): DecryptedMessageContent {
  const senderKey = resolveLocalSenderKey({
    walletAddress: input.walletAddress,
    roomId: input.senderKeyState?.roomId ?? '',
    epochId: input.envelope.senderKeyEpochId,
    localDevice: input.localDevice,
    members: input.members,
    senderDeviceId: input.envelope.senderDeviceId,
    distribution: input.envelope.distribution ?? null,
    senderKeyState: input.senderKeyState,
  });

  if (!senderKey) {
    return createPlaceholder(input.kind, 'Encrypted group message');
  }

  try {
    const text = decodeTextPayload(
      decryptWithSymmetricKey({
        ciphertext: input.envelope.ciphertext,
        nonce: input.envelope.nonce,
        key: senderKey,
      })
    );

    return { kind: input.kind, text, isPlaceholder: false };
  } catch {
    return createPlaceholder(input.kind, 'Encrypted group message');
  }
}

export function decryptConversationEnvelope(input: {
  envelope: ChatCiphertextEnvelope;
  kind: ChatMessageKind;
  currentUserId: string;
  walletAddress: string;
  localDevice: StoredLocalDevice | null;
  peerDeviceBundles?: E2eePeerDeviceBundle[] | null;
  members?: RoomMember[] | null;
  senderKeyState?: E2eeSenderKeyEpochState | null;
  senderId: string;
}): DecryptedMessageContent {
  if (!input.localDevice) {
    return createPlaceholder(
      input.kind,
      input.kind === 'image' ? 'Encrypted image payload' : 'Encrypted message'
    );
  }

  try {
    if (input.envelope.conversationType === 'direct') {
      const peerDeviceBundles = input.peerDeviceBundles ?? [];

      if (!peerDeviceBundles.length) {
        return createPlaceholder(input.kind, 'Encrypted direct message');
      }

      const text = decryptDirectText({
        envelope: input.envelope,
        localDevice: input.localDevice,
        currentUserId: input.currentUserId,
        peerDeviceBundles,
      });

      return { kind: input.kind, text, isPlaceholder: false };
    }

    return decryptGroupText({
      envelope: input.envelope,
      kind: input.kind,
      localDevice: input.localDevice,
      walletAddress: input.walletAddress,
      members: input.members ?? [],
      senderId: input.senderId,
      senderKeyState: input.senderKeyState ?? null,
    });
  } catch {
    return createPlaceholder(
      input.kind,
      input.kind === 'image' ? 'Encrypted image payload' : 'Encrypted message'
    );
  }
}
