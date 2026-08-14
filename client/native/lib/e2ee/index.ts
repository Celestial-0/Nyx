/**
 * Real end-to-end encryption for the native client (tweetnacl + bs58).
 * Ported from the web client's `features/e2ee`.
 */
export * from './e2ee.service';
export {
  hydrateDeviceStore,
  isDeviceStoreHydrated,
  readStoredLocalDevice,
} from './e2ee.storage';
export type {
  DecryptedMessageContent,
  StoredLocalDevice,
} from './e2ee.types';
