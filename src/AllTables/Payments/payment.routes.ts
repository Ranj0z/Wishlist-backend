import { Router } from "express";
import {
  createPaymentController,
  deletePaymentController,
  getAllPaymentsController,
  getPaymentByIDController,
  getPaymentsByItemController,
  getPaymentsByUserController,
} from "./payment.controller";

const router = Router();

// ==========================
// Payment Routes
// ==========================

// Create a new payment
router.post("/payments", createPaymentController);

// Get all payments
router.get("/payments", getAllPaymentsController);

// Get payment by ID
router.get("/payments/:id", getPaymentByIDController);

// Get payments by User ID
router.get("/payments/users/:userId", getPaymentsByUserController);

// Get payments by Item ID
router.get("/payments/items/:itemId", getPaymentsByItemController);

// Delete payment by ID
router.delete("/payments/:id", deletePaymentController);

export default router;
