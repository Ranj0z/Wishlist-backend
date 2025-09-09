import { Request, Response } from "express";
import {
  createWishlistService,
  deleteWishlistService,
  getAllWishlistsService,
  getWishlistByIDService,
  updateWishlistService,
} from "./wishlist.service";
import { getItemsByWishlistIDService } from "../Items/item.service"; // reuse existing item service
import db from "../../Drizzle/db";
import { wishlistsTable } from "../../Drizzle/schema";
import { eq } from "drizzle-orm";

// ==========================
// Wishlist Controllers
// ==========================

// Create Wishlist
export const createWishlistController = async (req: Request, res: Response) => {
  try {
    const newWishlist = req.body;
    const created = await createWishlistService(newWishlist);

    if (!created) {
      return res.status(400).json({ message: "Wishlist not created" });
    }

    return res
      .status(201)
      .json({ message: "Wishlist created successfully ✅", data: created });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get All Wishlists
export const getAllWishlistsController = async (req: Request, res: Response) => {
  try {
    const wishlists = await getAllWishlistsService();
    if (!wishlists || wishlists.length === 0) {
      return res.status(404).json({ message: "No wishlists found" });
    }
    return res.status(200).json({ data: wishlists });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Wishlist by ID
export const getWishlistByIDController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const wishlist = await getWishlistByIDService(id);
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    return res.status(200).json({ data: wishlist });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Update Wishlist
export const updateWishlistController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const updatedData = req.body;
    const updated = await updateWishlistService(id, updatedData);

    if (!updated) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    return res
      .status(200)
      .json({ message: "Wishlist updated successfully ✅", data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Delete Wishlist
export const deleteWishlistController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const deleted = await deleteWishlistService(id);
    if (!deleted || deleted.length === 0) {
      return res
        .status(404)
        .json({ message: "Wishlist not found or already deleted" });
    }

    return res.status(200).json({ message: "Wishlist deleted successfully ✅" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// ==========================
// Nested Controllers
// ==========================

// Get Items inside a Wishlist
export const getItemsInWishlistController = async (req: Request, res: Response) => {
  try {
    const wishlistId = parseInt(req.params.id);
    if (isNaN(wishlistId)) {
      return res.status(400).json({ message: "Invalid Wishlist ID format" });
    }

    const items = await getItemsByWishlistIDService(wishlistId);
    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No items found in this wishlist" });
    }

    return res.status(200).json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Wishlists under a User
export const getWishlistsByUserController = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const wishlists = await db.query.wishlistsTable.findMany({
      where: eq(wishlistsTable.userId, userId),
    });

    if (!wishlists || wishlists.length === 0) {
      return res.status(404).json({ message: "No wishlists found for this user" });
    }

    return res.status(200).json({ data: wishlists });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
