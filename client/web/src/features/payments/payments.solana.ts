import { address, lamports } from "@solana/kit"
import { getTransferSolInstruction } from "@solana-program/system"
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"

const lamportsPerSol = 1_000_000_000n

export function parseSolAmountToLamports(amountSol: string) {
  const trimmed = amountSol.trim()

  if (!trimmed) {
    throw new Error("Enter a SOL amount to continue.")
  }

  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) {
    throw new Error("Use up to 9 decimal places for SOL amounts.")
  }

  const [wholePart, fractionalPart = ""] = trimmed.split(".")
  const wholeLamports = BigInt(wholePart || "0") * lamportsPerSol
  const fractionalLamports = BigInt(
    (fractionalPart + "000000000").slice(0, 9) || "0"
  )
  const totalLamports = wholeLamports + fractionalLamports

  if (totalLamports <= 0n) {
    throw new Error("Enter an amount greater than 0 SOL.")
  }

  return totalLamports
}

function toWeb3TransferInstruction(input: {
  walletAddress: string
  treasuryWalletAddress: string
  amountLamports: bigint
}) {
  const transferInstruction = getTransferSolInstruction({
    source: address(input.walletAddress) as never,
    destination: address(input.treasuryWalletAddress),
    amount: lamports(input.amountLamports),
  } as never)

  return new TransactionInstruction({
    programId: new PublicKey(String(transferInstruction.programAddress)),
    keys: [
      {
        pubkey: new PublicKey(input.walletAddress),
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(input.treasuryWalletAddress),
        isSigner: false,
        isWritable: true,
      },
    ],
    data: Buffer.from(transferInstruction.data),
  })
}

export async function sendSolRechargeTransaction(input: {
  connection: Connection
  walletAddress: string
  treasuryWalletAddress: string
  amountLamports: bigint
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: {
      preflightCommitment?: "processed" | "confirmed" | "finalized"
      maxRetries?: number
    }
  ) => Promise<string>
}) {
  const transferInstruction = toWeb3TransferInstruction({
    walletAddress: input.walletAddress,
    treasuryWalletAddress: input.treasuryWalletAddress,
    amountLamports: input.amountLamports,
  })

  const latestBlockhash = await input.connection.getLatestBlockhash("confirmed")
  const transaction = new Transaction({
    feePayer: new PublicKey(input.walletAddress),
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(transferInstruction)

  return input.sendTransaction(transaction, input.connection, {
    preflightCommitment: "confirmed",
    maxRetries: 3,
  })
}
