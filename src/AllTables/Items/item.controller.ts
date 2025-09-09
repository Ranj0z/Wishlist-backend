import { Request, Response } from "express";
import {
  createItemService,
  deleteItemService,
  getAllItemsService,
  getItemByIDService,
  getItemsByUserIDService,
  getItemsByWishlistIDService,
  updateItemService,
} from "./item.service";

// ==========================
// Item Controllers
// ==========================

// Create Item
export const createItemController = async (req: Request, res: Response) => {
  try {
    const newItem = req.body;
    const created = await createItemService(newItem);

    if (!created) {
      return res.status(400).json({ message: "Item not created" });
    }

    return res.status(201).json({ message: "Item created successfully ✅", data: created });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get All Items
export const getAllItemsController = async (req: Request, res: Response) => {
  try {
    const items = await getAllItemsService();
    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No items found" });
    }
    return res.status(200).json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Item By ID
export const getItemByIDController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const item = await getItemByIDService(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.status(200).json({ data: item });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Items by Wishlist ID
export const getItemsByWishlistIDController = async (req: Request, res: Response) => {
  try {
    const wishlistId = parseInt(req.params.wishlistId);
    if (isNaN(wishlistId)) {
      return res.status(400).json({ message: "Invalid Wishlist ID format" });
    }

    const items = await getItemsByWishlistIDService(wishlistId);
    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No items found for this wishlist" });
    }

    return res.status(200).json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Items by User ID (via Payments)
export const getItemsByUserIDController = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const items = await getItemsByUserIDService(userId);
    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No items found for this user" });
    }

    return res.status(200).json({ data: items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Update Item by ID
export const updateItemController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const updatedData = req.body;
    const updated = await updateItemService(id, updatedData);

    if (!updated) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.status(200).json({ message: "Item updated successfully ✅", data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Delete Item by ID
export const deleteItemController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const deleted = await deleteItemService(id);
    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ message: "Item not found or already deleted" });
    }

    return res.status(200).json({ message: "Item deleted successfully ✅" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
