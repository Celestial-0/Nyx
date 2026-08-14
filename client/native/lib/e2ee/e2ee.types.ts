import type {
  ChatDirectMessageEnvelope,
  ChatGroupMessageEnvelope,
  ChatMessageKind,
  E2eeDeviceRegistration,
  E2eePeerDeviceBundle,
  E2eeSenderKeyEpochState,
  E2eeSenderKeyShareCiphertext,
  RoomMember,
} from '@/types';

/**
 * Local-storage view types for the E2EE layer. Ported from the web client's
 * `features/e2ee/e2ee.types.ts`. The on-the-wire schemas live in `@/types`;
 * these describe what we persist locally (secret keys + cached sender keys).
 */

export type StoredSenderKey = {
  epochId: string;
  roomId: string;
  key: string;
  createdAt: string;
};

export type E2eeDeviceSecrets = {
  identitySecretKey: string;
  signedPreKeySecretKey: string;
};

export type StoredLocalDevice = {
  registration: E2eeDeviceRegistration;
  secrets: E2eeDeviceSecrets;
  senderKeysByEpochId: Record<string, StoredSenderKey>;
};

export type E2eeTextPayload = {
  text: string;
};

export type DecryptedMessageContent = {
  kind: ChatMessageKind;
  text: string;
  isPlaceholder: boolean;
};

export type E2eeGroupEncryptInput = {
  text: string;
  sentAt: string;
  senderDevice: StoredLocalDevice;
  roomId: string;
  epochId: string;
  senderKey: Uint8Array;
  distribution?: {
    epochId: string;
    shares: {
      userId: string;
      deviceId: string;
      encryptedShare: E2eeSenderKeyShareCiphertext;
    }[];
  } | null;
};

export type E2eeSenderKeyDistributionResult = {
  epochId: string;
  algorithm: 'signal-sender-key-v1';
  shares: {
    userId: string;
    deviceId: string;
    encryptedShare: E2eeSenderKeyShareCiphertext;
  }[];
  senderKey: Uint8Array;
};

export type {
  ChatDirectMessageEnvelope,
  ChatGroupMessageEnvelope,
  ChatMessageKind,
  E2eePeerDeviceBundle,
  E2eeSenderKeyEpochState,
  RoomMember,
};
