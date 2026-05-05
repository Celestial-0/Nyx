import { and, eq, gte, sql } from "drizzle-orm";
import { creditLogs, userCredits } from "@/platform/db/schema";
import type { PaymentsDb, CreditLedgerReason } from "@/features/payments/types";
import { InsufficientCredits } from "@/shared/error";

export const DEFAULT_INITIAL_CREDITS = 150;
export const GROUP_ROOM_CREATE_CREDITS = 50;
export const MESSAGE_SEND_CREDITS = 2;

const selectBalance = async (db: PaymentsDb, userId: string) => {
  const rows = await db
    .select({
      balance: userCredits.balance,
    })
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .limit(1);

  return rows[0]?.balance ?? null;
};

const insertCreditLog = async ({
  db,
  userId,
  change,
  reason,
}: {
  db: PaymentsDb;
  userId: string;
  change: number;
  reason: CreditLedgerReason | `recharge:${string}`;
}) => {
  await db.insert(creditLogs).values({
    userId,
    change,
    reason,
  });
};

export const ensureUserCreditAccount = async ({
  db,
  userId,
}: {
  db: PaymentsDb;
  userId: string;
}) => {
  const existingBalance = await selectBalance(db, userId);

  if (existingBalance !== null) {
    return existingBalance;
  }

  const insertedRows = await db
    .insert(userCredits)
    .values({
      userId,
      balance: DEFAULT_INITIAL_CREDITS,
    })
    .onConflictDoNothing()
    .returning({
      balance: userCredits.balance,
    });

  if (insertedRows[0]) {
    await insertCreditLog({
      db,
      userId,
      change: DEFAULT_INITIAL_CREDITS,
      reason: "initial_grant",
    });

    return insertedRows[0].balance;
  }

  return (await selectBalance(db, userId)) ?? DEFAULT_INITIAL_CREDITS;
};

export const getUserCreditBalance = async ({
  db,
  userId,
}: {
  db: PaymentsDb;
  userId: string;
}) => ensureUserCreditAccount({ db, userId });

export const creditUserBalance = async ({
  db,
  userId,
  credits,
  reason,
}: {
  db: PaymentsDb;
  userId: string;
  credits: number;
  reason: CreditLedgerReason | `recharge:${string}`;
}) => {
  await ensureUserCreditAccount({ db, userId });

  const updatedRows = await db
    .update(userCredits)
    .set({
      balance: sql`${userCredits.balance} + ${credits}`,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId))
    .returning({
      balance: userCredits.balance,
    });

  const updatedBalance = updatedRows[0]?.balance ?? null;

  if (updatedBalance === null) {
    throw new Error("Failed to credit user balance.");
  }

  await insertCreditLog({
    db,
    userId,
    change: credits,
    reason,
  });

  return updatedBalance;
};

export const debitUserBalance = async ({
  db,
  userId,
  credits,
  reason,
}: {
  db: PaymentsDb;
  userId: string;
  credits: number;
  reason: CreditLedgerReason;
}) => {
  const currentBalance = await ensureUserCreditAccount({ db, userId });

  const updatedRows = await db
    .update(userCredits)
    .set({
      balance: sql`${userCredits.balance} - ${credits}`,
      updatedAt: new Date(),
    })
    .where(and(eq(userCredits.userId, userId), gte(userCredits.balance, credits)))
    .returning({
      balance: userCredits.balance,
    });

  const updatedBalance = updatedRows[0]?.balance ?? null;

  if (updatedBalance === null) {
    throw InsufficientCredits({
      requiredCredits: credits,
      currentBalance,
    });
  }

  await insertCreditLog({
    db,
    userId,
    change: -credits,
    reason,
  });

  return updatedBalance;
};
