import {
  transact,
  type Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import type { Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

/**
 * Solana Mobile Wallet Adapter (MWA) signer.
 *
 * Replaces the earlier embedded-keypair mock. Every privileged operation runs
 * inside a short-lived `transact()` session with an installed wallet app
 * (Phantom / Solflare / the MWA fakewallet). The auth token is cached so we can
 * `reauthorize` silently instead of prompting on every call.
 *
 * NOTE: MWA is Android-only and requires a custom dev build (not Expo Go).
 */

const APP_IDENTITY = {
  name: 'Nyx',
  uri: 'https://nyx.chat',
  icon: 'favicon.ico',
};

const CHAIN = 'solana:mainnet';

let cachedAuthToken: string | null = null;
let cachedAddressBase64: string | null = null;

/** MWA returns base64-encoded raw public keys; the backend expects base58. */
function base64AddressToBase58(base64Address: string): string {
  return bs58.encode(new Uint8Array(Buffer.from(base64Address, 'base64')));
}

async function authorize(wallet: Web3MobileWallet) {
  const result = cachedAuthToken
    ? await wallet.reauthorize({ auth_token: cachedAuthToken, identity: APP_IDENTITY })
    : await wallet.authorize({ chain: CHAIN, identity: APP_IDENTITY });

  const account = result.accounts[0];
  if (!account) {
    throw new Error('Wallet did not return an authorized account');
  }

  cachedAuthToken = result.auth_token;
  cachedAddressBase64 = account.address;

  return {
    authToken: result.auth_token,
    addressBase64: account.address,
    address: base64AddressToBase58(account.address),
    label: account.label ?? null,
  };
}

export interface WalletSession {
  /** Base58 Solana address (the backend's `walletAddress`). */
  address: string;
  authToken: string;
  label: string | null;
}

/** Authorize (or silently reauthorize) an MWA session and return the account. */
export async function authorizeSession(): Promise<WalletSession> {
  return transact(async (wallet) => {
    const { address, authToken, label } = await authorize(wallet);
    return { address, authToken, label };
  });
}

/** Drop the cached authorization (used on sign-out). */
export function resetWalletSession(): void {
  cachedAuthToken = null;
  cachedAddressBase64 = null;
}

/**
 * Sign an arbitrary message (used for the auth nonce AND the device
 * registration proof). MWA `signMessages` returns the signed payload with the
 * 64-byte ed25519 signature appended; we slice off that detached signature,
 * which is what the backend verifies.
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  return transact(async (wallet) => {
    const { addressBase64 } = await authorize(wallet);
    const signedPayloads = await wallet.signMessages({
      addresses: [addressBase64],
      payloads: [message],
    });

    const signedPayload = signedPayloads[0];
    if (!signedPayload) {
      throw new Error('Wallet did not return a signature');
    }

    // signed payload = original message || 64-byte signature
    return signedPayload.slice(signedPayload.length - 64);
  });
}

/** Sign and submit a transaction; returns the base58 transaction signature. */
export async function signAndSendTransaction(transaction: Transaction): Promise<string> {
  return transact(async (wallet) => {
    await authorize(wallet);
    const signatures = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });

    const signature = signatures[0];
    if (!signature) {
      throw new Error('Wallet did not return a transaction signature');
    }

    return signature;
  });
}

/** The most recently authorized base58 address, if any. */
export function getCachedWalletAddress(): string | null {
  return cachedAddressBase64 ? base64AddressToBase58(cachedAddressBase64) : null;
}

/**
 * A wallet-implementation-agnostic signer handle, so callers (auth flow, E2EE
 * device registration) don't depend on MWA directly.
 */
export interface LocalWallet {
  address: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export async function getWallet(): Promise<LocalWallet> {
  const session = await authorizeSession();
  return {
    address: session.address,
    signMessage,
  };
}
