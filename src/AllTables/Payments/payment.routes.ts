import { Express } from "express";
import {
  createPaymentController,
  deletePaymentController,
  gatewayWebhookController,
  getAllPaymentsController,
  getPaymentByIDController,
  getPaymentsByItemController,
  getPaymentsByUserController,
  retryPaymentController,
} from "./payment.controller";
import { requireAdmin, requireAuth } from "../../middleware/tokenAuth";

// ==========================
// Payment Routes
// ==========================
// NOTE: mounted directly on `app`, without the /api/v1 prefix used by the
// Auth/Wishlists/Items routers. Intentional, payments-only inconsistency.

const paymentRoutes = (app: Express) => {
  // Create a new payment (fires the gateway STK push when paymentMethod is MPesa)
  app.route("/payments").post(async (req, res, next) => {
    try {
      await createPaymentController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Get all payments
  app.route("/payments").get(requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await getAllPaymentsController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Gateway webhook — no auth, verified by HMAC signature
  app.route("/payments/gateway-webhook").post(async (req, res, next) => {
    try {
      await gatewayWebhookController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Get payments by User ID
  app.route("/payments/users/:userId").get(async (req, res, next) => {
    try {
      await getPaymentsByUserController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Get payments by Item ID
  app.route("/payments/items/:itemId").get(async (req, res, next) => {
    try {
      await getPaymentsByItemController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Retry a Failed payment
  app.route("/payments/:id/retry").post(requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await retryPaymentController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Get payment by ID
  app.route("/payments/:id").get(async (req, res, next) => {
    try {
      await getPaymentByIDController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Delete payment by ID
  app.route("/payments/:id").delete(requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await deletePaymentController(req, res);
    } catch (error) {
      next(error);
    }
  });
};

export default paymentRoutes;