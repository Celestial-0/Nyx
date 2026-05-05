"use client"

import type { E2eeDeviceRegistration } from "@/features/auth/auth.types"

import type {
  StoredLocalDevice,
  StoredSenderKey,
} from "./e2ee.types"

const DEVICE_STORAGE_KEY = "nyx-auth-devices"

type StoredDeviceMap = Record<string, StoredLocalDevice | E2eeDeviceRegistration>

function getStorage() {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage
}

function readRawDeviceMap(): StoredDeviceMap {
  const storage = getStorage()

  if (!storage) {
    return {}
  }

  try {
    const raw = storage.getItem(DEVICE_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    return JSON.parse(raw) as StoredDeviceMap
  } catch {
    return {}
  }
}

function writeRawDeviceMap(value: StoredDeviceMap) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(value))
}

export function isStoredLocalDevice(
  value: StoredLocalDevice | E2eeDeviceRegistration | null | undefined
): value is StoredLocalDevice {
  if (!value || typeof value !== "object") {
    return false
  }

  return (
    "registration" in value &&
    typeof value.registration === "object" &&
    "secrets" in value &&
    typeof value.secrets === "object"
  )
}

export function readStoredLocalDevice(walletAddress: string) {
  const entry = readRawDeviceMap()[walletAddress] ?? null
  return isStoredLocalDevice(entry) ? entry : null
}

export function readStoredDeviceRegistration(walletAddress: string) {
  const entry = readRawDeviceMap()[walletAddress] ?? null

  if (isStoredLocalDevice(entry)) {
    return entry.registration
  }

  return entry
}

export function writeStoredLocalDevice(
  walletAddress: string,
  value: StoredLocalDevice
) {
  writeRawDeviceMap({
    ...readRawDeviceMap(),
    [walletAddress]: value,
  })
}

export function clearStoredLocalDevice(walletAddress: string) {
  const map = readRawDeviceMap()
  delete map[walletAddress]
  writeRawDeviceMap(map)
}

export function writeStoredSenderKey(input: {
  walletAddress: string
  epochId: string
  senderKey: StoredSenderKey
}) {
  const existing = readStoredLocalDevice(input.walletAddress)

  if (!existing) {
    return
  }

  writeStoredLocalDevice(input.walletAddress, {
    ...existing,
    senderKeysByEpochId: {
      ...existing.senderKeysByEpochId,
      [input.epochId]: input.senderKey,
    },
  })
}

export function readStoredSenderKey(walletAddress: string, epochId: string) {
  return readStoredLocalDevice(walletAddress)?.senderKeysByEpochId[epochId] ?? null
}
