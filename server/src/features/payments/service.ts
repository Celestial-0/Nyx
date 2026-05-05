import { z } from "zod";
import bs58 from "bs58";
import { desc, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { creditLogs, payments } from "@/platform/db/schema";
import { paymentEventTopics } from "@/features/payments/events/topics";
import {
  DEFAULT_INITIAL_CREDITS,
  GROUP_ROOM_CREATE_CREDITS,
  MESSAGE_SEND_CREDITS,
  creditUserBalance,
  getUserCreditBalance,
} from "@/features/payments/ledger";
import type { PaymentsDb, PaymentsEventBus, PaymentRechargeVerifyInput, SolanaTransferVerification } from "@/features/payments/types";
import { AppError, BadRequest, Conflict } from "@/shared/error";
import { logger } from "@/shared/logger";


const decodeBase58 = (value: string): Uint8Array => bs58.decode(value);

const log = logger.child({ module: "payments.service" });

const lamportsPerSol = 1_000_000_000n;
const base58TransactionHashPattern = /^[1-9A-HJ-NP-Za-km-z]{32,128}$/;

const rpcTransactionResponseSchema = z.object({
  result: z
    .object({
      meta: z
        .object({
          err: z.unknown().nullable().optional(),
        })
        .nullable()
        .optional(),
      transaction: z.object({
        message: z.object({
          accountKeys: z.array(
            z.object({
              pubkey: z.string(),
              signer: z.boolean().optional(),
            })
          ),
          instructions: z.array(
            z.object({
              program: z.string().optional(),
              parsed: z
                .object({
                  type: z.string().optional(),
                  info: z
                    .object({
                      source: z.string().optional(),
                      destination: z.string().optional(),
                      lamports: z.union([z.number().int().nonnegative(), z.string()]).optional(),
                    })
                    .optional(),
                })
                .optional(),
            })
          ),
        }),
      }),
    })
    .nullable()
    .optional(),
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});

const formatLamportsToSol = (lamports: bigint) => {
  const whole = lamports / lamportsPerSol;
  const fractional = lamports % lamportsPerSol;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole}.${fractional.toString().padStart(9, "0").replace(/0+$/, "")}`;
};

const calculateCreditsGranted = (amountSol: string) =>
  Math.floor(Number(amountSol) * env.PAYMENT_CREDITS_PER_SOL);

const extractLamports = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }

  return 0n;
};

const assertBase58TransactionHash = (transactionHash: string) => {
  if (!base58TransactionHashPattern.test(transactionHash)) {
    throw BadRequest("Invalid transaction hash.");
  }

  try {
    decodeBase58(transactionHash);
  } catch {
    throw BadRequest("Invalid transaction hash.");
  }
};

const verifyNativeSolTransfer = async ({
  transactionHash,
  walletAddress,
}: {
  transactionHash: string;
  walletAddress: string;
}): Promise<SolanaTransferVerification> => {
  const response = await fetch(env.SOLANA_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: transactionHash,
      method: "getTransaction",
      params: [
        transactionHash,
        {
          encoding: "jsonParsed",
          commitment: env.SOLANA_COMMITMENT,
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError({
      message: "Failed to reach Solana RPC.",
    });
  }

  const payloadResult = rpcTransactionResponseSchema.safeParse(await response.json());

  if (!payloadResult.success) {
    throw BadRequest("Unexpected Solana RPC response shape.");
  }

  const payload = payloadResult.data;

  if (payload.error) {
    throw BadRequest(payload.error.message ?? "Failed to verify transaction.");
  }

  const result = payload.result;

  if (!result || result.meta?.err) {
    throw BadRequest("Transaction not found or not confirmed.");
  }

  const accountKeys = result.transaction?.message?.accountKeys ?? [];
  const signerMatch = accountKeys.some(
    (account) => account.pubkey === walletAddress && account.signer === true
  );

  if (!signerMatch) {
    throw BadRequest("Transaction signer does not match the authenticated wallet.");
  }

  const instructions = result.transaction?.message?.instructions ?? [];
  const matchingLamports = instructions.reduce((total, instruction) => {
    const info = instruction.parsed?.info;
    const isMatchingTransfer =
      instruction.program === "system" &&
      instruction.parsed?.type === "transfer" &&
      info?.source === walletAddress &&
      info?.destination === env.PAYMENT_TREASURY_WALLET;

    if (!isMatchingTransfer) {
      return total;
    }

    return total + extractLamports(info?.lamports);
  }, 0n);

  if (matchingLamports <= 0n) {
    throw BadRequest("Transaction does not include a valid transfer to the treasury wallet.");
  }

  return {
    transactionHash,
    lamports: matchingLamports,
    amountSol: formatLamportsToSol(matchingLamports),
  };
};

const emitVerifiedEventSafely = async ({
  eventBus,
  userId,
  transactionHash,
  amountSol,
  creditsGranted,
  balance,
}: {
  eventBus?: PaymentsEventBus;
  userId: string;
  transactionHash: string;
  amountSol: string;
  creditsGranted: number;
  balance: number;
}) => {
  if (!eventBus) {
    return;
  }

  try {
    await eventBus.emit(paymentEventTopics.transactionVerified, {
      userId,
      transactionHash,
      amountSol,
      creditsGranted,
      balance,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.warn({ error, transactionHash, userId }, "Failed to emit payment verification event");
  }
};

export const paymentsService = {
  getCreditsBalance: async ({
    db,
    userId,
  }: {
    db: PaymentsDb;
    userId: string;
  }) => {
    const balance = await getUserCreditBalance({
      db,
      userId,
    });

    const [recentRecharges, recentActivity] = await Promise.all([
      db
        .select({
          id: payments.id,
          transactionHash: payments.transactionHash,
          amountSol: payments.amountSol,
          creditsGranted: payments.creditsGranted,
          status: payments.status,
          network: payments.network,
          verifiedAt: payments.verifiedAt,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.verifiedAt), desc(payments.createdAt))
        .limit(5),
      db
        .select({
          id: creditLogs.id,
          change: creditLogs.change,
          reason: creditLogs.reason,
          createdAt: creditLogs.createdAt,
        })
        .from(creditLogs)
        .where(eq(creditLogs.userId, userId))
        .orderBy(desc(creditLogs.createdAt))
        .limit(8),
    ]);

    return {
      balance,
      pricing: {
        creditsPerSol: env.PAYMENT_CREDITS_PER_SOL,
        defaultInitialCredits: DEFAULT_INITIAL_CREDITS,
        messageSendCredits: MESSAGE_SEND_CREDITS,
        groupRoomCreateCredits: GROUP_ROOM_CREATE_CREDITS,
      },
      treasury: {
        walletAddress: env.PAYMENT_TREASURY_WALLET,
      },
      network: {
        chain: "solana" as const,
        rpcUrl: env.SOLANA_RPC_URL,
        commitment: env.SOLANA_COMMITMENT,
      },
      recentRecharges: recentRecharges.map((recharge) => ({
        id: recharge.id,
        transactionHash: recharge.transactionHash ?? "",
        amountSol: recharge.amountSol,
        creditsGranted: recharge.creditsGranted,
        status: "confirmed" as const,
        network: recharge.network,
        verifiedAt: recharge.verifiedAt?.toISOString() ?? null,
        createdAt: recharge.createdAt?.toISOString() ?? null,
      })),
      recentActivity: recentActivity.map((activity) => ({
        ...activity,
        createdAt: activity.createdAt?.toISOString() ?? null,
      })),
    };
  },

  verifyRecharge: async ({
    db,
    userId,
    walletAddress,
    input,
    eventBus,
  }: {
    db: PaymentsDb;
    userId: string;
    walletAddress: string;
    input: PaymentRechargeVerifyInput;
    eventBus?: PaymentsEventBus;
  }) => {
    const transactionHash = input.transactionHash.trim();

    if (!transactionHash) {
      throw BadRequest("transactionHash is required.");
    }

    assertBase58TransactionHash(transactionHash);

    const transfer = await verifyNativeSolTransfer({
      transactionHash,
      walletAddress,
    });
    const creditsGranted = calculateCreditsGranted(transfer.amountSol);

    if (creditsGranted <= 0) {
      throw BadRequest("Transaction amount is too small to grant any credits.");
    }

    let result: {
      amountSol: string;
      creditsGranted: number;
      balance: number;
    };

    try {
      result = await db.transaction(async (tx) => {
        const insertedPayments = await tx
          .insert(payments)
          .values({
            userId,
            amountSol: transfer.amountSol,
            creditsGranted,
            transactionHash,
            network: "solana",
            status: "confirmed",
            verifiedAt: new Date(),
          })
          .returning({
            amountSol: payments.amountSol,
            creditsGranted: payments.creditsGranted,
          });

        const payment = insertedPayments[0];

        if (!payment) {
          throw new AppError({
            message: "Failed to record verified payment.",
          });
        }

        const balance = await creditUserBalance({
          db: tx as never,
          userId,
          credits: creditsGranted,
          reason: `recharge:${transactionHash}`,
        });

        return {
          amountSol: payment.amountSol,
          creditsGranted: payment.creditsGranted,
          balance,
        };
      });
    } catch (error) {
      const dbError = error as {
        code?: string;
        message?: string;
        cause?: { code?: string; message?: string };
      };
      const duplicateCode = dbError.code ?? dbError.cause?.code;
      const duplicateMessage = dbError.message ?? dbError.cause?.message ?? "";

      if (
        duplicateCode === "23505" ||
        /payments_tx_hash|duplicate key/i.test(duplicateMessage)
      ) {
        throw Conflict("Transaction has already been used for a recharge.");
      }

      throw error;
    }

    await emitVerifiedEventSafely({
      eventBus,
      userId,
      transactionHash,
      amountSol: result.amountSol,
      creditsGranted: result.creditsGranted,
      balance: result.balance,
    });

    return {
      transactionHash,
      amountSol: result.amountSol,
      creditsGranted: result.creditsGranted,
      balance: result.balance,
      status: "confirmed" as const,
    };
  },
};
