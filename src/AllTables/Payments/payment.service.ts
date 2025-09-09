import { eq } from "drizzle-orm";
import db from "../../Drizzle/db";
import { paymentsTable, TIPayments } from "../../Drizzle/schema";

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
