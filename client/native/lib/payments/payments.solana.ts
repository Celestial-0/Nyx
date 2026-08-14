import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import { signAndSendTransaction } from '@/lib/wallet';

/**
 * On-chain SOL recharge. Ported from the web client's `payments.solana.ts`,
 * but built with `@solana/web3.js` `SystemProgram.transfer` (instead of the
 * web's `@solana/kit` + `@solana-program/system`) and signed/submitted through
 * the Mobile Wallet Adapter.
 */

const lamportsPerSol = 1_000_000_000n;

export function parseSolAmountToLamports(amountSol: string): bigint {
  const trimmed = amountSol.trim();

  if (!trimmed) {
    throw new Error('Enter a SOL amount to continue.');
  }

  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) {
    throw new Error('Use up to 9 decimal places for SOL amounts.');
  }

  const [wholePart, fractionalPart = ''] = trimmed.split('.');
  const wholeLamports = BigInt(wholePart || '0') * lamportsPerSol;
  const fractionalLamports = BigInt((fractionalPart + '000000000').slice(0, 9) || '0');
  const totalLamports = wholeLamports + fractionalLamports;

  if (totalLamports <= 0n) {
    throw new Error('Enter an amount greater than 0 SOL.');
  }

  return totalLamports;
}

/**
 * Build a SOL transfer to the treasury, then sign + submit it via MWA.
 * Returns the transaction signature (hash) to hand to the backend verifier.
 */
export async function sendSolRechargeTransaction(input: {
  rpcUrl: string;
  walletAddress: string;
  treasuryWalletAddress: string;
  amountLamports: bigint;
}): Promise<string> {
  const connection = new Connection(input.rpcUrl, 'confirmed');
  const feePayer = new PublicKey(input.walletAddress);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: feePayer,
    toPubkey: new PublicKey(input.treasuryWalletAddress),
    lamports: input.amountLamports,
  });

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(transferInstruction);

  return signAndSendTransaction(transaction);
}
