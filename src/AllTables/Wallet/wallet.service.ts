import { and, eq, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import db from "../../Drizzle/db";
import {
  usersTable,
  walletTransactionsTable,
  withdrawalRequestsTable,
  TIWithdrawalRequests,
} from "../../Drizzle/schema";

export class InsufficientBalanceError extends Error {}
export class WithdrawalRequestNotFoundError extends Error {}
export class WithdrawalAlreadyProcessedError extends Error {}

export const getWalletBalanceService = async (userId: number) => {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.userId, userId) });
  return user ? { userId, balance: user.amount } : null;
};

export const getWalletTransactionsService = async (userId: number) => {
  return await db.query.walletTransactionsTable.findMany({
    where: eq(walletTransactionsTable.userId, userId),
  });
};

// Submit a withdrawal request. Funds are held immediately (same conditional-
// decrement pattern as item stock reservation) so several pending requests
// can never together overdraw the balance.
export const createWithdrawalRequestService = async (params: {
  userId: number;
  amount: string;
  destinationPhone: string;
}) => {
  const { userId, amount, destinationPhone } = params;

  if (Number(amount) <= 0) throw new Error("Withdrawal amount must be greater than zero");

  const [heldUser] = await db
    .update(usersTable)
    .set({ amount: sql`(${usersTable.amount}::numeric - ${amount}::numeric)::text` })
    .where(and(eq(usersTable.userId, userId), gte(sql`${usersTable.amount}::numeric`, sql`${amount}::numeric`)))
    .returning();

  if (!heldUser) {
    throw new InsufficientBalanceError("Insufficient wallet balance for this withdrawal");
  }

  const [request] = await db
    .insert(withdrawalRequestsTable)
    .values({
      userId,
      amount,
      destinationPhone,
      status: "Pending",
    } as TIWithdrawalRequests)
    .returning();

  return request;
};

export const getWithdrawalRequestsService = async (status?: "Pending" | "Paid" | "Rejected") => {
  if (status) {
    return await db.query.withdrawalRequestsTable.findMany({
      where: eq(withdrawalRequestsTable.status, status),
    });
  }
  return await db.query.withdrawalRequestsTable.findMany();
};

export const getWithdrawalRequestsByUserService = async (userId: number) => {
  return await db.query.withdrawalRequestsTable.findMany({
    where: eq(withdrawalRequestsTable.userId, userId),
  });
};

// Admin confirms the payout already happened out-of-band (MPesa B2C from
// their dashboard, bank transfer, etc.) — this just records it. Balance was
// already deducted at request time, so no further change there.
export const markWithdrawalPaidService = async (requestId: number, adminUserId: number) => {
  const request = await db.query.withdrawalRequestsTable.findFirst({
    where: eq(withdrawalRequestsTable.requestId, requestId),
  });
  if (!request) throw new WithdrawalRequestNotFoundError();
  if (request.status !== "Pending") throw new WithdrawalAlreadyProcessedError();

  const [updated] = await db
    .update(withdrawalRequestsTable)
    .set({ status: "Paid", processedAt: new Date(), processedBy: adminUserId })
    .where(eq(withdrawalRequestsTable.requestId, requestId))
    .returning();

  await db.insert(walletTransactionsTable).values({
    userId: request.userId,
    type: "Withdrawal",
    amount: request.amount,
    relatedWithdrawalId: request.requestId,
  });

  return updated;
};

// Admin declines the request — release the held funds back to the balance.
export const rejectWithdrawalService = async (requestId: number, adminUserId: number) => {
  const request = await db.query.withdrawalRequestsTable.findFirst({
    where: eq(withdrawalRequestsTable.requestId, requestId),
  });
  if (!request) throw new WithdrawalRequestNotFoundError();
  if (request.status !== "Pending") throw new WithdrawalAlreadyProcessedError();

  const [updated] = await db
    .update(withdrawalRequestsTable)
    .set({ status: "Rejected", processedAt: new Date(), processedBy: adminUserId })
    .where(eq(withdrawalRequestsTable.requestId, requestId))
    .returning();

  const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.userId, request.userId) });
  if (owner) {
    await db
      .update(usersTable)
      .set({ amount: (Number(owner.amount) + Number(request.amount)).toFixed(2) })
      .where(eq(usersTable.userId, request.userId));
  }

  return updated;
};
