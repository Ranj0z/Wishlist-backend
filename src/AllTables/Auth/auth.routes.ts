import { Router } from "express";
import {
  createUserController,
  deleteUserController,
  getAllUsersController,
  getUserByIdController,
  loginUserController,
  updateUserController,
  updateUserToAdminController,
  verifyUserController,
} from "./auth.controller";

const router = Router();

// ==========================
// Auth Routes
// ==========================

// Register
router.post("/auth/register", createUserController);

// Login
router.post("/auth/login", loginUserController);

// Verify user
router.post("/auth/verify", verifyUserController);

// ==========================
// User Management Routes
// ==========================

// Get all users
router.get("/users", getAllUsersController);

// Get user by ID
router.get("/users/:id", getUserByIdController);

// Update user by ID
router.patch("/users/:id", updateUserController);

// Update user to admin
router.patch("/users/admin/:id", updateUserToAdminController);

// Delete user by ID
router.delete("/users/:id", deleteUserController);

export default router;
