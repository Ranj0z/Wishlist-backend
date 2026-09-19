import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import db from "../../Drizzle/db";
import {
  itemsTable,
  paymentItemsTable,
  paymentsTable,
  usersTable,
  walletTransactionsTable,
  TIPayments,
} from "../../Drizzle/schema";
import { initiateGatewayStkPush } from "../../lib/paybillGateway";
import { normalizePhoneNumber } from "../../utils/normalizePhoneNumber";
import { reserveItemStockService, releaseItemStockService } from "../Items/item.service";

// ==========================
// Payment Errors
// ==========================
export class PaymentNotFoundError extends Error {}
export class PaymentAlreadyInitiatedError extends Error {}
export class RetryTokenMismatchError extends Error {}
export class InsufficientStockError extends Error {
  constructor(public itemId: number) {
    super(`Not enough stock left for item ${itemId}`);
  }
}
export class EmptyCheckoutError extends Error {}
export class InsufficientWalletBalanceError extends Error {}
export class WalletRequiresLoginError extends Error {}

// Random opaque secret returned to the payer at creation; required to retry later
export const generateRetryToken = () => crypto.randomBytes(24).toString("hex");

// How long a Pending ItemPurchase payment can sit unconfirmed before its
// stock hold is considered abandoned and released. See expireStalePendingPaymentsService.
const PENDING_HOLD_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ==========================
// Checkout (multi-item, one wishlist, guest or logged-in)
// ==========================
//
// NOTE ON ATOMICITY: the current DB client (Drizzle over `drizzle-orm/neon-http`,
// see src/Drizzle/db.ts) talks to Postgres over plain HTTP and does not support
// true interactive transactions (read a row, branch in JS, write again, with a
// real rollback). Each stock reservation below is still safe on its own — it's
// a single conditional `UPDATE ... WHERE quantity >= :n RETURNING *`, which
// Postgres executes atomically — so two simultaneous buyers can never both
// win the last unit. What this driver can't give us is an all-or-nothing
// multi-item checkout: if item A's stock reserves fine but item B doesn't,
// we compensate by releasing A's hold in application code (below) rather than
// relying on a DB rollback. If you move to `drizzle-orm/node-postgres` or
// `drizzle-orm/neon-serverless` (pooled) later, this whole reservation loop
// can be wrapped in a single `db.transaction()` instead.
export const checkoutService = async (params: {
  wishlistId: number;
  items: { itemId: number; quantity: number }[];
  paymentMethod: "Stripe" | "MPesa" | "eWallet";
  userId?: number; // payer, if logged in
  guestName?: string;
  phone?: string; // required for MPesa; optional guest contact otherwise
}) => {
  const { wishlistId, items, paymentMethod, userId, guestName, phone } = params;

  if (!items || items.length === 0) {
    throw new EmptyCheckoutError("No items in checkout");
  }
  if (paymentMethod === "eWallet" && !userId) {
    throw new WalletRequiresLoginError("Wallet payments require a logged-in user");
  }

  let normalizedPhone: string | undefined;
  if (paymentMethod === "MPesa") {
    if (!phone) throw new Error("phone is required for MPesa payments");
    normalizedPhone = normalizePhoneNumber(phone);
  } else if (phone) {
    // Optional guest contact for Stripe/eWallet — normalize if it looks like one.
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch {
      normalizedPhone = undefined;
    }
  }

  // Reserve stock for every line up front, compensating if any line fails.
  const reserved: { itemId: number; quantity: number; unitPriceSnapshot: string }[] = [];
  for (const line of items) {
    const item = await db.query.itemsTable.findFirst({ where: eq(itemsTable.itemId, line.itemId) });
    if (!item || item.wishlistId !== wishlistId) {
      await rollbackReservations(reserved);
      throw new Error(`Item ${line.itemId} does not belong to wishlist ${wishlistId}`);
    }

    const updated = await reserveItemStockService(line.itemId, line.quantity);
    if (!updated) {
      await rollbackReservations(reserved);
      throw new InsufficientStockError(line.itemId);
    }

    reserved.push({ itemId: line.itemId, quantity: line.quantity, unitPriceSnapshot: item.price });
  }

  const totalAmount = reserved
    .reduce((sum, r) => sum + Number(r.unitPriceSnapshot) * r.quantity, 0)
    .toFixed(2);

  // eWallet: settle instantly, no gateway round-trip.
  if (paymentMethod === "eWallet") {
    try {
      return await spendFromWalletService({
        userId: userId!,
        amount: totalAmount,
        wishlistId,
        lineItems: reserved,
      });
    } catch (error) {
      await rollbackReservations(reserved);
      throw error;
    }
  }

  // Stripe/MPesa: create the Pending payment + its line items first.
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      purpose: "ItemPurchase",
      wishlistId,
      userId: userId ?? null,
      guestName: userId ? null : guestName ?? null,
      totalAmount,
      paymentStatus: "Pending",
      paymentMethod,
      phone: normalizedPhone,
      retryToken: paymentMethod === "MPesa" ? generateRetryToken() : undefined,
    } as TIPayments)
    .returning();

  await db.insert(paymentItemsTable).values(
    reserved.map((r) => ({
      paymentId: payment.paymentId,
      itemId: r.itemId,
      quantity: r.quantity,
      unitPriceSnapshot: r.unitPriceSnapshot,
    }))
  );

  if (paymentMethod !== "MPesa") {
    // Stripe (or any future non-instant, non-MPesa method): hand back the
    // Pending payment; actual confirmation still comes through the webhook.
    return { message: "Payment created ✅", data: payment };
  }

  try {
    const { CheckoutRequestID } = await initiateGatewayStkPush({
      phone: normalizedPhone!,
      amount: Number(totalAmount),
      orderRef: String(payment.paymentId),
      description: "Wishlist checkout",
    });

    const [updated] = await db
      .update(paymentsTable)
      .set({ gatewayReference: CheckoutRequestID })
      .where(eq(paymentsTable.paymentId, payment.paymentId))
      .returning();

    return { message: "STK push sent ✅", data: updated ?? payment };
  } catch (error: any) {
    // Gateway rejected the push outright — release the stock hold now rather
    // than waiting for a webhook that will never arrive, and mark Failed.
    await rollbackReservations(reserved);
    const [failed] = await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, payment.paymentId))
      .returning();

    return {
      status: 502,
      error: error.response?.data?.error ?? error.message,
      paymentId: payment.paymentId,
      retryToken: failed?.retryToken ?? payment.retryToken,
    };
  }
};

