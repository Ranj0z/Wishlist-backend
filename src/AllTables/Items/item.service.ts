import { and, eq, gte, inArray, sql } from "drizzle-orm";
import db from "../../Drizzle/db";
import { itemsTable, wishlistsTable, paymentsTable, paymentItemsTable, TIItems } from "../../Drizzle/schema";

// ==========================
// Item Services
// ==========================

// Create Item
export const createItemService = async (newItem: TIItems) => {
  const [created] = await db
    .insert(itemsTable)
    .values(newItem)
    .returning();
  return created; // now you have itemId, wishlistId, etc.
};

// Get All Items
export const getAllItemsService = async () => {
  return await db.query.itemsTable.findMany();
};

// Get Item By ID
export const getItemByIDService = async (itemId: number) => {
  return await db.query.itemsTable.findFirst({
    where: eq(itemsTable.itemId, itemId),
  });
};

// Get Items By WishlistID
export const getItemsByWishlistIDService = async (wishlistId: number) => {
  return await db.query.itemsTable.findMany({
    where: eq(itemsTable.wishlistId, wishlistId),
  });
};

// Get Items by UserID (via Payments -> PaymentItems, now that a payment can cover several items)
export const getItemsByUserIDService = async (userId: number) => {
  // Step 1: Get payment_items rows for payments made by this user
  const userPaymentItems = await db
    .select({ itemId: paymentItemsTable.itemId })
    .from(paymentItemsTable)
    .innerJoin(paymentsTable, eq(paymentItemsTable.paymentId, paymentsTable.paymentId))
    .where(eq(paymentsTable.userId, userId));

  const itemIds = [...new Set(userPaymentItems.map((p) => p.itemId))];

  if (itemIds.length === 0) return [];

  // Step 2: Get Items for those itemIds
  const items = await db
    .select()
    .from(itemsTable)
    .where(inArray(itemsTable.itemId, itemIds));

  return items;
};

// ==========================
// Stock reservation (checkout soft-holds stock immediately; released on
// payment failure/expiry, never touched again on success since it was
// already decremented here).
// ==========================

// Atomically decrement stock only if enough remains. Returns the updated row,
// or undefined if there wasn't enough stock (caller must treat that as a
// rejected line and not proceed).
export const reserveItemStockService = async (itemId: number, quantity: number) => {
  const [updated] = await db
    .update(itemsTable)
    .set({
      quantity: sql`${itemsTable.quantity} - ${quantity}`,
      updatedAt: new Date(),
    })
    .where(and(eq(itemsTable.itemId, itemId), gte(itemsTable.quantity, quantity)))
    .returning();

  if (updated && updated.quantity === 0) {
    await db
      .update(itemsTable)
      .set({ productStatus: true })
      .where(eq(itemsTable.itemId, itemId));
  }

  return updated;
};

// Restore stock previously held by reserveItemStockService (payment failed,
// expired, or was rejected before the gateway was ever contacted).
export const releaseItemStockService = async (itemId: number, quantity: number) => {
  const [updated] = await db
    .update(itemsTable)
    .set({
      quantity: sql`${itemsTable.quantity} + ${quantity}`,
      productStatus: false,
      updatedAt: new Date(),
    })
    .where(eq(itemsTable.itemId, itemId))
    .returning();

  return updated;
};

// Update Item By ID
export const updateItemService = async (itemId: number, updatedItem: Partial<TIItems>) => {
  const [updated] = await db
    .update(itemsTable)
    .set(updatedItem)
    .where(eq(itemsTable.itemId, itemId))
    .returning();

  return updated;
};

// Delete Item By ID
export const deleteItemService = async (itemId: number) => {
  const deletedItem = await db
    .delete(itemsTable)
    .where(eq(itemsTable.itemId, itemId))
    .returning();

  return deletedItem;
};
