import { Router } from "express";
import {
  createItemController,
  deleteItemController,
  getAllItemsController,
  getItemByIDController,
  getItemsByUserIDController,
  getItemsByWishlistIDController,
  updateItemController,
} from "./item.controller";

const router = Router();

// ==========================
// Item Routes
// ==========================

// Create a new item
router.post("/items", createItemController);

// Get all items
router.get("/items", getAllItemsController);

// Get item by ID
router.get("/items/:id", getItemByIDController);

// Get items by wishlist ID
router.get("/items/wishlists/:wishlistId", getItemsByWishlistIDController);

// Get items by user ID (via payments)
router.get("/items/users/:userId", getItemsByUserIDController);

// Update item by ID
router.put("/items/:id", updateItemController);

// Delete item by ID
router.delete("/items/:id", deleteItemController);

export default router;