const rollbackReservations = async (reserved: { itemId: number; quantity: number }[]) => {
  for (const r of reserved) {
    await releaseItemStockService(r.itemId, r.quantity);
  }
};

// ==========================
// Wallet: donate (open amount, via gateway) and spend (instant, own balance)
// ==========================

// Open-amount donation into targetUserId's wallet. Goes through the same
// MPesa/Stripe flow as item checkout; the wallet is only credited once the
// webhook confirms success (see handleGatewayWebhookService).
export const donateToWalletService = async (params: {
  targetUserId: number;
  amount: string;
  paymentMethod: "Stripe" | "MPesa";
  userId?: number;
  guestName?: string;
  phone?: string;
}) => {
  const { targetUserId, amount, paymentMethod, userId, guestName, phone } = params;

  if (Number(amount) <= 0) throw new Error("Donation amount must be greater than zero");

  const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.userId, targetUserId) });
  if (!targetUser) throw new Error("Target wallet owner not found");

  let normalizedPhone: string | undefined;
  if (paymentMethod === "MPesa") {
    if (!phone) throw new Error("phone is required for MPesa payments");
    normalizedPhone = normalizePhoneNumber(phone);
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      purpose: "WalletDonation",
      targetUserId,
      userId: userId ?? null,
      guestName: userId ? null : guestName ?? null,
      totalAmount: amount,
      paymentStatus: "Pending",
      paymentMethod,
      phone: normalizedPhone,
      retryToken: paymentMethod === "MPesa" ? generateRetryToken() : undefined,
    } as TIPayments)
    .returning();

  if (paymentMethod !== "MPesa") {
    return { message: "Donation payment created ✅", data: payment };
  }

  try {
    const { CheckoutRequestID } = await initiateGatewayStkPush({
      phone: normalizedPhone!,
      amount: Number(amount),
      orderRef: String(payment.paymentId),
      description: "Wallet donation",
    });

    const [updated] = await db
      .update(paymentsTable)
      .set({ gatewayReference: CheckoutRequestID })
      .where(eq(paymentsTable.paymentId, payment.paymentId))
      .returning();

    return { message: "STK push sent ✅", data: updated ?? payment };
  } catch (error: any) {
    const [failed] = await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, payment.paymentId))
      .returning();

    return {
      status: 502,
      error: error.response?.data?.error ?? error.message,
      paymentId: payment.paymentId,
      retryToken: failed?.retryToken ?? payment.retryToken,
    };
  }
};

