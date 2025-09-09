import { Router } from "express";
import {
  createWishlistController,
  deleteWishlistController,
  getAllWishlistsController,
  getWishlistByIDController,
  updateWishlistController,
  getItemsInWishlistController,
  getWishlistsByUserController,
} from "./wishlist.controller";

const router = Router();

// ==========================
// Wishlist Routes
// ==========================

// Create a new wishlist
router.post("/wishlists", createWishlistController);

// Get all wishlists
router.get("/wishlists", getAllWishlistsController);

// Get wishlist by ID
router.get("/wishlists/:id", getWishlistByIDController);

// Update wishlist by ID
router.put("/wishlists/:id", updateWishlistController);

// Delete wishlist by ID
router.delete("/wishlists/:id", deleteWishlistController);

// ==========================
// Nested Routes
// ==========================

// Get items inside a wishlist
router.get("/items/wishlist/:id", getItemsInWishlistController);

// Get wishlists under a user
router.get("/users/:userId/wishlists", getWishlistsByUserController);

export default router;
