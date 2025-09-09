import { eq, inArray } from "drizzle-orm";
import db from "../../Drizzle/db";
import { itemsTable, wishlistsTable, paymentsTable, TIItems } from "../../Drizzle/schema";

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

// Get Items by UserID (via Payments)
export const getItemsByUserIDService = async (userId: number) => {
  // Step 1: Get payments for this user
  const userPayments = await db
    .select({ itemId: paymentsTable.itemId })
    .from(paymentsTable)
    .where(eq(paymentsTable.userId, userId));

  const itemIds = userPayments.map((p) => p.itemId).filter((id): id is number => !!id);

  if (itemIds.length === 0) return [];

  // Step 2: Get Items for those itemIds
  const items = await db
    .select()
    .from(itemsTable)
    .where(inArray(itemsTable.itemId, itemIds));

  return items;
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
