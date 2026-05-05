import { afterEach, describe, expect, mock, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { creditLogs, payments, userCredits, users } from "@/platform/db/schema";
import { paymentsService } from "@/features/payments/service";
import { withTestTransaction } from "@/test-utils/integration";
import bs58 from "bs58";

const encodeBase58 = (value: Uint8Array): string => bs58.encode(value);


const originalFetch = globalThis.fetch;
const createBase58Value = (size = 32) => encodeBase58(randomBytes(size));

const createRpcResponse = ({
  walletAddress,
  treasuryWallet,
  lamports,
  err = null,
}: {
  walletAddress: string;
  treasuryWallet: string;
  lamports: number;
  err?: unknown;
}) => ({
  jsonrpc: "2.0",
  id: "tx",
  result: {
    meta: {
      err,
    },
    transaction: {
      message: {
        accountKeys: [
          {
            pubkey: walletAddress,
            signer: true,
          },
        ],
        instructions: [
          {
            program: "system",
            parsed: {
              type: "transfer",
              info: {
                source: walletAddress,
                destination: treasuryWallet,
                lamports,
              },
            },
          },
        ],
      },
    },
  },
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("paymentsService", () => {
  test("getCreditsBalance backfills an existing user without a credits row", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      const result = await paymentsService.getCreditsBalance({
        db: tx as never,
        userId,
      });
      const creditEntries = await tx
        .select({
          id: creditLogs.id,
          change: creditLogs.change,
          reason: creditLogs.reason,
          createdAt: creditLogs.createdAt,
        })
        .from(creditLogs)
        .where(eq(creditLogs.userId, userId))
        .orderBy(asc(creditLogs.createdAt));

      expect(result).toEqual({
        balance: 150,
        pricing: {
          creditsPerSol: env.PAYMENT_CREDITS_PER_SOL,
          defaultInitialCredits: 150,
          messageSendCredits: 2,
          groupRoomCreateCredits: 50,
        },
        treasury: {
          walletAddress: env.PAYMENT_TREASURY_WALLET,
        },
        network: {
          chain: "solana",
          rpcUrl: env.SOLANA_RPC_URL,
          commitment: env.SOLANA_COMMITMENT,
        },
        recentRecharges: [],
        recentActivity: [
          {
            id: creditEntries[0]!.id,
            change: 150,
            reason: "initial_grant",
            createdAt: creditEntries[0]!.createdAt?.toISOString() ?? null,
          },
        ],
      });
      expect(
        creditEntries.map((entry) => ({
          change: entry.change,
          reason: entry.reason,
        }))
      ).toEqual([{ change: 150, reason: "initial_grant" }]);
    });
  });

  test("verifyRecharge records a confirmed payment and credits the user", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();
      const transactionHash = createBase58Value(64);

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify(
            createRpcResponse({
              walletAddress,
              treasuryWallet: "11111111111111111111111111111111",
              lamports: 1_500_000_000,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      const result = await paymentsService.verifyRecharge({
        db: tx as never,
        userId,
        walletAddress,
        input: { transactionHash },
      });

      const balances = await tx
        .select({
          balance: userCredits.balance,
        })
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);
      const paymentRows = await tx
        .select({
          transactionHash: payments.transactionHash,
          amountSol: payments.amountSol,
          creditsGranted: payments.creditsGranted,
          status: payments.status,
        })
        .from(payments)
        .where(eq(payments.transactionHash, transactionHash))
        .limit(1);

      expect(result).toEqual({
        transactionHash,
        amountSol: "1.5",
        creditsGranted: 1500,
        balance: 1650,
        status: "confirmed",
      });
      expect(balances[0]?.balance).toBe(1650);
      expect(paymentRows[0]).toEqual({
        transactionHash,
        amountSol: "1.5",
        creditsGranted: 1500,
        status: "confirmed",
      });
    });
  });

  test("verifyRecharge rejects reused transaction hashes", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();
      const transactionHash = createBase58Value(64);

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify(
            createRpcResponse({
              walletAddress,
              treasuryWallet: "11111111111111111111111111111111",
              lamports: 1_000_000_000,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      await paymentsService.verifyRecharge({
        db: tx as never,
        userId,
        walletAddress,
        input: { transactionHash },
      });

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash },
        });
        throw new Error("Expected duplicate recharge verification to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "CONFLICT",
        });
      }
    });
  });

  test("verifyRecharge rejects wrong signer wallets", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify(
            createRpcResponse({
              walletAddress: createBase58Value(),
              treasuryWallet: "11111111111111111111111111111111",
              lamports: 1_000_000_000,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: createBase58Value(64) },
        });
        throw new Error("Expected signer mismatch to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Transaction signer does not match the authenticated wallet.",
        });
      }
    });
  });

  test("verifyRecharge rejects wrong treasury recipients", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify(
            createRpcResponse({
              walletAddress,
              treasuryWallet: createBase58Value(),
              lamports: 1_000_000_000,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: createBase58Value(64) },
        });
        throw new Error("Expected treasury mismatch to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Transaction does not include a valid transfer to the treasury wallet.",
        });
      }
    });
  });

  test("verifyRecharge rejects unconfirmed or missing transactions", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "tx",
            result: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: createBase58Value(64) },
        });
        throw new Error("Expected missing transaction to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Transaction not found or not confirmed.",
        });
      }
    });
  });

  test("verifyRecharge rejects zero-credit grants", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify(
            createRpcResponse({
              walletAddress,
              treasuryWallet: "11111111111111111111111111111111",
              lamports: 1,
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: createBase58Value(64) },
        });
        throw new Error("Expected tiny recharge to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Transaction amount is too small to grant any credits.",
        });
      }
    });
  });

  test("verifyRecharge rejects malformed transaction hashes before RPC calls", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      const fetchMock = mock(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
      globalThis.fetch = fetchMock;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: "not-valid-*" },
        });
        throw new Error("Expected malformed transaction hash to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Invalid transaction hash.",
        });
      }

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  test("verifyRecharge rejects malformed Solana RPC response shapes safely", async () => {
    await withTestTransaction(async (tx) => {
      const userId = randomUUID();
      const walletAddress = createBase58Value();

      await tx.insert(users).values({
        id: userId,
        walletAddress,
      });

      globalThis.fetch = mock(async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "tx",
            result: {
              transaction: {},
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      ) as unknown as typeof fetch;

      try {
        await paymentsService.verifyRecharge({
          db: tx as never,
          userId,
          walletAddress,
          input: { transactionHash: createBase58Value(64) },
        });
        throw new Error("Expected malformed RPC response to fail.");
      } catch (error) {
        expect(error).toMatchObject({
          code: "BAD_REQUEST",
          message: "Unexpected Solana RPC response shape.",
        });
      }
    });
  });
});
