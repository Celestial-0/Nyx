import * as Crypto from 'expo-crypto';

/**
 * Central UUID generator. Hermes does not implement `crypto.randomUUID`, so we
 * use expo-crypto's implementation everywhere the web client used
 * `crypto.randomUUID()`.
 */
export function randomUUID(): string {
  return Crypto.randomUUID();
}