// Pay for items using the payer's own wallet balance. Synchronous — no
// gateway, no webhook. Stock must already be reserved by the caller
// (checkoutService) before this runs.
const spendFromWalletService = async (params: {
  userId: number;
  amount: string;
  wishlistId: number;
  lineItems: { itemId: number; quantity: number; unitPriceSnapshot: string }[];
}) => {
  const { userId, amount, wishlistId, lineItems } = params;

  const payer = await db.query.usersTable.findFirst({ where: eq(usersTable.userId, userId) });
  if (!payer) throw new Error("Payer not found");
  if (Number(payer.amount) < Number(amount)) {
    throw new InsufficientWalletBalanceError("Insufficient wallet balance");
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      purpose: "WalletSpend",
      wishlistId,
      userId,
      totalAmount: amount,
      paymentStatus: "Completed",
      paymentMethod: "eWallet",
    } as TIPayments)
    .returning();

  await db.insert(paymentItemsTable).values(
    lineItems.map((r) => ({
      paymentId: payment.paymentId,
      itemId: r.itemId,
      quantity: r.quantity,
      unitPriceSnapshot: r.unitPriceSnapshot,
    }))
  );

  await db
    .update(usersTable)
    .set({ amount: (Number(payer.amount) - Number(amount)).toFixed(2) })
    .where(eq(usersTable.userId, userId));

  await db.insert(walletTransactionsTable).values({
    userId,
    type: "Spend",
    amount,
    relatedPaymentId: payment.paymentId,
  });

  return { message: "Paid from wallet ✅", data: payment };
};

// ==========================
// Payment Services (reads/deletes)
// ==========================

export const getAllPaymentsService = async () => {
  return await db.query.paymentsTable.findMany();
};

export const getPaymentByIDService = async (paymentId: number) => {
  return await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.paymentId, paymentId),
    with: { items: true },
  });
};

export const getPaymentsByUserIDService = async (userId: number) => {
  return await db.query.paymentsTable.findMany({
    where: eq(paymentsTable.userId, userId),
  });
};

// Payments touching a given item (via payment_items) — replaces the old
// direct paymentsTable.itemId lookup.
export const getPaymentsByItemIDService = async (itemId: number) => {
  return await db
    .select({
      paymentId: paymentsTable.paymentId,
      paymentStatus: paymentsTable.paymentStatus,
      paymentMethod: paymentsTable.paymentMethod,
      totalAmount: paymentsTable.totalAmount,
      createdAt: paymentsTable.createdAt,
      quantity: paymentItemsTable.quantity,
      unitPriceSnapshot: paymentItemsTable.unitPriceSnapshot,
    })
    .from(paymentItemsTable)
    .innerJoin(paymentsTable, eq(paymentItemsTable.paymentId, paymentsTable.paymentId))
    .where(eq(paymentItemsTable.itemId, itemId));
};

export const deletePaymentService = async (paymentId: number) => {
  const deletedPayment = await db
    .delete(paymentsTable)
    .where(eq(paymentsTable.paymentId, paymentId))
    .returning();

  return deletedPayment;
};

// ==========================
// Paybill Gateway — webhook + retry
// ==========================

