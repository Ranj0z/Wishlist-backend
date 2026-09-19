import { Express } from "express";
import {
  checkoutController,
  deletePaymentController,
  donateController,
  expireStalePaymentsController,
  gatewayWebhookController,
  getAllPaymentsController,
  getPaymentByIDController,
  getPaymentsByItemController,
  getPaymentsByUserController,
  retryPaymentController,
} from "./payment.controller";
import { optionalAuth, requireAdmin, requireAuth } from "../../middleware/tokenAuth";

// ==========================
// Payment Routes
// ==========================
// NOTE: mounted directly on `app`, without the /api/v1 prefix used by the
// Auth/Wishlists/Items routers. Intentional, payments-only inconsistency.

const paymentRoutes = (app: Express) => {
  // Checkout — pick multiple items from one wishlist, pay the total in one
  // call. No login required (optionalAuth attaches req.user if a token is
  // present, but never rejects the request).
  app.route("/wishlists/:wishlistId/checkout").post(optionalAuth, async (req, res, next) => {
    try {
      req.body.wishlistId = req.params.wishlistId;
      await checkoutController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Donate an open amount to a user's wallet.
  app.route("/wallet/:targetUserId/donate").post(optionalAuth, async (req, res, next) => {
    try {
      req.body.targetUserId = req.params.targetUserId;
      await donateController(req, res);
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

  // Retry a Failed payment — requires the retryToken issued at creation, no login
  app.route("/payments/:id/retry").post(async (req, res, next) => {
    try {
      await retryPaymentController(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Release stock holds for abandoned Pending payments. Meant for an
  // external scheduler to call periodically — admin-gated since it's not a
  // user-facing action.
  app.route("/payments/expire-stale").post(requireAuth, requireAdmin, async (req, res, next) => {
    try {
      await expireStalePaymentsController(req, res);
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
