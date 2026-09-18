import crypto from "crypto";
import { eq } from "drizzle-orm";
import db from "../../Drizzle/db";
import { paymentsTable, TIPayments } from "../../Drizzle/schema";
import { initiateGatewayStkPush } from "../../lib/paybillGateway";
import { normalizePhoneNumber } from "../../utils/normalizePhoneNumber";

// ==========================
// Payment Errors
// ==========================
export class PaymentNotFoundError extends Error {}
export class PaymentAlreadyInitiatedError extends Error {}
export class RetryTokenMismatchError extends Error {}

// Random opaque secret returned to the payer at creation; required to retry later
export const generateRetryToken = () => crypto.randomBytes(24).toString("hex");

// ==========================
// Payment Services
// ==========================

// Create a new Payment
export const createPaymentService = async (payment: TIPayments) => {
  const [newPayment] = await db
    .insert(paymentsTable)
    .values(payment)
    .returning();

  return newPayment;
};

// Get All Payments
export const getAllPaymentsService = async () => {
  return await db.query.paymentsTable.findMany();
};

// Get Payment By ID
export const getPaymentByIDService = async (paymentId: number) => {
  return await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.paymentId, paymentId),
  });
};

// Get Payments By UserID
export const getPaymentsByUserIDService = async (userId: number) => {
  return await db.query.paymentsTable.findMany({
    where: eq(paymentsTable.userId, userId),
  });
};

// Get Payments By ItemID
export const getPaymentsByItemIDService = async (itemId: number) => {
  return await db.query.paymentsTable.findMany({
    where: eq(paymentsTable.itemId, itemId),
  });
};

// Delete Payment By ID
export const deletePaymentService = async (paymentId: number) => {
  const deletedPayment = await db
    .delete(paymentsTable)
    .where(eq(paymentsTable.paymentId, paymentId))
    .returning();

  return deletedPayment;
};

// ==========================
// Paybill Gateway Services
// ==========================

// Store the gateway's CheckoutRequestID against a payment row
export const setGatewayReferenceService = async (
  paymentId: number,
  gatewayReference: string
) => {
  const [updated] = await db
    .update(paymentsTable)
    .set({ gatewayReference })
    .where(eq(paymentsTable.paymentId, paymentId))
    .returning();

  return updated;
};

// Mark a payment row Failed (kept, never deleted — audit trail)
export const markPaymentFailedService = async (paymentId: number) => {
  const [updated] = await db
    .update(paymentsTable)
    .set({ paymentStatus: "Failed" })
    .where(eq(paymentsTable.paymentId, paymentId))
    .returning();

  return updated;
};

// Verify the X-Signature header against the raw request body
export const verifyGatewaySignature = (
  rawBody: Buffer,
  signature: string | undefined
) => {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.GATEWAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};

// Resolve a Pending payment from the gateway's webhook callback
export const handleGatewayWebhookService = async (payload: {
  CheckoutRequestID: string;
  status: "success" | "failed";
  mpesaReceipt: string | null;
}) => {
  const payment = await db.query.paymentsTable.findFirst({
    where: eq(paymentsTable.gatewayReference, payload.CheckoutRequestID),
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
  } else {
    await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, payment.paymentId));
  }
};

// Re-initiate an STK push for a previously Failed payment.
// providedToken must match the retryToken issued at creation — this is the
// no-login proof-of-possession check standing in for auth.
export const retryPaymentService = async (
  paymentId: number,
  providedToken: string | undefined
) => {
  const payment = await getPaymentByIDService(paymentId);
  if (!payment) throw new PaymentNotFoundError();
  if (payment.paymentStatus !== "Failed") throw new PaymentAlreadyInitiatedError();
  if (!providedToken || providedToken !== payment.retryToken) {
    throw new RetryTokenMismatchError();
  }
  if (!payment.phone) throw new Error("No phone number stored for this payment");

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
    await db
      .update(paymentsTable)
      .set({ paymentStatus: "Failed" })
      .where(eq(paymentsTable.paymentId, paymentId));
    throw error;
  }
};