export const verifyGatewaySignature = (
  rawBody: Buffer,
  signature: string | undefined
) => {
  if (!signature || !rawBody) return false;
  const expected = crypto
    .createHmac("sha256", process.env.GATEWAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};

// Resolve a Pending payment from the gateway's webhook callback. Branches on
// `purpose`: ItemPurchase just confirms/releases a stock hold that was
// already applied at checkout; WalletDonation credits the target wallet here
// (only on confirmed success — never before).
export const handleGatewayWebhookService = async (payload: {
  CheckoutRequestID: string;
  status: "success" | "failed";
  mpesaReceipt: string | null;
}) => {
  const payment = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.gatewayReference, payload.CheckoutRequestID),
    with: { items: true },
  });
  if (!payment) return; // not found: log it, let the controller 200 anyway
  if (payment.paymentStatus !== "Pending") return; // already resolved, ignore

  if (payload.status === "success") {
    await db
      .update(paymentsTable)
      .set({
        paymentStatus: "Completed",
        transactionID: payload.mpesaReceipt ?? undefined,
      })
      .where(eq(paymentsTable.paymentId, payment.paymentId));

    if (payment.purpose === "WalletDonation" && payment.targetUserId) {
      const target = await db.query.usersTable.findFirst({ where: eq(usersTable.userId, payment.targetUserId) });
      if (target) {
        await db
          .update(usersTable)
          .set({ amount: (Number(target.amount) + Number(payment.totalAmount)).toFixed(2) })
          .where(eq(usersTable.userId, payment.targetUserId));

        await db.insert(walletTransactionsTable).values({
          userId: payment.targetUserId,
          type: "Donation",
          amount: payment.totalAmount,
          relatedPaymentId: payment.paymentId,
        });
      }
    }
    // ItemPurchase: nothing left to do — stock was already decremented at checkout.
  } else {
    await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, payment.paymentId));

    if (payment.purpose === "ItemPurchase") {
      for (const line of payment.items) {
        await releaseItemStockService(line.itemId, line.quantity);
      }
    }
  }
};

// Re-initiate an STK push for a previously Failed payment. providedToken must
// match the retryToken issued at creation — the no-login proof-of-possession
// check standing in for auth. Stock was released on the original failure, so
// this re-reserves it now and can legitimately fail if someone else bought
// the remaining stock in the meantime.
export const retryPaymentService = async (
  paymentId: number,
  providedToken: string | undefined
) => {
  const payment = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.paymentId, paymentId),
    with: { items: true },
  });
  if (!payment) throw new PaymentNotFoundError();
  if (payment.paymentStatus !== "Failed") throw new PaymentAlreadyInitiatedError();
  if (!providedToken || providedToken !== payment.retryToken) {
    throw new RetryTokenMismatchError();
  }
  if (!payment.phone) throw new Error("No phone number stored for this payment");

  // Re-reserve stock for ItemPurchase retries; WalletDonation has no stock.
  const reserved: { itemId: number; quantity: number }[] = [];
  if (payment.purpose === "ItemPurchase") {
    for (const line of payment.items) {
      const updated = await reserveItemStockService(line.itemId, line.quantity);
      if (!updated) {
        await rollbackReservations(reserved);
        throw new InsufficientStockError(line.itemId);
      }
      reserved.push({ itemId: line.itemId, quantity: line.quantity });
    }
  }

  try {
    const { CheckoutRequestID } = await initiateGatewayStkPush({
      phone: normalizePhoneNumber(payment.phone),
      amount: Number(payment.totalAmount),
      orderRef: String(payment.paymentId),
    });

    // Rotate the token so a used-once retry link can't be replayed
    const nextRetryToken = generateRetryToken();

    await db
      .update(paymentsTable)
      .set({
        gatewayReference: CheckoutRequestID,
        paymentStatus: "Pending",
        retryToken: nextRetryToken,
      })
      .where(eq(paymentsTable.paymentId, paymentId));

    return { paymentId, retryToken: nextRetryToken };
  } catch (error) {
    await rollbackReservations(reserved);
    await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, paymentId));
    throw error;
  }
};

// ==========================
// Stale hold cleanup
// ==========================
//
// A payment can go Pending -> (gateway never calls the webhook: user closed
// the STK prompt, network drop, etc.) and sit there forever holding stock.
// There's no cron runner wired up in this project, so this is exposed as a
// plain function an external scheduler (a hosted cron hitting an admin route,
// or a `setInterval` in index.ts) can call periodically.
export const expireStalePendingPaymentsService = async () => {
  const cutoff = new Date(Date.now() - PENDING_HOLD_TTL_MS);

  const stale = await db.query.paymentsTable.findMany({
    where: and(eq(paymentsTable.paymentStatus, "Pending"), eq(paymentsTable.purpose, "ItemPurchase")),
    with: { items: true },
  });

  const toExpire = stale.filter((p) => p.createdAt < cutoff);

  for (const payment of toExpire) {
    for (const line of payment.items) {
      await releaseItemStockService(line.itemId, line.quantity);
    }
    await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, payment.paymentId));
  }

  return { expiredCount: toExpire.length };
};
