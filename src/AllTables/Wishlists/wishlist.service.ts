import { eq } from "drizzle-orm";
import db from "../../Drizzle/db";
import { TIWishlists, wishlistsTable } from "../../Drizzle/schema";

// ==========================
// Wishlist Services
// ==========================

// Create a new Wishlist
export const createWishlistService = async (newWishlist: TIWishlists) => {
  const [createdWishlist] = await db
    .insert(wishlistsTable)
    .values(newWishlist)
    .returning(); // returns inserted row(s) including serial wishlistId

  return createdWishlist;
};

// Get All Wishlists
export const getAllWishlistsService = async () => {
  const allWishlists = await db.query.wishlistsTable.findMany();
  return allWishlists;
};

// Get Wishlist By ID
export const getWishlistByIDService = async (wishlistId: number) => {
  const wishlistByID = await db.query.wishlistsTable.findFirst({
    where: eq(wishlistsTable.wishlistId, wishlistId),
  });
  return wishlistByID;
};

// Update Wishlist By ID
export const updateWishlistService = async (
  wishlistId: number,
  updatedData: Partial<TIWishlists>
) => {
  const [updated] = await db
    .update(wishlistsTable)
    .set(updatedData)
    .where(eq(wishlistsTable.wishlistId, wishlistId))
    .returning();

  return updated;
};

// Delete Wishlist By ID
export const deleteWishlistService = async (wishlistId: number) => {
  const deletedWishlist = await db
    .delete(wishlistsTable)
    .where(eq(wishlistsTable.wishlistId, wishlistId))
    .returning();

  return deletedWishlist;
};
