import type {
  E2eeActiveDevice,
  E2eeDeviceRegistration,
  E2eePeerDeviceBundle,
  E2eeSenderKeyEpochState,
  E2eeSenderKeyShareCiphertext,
} from "@/features/auth/auth.types"
import type {
  ChatDirectMessageEnvelope,
  ChatGroupMessageEnvelope,
  ChatMessageKind,
} from "@/features/chat/chat.types"
import type { RoomMember } from "@/features/rooms/rooms.types"

export type StoredSenderKey = {
  epochId: string
  roomId: string
  key: string
  createdAt: string
}

export type E2eeDeviceSecrets = {
  identitySecretKey: string
  signedPreKeySecretKey: string
}

export type StoredLocalDevice = {
  registration: E2eeDeviceRegistration
  secrets: E2eeDeviceSecrets
  senderKeysByEpochId: Record<string, StoredSenderKey>
}

export type E2eeTextPayload = {
  text: string
}

export type DecryptedMessageContent =
  | {
      kind: ChatMessageKind
      text: string
      isPlaceholder: false
    }
  | {
      kind: ChatMessageKind
      text: string
      isPlaceholder: true
    }

export type E2eeDirectEncryptInput = {
  text: string
  sentAt: string
  senderDevice: StoredLocalDevice
  recipients: E2eePeerDeviceBundle[]
}

export type E2eeGroupEncryptInput = {
  text: string
  sentAt: string
  senderDevice: StoredLocalDevice
  roomId: string
  epochId: string
  senderKey: Uint8Array
  distribution?: {
    epochId: string
    shares: {
      userId: string
      deviceId: string
      encryptedShare: E2eeSenderKeyShareCiphertext
    }[]
  } | null
}

export type E2eeDmDecryptInput = {
  envelope: ChatDirectMessageEnvelope
  currentUserId: string
  localDevice: StoredLocalDevice
  peerDeviceBundles: E2eePeerDeviceBundle[]
}

export type E2eeGroupDecryptInput = {
  envelope: ChatGroupMessageEnvelope
  kind: ChatMessageKind
  currentUserId: string
  localDevice: StoredLocalDevice
  members: RoomMember[]
  senderKeyState: E2eeSenderKeyEpochState | null
  senderId: string
}

export type E2eeResolvedSenderKey = {
  key: Uint8Array
  source:
    | "local-cache"
    | "distribution"
    | "active-device-share"
}

export type E2eeSenderKeyDistributionResult = {
  epochId: string
  algorithm: "signal-sender-key-v1"
  shares: {
    userId: string
    deviceId: string
    encryptedShare: E2eeSenderKeyShareCiphertext
  }[]
  senderKey: Uint8Array
}

export type E2eeConversationDeviceContext = {
  currentUserId: string
  localDevice: StoredLocalDevice
  peerDeviceBundles?: E2eePeerDeviceBundle[]
  members?: RoomMember[]
  senderKeyState?: E2eeSenderKeyEpochState | null
  senderId?: string
}

export type E2eeActiveSession = {
  userId: string
  activeDevice: E2eeActiveDevice
}
