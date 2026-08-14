import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredLocalDevice, StoredSenderKey } from './e2ee.types';

/**
 * Local device / sender-key storage.
 *
 * The web client used synchronous `localStorage`; React Native storage is
 * async. To keep the E2EE service synchronous (it is called inline during
 * encrypt/decrypt), we hold an in-memory cache of the device map and persist
 * writes to AsyncStorage fire-and-forget.
 *
 * `hydrateDeviceStore()` MUST be awaited once after login/app-start before any
 * decryption or message composition happens (guarded by the composer state).
 *
 * Uses AsyncStorage (not SecureStore): the bundle (12 prekeys + secret keys +
 * cached sender keys) exceeds SecureStore's ~2 KB per-value limit, and this
 * matches the web client's unencrypted localStorage behavior.
 */

const DEVICE_STORAGE_KEY = 'nyx-auth-devices';

type StoredDeviceMap = Record<string, StoredLocalDevice>;

let deviceMapCache: StoredDeviceMap = {};
let hydrated = false;

function persist() {
  // Fire-and-forget; the in-memory cache is the source of truth for reads.
  void AsyncStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(deviceMapCache)).catch(
    (error) => {
      console.warn('Failed to persist device store:', error);
    }
  );
}

function isStoredLocalDevice(value: unknown): value is StoredLocalDevice {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'registration' in value &&
    typeof (value as StoredLocalDevice).registration === 'object' &&
    'secrets' in value &&
    typeof (value as StoredLocalDevice).secrets === 'object'
  );
}

/** Load the persisted device map into the in-memory cache. Await once at start. */
export async function hydrateDeviceStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDeviceMap;
      const next: StoredDeviceMap = {};
      for (const [wallet, entry] of Object.entries(parsed)) {
        if (isStoredLocalDevice(entry)) {
          next[wallet] = entry;
        }
      }
      deviceMapCache = next;
    }
  } catch (error) {
    console.warn('Failed to hydrate device store:', error);
  } finally {
    hydrated = true;
  }
}

export function isDeviceStoreHydrated(): boolean {
  return hydrated;
}

export function readStoredLocalDevice(walletAddress: string): StoredLocalDevice | null {
  return deviceMapCache[walletAddress] ?? null;
}

export function writeStoredLocalDevice(
  walletAddress: string,
  value: StoredLocalDevice
): void {
  deviceMapCache = { ...deviceMapCache, [walletAddress]: value };
  persist();
}

export function clearStoredLocalDevice(walletAddress: string): void {
  const { [walletAddress]: _removed, ...rest } = deviceMapCache;
  deviceMapCache = rest;
  persist();
}

export function writeStoredSenderKey(input: {
  walletAddress: string;
  epochId: string;
  senderKey: StoredSenderKey;
}): void {
  const existing = readStoredLocalDevice(input.walletAddress);

  if (!existing) {
    return;
  }

  writeStoredLocalDevice(input.walletAddress, {
    ...existing,
    senderKeysByEpochId: {
      ...existing.senderKeysByEpochId,
      [input.epochId]: input.senderKey,
    },
  });
}

export function readStoredSenderKey(
  walletAddress: string,
  epochId: string
): StoredSenderKey | null {
  return readStoredLocalDevice(walletAddress)?.senderKeysByEpochId[epochId] ?? null;
}
