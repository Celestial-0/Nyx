/**
 * Runtime polyfills required before any crypto / Solana code runs.
 *
 * Import this FIRST in `app/_layout.tsx` (before other app imports).
 *
 *  - `react-native-get-random-values` shims `crypto.getRandomValues`, which
 *    `tweetnacl` and `@solana/web3.js` rely on for key/nonce generation.
 *  - `Buffer` is a global on Node/web but not in Hermes; `@solana/web3.js`
 *    expects it, so expose it from the `buffer` package.
 *  - `TextEncoder`/`TextDecoder` are used by the E2EE payload codec. Hermes on
 *    Expo SDK 57 / RN 0.81 provides them; we assert rather than shim.
 */
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };

if (!globalScope.Buffer) {
  globalScope.Buffer = Buffer;
}

if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
  // Surface a clear error instead of a cryptic failure deep inside the E2EE codec.
  console.warn(
    'TextEncoder/TextDecoder are unavailable in this runtime; E2EE payload encoding will fail.'
  );
}
